package com.dsbuilder.app.data.aitools

import com.dsbuilder.ai.chat.domain.ToolResult
import com.dsbuilder.ds.core.application.DsFailure
import com.dsbuilder.ds.designsystems.application.ListDesignSystemTokensUseCase
import com.dsbuilder.ds.designsystems.domain.DesignSystemId
import com.dsbuilder.ds.designsystems.presentation.DesignSystemTokenSummaryResponse
import com.dsbuilder.ds.themes.application.tokengroups.ListTokenGroupsUseCase
import com.dsbuilder.ds.themes.domain.tokengroups.TokenGroupKind
import com.dsbuilder.ds.themes.presentation.tokengroups.TokenGroupDto
import com.dsbuilder.ds.tokens.application.GetTokenUseCase
import com.dsbuilder.ds.tokens.application.GetTokenValuesUseCase
import com.dsbuilder.ds.tokens.application.TokenValueFilter
import com.dsbuilder.ds.tokens.application.UpdateTokenValue
import com.dsbuilder.ds.tokens.application.UpdateTokenValueUseCase
import com.dsbuilder.ds.tokens.domain.TokenMode
import com.dsbuilder.ds.tokens.domain.TokenPlatform
import com.dsbuilder.ds.tokens.domain.TokenValue
import com.dsbuilder.ds.tokens.presentation.TokenResponse
import com.dsbuilder.ds.tokens.presentation.TokenValueResponse
import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.longOrNull
import kotlinx.serialization.json.put
import org.koin.core.Koin
import java.util.UUID

/** Обработчики инструментов чата этой области. */
internal fun tokenChatTools(koin: Koin): List<DsChatTool> = listOf(
    TokensListChatTool(koin.get()),
    TokenGetChatTool(koin.get()),
    TokenValuesGetChatTool(koin.get()),
    TokenGroupsListChatTool(koin.get()),
    TokenValueUpdateChatTool(koin.get()),
)

/** `tokens_list`: как `GET /design-systems/{id}/tokens` с фильтрами и страницей. */
private class TokensListChatTool(private val list: ListDesignSystemTokensUseCase) : DsChatTool {
    override val name = "tokens_list"

    override suspend fun run(arguments: JsonObject, call: DsToolCall): ToolResult {
        val type = arguments.text("type")
        val name = arguments.text("name")
        val query = arguments.text("query")
        val page = arguments.page()
        if (type != null && type !in TOKEN_TYPES) {
            return call.reject(DsFailure.InvalidRequest("Invalid token type '$type'"))
        }
        if (page == null || name != null && query != null) return call.reject(INVALID_QUERY)
        val read = page.copy(name = name, query = query, groupId = arguments.text("groupId"), type = type)
        val context = call.readContext().copy(readQuery = read)
        return call.respondPage(ListSerializer(DesignSystemTokenSummaryResponse.serializer())) {
            list.execute(context, DesignSystemId(call.designSystemId), type, query)
                .map { items -> items.map(DesignSystemTokenSummaryResponse::from) }
        }
    }
}

/** `token_get`: как `GET /design-systems/{id}/tokens/{tokenId}`. */
private class TokenGetChatTool(private val get: GetTokenUseCase) : DsChatTool {
    override val name = "token_get"

    override suspend fun run(arguments: JsonObject, call: DsToolCall): ToolResult {
        val id = arguments.uuid("tokenId") ?: return call.reject(INVALID_ID)
        return call.respond(
            { value -> Json.encodeToJsonElement(TokenResponse.serializer(), TokenResponse.from(value)) },
        ) { get.execute(call.readContext(), id) }
    }
}

/** `token_values_get`: как `GET /design-systems/{id}/tokens/{tokenId}/values` с фильтрами темы, платформы и режима. */
private class TokenValuesGetChatTool(private val getValues: GetTokenValuesUseCase) : DsChatTool {
    override val name = "token_values_get"

