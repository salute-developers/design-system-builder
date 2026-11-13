package com.dsbuilder.ds.app

import java.security.MessageDigest
import java.util.Base64

/** Полный релизный запрос для тестов HTTP, с хешем ровно отправленных исходных байтов. */
internal fun coreReleasePayload(version: String, components: String): String {
    val bytes = components.toByteArray()
    val hash = MessageDigest.getInstance("SHA-256").digest(bytes).joinToString("") { "%02x".format(it) }
    val source = Base64.getEncoder().encodeToString(bytes)
    return """{"platform":"compose","dryRun":false,"components":$components,
        "coreRelease":{"libraryId":"uikit-compose","platform":"compose","version":"$version"},
        "sourceMetaBase64":"$source","metaSha256":"$hash"}"""
}
