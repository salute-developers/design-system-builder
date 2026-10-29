package com.dsbuilder.ds.core.application

import kotlinx.serialization.json.JsonElement
import java.io.ByteArrayOutputStream
import java.io.DataOutputStream
import java.lang.reflect.Array
import java.lang.reflect.Modifier
import java.security.MessageDigest
import java.util.IdentityHashMap
import java.util.UUID

/** Стабильный SHA-256 тела запроса для проверки повторяемости. */
object RequestHash {
    /** Вычисляет хэш байтов без нормализации тела. */
    fun sha256(body: ByteArray): String = MessageDigest.getInstance("SHA-256")
        .digest(body)
        .joinToString("") { byte -> "%02x".format(byte) }

    /**
     * Вычисляет хэш однозначного структурного представления команды.
     *
     * Имена типов, полей и длины значений входят в представление, поэтому пользовательский текст не может
     * притвориться разделителем соседнего поля, как это возможно у `data class.toString()`.
     */
    fun canonical(value: Any?): String = sha256(canonicalBytes(value))

    private fun canonicalBytes(value: Any?): ByteArray = ByteArrayOutputStream().use { bytes ->
        DataOutputStream(bytes).use { output -> Encoder(output).write(value) }
        bytes.toByteArray()
    }

    private class Encoder(private val output: DataOutputStream) {
        private val visiting = IdentityHashMap<Any, Unit>()

        @Suppress("CyclomaticComplexMethod")
        fun write(value: Any?) {
            when (value) {
                null -> output.writeByte(NULL)
                is String -> writeText(STRING, value)
                is Char -> writeText(CHAR, value.toString())
                is Boolean -> {
                    output.writeByte(BOOLEAN)
                    output.writeBoolean(value)
                }
                is Byte, is Short, is Int, is Long -> writeTypedText(INTEGER, value)
                is Float, is Double -> writeTypedText(DECIMAL, value)
                is UUID -> writeText(UUID_VALUE, value.toString())
                is Enum<*> -> {
                    output.writeByte(ENUM)
                    writeUtf8(value.javaClass.name)
                    writeUtf8(value.name)
                }
                is JsonElement -> writeText(JSON, value.toString())
                is Map<*, *> -> writeMap(value)
                is Set<*> -> writeUnordered(value)
                is Iterable<*> -> writeIterable(value)
                is Pair<*, *> -> writeIterable(listOf(value.first, value.second))
                is Triple<*, *, *> -> writeIterable(listOf(value.first, value.second, value.third))
                else -> when {
                    value.javaClass.isArray -> writeArray(value)
                    value.javaClass.name.startsWith("com.dsbuilder.") -> writeObject(value)
                    else -> writeTypedText(ATOM, value)
                }
            }
        }

        private fun writeObject(value: Any) = guardCycle(value) {
            output.writeByte(OBJECT)
            writeUtf8(value.javaClass.name)
            val fields = generateSequence(value.javaClass as Class<*>?) { type -> type.superclass }
                .flatMap { type -> type.declaredFields.asSequence() }
                .filterNot { field -> Modifier.isStatic(field.modifiers) || field.isSynthetic }
                .sortedBy { field -> "${field.declaringClass.name}#${field.name}" }
                .toList()
            output.writeInt(fields.size)
            fields.forEach { field ->
                check(field.trySetAccessible()) { "Cannot encode ${field.declaringClass.name}.${field.name}" }
                writeUtf8(field.name)
                write(field.get(value))
            }
        }

        private fun writeMap(value: Map<*, *>) = guardCycle(value) {
            output.writeByte(MAP)
            val entries = value.entries
                .map { entry -> canonicalBytes(entry.key) to entry.value }
                .sortedWith { left, right -> compareBytes(left.first, right.first) }
            output.writeInt(entries.size)
            entries.forEach { (key, item) ->
                writeBytes(key)
                write(item)
            }
        }

        private fun writeUnordered(value: Set<*>) = guardCycle(value) {
            output.writeByte(SET)
            val entries = value.map(::canonicalBytes).sortedWith(::compareBytes)
            output.writeInt(entries.size)
            entries.forEach(::writeBytes)
        }

        private fun writeIterable(value: Iterable<*>) = guardCycle(value) {
            output.writeByte(LIST)
            val entries = value.toList()
            output.writeInt(entries.size)
            entries.forEach(::write)
        }

        private fun writeArray(value: Any) = guardCycle(value) {
            output.writeByte(ARRAY)
            val size = Array.getLength(value)
            output.writeInt(size)
            repeat(size) { index -> write(Array.get(value, index)) }
        }

        private fun writeTypedText(tag: Int, value: Any) {
            output.writeByte(tag)
            writeUtf8(value.javaClass.name)
            writeUtf8(value.toString())
        }

        private fun writeText(tag: Int, value: String) {
            output.writeByte(tag)
            writeUtf8(value)
        }

        private fun writeBytes(value: ByteArray) {
            output.writeInt(value.size)
            output.write(value)
        }

        private fun writeUtf8(value: String) = writeBytes(value.encodeToByteArray())

        private fun guardCycle(value: Any, block: () -> Unit) {
            check(visiting.put(value, Unit) == null) { "Cyclic request body is not supported" }
            try {
                block()
            } finally {
                visiting.remove(value)
            }
        }
    }

    private fun compareBytes(left: ByteArray, right: ByteArray): Int {
        val sharedSize = minOf(left.size, right.size)
        repeat(sharedSize) { index ->
            val comparison = (left[index].toInt() and 0xff).compareTo(right[index].toInt() and 0xff)
            if (comparison != 0) return comparison
        }
        return left.size.compareTo(right.size)
    }

    private const val NULL = 0
    private const val STRING = 1
    private const val CHAR = 2
    private const val BOOLEAN = 3
    private const val INTEGER = 4
    private const val DECIMAL = 5
    private const val UUID_VALUE = 6
    private const val ENUM = 7
    private const val JSON = 8
    private const val MAP = 9
    private const val SET = 10
    private const val LIST = 11
    private const val ARRAY = 12
    private const val OBJECT = 13
    private const val ATOM = 14
}
