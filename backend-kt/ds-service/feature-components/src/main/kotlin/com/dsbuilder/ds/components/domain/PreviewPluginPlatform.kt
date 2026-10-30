package com.dsbuilder.ds.components.domain

/** Платформа preview plugin: у каждой свои маршруты, хранилище билдов и поле версии библиотеки в manifest. */
enum class PreviewPluginPlatform(
    /** Значение платформы в manifest, мете и реестре билдов. */
    val wire: String,
    /** Поле manifest с версией библиотеки, из которой собран плагин. */
    val libraryVersionField: String,
) {
    /** Compose-плагин, версия `uikit-compose`. */
    COMPOSE("compose", "uikitComposeVersion"),

    /** Web-плагин, версия `plasma-new-hope`. */
    WEB("web", "plasmaNewHopeVersion"),
}
