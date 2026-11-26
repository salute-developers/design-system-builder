package com.dsbuilder.ds.components.application

/** Что произошло с билдом. */
enum class PublishKind {
    /** Файлы незакреплённого dev-preview заменены без смены build ID. */
    REPLACED,

    /** Новый билд записан и стал активным. */
    PUBLISHED,

    /** Существующий неактивный билд снова стал активным. */
    ACTIVATED,

    /** Билд уже был опубликован и активен. */
    UNCHANGED,
}
