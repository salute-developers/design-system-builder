package com.dsbuilder.ds.tokens.data

import com.dsbuilder.ds.core.application.DraftChangeHandler
import com.dsbuilder.ds.core.application.DraftSubjectChange
import com.dsbuilder.ds.core.application.TokenRevertListener
import com.dsbuilder.ds.core.data.ExposedDraftChangeHandler
import com.dsbuilder.ds.core.data.SubjectMutationPaths
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import org.jetbrains.exposed.v1.core.and
import org.jetbrains.exposed.v1.core.eq
import org.jetbrains.exposed.v1.jdbc.deleteWhere
import org.jetbrains.exposed.v1.jdbc.insert
import org.jetbrains.exposed.v1.jdbc.selectAll
import java.util.UUID

/** Тип записи журнала об определении токена. */
const val TOKEN_DRAFT_ENTITY_TYPE: String = "token"

/** Тип записи журнала о значении токена. */
const val TOKEN_VALUE_DRAFT_ENTITY_TYPE: String = "token-value"

/**
 * Предметные обработчики журнала токенов и их значений. [listeners] получают сообщение об успешном откате определения
 * или значения в той же транзакции, например для пересчёта производного типа цветового токена.
 */
fun tokenDraftChangeHandlers(listeners: List<TokenRevertListener> = emptyList()): List<DraftChangeHandler> =
    listOf(tokenDefinitionDraftChangeHandler(listeners), tokenValueDraftChangeHandler(listeners))

/**
 * Обработчик определений: у цветового и градиентного токена путь `/type` производный от значений семейства, поэтому
 * запись, у которой изменился только тип, не показывается, а у остальных записей `/type` убирается из путей.
 */
private fun tokenDefinitionDraftChangeHandler(listeners: List<TokenRevertListener>): DraftChangeHandler {
    val delegate = ExposedDraftChangeHandler(
        entityType = TOKEN_DRAFT_ENTITY_TYPE,
        stableTable = TokensTable,
        stableId = TokensTable.id,
        stableDesignSystemId = TokensTable.designSystemId,
        revisionTable = TokenRevisionsTable,
        revisionEntityId = TokenRevisionsTable.tokenId,
        revisionVersionId = TokenRevisionsTable.designSystemVersionId,
        revisionSequenceNumber = TokenRevisionsTable.versionSequenceNumber,
        revisionDeleted = TokenRevisionsTable.deleted,
        revisionValueColumns = listOf(
            TokenRevisionsTable.name,
            TokenRevisionsTable.type,
            TokenRevisionsTable.displayName,
            TokenRevisionsTable.description,
            TokenRevisionsTable.enabled,
            TokenRevisionsTable.groupId,
            TokenRevisionsTable.position,
        ),
    )
    return object : DraftChangeHandler by delegate {
        override fun describe(
            designSystemId: UUID,
            sequenceNumber: Long,
            previousSequenceNumber: Long,
            limit: Int?,
        ): List<DraftSubjectChange> {
            // Скрытые записи не должны занимать место в ограниченной выборке.
            val visible = delegate.describe(designSystemId, sequenceNumber, previousSequenceNumber, null)
                .mapNotNull(::withoutDerivedType)
            return if (limit == null) visible else visible.take(limit)
        }

        override fun describeEntity(
            designSystemId: UUID,
            sequenceNumber: Long,
            previousSequenceNumber: Long,
            entityId: UUID,
        ): DraftSubjectChange? = delegate.describeEntity(
            designSystemId,
            sequenceNumber,
            previousSequenceNumber,
            entityId,
        )
            ?.let(::withoutDerivedType)

        override fun hasChanges(designSystemId: UUID, sequenceNumber: Long, previousSequenceNumber: Long): Boolean =
            describe(designSystemId, sequenceNumber, previousSequenceNumber, limit = 1).isNotEmpty()

        // Блокировки зависимостей (определений семейства) берутся до блокировки записи определения: при общем порядке
        // записей значений (TokenValueWritePolicy) откат определения не блокирует взаимно параллельную запись.
        override fun prepareRevert(designSystemId: UUID, entityId: UUID): Boolean =
            listeners.all { it.prepareRevert(designSystemId, entityId) } &&
                delegate.prepareRevert(designSystemId, entityId)

        // Откат имени или удаления меняет состав семейства, поэтому производный тип пересчитывается после него.
        override fun revert(versionId: UUID, entityId: UUID, removeStableEntity: Boolean): Boolean {
            val owner = TokensTable.selectAll().where { TokensTable.id eq entityId }.singleOrNull()
                ?.get(TokensTable.designSystemId)
            return notifyingRevert(listeners, owner, entityId) {
                delegate.revert(versionId, entityId, removeStableEntity)
            }
        }
    }
}

