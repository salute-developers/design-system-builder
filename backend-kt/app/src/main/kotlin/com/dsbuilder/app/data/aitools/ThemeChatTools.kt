package com.dsbuilder.app.data.aitools

import com.dsbuilder.ai.chat.domain.ToolResult
import com.dsbuilder.ds.core.application.DsFailure
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.ModelReadQuery
import com.dsbuilder.ds.designsystems.application.ListDesignSystemTokensUseCase
import com.dsbuilder.ds.designsystems.domain.DesignSystemId
import com.dsbuilder.ds.designsystems.presentation.DesignSystemTokenSummaryResponse
import com.dsbuilder.ds.themes.application.GetTenantTokenValuesUseCase
import com.dsbuilder.ds.themes.application.GetTenantUseCase
import com.dsbuilder.ds.themes.application.ListTenantsUseCase
import com.dsbuilder.ds.themes.application.colortokens.ColorTokenMutation
import com.dsbuilder.ds.themes.application.colortokens.ColorTokenValue
import com.dsbuilder.ds.themes.application.colortokens.UpdateColorTokenValues
import com.dsbuilder.ds.themes.application.colortokens.UpdateColorTokenValuesUseCase
import com.dsbuilder.ds.themes.application.palette.GetTenantPaletteUseCase
import com.dsbuilder.ds.themes.application.sizetokens.UpdateSizeTokenValue
import com.dsbuilder.ds.themes.application.sizetokens.UpdateSizeTokenValueUseCase
import com.dsbuilder.ds.themes.application.sizetokens.UpdatedSizeToken
import com.dsbuilder.ds.themes.application.typography.TypographyBaseRevision
import com.dsbuilder.ds.themes.application.typography.UpdateTypographyStyle
import com.dsbuilder.ds.themes.application.typography.UpdateTypographyStyleUseCase
import com.dsbuilder.ds.themes.application.typography.UpdatedTypographyStyle
import com.dsbuilder.ds.themes.domain.ThemeTokenMode
import com.dsbuilder.ds.themes.domain.ThemeTokenPlatform
import com.dsbuilder.ds.themes.domain.ThemeTokenType
import com.dsbuilder.ds.themes.domain.sizetokens.SizeValueInput
import com.dsbuilder.ds.themes.domain.typography.TypographyVariant
import com.dsbuilder.ds.themes.presentation.TenantResponse
import com.dsbuilder.ds.themes.presentation.TenantTokenValueResponse
import com.dsbuilder.ds.themes.presentation.colortokens.ColorTokenValueItem
import com.dsbuilder.ds.themes.presentation.colortokens.UpdateColorTokenValuesRequest
import com.dsbuilder.ds.themes.presentation.sizetokens.UpdateSizeTokenValueRequest
import com.dsbuilder.ds.themes.presentation.typography.UpdateTypographyStyleRequest
import com.dsbuilder.ds.tokens.application.GetTokenUseCase
import com.dsbuilder.ds.tokens.presentation.TokenResponse
import kotlinx.serialization.KSerializer
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.longOrNull
import kotlinx.serialization.json.put
import org.koin.core.Koin
import java.util.UUID
import kotlin.coroutines.cancellation.CancellationException

/** Обработчики инструментов чата этой области. */
internal fun themeChatTools(koin: Koin): List<DsChatTool> = listOf(
    TenantsListChatTool(koin.get()),
    PaletteGetChatTool(koin.get()),
    TokenEditDataGetChatTool(koin.get(), koin.get(), koin.get(), koin.get()),
    ColorTokenValuesUpdateChatTool(koin.get()),
    SizeTokenValueUpdateChatTool(koin.get()),
    TypographyStyleUpdateChatTool(koin.get()),
)

/** `tenants_list`: `GET /tenants` с фильтрами `name`/`query` и страницей, как в `modelReadContext`. */
private class TenantsListChatTool(private val list: ListTenantsUseCase) : DsChatTool {
    override val name = "tenants_list"

    override suspend fun run(arguments: JsonObject, call: DsToolCall): ToolResult {
        val name = arguments.text("name")
        val query = arguments.text("query")
        val page = arguments.page()
        if (page == null || (name != null && query != null)) return call.reject(INVALID_QUERY)
        val context = call.readContext().copy(readQuery = page.copy(name = name, query = query))
        return call.respondPage(TENANTS) { list.execute(context).map { it.map(TenantResponse::from) } }
    }
}

