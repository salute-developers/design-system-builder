package com.dsbuilder.consent.application

import java.security.MessageDigest

/** Вычисляет SHA-256 без сохранения исходного ключа. */
fun sha256(bytes: ByteArray): String = MessageDigest.getInstance("SHA-256").digest(bytes)
    .joinToString("") { "%02x".format(it) }
