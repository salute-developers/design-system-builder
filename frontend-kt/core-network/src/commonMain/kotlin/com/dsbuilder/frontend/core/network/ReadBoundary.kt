package com.dsbuilder.frontend.core.network

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive

/** Разрешённая сервером граница; черновик остаётся живым селектором. */
public data class ReadBoundary(
    /** Фактическая дизайн-система разрешённого предметного ответа. */
    public val designSystemId: String,
    /** Точная публикация либо живой селектор draft. */
    public val version: String,
    /** UUID публикации; для черновика отсутствует. */
    public val versionId: String?,
) {
    /** Продолжает публикацию по UUID, черновик — явным draft. */
    public fun query(): String = versionId?.let { "?versionId=$it" } ?: "?version=draft"

    public companion object {
        /** Проверяет выбранную границу, сохраняя совместимость ответов участника без метаданных.
         * @param raw Фактический заголовок ответа.
         * @param designSystemId Ожидаемая ДС выбранного запроса.
         * @param version Явно выбранная версия, если она задана.
         * @param pinnedRaw Контекст предыдущего предметного ответа.
         * @param required Требование метаданных для анонимного чтения.
         * @param headersValid Отсутствие неоднозначных повторов технических заголовков.
         */
        public fun validates(
            raw: String?,
            designSystemId: String,
            version: String? = null,
            pinnedRaw: String? = null,
            required: Boolean = false,
            headersValid: Boolean = true,
        ): Boolean {
            val actual = parse(raw)
            val pinned = parse(pinnedRaw)
            return when {
                !headersValid -> false
                raw != null && actual == null -> false
                pinnedRaw != null && pinned == null -> false
                actual == null -> !required && pinned == null
                actual.designSystemId != designSystemId -> false
                version != null && actual.version != version -> false
                else -> pinned == null || actual == pinned
            }
        }

        /** Отклоняет неполные метаданные и не выдаёт draftId за опубликованную версию. */
        public fun parse(raw: String?): ReadBoundary? = runCatching {
            val body = raw?.let(Json::parseToJsonElement) as? JsonObject ?: return null
            fun field(name: String) = (body[name] as? JsonPrimitive)?.content
            val system = field("designSystemId") ?: return null
            val version = field("version") ?: return null
            val id = field("versionId")
            if (version == "draft") {
                require(id == null)
            } else {
                require(Regex("(0|[1-9][0-9]*)\\.(0|[1-9][0-9]*)\\.(0|[1-9][0-9]*)").matches(version))
                require(id != null && Regex("[0-9a-fA-F]{8}(-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}").matches(id))
            }
            ReadBoundary(system, version, id)
        }.getOrNull()
    }
}
