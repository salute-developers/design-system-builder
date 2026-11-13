package com.dsbuilder.frontend.core.auth

/** Канонический ключ сессии: схема/сервер без регистра и без завершающего слеша. */
public fun normalizeSessionApiUrl(value: String): String {
    val trimmed = value.trim().trimEnd('/')
    val scheme = trimmed.substringBefore("://", "").lowercase()
    require(scheme == "https" || scheme == "http") { "Ожидается HTTP(S) API URL." }
    val rest = trimmed.substringAfter("://")
    val authority = rest.substringBefore('/').lowercase()
    require(authority.isNotBlank() && authority.none { it == '@' || it == '?' || it == '#' }) {
        "Некорректный сервер API URL."
    }
    require(!rest.contains('?') && !rest.contains('#')) { "API URL не должен содержать query или fragment." }
    val host = when (scheme) {
        "https" -> authority.removeSuffix(":443")
        else -> authority.removeSuffix(":80")
    }
    return "$scheme://$host${rest.removePrefix(rest.substringBefore('/'))}"
}
