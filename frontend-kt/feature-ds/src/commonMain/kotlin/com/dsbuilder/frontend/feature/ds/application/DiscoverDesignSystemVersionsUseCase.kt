package com.dsbuilder.frontend.feature.ds.application

import com.dsbuilder.frontend.core.application.CredentialResult
import com.dsbuilder.frontend.core.application.DesignSystemLink
import com.dsbuilder.frontend.core.application.UserSessionAccess
import com.dsbuilder.frontend.core.auth.BackendCredential
import com.dsbuilder.frontend.core.domain.DesignSystemId
import com.dsbuilder.frontend.core.domain.DesignSystemSelection
import com.dsbuilder.frontend.core.domain.ProjectId
import com.dsbuilder.frontend.core.network.ApiUrlResolver
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive

/** Запрос версий до выбора конкретной версии.
 * @property projectId проект.
 * @property designSystemId система проекта.
 * @property limit размер серверной страницы.
 * @property cursor непрозрачный серверный курсор.
 */
public data class DiscoverDesignSystemVersionsCommand(
    public val projectId: String,
    public val designSystemId: String,
    public val limit: Int? = null,
    public val cursor: String? = null,
)

internal fun interface DesignSystemVersionsSource {
    suspend fun read(
        apiUrl: String,
        credential: BackendCredential,
        command: DiscoverDesignSystemVersionsCommand,
    ): ModelReadResult
}

/** Обнаруживает версии от имени пользователя без workspace или фиктивной версии. */
public class DiscoverDesignSystemVersionsUseCase internal constructor(
    private val apiUrlResolver: ApiUrlResolver,
    private val sessionResolver: UserSessionAccess,
    private val source: DesignSystemVersionsSource,
) {
    /** Получает серверную страницу и дополняет опубликованные версии каноническими ссылками. */
    public suspend fun execute(
        command: DiscoverDesignSystemVersionsCommand,
        apiUrlOverride: String? = null,
    ): ModelReadResult {
        val validIds = IDENTIFIER.matches(command.projectId) && IDENTIFIER.matches(command.designSystemId)
        val validLimit = command.limit == null || command.limit in 1..200
        if (!validIds || !validLimit) {
            return ModelReadResult.Failed(
                "INVALID_QUERY",
                "Valid projectId, designSystemId and limit 1..200 are required.",
            )
        }
        val apiUrl = apiUrlResolver.resolve(apiUrlOverride).value
        val access = sessionResolver.resolve(apiUrl)
        if (access is CredentialResult.Failed) {
            return ModelReadResult.Failed(
                access.code.name,
                "Run dsbuilder auth login and retry.",
            )
        }
        val result = source.read(apiUrl, (access as CredentialResult.Selected).credential, command)
        return addLinks(result, command)
    }

    private fun addLinks(result: ModelReadResult, command: DiscoverDesignSystemVersionsCommand): ModelReadResult {
        if (result !is ModelReadResult.Success) return result
        return runCatching {
            val envelope = result.value as JsonObject
            val context = envelope.getValue("context") as JsonObject
            require((context.getValue("designSystemId") as JsonPrimitive).content == command.designSystemId)
            val items = envelope.getValue("items") as JsonArray
            val linked = items.map { element ->
                val item = element as JsonObject
                val version = (item.getValue("version") as JsonPrimitive).also {
                    require(it.isString && VERSION.matches(it.content))
                }.content
                require((item.getValue("designSystemId") as JsonPrimitive).content == command.designSystemId)
                val selection = DesignSystemSelection(
                    ProjectId(command.projectId),
                    DesignSystemId(command.designSystemId),
                    version,
                )
                JsonObject(item + ("designSystem" to JsonPrimitive(DesignSystemLink.format(selection))))
            }
            ModelReadResult.Success(JsonObject(envelope + ("items" to JsonArray(linked))))
        }.getOrElse {
            ModelReadResult.Failed("INVALID_BACKEND_RESPONSE", "Backend returned invalid published versions.")
        }
    }

    private companion object {
        val IDENTIFIER = Regex("[A-Za-z0-9][A-Za-z0-9_-]*")
        val VERSION = Regex("(0|[1-9][0-9]*)\\.(0|[1-9][0-9]*)\\.(0|[1-9][0-9]*)")
    }
}
