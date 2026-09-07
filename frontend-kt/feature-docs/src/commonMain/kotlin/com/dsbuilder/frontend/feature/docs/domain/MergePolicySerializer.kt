package com.dsbuilder.frontend.feature.docs.domain

import kotlinx.serialization.KSerializer
import kotlinx.serialization.descriptors.PrimitiveKind
import kotlinx.serialization.descriptors.PrimitiveSerialDescriptor
import kotlinx.serialization.encoding.Decoder
import kotlinx.serialization.encoding.Encoder

/**
 * Кастомный сериализатор для [MergePolicy].
 *
 * Поддерживает как PascalCase ("Append"), так и lowercase ("append") форматы JSON.
 */
public object MergePolicySerializer : KSerializer<MergePolicy> {
    override val descriptor = PrimitiveSerialDescriptor("MergePolicy", PrimitiveKind.STRING)

    override fun serialize(encoder: Encoder, value: MergePolicy) {
        encoder.encodeString(value.name)
    }

    override fun deserialize(decoder: Decoder): MergePolicy {
        return when (decoder.decodeString().lowercase()) {
            "append" -> MergePolicy.Append
            "prepend" -> MergePolicy.Prepend
            "replace" -> MergePolicy.Replace
            else -> throw IllegalArgumentException("Unknown MergePolicy: ${decoder.decodeString()}")
        }
    }
}
