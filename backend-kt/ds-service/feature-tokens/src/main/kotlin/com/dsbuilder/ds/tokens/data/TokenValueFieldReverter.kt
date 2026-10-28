package com.dsbuilder.ds.tokens.data

import com.dsbuilder.ds.core.data.SubjectMutationPaths
import com.dsbuilder.ds.tokens.domain.TokenParameterRestore
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.booleanOrNull
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
@Suppress("ReturnCount")
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
    // Признак своего значения платформы откатывается отдельным путём, параметры значения — путями под `/value`.
    val overridden = if (OVERRIDDEN_PATH in paths) {
        if (previous["overridden"] == current["overridden"]) return false
        (previous["overridden"] as? JsonPrimitive)?.booleanOrNull ?: return false
    } else {
        revision[TokenValueRevisionsTable.overridden]
    }
    val valuePaths = paths - OVERRIDDEN_PATH
    val restored = if (valuePaths.isEmpty()) {
        revision[TokenValueRevisionsTable.value] ?: JsonNull
    } else {
        TokenParameterRestore.restore(
            previous["value"] ?: JsonNull,
            current["value"] ?: JsonNull,
            valuePaths,
            type,
        ) ?: return false
    }
    val changedPaths = buildSet {
        if (valuePaths.isNotEmpty()) add("/value")
        if (OVERRIDDEN_PATH in paths) add(OVERRIDDEN_PATH)
    }
    replaceDraftRevision(versionId, entityId, revision, restored, overridden, changedPaths)
    return true
}

private fun replaceDraftRevision(
    versionId: UUID,
    entityId: UUID,
    revision: ResultRow,
    restored: JsonElement,
    overridden: Boolean,
    paths: Set<String>,
) {
    TokenValueRevisionsTable.deleteWhere {
        (TokenValueRevisionsTable.tokenValueId eq entityId) and
            (TokenValueRevisionsTable.designSystemVersionId eq versionId)
    }
    SubjectMutationPaths.with(paths) {
        TokenValueRevisionsTable.insert {
            it[tokenValueId] = entityId
            it[designSystemId] = revision[TokenValueRevisionsTable.designSystemId]
            it[designSystemVersionId] = versionId
            it[versionSequenceNumber] = revision[TokenValueRevisionsTable.versionSequenceNumber]
            it[paletteId] = revision[TokenValueRevisionsTable.paletteId]
            it[value] = restored.takeUnless { value -> value == JsonNull }
            it[TokenValueRevisionsTable.overridden] = overridden
            it[deleted] = false
        }
    }
}

private const val OVERRIDDEN_PATH = "/overridden"
