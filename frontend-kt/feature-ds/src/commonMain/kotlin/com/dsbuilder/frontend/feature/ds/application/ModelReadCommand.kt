package com.dsbuilder.frontend.feature.ds.application

/** Параметры предметного чтения без типов HTTP и MCP. */
public data class ModelReadCommand(
    /** Операция модели. */
    public val operation: ModelReadOperation,
    /** ID токена, компонента, темы или appearance согласно операции. */
    public val resourceId: String? = null,
    /** Явная версия перекрывает версию разрешённого контекста. */
    public val version: String? = null,
    /** Предметные фильтры, передаваемые серверу. */
    public val filters: Map<String, String> = emptyMap(),
    /** Размер страницы; списки по умолчанию запрашивают 50. */
    public val limit: Int? = null,
    /** Непрозрачное продолжение сервера. */
    public val cursor: String? = null,
)
