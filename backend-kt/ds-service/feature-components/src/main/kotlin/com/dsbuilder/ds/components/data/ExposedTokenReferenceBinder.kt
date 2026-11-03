package com.dsbuilder.ds.components.data

import com.dsbuilder.ds.core.application.TokenReferenceBinder
import com.dsbuilder.ds.core.data.SubjectMutationPaths
import com.dsbuilder.ds.core.data.lockDraftSubjects
import org.jetbrains.exposed.v1.core.and
import org.jetbrains.exposed.v1.core.eq
import org.jetbrains.exposed.v1.core.inList
import org.jetbrains.exposed.v1.core.isNull
import org.jetbrains.exposed.v1.jdbc.selectAll
import java.util.UUID

/**
 * Переводит текстовые ссылки значений свойств вариаций, инвариантов и комбинаций стилей на токен в ссылки по
 * `token_id` черновыми редакциями с путями `/token_id` и `/value` (у комбинаций — `/token_id`, текст значения
 * обязателен и остаётся) или делает их пустыми при удалении токена (путь `/value`, у комбинаций — пустая строка).
 * Строки, у которых ссылка уже по `token_id`, не меняются.
 */
class ExposedTokenReferenceBinder : TokenReferenceBinder {
    override suspend fun bind(designSystemId: UUID, tokenId: UUID, rowIds: Set<UUID>) =
        write(designSystemId, tokenId, rowIds)

    override suspend fun detach(designSystemId: UUID, rowIds: Set<UUID>) = write(designSystemId, null, rowIds)

    /** Привязка к токену [tokenId] или, при `null`, пустая ссылка вместо текста. */
    private fun write(designSystemId: UUID, tokenId: UUID?, rowIds: Set<UUID>) {
        if (rowIds.isEmpty()) return
        // Редакция переименованного или удаляемого токена не является базовой редакцией зависимого свойства.
        SubjectMutationPaths.withoutBaseComparison {
            bindInvariants(designSystemId, tokenId, rowIds)
            bindCombinations(designSystemId, tokenId, rowIds)
            bindVariations(designSystemId, tokenId, rowIds)
        }
    }

    private fun bindVariations(designSystemId: UUID, token: UUID?, rowIds: Set<UUID>) {
        val table = VariationPropertyValuesTable
        fun rows(ids: Collection<UUID>) = table.selectAll().where {
            (table.id inList ids) and (table.designSystemId eq designSystemId) and table.tokenId.isNull()
        }.map { it[table.id] to it }.sortedBy { it.first }
        val ids = rows(rowIds).map { it.first }
        if (ids.isEmpty()) return
        check(lockDraftSubjects(designSystemId, "variation-property-value", ids))
        // После блокировки читаем заново: параллельное редактирование могло уже сменить ссылку.
        VariationPropertyValueRevisionsTable.detachTokenReferences(
            VariationPropertyValueRevisionsTable.entityId,
            designSystemId,
            rows(ids),
            changedPaths = valuePaths(token),
        ) { statement, current ->
            statement[tokenId] = token
            statement[value] = null
            statement[alpha] = current[table.alpha]
            statement[adjustment] = current[table.adjustment]
            statement[position] = current[table.position]
            statement[stateSetId] = current[table.stateSetId]
        }
    }

    private fun bindInvariants(designSystemId: UUID, token: UUID?, rowIds: Set<UUID>) {
        val table = InvariantPropertyValuesTable
        fun rows(ids: Collection<UUID>) = table.selectAll().where {
            (table.id inList ids) and (table.designSystemId eq designSystemId) and table.tokenId.isNull()
        }.map { it[table.id] to it }.sortedBy { it.first }
        val ids = rows(rowIds).map { it.first }
        if (ids.isEmpty()) return
        check(lockDraftSubjects(designSystemId, "invariant-property-value", ids))
        InvariantPropertyValueRevisionsTable.detachTokenReferences(
            InvariantPropertyValueRevisionsTable.entityId,
            designSystemId,
            rows(ids),
            changedPaths = valuePaths(token),
        ) { statement, current ->
            statement[tokenId] = token
            statement[value] = null
            statement[alpha] = current[table.alpha]
            statement[adjustment] = current[table.adjustment]
            statement[position] = current[table.position]
            statement[stateSetId] = current[table.stateSetId]
        }
    }

    private fun bindCombinations(designSystemId: UUID, token: UUID?, rowIds: Set<UUID>) {
        val table = StyleCombinationsTable
        fun rows(ids: Collection<UUID>) = table.selectAll().where {
            (table.id inList ids) and (table.designSystemId eq designSystemId) and table.tokenId.isNull()
        }.map { it[table.id] to it }.sortedBy { it.first }
        val ids = rows(rowIds).map { it.first }
        if (ids.isEmpty()) return
        check(lockDraftSubjects(designSystemId, "style-combination", ids))
        StyleCombinationRevisionsTable.detachTokenReferences(
            StyleCombinationRevisionsTable.entityId,
            designSystemId,
            rows(ids),
            changedPaths = if (token == null) setOf("/value") else setOf("/token_id"),
        ) { statement, current ->
            statement[tokenId] = token
            statement[combinationKey] = current[table.combinationKey]
            // У комбинации значение обязательно: при привязке текст остаётся, ссылку определяет `token_id`; при
            // удалении токена пустая строка — пустая ссылка.
            statement[value] = if (token == null) "" else current[table.value]
            statement[alpha] = current[table.alpha]
            statement[adjustment] = current[table.adjustment]
            statement[position] = current[table.position]
            statement[stateSetId] = current[table.stateSetId]
        }
    }

    private fun valuePaths(token: UUID?) = if (token == null) setOf("/value") else setOf("/token_id", "/value")
}
