package com.dsbuilder.frontend.feature.components.application

import com.dsbuilder.frontend.core.domain.FieldChange
import kotlinx.serialization.KSerializer
import kotlinx.serialization.builtins.nullable
import kotlinx.serialization.builtins.serializer
import kotlinx.serialization.encoding.Decoder
import kotlinx.serialization.encoding.Encoder

/** Кодирует явное присваивание, включая null. Значение Unchanged пропускается как значение по умолчанию. */
internal object StringFieldChangeSerializer : KSerializer<FieldChange<String>> {
    private val valueSerializer = String.serializer().nullable
    override val descriptor = valueSerializer.descriptor

    override fun serialize(encoder: Encoder, value: FieldChange<String>) {
        require(value is FieldChange.Set) { "Unchanged fields must be omitted." }
        encoder.encodeSerializableValue(valueSerializer, value.value)
    }

    override fun deserialize(decoder: Decoder): FieldChange<String> =
        FieldChange.Set(decoder.decodeSerializableValue(valueSerializer))
}