/** Запись без производного `/type` цветового токена или `null`, если других изменений нет. */
internal fun withoutDerivedType(change: DraftSubjectChange): DraftSubjectChange? {
    val derived = TYPE_PATH in change.changedPaths &&
        change.previousValue?.isColorToken() == true && change.currentValue?.isColorToken() == true
    if (!derived) return change
    val paths = change.changedPaths - TYPE_PATH
    return if (paths.isEmpty()) null else change.copy(changedPaths = paths)
}

private fun JsonObject.isColorToken(): Boolean = (this["type"] as? JsonPrimitive)?.content in COLOR_TOKEN_TYPES

private fun tokenValueDraftChangeHandler(listeners: List<TokenRevertListener>): DraftChangeHandler {
    val delegate = ExposedDraftChangeHandler(
        entityType = TOKEN_VALUE_DRAFT_ENTITY_TYPE,
        stableTable = TokenValuesTable,
        stableId = TokenValuesTable.id,
        stableDesignSystemId = TokenValuesTable.designSystemId,
        revisionTable = TokenValueRevisionsTable,
        revisionEntityId = TokenValueRevisionsTable.tokenValueId,
        revisionVersionId = TokenValueRevisionsTable.designSystemVersionId,
        revisionSequenceNumber = TokenValueRevisionsTable.versionSequenceNumber,
        revisionDeleted = TokenValueRevisionsTable.deleted,
        stableValueColumns = listOf(
            TokenValuesTable.tokenId,
            TokenValuesTable.tenantId,
            TokenValuesTable.platform,
            TokenValuesTable.mode,
        ),
        revisionValueColumns = listOf(
            TokenValueRevisionsTable.paletteId,
            TokenValueRevisionsTable.value,
            TokenValueRevisionsTable.overridden,
        ),
    )
    return object : DraftChangeHandler by delegate {
        override fun revertFields(
            versionId: UUID,
            entityId: UUID,
            previous: JsonObject,
            current: JsonObject,
            paths: Set<String>,
        ): Boolean = notifying(entityId) { revertTokenValueFields(versionId, entityId, previous, current, paths) }

        override fun revert(versionId: UUID, entityId: UUID, removeStableEntity: Boolean): Boolean =
            notifying(entityId) {
                if (removeStableEntity) {
                    delegate.revert(versionId, entityId, true)
                } else {
                    revertToBaseline(delegate, versionId, entityId)
                }
            }

        /** Токен значения читается до отката: откат созданного значения удаляет его строку. */
        private fun notifying(entityId: UUID, revert: () -> Boolean): Boolean {
            val stable = TokenValuesTable.selectAll().where { TokenValuesTable.id eq entityId }.singleOrNull()
            val owner = stable?.get(TokenValuesTable.designSystemId)
            return notifyingRevert(listeners, owner, stable?.get(TokenValuesTable.tokenId), revert)
        }
    }
}

/** Выполняет откат [revert] и после успеха — действия слушателей, подготовленные до отката. */
private fun notifyingRevert(
    listeners: List<TokenRevertListener>,
    designSystemId: UUID?,
    tokenId: UUID?,
    revert: () -> Boolean,
): Boolean {
    val after = if (designSystemId == null || tokenId == null) {
        emptyList()
    } else {
        listeners.map { it.beforeRevert(designSystemId, tokenId) }
    }
    return revert().also { reverted -> if (reverted) after.forEach { it() } }
}

/** Откат значения к основе создания темы, если она есть, иначе удаление черновой редакции. */
private fun revertToBaseline(delegate: DraftChangeHandler, versionId: UUID, entityId: UUID): Boolean {
    val baseline = TokenValueCreationBaselinesTable.selectAll().where {
        (TokenValueCreationBaselinesTable.designSystemVersionId eq versionId) and
            (TokenValueCreationBaselinesTable.tokenValueId eq entityId)
    }.singleOrNull() ?: return delegate.revert(versionId, entityId, false)
    val current = TokenValueRevisionsTable.selectAll().where {
        (TokenValueRevisionsTable.designSystemVersionId eq versionId) and
            (TokenValueRevisionsTable.tokenValueId eq entityId)
    }.singleOrNull() ?: return false
    TokenValueRevisionsTable.deleteWhere {
        (TokenValueRevisionsTable.designSystemVersionId eq versionId) and
            (TokenValueRevisionsTable.tokenValueId eq entityId)
    }
    SubjectMutationPaths.with(setOf("/palette_id", "/value", "/overridden")) {
        TokenValueRevisionsTable.insert {
            it[tokenValueId] = entityId
            it[designSystemId] = current[TokenValueRevisionsTable.designSystemId]
            it[designSystemVersionId] = versionId
            it[versionSequenceNumber] = current[TokenValueRevisionsTable.versionSequenceNumber]
            it[paletteId] = baseline[TokenValueCreationBaselinesTable.paletteId]
            it[value] = baseline[TokenValueCreationBaselinesTable.value]
            it[overridden] = baseline[TokenValueCreationBaselinesTable.overridden]
            it[deleted] = false
        }
    }
    return true
}

private const val TYPE_PATH = "/type"
private val COLOR_TOKEN_TYPES = setOf("color", "gradient")
