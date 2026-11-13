package com.dsbuilder.ds.themes.application.typography

import com.dsbuilder.ds.themes.domain.typography.ComponentPropertyReference
import java.util.UUID

/** Значения свойств компонентов дизайн-системы, которые могут ссылаться на стили типографии. */
interface TypographyUsageRepository {
    /** Ссылки значений свойств компонентов дизайн-системы [designSystemId]: текст значения или имя токена. */
    suspend fun references(designSystemId: UUID): List<ComponentPropertyReference>

    /** Строки значений свойств компонентов, которые ссылаются на стиль текстом из [values], без `token_id`. */
    suspend fun textReferences(designSystemId: UUID, values: Set<String>): Map<String, Set<UUID>>
}