/** `palette_get`: `GET /tenants/{tenantId}/palette`; принадлежность темы DS проверяет сам use case. */
private class PaletteGetChatTool(private val get: GetTenantPaletteUseCase) : DsChatTool {
    override val name = "palette_get"

    override suspend fun run(arguments: JsonObject, call: DsToolCall): ToolResult {
        val tenantId = arguments.uuid("tenantId") ?: return call.reject(INVALID_TENANT)
        val filter = ModelReadQuery(
            groupId = arguments.text("groupId"),
            type = arguments.text("type"),
            shade = arguments.text("shade"),
        )
        val context = call.readContext().copy(readQuery = filter)
        return call.respond(::encodeThemePalette) { get.execute(context, tenantId) }
    }
}

/**
 * `token_edit_data_get`: те же четыре чтения, что у одноимённого инструмента MCP, по очереди и с первым отказом
 * в ответе. Каждое чтение ограничено DS хода.
 */
private class TokenEditDataGetChatTool(
    private val getToken: GetTokenUseCase,
    private val getTenant: GetTenantUseCase,
    private val listTokens: ListDesignSystemTokensUseCase,
    private val getValues: GetTenantTokenValuesUseCase,
) : DsChatTool {
    override val name = "token_edit_data_get"

    override suspend fun run(arguments: JsonObject, call: DsToolCall): ToolResult {
        val tokenId = arguments.uuid("tokenId") ?: return call.reject(INVALID_TOKEN)
        val tenantId = arguments.uuid("tenantId") ?: return call.reject(INVALID_TENANT)
        val context = call.readContext()
        return call.respond({ data: JsonObject -> data }) {
            val token = when (val result = getToken.execute(context, tokenId)) {
                is DsResult.Failure -> return@respond result
                is DsResult.Success -> TokenResponse.from(result.value)
            }
            val tenant = when (val result = getTenant.execute(context, tenantId)) {
                is DsResult.Failure -> return@respond result
                is DsResult.Success -> TenantResponse.from(result.value)
            }
            val tokens = when (
                val result = listTokens.execute(context, DesignSystemId(call.designSystemId), null, null)
            ) {
                is DsResult.Failure -> return@respond result
                is DsResult.Success -> result.value.map(DesignSystemTokenSummaryResponse::from)
            }
            val values = when (val result = getValues.execute(context, tenantId)) {
                is DsResult.Failure -> return@respond result
                is DsResult.Success -> result.value.map(TenantTokenValueResponse::from)
            }
            DsResult.Success(encodeTokenEditData(token, tenant, tokens, values))
        }
    }
}

/** `color_token_values_update`: `PUT /tenants/{tenantId}/color-tokens/{tokenId}/values`. */
private class ColorTokenValuesUpdateChatTool(private val update: UpdateColorTokenValuesUseCase) : DsChatTool {
    override val name = "color_token_values_update"

    @Suppress("ReturnCount")
    override suspend fun run(arguments: JsonObject, call: DsToolCall): ToolResult {
        val tenantId = arguments.uuid("tenantId") ?: return call.reject(INVALID_TENANT)
        val tokenId = arguments.uuid("tokenId") ?: return call.reject(INVALID_TOKEN)
        val baseRevision = arguments.baseRevision() ?: return call.reject(INVALID_BASE_REVISION)
        val body = buildJsonObject {
            put("editRevision", arguments["editRevision"]?.takeUnless { it is JsonNull } ?: JsonPrimitive(0))
            arguments["members"]?.let { put("members", it) }
        }
        val command = body.decode(UpdateColorTokenValuesRequest.serializer())?.toCommand()
            ?: return call.reject(INVALID_BODY)
        val context = call.writeContext<ColorTokenMutation<ThemeTokenType>>(
            scope = "tenant:$tenantId|token:$tokenId",
            body = command,
            encode = { encodeColorTokenValues(it).toString() },
            baseRevision = baseRevision.value,
        )
        return call.respond(::encodeColorTokenValues) { update.execute(context, tenantId, tokenId, command) }
    }
}

/** `size_token_value_update`: `PUT /tenants/{tenantId}/size-tokens/{tokenId}/value`. */
private class SizeTokenValueUpdateChatTool(private val update: UpdateSizeTokenValueUseCase) : DsChatTool {
    override val name = "size_token_value_update"

