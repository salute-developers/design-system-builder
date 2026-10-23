package com.dsbuilder.ds.components.data

import org.jetbrains.exposed.v1.core.and
import org.jetbrains.exposed.v1.core.eq
import org.jetbrains.exposed.v1.core.lowerCase
import org.jetbrains.exposed.v1.jdbc.insertReturning
import org.jetbrains.exposed.v1.jdbc.selectAll
import java.util.UUID

/** Записи осей вариации: устойчивая запись дизайн-системы и её редакция в активном черновике. */
internal object VariationWrites {
    /** Находит действующую ось компонента в дизайн-системе по имени. */
    fun find(designSystemId: UUID, componentId: UUID, name: String, ignoreCase: Boolean = false): UUID? =
        VariationsTable.selectAll().where {
            (VariationsTable.designSystemId eq designSystemId) and
                (VariationsTable.componentId eq componentId) and
                if (ignoreCase) VariationsTable.name.lowerCase() eq name.lowercase() else VariationsTable.name eq name
        }.singleOrNull()?.get(VariationsTable.id)

    /** Создаёт ось дизайн-системы вместе с редакцией имени и описания. */
    fun create(designSystemId: UUID, componentId: UUID, name: String, description: String?): UUID {
        val id = StableVariationsTable.insertReturning {
            it[StableVariationsTable.designSystemId] = designSystemId
            it[StableVariationsTable.componentId] = componentId
        }.single()[StableVariationsTable.id]
        VariationRevisionsTable.replaceRevision(VariationRevisionsTable.entityId, id, designSystemId) {
            it[VariationRevisionsTable.name] = name
            it[VariationRevisionsTable.description] = description
        }
        return id
    }

    /** Находит ось по имени либо создаёт её. */
    fun findOrCreate(designSystemId: UUID, componentId: UUID, name: String, ignoreCase: Boolean = false): UUID =
        find(designSystemId, componentId, name, ignoreCase) ?: create(designSystemId, componentId, name, null)

    /** Связывает свойство с осью; связь принадлежит дизайн-системе оси. */
    fun linkProperty(propertyId: UUID, variationId: UUID) {
        val present = PropertyVariationsTable.selectAll().where {
            (PropertyVariationsTable.propertyId eq propertyId) and (PropertyVariationsTable.variationId eq variationId)
        }.any()
        if (present) return
        val owner = StableVariationsTable.selectAll().where { StableVariationsTable.id eq variationId }
            .single()[StableVariationsTable.designSystemId]
        PropertyVariationsTable.insertReturning {
            it[PropertyVariationsTable.propertyId] = propertyId
            it[PropertyVariationsTable.variationId] = variationId
            it[designSystemId] = owner
        }.single()
    }
}