    override suspend fun run(arguments: JsonObject, call: DsToolCall): ToolResult {
        val id = arguments.uuid("tokenId") ?: return call.reject(INVALID_ID)
        val filter = runCatching {
            TokenValueFilter(
                tenantId = arguments.text("tenantId")?.let(UUID::fromString),
                platform = arguments.text("platform")?.let { requireNotNull(TokenPlatform.fromWire(it)) },
                mode = arguments.text("mode")?.let { requireNotNull(TokenMode.fromWire(it)) },
            )
        }.getOrNull() ?: return call.reject(DsFailure.InvalidRequest("invalid_query"))
        return call.respond(
            { values -> Json.encodeToJsonElement(TOKEN_VALUES, values.map(TokenValueResponse::from)) },
        ) { getValues.execute(call.readContext(), id, filter) }
    }
}

/** `token_groups_list`: как `GET /design-systems/{id}/token-groups` с видом, родителем и страницей. */
private class TokenGroupsListChatTool(private val list: ListTokenGroupsUseCase) : DsChatTool {
    override val name = "token_groups_list"

    override suspend fun run(arguments: JsonObject, call: DsToolCall): ToolResult {
        val kindWire = arguments.text("kind") ?: TokenGroupKind.COLOR.wireValue
        val kind = TokenGroupKind.fromWire(kindWire)
            ?: return call.reject(DsFailure.InvalidRequest("invalid_kind", message = "Неизвестный вид групп"))
        val parentId = arguments.text("parentId")
        val invalidParent = parentId != null && parentId.toUuid()?.toString() != parentId.lowercase()
        val page = arguments.page()
        if (page == null || invalidParent) return call.reject(INVALID_QUERY)
        val context = call.readContext().copy(readQuery = page.copy(parentId = parentId))
        return call.respondPage(ListSerializer(TokenGroupDto.serializer())) {
            list.execute(context, call.designSystemId, kind).map { groups -> groups.map(TokenGroupDto::from) }
        }
    }
}

/**
 * `token_value_update`: как `PATCH /design-systems/{id}/token-values/{valueId}`. Повтор через контекст: операция
 * `ai:token_value_update|token-value:{valueId}`, тело — переданные поля `value`/`paletteId` и `baseRevision`.
 */
private class TokenValueUpdateChatTool(private val update: UpdateTokenValueUseCase) : DsChatTool {
    override val name = "token_value_update"

    override suspend fun run(arguments: JsonObject, call: DsToolCall): ToolResult {
        val id = arguments.uuid("valueId") ?: return call.reject(INVALID_ID)
        val value = arguments["value"]
        val paletteWire = arguments["paletteId"]
        val paletteId = (paletteWire as? JsonPrimitive)?.takeIf { it.isString }?.content?.toUuid()
        val invalidBody = value is JsonNull || paletteWire != null && paletteId == null
        if (invalidBody) {
            return call.reject(
                DsFailure.InvalidRequest(
                    "invalid_body",
                    message = "value and paletteId must not be null; paletteId must be an ID. Omit a field to keep it.",
                ),
            )
        }
        val baseRevision = (arguments["baseRevision"] as? JsonPrimitive)?.longOrNull
        val body = buildJsonObject {
            value?.let { put("value", it) }
            paletteId?.let { put("paletteId", it.toString()) }
            baseRevision?.let { put("baseRevision", it) }
        }
        val command = UpdateTokenValue(
            paletteId = paletteId,
            paletteIdPresent = paletteId != null,
            platform = null,
            platformPresent = false,
            mode = null,
            modePresent = false,
            value = value,
            valuePresent = value != null,
        )
        val context = call.writeContext<TokenValue>(
            scope = "token-value:$id",
            body = body,
            encode = { encodeTokenValue(it).toString() },
            baseRevision = baseRevision,
        )
        return call.respond(::encodeTokenValue) { update.execute(context, id, command) }
    }
}

private fun encodeTokenValue(value: TokenValue): JsonElement =
    Json.encodeToJsonElement(TokenValueResponse.serializer(), TokenValueResponse.from(value))

private val TOKEN_TYPES = setOf("color", "gradient", "typography", "fontFamily", "spacing", "shape", "shadow")
private val TOKEN_VALUES = ListSerializer(TokenValueResponse.serializer())
private val INVALID_ID = DsFailure.InvalidRequest("invalid_id")
private val INVALID_QUERY = DsFailure.InvalidRequest("INVALID_QUERY")
