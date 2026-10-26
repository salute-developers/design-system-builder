package com.dsbuilder.ds.core.data

import com.dsbuilder.ds.core.application.ModelReadItems
import com.dsbuilder.ds.core.application.ModelReadPage
import com.dsbuilder.ds.core.application.ModelReadQuery
import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.builtins.nullable
import kotlinx.serialization.builtins.serializer
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put
import org.jetbrains.exposed.v1.core.Column
import org.jetbrains.exposed.v1.core.ExpressionWithColumnType
import org.jetbrains.exposed.v1.core.QueryBuilder
import org.jetbrains.exposed.v1.core.ResultRow
import org.jetbrains.exposed.v1.core.SortOrder
import org.jetbrains.exposed.v1.core.TextColumnType
import org.jetbrains.exposed.v1.core.and
import org.jetbrains.exposed.v1.core.eq
import org.jetbrains.exposed.v1.core.greater
import org.jetbrains.exposed.v1.core.less
import org.jetbrains.exposed.v1.core.or
import org.jetbrains.exposed.v1.jdbc.Query
import java.security.MessageDigest
import java.util.Base64
import java.util.UUID

/** Ограничивает SQL-выборку по ключу и ID, не требуя существования последней строки. */
fun Query.modelReadPage(
    read: ModelReadQuery,
    list: String,
    key: Column<out String?>,
    id: Column<UUID>,
): ModelReadItems<ResultRow> {
    val orderKey = object : ExpressionWithColumnType<String>() {
        override val columnType = TextColumnType()
        override fun toQueryBuilder(queryBuilder: QueryBuilder) {
            queryBuilder.append("COALESCE(")
            queryBuilder.append(key)
            queryBuilder.append(", '')")
        }
    }
    orderBy(orderKey to SortOrder.ASC, id to SortOrder.ASC)
    if (read.limit == null && read.cursor == null) return ModelReadItems(toList())
    val limit = read.limit ?: DEFAULT_PAGE_LIMIT
    if (limit !in 1..MAX_PAGE_LIMIT || read.scope.isEmpty()) throw InvalidModelReadQueryException()
    val binding = pageBinding(read, list)
    read.cursor?.let { cursor ->
        val position = decodePosition(cursor, binding)
        adjustWhere {
            val after = (orderKey greater position.first) or
                ((orderKey eq position.first) and (id greater position.second))
            this?.and(after) ?: after
        }
    }
    val rows = limit(limit + 1).toList()
    val items = rows.take(limit)
    val next = items.lastOrNull()?.takeIf { rows.size > limit }?.let { row ->
        encodePosition(binding, row[key].orEmpty(), row[id])
    }
    return ModelReadItems(items, ModelReadPage(limit, next))
}

private fun pageBinding(read: ModelReadQuery, list: String): String {
    val values = listOf(
        read.scope, list, "name,id:asc", read.name, read.query, read.platform,
        read.groupId, read.parentId, read.type, read.shade, read.version,
    )
    val encoded = Json.encodeToString(ListSerializer(String.serializer().nullable), values)
    return MessageDigest.getInstance("SHA-256").digest(encoded.toByteArray())
        .joinToString("") { "%02x".format(it) }
}

private fun encodePosition(binding: String, key: String, id: UUID): String = Base64.getUrlEncoder().withoutPadding()
    .encodeToString(
        buildJsonObject {
            put("binding", binding)
            put("key", key)
            put("id", id.toString())
        }.toString().toByteArray(),
    )

private fun decodePosition(cursor: String, binding: String): Pair<String, UUID> = try {
    if (cursor.length > MAX_CURSOR_LENGTH) throw InvalidModelReadQueryException()
    val value = Json.parseToJsonElement(String(Base64.getUrlDecoder().decode(cursor))).jsonObject
    if (value.keys != setOf("binding", "key", "id") || value.getValue("binding").jsonPrimitive.content != binding) {
        throw InvalidModelReadQueryException()
    }
    value.getValue("key").jsonPrimitive.content to UUID.fromString(value.getValue("id").jsonPrimitive.content)
} catch (_: IllegalArgumentException) {
    throw InvalidModelReadQueryException()
} catch (_: NoSuchElementException) {
    throw InvalidModelReadQueryException()
}

private const val DEFAULT_PAGE_LIMIT = 50
private const val MAX_PAGE_LIMIT = 200
private const val MAX_CURSOR_LENGTH = 8192

/** Страница публикаций в порядке sequenceNumber DESC, ID DESC. */
fun Query.modelReadVersionPage(
    read: ModelReadQuery,
    sequence: Column<Long>,
    id: Column<UUID>,
): ModelReadItems<ResultRow> {
    orderBy(sequence to SortOrder.DESC, id to SortOrder.DESC)
    if (read.limit == null && read.cursor == null) return ModelReadItems(toList())
    val size = read.limit ?: DEFAULT_PAGE_LIMIT
    if (size !in 1..MAX_PAGE_LIMIT || read.scope.isEmpty()) throw InvalidModelReadQueryException()
    val binding = pageBinding(read, "versions:sequence,id:desc")
    read.cursor?.let {
        val position = decodePosition(it, binding)
        val number = position.first.toLongOrNull() ?: throw InvalidModelReadQueryException()
        adjustWhere {
            val after = (sequence less number) or ((sequence eq number) and (id less position.second))
            this?.and(after) ?: after
        }
    }
    val rows = limit(size + 1).toList()
    val items = rows.take(size)
    val next = items.lastOrNull()?.takeIf { rows.size > size }?.let {
        encodePosition(binding, it[sequence].toString(), it[id])
    }
    return ModelReadItems(items, ModelReadPage(size, next))
}

/** Страница уже ограниченного журналом набора; не заменяет проверку предела вычисления 10000. */
fun <T> List<T>.modelReadJournalPage(
    read: ModelReadQuery,
    key: (T) -> String,
    id: (T) -> UUID,
): ModelReadItems<T> {
    if (read.limit == null && read.cursor == null) return ModelReadItems(this)
    val size = read.limit ?: DEFAULT_PAGE_LIMIT
    if (size !in 1..MAX_PAGE_LIMIT || read.scope.isEmpty()) throw InvalidModelReadQueryException()
    val binding = pageBinding(read, "journal")
    val position = read.cursor?.let { decodePosition(it, binding) }
    val candidates = asSequence().filter {
        position == null || key(it) > position.first ||
            (key(it) == position.first && id(it).toString() > position.second.toString())
    }.take(size + 1).toList()
    val items = candidates.take(size)
    val next = items.lastOrNull()?.takeIf { candidates.size > size }?.let {
        encodePosition(binding, key(it), id(it))
    }
    return ModelReadItems(items, ModelReadPage(size, next))
}