    @Suppress("ReturnCount")
    override suspend fun run(arguments: JsonObject, call: DsToolCall): ToolResult {
        val tenantId = arguments.uuid("tenantId") ?: return call.reject(INVALID_TENANT)
        val tokenId = arguments.uuid("tokenId") ?: return call.reject(INVALID_TOKEN)
        val baseRevision = arguments.baseRevision() ?: return call.reject(INVALID_BASE_REVISION)
        val request = arguments.body(SIZE_FIELDS).decode(UpdateSizeTokenValueRequest.serializer())
            ?: return call.reject(INVALID_BODY)
        val baseRevisions = request.baseRevisions.orEmpty().entries.associate { (platform, revision) ->
            (ThemeTokenPlatform.fromWire(platform) ?: return call.reject(INVALID_SIZE_BASE_REVISION)) to revision
        }
        val command = UpdateSizeTokenValue(
            SizeValueInput(request.valuePx, request.layers, request.fallbackElevation, request.platforms),
            baseRevisions,
        )
        val context = call.writeContext<UpdatedSizeToken>(
            scope = "tenant:$tenantId|token:$tokenId",
            body = request,
            encode = { encodeUpdatedSizeToken(it).toString() },
            baseRevision = baseRevision.value,
        )
        return call.respond(::encodeUpdatedSizeToken) { update.execute(context, tenantId, tokenId, command) }
    }
}

/** `typography_style_update`: `PATCH /tenants/{tenantId}/typography-styles/{tokenId}`. */
private class TypographyStyleUpdateChatTool(private val update: UpdateTypographyStyleUseCase) : DsChatTool {
    override val name = "typography_style_update"

    @Suppress("ReturnCount")
    override suspend fun run(arguments: JsonObject, call: DsToolCall): ToolResult {
        val tenantId = arguments.uuid("tenantId") ?: return call.reject(INVALID_TENANT)
        val tokenId = arguments.uuid("tokenId") ?: return call.reject(INVALID_TOKEN)
        val baseRevision = arguments.baseRevision() ?: return call.reject(INVALID_BASE_REVISION)
        val request = arguments.body(TYPOGRAPHY_FIELDS).decode(UpdateTypographyStyleRequest.serializer())
            ?: return call.reject(INVALID_BODY)
        if (request.baseRevisions.orEmpty().any { it.baseRevision < 0 }) return call.reject(INVALID_BASE_REVISION)
        val command = request.toCommand() ?: return call.reject(INVALID_BODY)
        val context = call.writeContext<UpdatedTypographyStyle>(
            scope = "tenant:$tenantId|token:$tokenId",
            body = request,
            encode = { encodeUpdatedTypographyStyle(it).toString() },
            baseRevision = baseRevision.value,
        )
        return call.respond(::encodeUpdatedTypographyStyle) { update.execute(context, tenantId, tokenId, command) }
    }
}

/** Команда изменения цветов, как в `ColorTokenRoutes`; `null`, если идентификатор, платформа или режим не разобраны. */
private fun UpdateColorTokenValuesRequest.toCommand(): UpdateColorTokenValues? {
    val values = members.associate { member ->
        (member.tokenId.toUuid() ?: return null) to (member.values.toValues() ?: return null)
    }
    return if (values.size == members.size) UpdateColorTokenValues(editRevision, values) else null
}

private fun List<ColorTokenValueItem>.toValues(): List<ColorTokenValue>? = map { item ->
    if ((item.baseRevision ?: 0) < 0) return null
    ColorTokenValue(
        platform = ThemeTokenPlatform.fromWire(item.platform) ?: return null,
        mode = ThemeTokenMode.fromWire(item.mode) ?: return null,
        paletteId = item.paletteId?.let { it.toUuid() ?: return null },
        value = item.value,
        baseRevision = item.baseRevision,
        overridden = item.overridden,
    )
}

/** Команда изменения стиля, как в `TypographyStyleRoutes`; `null`, если начертание, токен или платформа неверны. */
@Suppress("ReturnCount")
private fun UpdateTypographyStyleRequest.toCommand(): UpdateTypographyStyle? {
    val variants = weights.orEmpty().mapKeys { (name, _) -> TypographyVariant.fromWire(name) ?: return null }
    val bases = baseRevisions.orEmpty().map { item ->
        TypographyBaseRevision(
            tokenId = item.tokenId.toUuid() ?: return null,
            platform = ThemeTokenPlatform.fromWire(item.platform) ?: return null,
            baseRevision = item.baseRevision,
        )
    }
    val target = platform?.let { ThemeTokenPlatform.fromWire(it) ?: return null }
    return UpdateTypographyStyle(
        platform = target,
        size = size,
        lineHeight = lineHeight,
        letterSpacing = letterSpacing,
        weights = variants,
        fontFamily = fontFamily,
        baseRevisions = bases,
    )
}

