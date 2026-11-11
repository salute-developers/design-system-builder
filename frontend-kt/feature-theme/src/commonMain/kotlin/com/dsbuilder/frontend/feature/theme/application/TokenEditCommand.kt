package com.dsbuilder.frontend.feature.theme.application

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonElement

/** Типизированные точечные операции токенов без выбора произвольного маршрута. */
@Serializable
public sealed interface TokenEditCommand {
    /** Создание определения токена. */
    @Serializable
    @SerialName("token_create")
    public data class CreateDefinition(
        /** Имя определения. */
        public val name: String,
        /** Тип значения по контракту backend. */
        public val type: String? = null,
        /** Отображаемое имя. */
        public val displayName: String? = null,
        /** Описание. */
        public val description: String? = null,
        /** Доступность токена. */
        public val enabled: Boolean = true,
    ) : TokenEditCommand

    /** Изменение метаданных одного определения. */
    @Serializable
    @SerialName("token_update")
    public data class UpdateDefinition(
        /** Идентификатор определения. */
        public val tokenId: String,
        /** Новое имя. */
        public val name: String? = null,
        /** Новый тип. */
        public val type: String? = null,
        /** Новое отображаемое имя. */
        public val displayName: String? = null,
        /** Новое описание. */
        public val description: String? = null,
        /** Новая доступность. */
        public val enabled: Boolean? = null,
    ) : TokenEditCommand

    /** Удаление одного определения и его зависимых данных по правилам backend. */
    @Serializable
    @SerialName("token_delete")
    public data class DeleteDefinition(
        /** Идентификатор определения. */
        public val tokenId: String,
    ) : TokenEditCommand

    /** Создание отдельного значения темы. */
    @Serializable
    @SerialName("token_value_create")
    public data class CreateValue(
        /** Идентификатор определения. */
        public val tokenId: String,
        /** Идентификатор темы. */
        public val tenantId: String,
        /** Платформа web, ios или android. */
        public val platform: String,
        /** Режим light/dark у цвета, null у значений без режима. */
        public val mode: String?,
        /** Исходное значение, включая поддерживаемые backend составные формы. */
        public val value: JsonElement,
        /** Идентификатор палитры. */
        public val paletteId: String? = null,
    ) : TokenEditCommand

    /** Изменение одного значения с сохранением его ключа. */
    @Serializable
    @SerialName("token_value_update")
    public data class UpdateValue(
        /** Идентификатор значения. */
        public val valueId: String,
        /** Новое исходное значение; отсутствие сохраняет прежнее значение. JSON null не поддерживается backend. */
        public val value: JsonElement? = null,
        /** Идентификатор палитры. */
        public val paletteId: String? = null,
    ) : TokenEditCommand

    /** Удаление отдельного значения. */
    @Serializable
    @SerialName("token_value_delete")
    public data class DeleteValue(
        /** Идентификатор значения. */
        public val valueId: String,
    ) : TokenEditCommand
}
