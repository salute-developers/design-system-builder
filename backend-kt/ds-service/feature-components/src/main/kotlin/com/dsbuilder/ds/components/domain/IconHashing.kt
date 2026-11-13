package com.dsbuilder.ds.components.domain

import java.security.MessageDigest

/** Хеширование содержимого каталога. */
object IconHashing {
    private const val ID_LENGTH = 12

    /** Hex SHA-256 байтов. */
    fun sha256(bytes: ByteArray): String =
        MessageDigest.getInstance("SHA-256").digest(bytes).joinToString("") { "%02x".format(it) }

    /** Контрольная сумма содержимого иконки: имя, категория, синонимы (порядок не важен), размеры и SVG. */
    fun entryHash(icon: IconEntry, assets: Collection<IconAsset>): String {
        val record = buildString {
            append(icon.name).append('\u0000').append(icon.category.orEmpty()).append('\u0000')
            append(icon.aliases.sorted().joinToString("\u0001")).append('\u0000')
            assets.filter { it.name == icon.name }.sortedBy { it.size.px }.forEach {
                append(it.size.px).append(':').append(it.sha256).append(';')
            }
        }
        return sha256(record.toByteArray(Charsets.UTF_8))
    }

    /** Идентификатор загрузки по содержимому; порядок иконок не влияет на результат. */
    fun loadId(entries: List<IconEntry>): IconCatalogLoadId {
        val record = entries.sortedBy { it.name }.joinToString("\n") { "${it.name}:${it.contentHash}" }
        return IconCatalogLoadId(sha256(record.toByteArray(Charsets.UTF_8)).take(ID_LENGTH))
    }
}