/** Общая базовая редакция, как заголовок `X-DS-Base-Revision`; `null` — недопустимое значение. */
private class ThemeBaseRevision(val value: Long?)

private fun JsonObject.baseRevision(): ThemeBaseRevision? {
    val raw = this["baseRevision"]?.takeUnless { it is JsonNull } ?: return ThemeBaseRevision(null)
    val revision = (raw as? JsonPrimitive)?.takeUnless { it.isString }?.longOrNull
    return revision?.takeIf { it >= 0 }?.let(::ThemeBaseRevision)
}

/** Тело запроса маршрута из аргументов модели: только поля тела, прочие (тема, токен, DS) отбрасываются. */
private fun JsonObject.body(fields: Set<String>): JsonObject = JsonObject(filterKeys { it in fields })

/** Разбор тела строгим `Json`, как `receive` маршрута; `null` — некорректное тело. */
private fun <T> JsonObject.decode(serializer: KSerializer<T>): T? = try {
    Json.decodeFromJsonElement(serializer, this)
} catch (cancelled: CancellationException) {
    throw cancelled
} catch (@Suppress("TooGenericExceptionCaught") failure: Exception) {
    null
}

/**
 * Список с продолжением: тело маршрута в `items` и `nextCursor` из `X-DS-Next-Cursor`. [DsToolCall.respond] отдаёт
 * кодировщику только значение, поэтому успешный результат передаётся ему целиком.
 */
private suspend fun <T> DsToolCall.respondPage(
    serializer: KSerializer<T>,
    block: suspend () -> DsResult<T>,
): ToolResult = respond(
    { success: DsResult.Success<T> ->
        buildJsonObject {
            put("items", Json.encodeToJsonElement(serializer, success.value))
            success.readPage?.nextCursor?.let { put("nextCursor", it) }
        }
    },
) {
    when (val result = block()) {
        is DsResult.Success -> DsResult.Success(result)
        is DsResult.Failure -> result
    }
}

/** Отказ без вызова use case, как ответ маршрута на некорректный запрос. */
private suspend fun DsToolCall.reject(failure: DsFailure): ToolResult =
    respond<Unit>({ JsonNull }) { DsResult.Failure(failure) }

private fun <T, R> DsResult<T>.map(transform: (T) -> R): DsResult<R> = when (this) {
    is DsResult.Success -> DsResult.Success(transform(value), mutationMetadata, readContext, readPage)
    is DsResult.Failure -> this
}

/** Размер страницы и продолжение; `null` — недопустимые значения, как `INVALID_QUERY` маршрута. */
private fun JsonObject.page(): ModelReadQuery? {
    val limit = (this["limit"] as? JsonPrimitive)?.longOrNull ?: DEFAULT_LIMIT.toLong()
    val cursor = text("cursor")
    if (limit !in 1..MAX_LIMIT || cursor == "") return null
    return ModelReadQuery(limit = limit.toInt(), cursor = cursor)
}

private fun JsonObject.text(name: String): String? =
    (this[name] as? JsonPrimitive)?.takeIf { it.isString }?.content

private fun JsonObject.uuid(name: String): UUID? = text(name)?.toUuid()

private fun String.toUuid(): UUID? = runCatching { UUID.fromString(this) }.getOrNull()

private val SIZE_FIELDS = setOf("valuePx", "layers", "fallbackElevation", "platforms", "baseRevisions")
private val TYPOGRAPHY_FIELDS =
    setOf("size", "lineHeight", "letterSpacing", "weights", "fontFamily", "platform", "baseRevisions")

// Коды и тексты отказов маршрутов тем: `message` показывается пользователю.
private val INVALID_TENANT = DsFailure.InvalidRequest("invalid_id", message = "Некорректный идентификатор темы")
private val INVALID_TOKEN = DsFailure.InvalidRequest("invalid_id", message = "Некорректный идентификатор токена")
private val INVALID_BODY = DsFailure.InvalidRequest("invalid_body", message = "Некорректное тело запроса")
private val INVALID_BASE_REVISION = DsFailure.InvalidRequest("invalid_base_revision")
private val INVALID_SIZE_BASE_REVISION = DsFailure.InvalidRequest(
    "invalid_base_revision",
    message = "Базовые редакции задаются для платформ web, ios и android",
)
private val INVALID_QUERY = DsFailure.InvalidRequest("INVALID_QUERY")
private const val DEFAULT_LIMIT = 50
private const val MAX_LIMIT = 200L
