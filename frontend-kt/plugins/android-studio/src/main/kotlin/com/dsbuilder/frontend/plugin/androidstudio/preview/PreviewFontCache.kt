package com.dsbuilder.frontend.plugin.androidstudio.preview

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import java.io.DataInputStream
import java.io.DataOutputStream
import java.io.IOException
import java.nio.file.AtomicMoveNotSupportedException
import java.nio.file.Files
import java.nio.file.LinkOption.NOFOLLOW_LINKS
import java.nio.file.Path
import java.nio.file.StandardCopyOption.ATOMIC_MOVE
import java.nio.file.StandardCopyOption.REPLACE_EXISTING
import java.nio.file.attribute.FileTime
import java.security.MessageDigest
import java.util.Locale

/** Ограниченный кеш только публичных immutable-шрифтов; URL и авторизация на диск не записываются. */
internal class PreviewFontCache(
    private val directory: Path,
    private val clock: () -> Long = System::currentTimeMillis,
    private val maxBytes: Long = 64L * 1024 * 1024,
    private val maxEntries: Int = 128,
) {
    suspend fun read(url: String, type: String): ByteArray? = io {
        val file = path(url, type)
        if (!Files.isRegularFile(file, NOFOLLOW_LINKS)) return@io null
        val bytes = DataInputStream(Files.newInputStream(file, NOFOLLOW_LINKS)).use { input ->
            if (input.readInt() != MAGIC || input.readLong() <= clock()) return@use null
            val size = input.readInt()
            if (size !in 12..PreviewFontDownloader.MAX_FONT_BYTES || Files.size(file) != HEADER_BYTES + size) {
                return@use null
            }
            val digest = ByteArray(32).also(input::readFully)
            val value = ByteArray(size).also(input::readFully)
            value.takeIf { digest.contentEquals(sha256(it)) && validPreviewFont(it, type) }
        }
        if (bytes == null) Files.deleteIfExists(file) else Files.setLastModifiedTime(file, FileTime.fromMillis(clock()))
        bytes
    }

    suspend fun store(
        url: String,
        type: String,
        bytes: ByteArray,
        cacheControl: String?,
        age: String?,
        vary: String? = null,
    ) {
        if (!vary.isNullOrBlank()) return
        val lifetime = immutableFontLifetime(cacheControl, age) ?: return
        if (bytes.size > PreviewFontDownloader.MAX_FONT_BYTES || !validPreviewFont(bytes, type)) return
        io {
            Files.createDirectories(directory)
            val temporary = Files.createTempFile(directory, "font-", ".tmp")
            try {
                DataOutputStream(Files.newOutputStream(temporary)).use { output ->
                    output.writeInt(MAGIC)
                    output.writeLong(clock() + lifetime)
                    output.writeInt(bytes.size)
                    output.write(sha256(bytes))
                    output.write(bytes)
                }
                val target = path(url, type)
                try {
                    Files.move(temporary, target, ATOMIC_MOVE, REPLACE_EXISTING)
                } catch (_: AtomicMoveNotSupportedException) {
                    Files.move(temporary, target, REPLACE_EXISTING)
                }
                Files.setLastModifiedTime(target, FileTime.fromMillis(clock()))
                trim()
            } finally {
                Files.deleteIfExists(temporary)
            }
        }
    }

    private fun path(url: String, type: String): Path {
        val key = sha256("$type:$url".toByteArray()).joinToString("") { "%02x".format(it) }
        return directory.resolve("$key.font")
    }

    private fun trim() {
        val entries = Files.list(directory).use { stream ->
            stream.filter { it.fileName.toString().matches(Regex("[0-9a-f]{64}\\.font")) }
                .filter { Files.isRegularFile(it, NOFOLLOW_LINKS) }
                .toList().sortedBy { Files.getLastModifiedTime(it).toMillis() }
        }
        var bytes = entries.sumOf { Files.size(it) }
        var count = entries.size
        for (file in entries) {
            if (bytes <= maxBytes && count <= maxEntries) break
            bytes -= Files.size(file)
            Files.deleteIfExists(file)
            count--
        }
    }

    private suspend fun <T> io(action: () -> T): T? = withContext(Dispatchers.IO) {
        diskMutex.withLock {
            try {
                action()
            } catch (_: IOException) {
                null
            } catch (_: SecurityException) {
                null
            }
        }
    }

    private companion object {
        val diskMutex = Mutex()
        const val MAGIC = 0x44534632
        const val HEADER_BYTES = 48L
    }
}

private fun sha256(bytes: ByteArray): ByteArray = MessageDigest.getInstance("SHA-256").digest(bytes)

internal fun immutableFontLifetime(cacheControl: String?, age: String?): Long? {
    val directives = cacheControl?.lowercase(Locale.ROOT)?.split(',')?.map(String::trim).orEmpty()
    if (!directives.containsAll(listOf("public", "immutable")) ||
        directives.any { it.substringBefore('=').trim() in setOf("private", "no-store", "no-cache") }
    ) {
        return null
    }
    val maxAge = directives.singleOrNull { it.substringBefore('=').trim() == "max-age" }
        ?.substringAfter('=')?.trim()?.trim('"')?.toLongOrNull()
    val currentAge = (age ?: "0").toLongOrNull()
    if (currentAge == null || maxAge == null) return null
    return if (currentAge < 0 || maxAge <= currentAge) {
        null
    } else {
        minOf(maxAge - currentAge, 7 * 24 * 60 * 60L) * 1000
    }
}
