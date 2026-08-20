package com.dsbuilder.feature.publisher.domain.entity

enum class JobTarget {
    COMPOSE,
    XML,
    IOS,
    WEB
}

val JobTarget.isAndroid: Boolean
    get() = this == JobTarget.COMPOSE || this == JobTarget.XML