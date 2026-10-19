package com.dsbuilder.ds.tokens.data

import com.dsbuilder.ds.core.data.SubjectMutationPaths
import com.dsbuilder.ds.tokens.domain.TokenParameterRestore
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import org.jetbrains.exposed.v1.core.ResultRow
import org.jetbrains.exposed.v1.core.SortOrder
import org.jetbrains.exposed.v1.core.and
import org.jetbrains.exposed.v1.core.eq
import org.jetbrains.exposed.v1.core.lessEq
import org.jetbrains.exposed.v1.jdbc.deleteWhere
import org.jetbrains.exposed.v1.jdbc.insert
import org.jetbrains.exposed.v1.jdbc.selectAll
import java.util.UUID

/** Записывает частичный откат в существующую черновую редакцию под уже полученной предметной блокировкой. */
internal fun revertTokenValueFields(
    versionId: UUID,
    entityId: UUID,
    previous: JsonObject,
    current: JsonObject,
    paths: Set<String>,
): Boolean {
    val revision = TokenValueRevisionsTable.selectAll().where {
        (TokenValueRevisionsTable.tokenValueId eq entityId) and
            (TokenValueRevisionsTable.designSystemVersionId eq versionId)
    }.singleOrNull() ?: return false
    val stable = TokenValuesTable.selectAll().where { TokenValuesTable.id eq entityId }.singleOrNull()
        ?: return false
    val sequence = revision[TokenValueRevisionsTable.versionSequenceNumber]
    val type = TokenRevisionsTable.selectAll().where {
        (TokenRevisionsTable.tokenId eq stable[TokenValuesTable.tokenId]) and
            (TokenRevisionsTable.versionSequenceNumber lessEq sequence)
    }.orderBy(TokenRevisionsTable.versionSequenceNumber, SortOrder.DESC).limit(1).singleOrNull()
        ?.get(TokenRevisionsTable.type)
    val restored = TokenParameterRestore.restore(
        previous["value"] ?: JsonNull,
        current["value"] ?: JsonNull,
        paths,
        type,
    )
    return restored?.let {
        replaceDraftRevision(versionId, entityId, revision, it)
        true
    } ?: false
}

private fun replaceDraftRevision(versionId: UUID, entityId: UUID, revision: ResultRow, restored: JsonElement) {
    TokenValueRevisionsTable.deleteWhere {
        (TokenValueRevisionsTable.tokenValueId eq entityId) and
            (TokenValueRevisionsTable.designSystemVersionId eq versionId)
    }
    SubjectMutationPaths.with(setOf("/value")) {
        TokenValueRevisionsTable.insert {
            it[tokenValueId] = entityId
            it[designSystemId] = revision[TokenValueRevisionsTable.designSystemId]
            it[designSystemVersionId] = versionId
            it[versionSequenceNumber] = revision[TokenValueRevisionsTable.versionSequenceNumber]
            it[paletteId] = revision[TokenValueRevisionsTable.paletteId]
            it[value] = restored.takeUnless { value -> value == JsonNull }
            it[deleted] = false
        }
    }
}
