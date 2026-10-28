package com.dsbuilder.ds.components.application

/** Что произошло с билдом. */
enum class PublishKind {
    /** Новый билд записан и стал активным. */
    PUBLISHED,

    /** Существующий неактивный билд снова стал активным. */
    ACTIVATED,

    /** Билд уже был опубликован и активен. */
    UNCHANGED,
}
