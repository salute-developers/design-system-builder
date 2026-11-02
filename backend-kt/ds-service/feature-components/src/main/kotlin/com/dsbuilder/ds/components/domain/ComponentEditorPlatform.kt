package com.dsbuilder.ds.components.domain

/** Платформа, для которой редактор читает пакет данных компонента. */
enum class ComponentEditorPlatform(
    /** Значение платформы в API и в колонке `components.platform`. */
    val wireValue: String,
) {
    WEB("web"),
    COMPOSE("compose"),
    ;

    companion object {
        /** Разбирает значение параметра `platform`; `null` для отсутствующего или неподдерживаемого. */
        fun fromWire(value: String?): ComponentEditorPlatform? = entries.firstOrNull { it.wireValue == value }
    }
}
