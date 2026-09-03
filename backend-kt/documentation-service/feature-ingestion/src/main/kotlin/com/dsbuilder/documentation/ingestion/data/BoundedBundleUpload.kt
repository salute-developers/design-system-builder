package com.dsbuilder.documentation.ingestion.data

import com.dsbuilder.documentation.ingestion.application.BundleSource
import java.io.InputStream
import java.nio.file.Files
import java.nio.file.Path
import java.security.MessageDigest

/** Потоково сохраняет compressed upload с лимитом и SHA-256. */
class BoundedBundleUpload(private val temporaryDirectory: Path, private val maxCompressedBytes: Long) {
    /** Копирует stream во временный файл; вызывающая сторона удаляет source. */
    fun receive(input: InputStream, originalFilename: String?): BundleSource {
        Files.createDirectories(temporaryDirectory)
        val target = Files.createTempFile(temporaryDirectory, "documentation-", ".tar.gz")
        val digest = MessageDigest.getInstance("SHA-256")
        var completed = false
        try {
            val count = copyAndDigest(input, target, digest)
            val sha256 = digest.digest().joinToString("") { "%02x".format(it) }
            completed = true
            return BundleSource(target.toString(), originalFilename, sha256, count)
        } finally {
            if (!completed) {
                Files.deleteIfExists(target)
            }
        }
    }

    private fun copyAndDigest(input: InputStream, target: Path, digest: MessageDigest): Long {
        var count = 0L
        Files.newOutputStream(target).use { output ->
            val buffer = ByteArray(DEFAULT_BUFFER_SIZE)
            var read = input.read(buffer)
            while (read >= 0) {
                count += read
                requireWithinLimit(count)
                digest.update(buffer, 0, read)
                output.write(buffer, 0, read)
                read = input.read(buffer)
            }
        }
        return count
    }

    private fun requireWithinLimit(size: Long) {
        if (size > maxCompressedBytes) {
            throw UploadLimitExceededException()
        }
    }
}

/** Превышен лимит compressed upload. */
class UploadLimitExceededException : RuntimeException()
