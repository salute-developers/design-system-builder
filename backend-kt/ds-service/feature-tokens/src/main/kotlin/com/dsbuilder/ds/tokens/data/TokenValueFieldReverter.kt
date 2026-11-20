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
    // Признаки своего значения платформы и отвязанной подтемы откатываются отдельными путями, параметры значения —
    // путями под `/value`.
    val overridden = revertedFlag(OVERRIDDEN_PATH, paths, previous, current, revision)
        ?: return false
    val detached = revertedFlag(DETACHED_PATH, paths, previous, current, revision)
        ?: return false
    val valuePaths = paths - FLAG_PATHS
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
        addAll(paths intersect FLAG_PATHS)
    }
    replaceDraftRevision(versionId, entityId, revision, restored, RevisionFlags(overridden, detached), changedPaths)
    return true
}

/**
 * Признак по пути [path] после отката: прежний, если путь откатывается и признак менялся, иначе действующий из
 * [revision]; `null` — путь откатывается, но признак не менялся или не разобран.
 */
private fun revertedFlag(
    path: String,
    paths: Set<String>,
    previous: JsonObject,
    current: JsonObject,
    revision: ResultRow,
): Boolean? {
    val field = path.removePrefix("/")
    if (path !in paths) return revision[FLAG_COLUMNS.getValue(path)]
    if (previous[field] == current[field]) return null
    return (previous[field] as? JsonPrimitive)?.booleanOrNull
}

/** Признаки предметной редакции значения, которые откатываются отдельными путями. */
private data class RevisionFlags(val overridden: Boolean, val detached: Boolean)

private fun replaceDraftRevision(
    versionId: UUID,
    entityId: UUID,
    revision: ResultRow,
    restored: JsonElement,
    flags: RevisionFlags,
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
            it[TokenValueRevisionsTable.overridden] = flags.overridden
            it[TokenValueRevisionsTable.detached] = flags.detached
            it[deleted] = false
        }
    }
}

private const val OVERRIDDEN_PATH = "/overridden"
private const val DETACHED_PATH = "/detached"
private val FLAG_COLUMNS = mapOf(
    OVERRIDDEN_PATH to TokenValueRevisionsTable.overridden,
    DETACHED_PATH to TokenValueRevisionsTable.detached,
)
private val FLAG_PATHS = FLAG_COLUMNS.keys
