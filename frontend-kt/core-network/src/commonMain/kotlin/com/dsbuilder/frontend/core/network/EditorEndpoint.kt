package com.dsbuilder.frontend.core.network

import io.ktor.http.encodeURLParameter
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive

/** Единый внутренний формат типизированной команды. Дискриминатор не передаётся в HTTP-тело. */
public val editorCommandJson: Json = Json { classDiscriminator = "operation" }

private val pathParameter = Regex("\\{([A-Za-z][A-Za-z0-9]*)\\}")

/** Закрытое описание HTTP-контракта, задаваемое адаптером фичи. */
public data class EditorEndpoint(
    /** Метод предметной операции. */
    public val method: MutationHttpMethod,
    /** Шаблон пути относительно проверенной области системы. */
    public val path: String,
    /** Поле типизированного вложенного тела, либо плоские поля самой команды. */
    public val bodyField: String? = null,
    /** Наличие HTTP-тела, включая DELETE с телом. */
    public val sendsBody: Boolean = true,
    /** Поля, передаваемые через query вместо тела. */
    public val queryFields: List<String> = emptyList(),
    /** Путь подтверждающего чтения после усечения метаданных. */
    public val confirmationPath: String? = null,
) {
    /** Строит один запрос, исключая внутренний дискриминатор и поля пути из плоского тела. */
    public fun request(
        root: String,
        command: JsonObject,
        key: String,
        baseRevision: Long?,
    ): HttpMutationRequest {
        val routeFields = pathParameter.findAll(path).map { it.groupValues[1] }.toSet()
        val query = queryFields.filter(command::containsKey).joinToString("&") { name ->
            val value = command.getValue(name)
            val text = if (value is JsonArray) {
                value.joinToString(",") { it.jsonPrimitive.content }
            } else {
                value.jsonPrimitive.content
            }
            "$name=${text.encodeURLParameter()}"
        }
        val body = if (!sendsBody) {
            null
        } else {
            val payload = bodyField?.let { command.getValue(it).jsonObject } ?: JsonObject(
                command.filterKeys { it != "operation" && it !in routeFields && it !in queryFields },
            )
            payload.toString()
        }
        val suffix = query.takeIf(String::isNotEmpty)?.let { "?$it" }.orEmpty()
        return HttpMutationRequest(method, root + render(path, command) + suffix, body, key, baseRevision)
    }

    /** Использует тот же проверенный контекст и идентификаторы для подтверждающего чтения. */
    public fun confirmation(root: String, command: JsonObject): String? =
        confirmationPath?.let { root + render(it, command) }
}

private fun render(path: String, command: JsonObject): String = pathParameter.replace(path) { match ->
    command.getValue(match.groupValues[1]).jsonPrimitive.content.encodeEditorId()
}
