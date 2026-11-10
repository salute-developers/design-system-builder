package com.dsbuilder.ds.core.data

import org.jetbrains.exposed.v1.core.Expression
import org.jetbrains.exposed.v1.core.Key
import org.jetbrains.exposed.v1.core.Op
import org.jetbrains.exposed.v1.core.QueryBuilder
import org.jetbrains.exposed.v1.core.UUIDColumnType
import org.jetbrains.exposed.v1.jdbc.transactions.TransactionManager
import java.util.UUID

/** Сбрасывается при установке контекста, хранится только в текущей транзакции. */
internal val requestMutationScopeChecked = Key<Boolean>()

/** Сопоставляет владельца строки с ожидаемой системой текущей транзакции. */
fun requestDesignSystemScope(owner: Expression<out UUID?>): Op<Boolean> = object : Op<Boolean>() {
    override fun toQueryBuilder(queryBuilder: QueryBuilder) {
        queryBuilder.append("ds_request_matches_design_system(")
        owner.toQueryBuilder(queryBuilder)
        queryBuilder.append(")")
    }
}

/** Проверяет владельца перед работой с устойчивыми строками или созданием редакции. */
fun requestDesignSystemMatches(owner: UUID): Boolean = TransactionManager.current().exec(
    "SELECT ds_request_matches_design_system(?)",
    listOf(UUIDColumnType() to owner),
) { rows -> rows.next() && rows.getBoolean(1) } ?: false

/** Не допускает запись устойчивой сущности другой системы даже до создания её редакции. */
fun requireRequestDesignSystem(owner: UUID) {
    if (!requestDesignSystemMatches(owner)) throw InaccessibleDesignSystemException()
}

/** Проверяет доступность самой ожидаемой системы, в том числе для пустого списка/пакета. */
fun requireRequestDesignSystemAccessible() {
    val accessible = TransactionManager.current().exec(
        """
            SELECT NULLIF(current_setting('ds.design_system_id', true), '') IS NULL OR EXISTS (
                SELECT 1 FROM design_systems
                WHERE id = NULLIF(current_setting('ds.design_system_id', true), '')::uuid
                  AND (current_setting('ds.system_admin', true) = 'true'
                       OR project_id = current_setting('ds.project_id', true) OR project_id IS NULL)
            )
        """.trimIndent(),
    ) { rows -> rows.next() && rows.getBoolean(1) } ?: false
    if (!accessible) throw InaccessibleDesignSystemException()
}

/** Проверяет актуальную редакцию перед новой мутацией; историческое чтение не ограничивает. */
fun requireRequestDesignSystemMutable() {
    requireRequestDesignSystemAccessible()
    val mutable = TransactionManager.current().exec(
        """
            SELECT NULLIF(current_setting('ds.design_system_id', true), '') IS NULL OR EXISTS (
                SELECT 1 FROM design_system_versions boundary
                JOIN LATERAL (
                    SELECT deleted FROM design_system_revisions revision
                    WHERE revision.design_system_id = boundary.design_system_id
                      AND revision.version_sequence_number <= boundary.sequence_number
                    ORDER BY revision.version_sequence_number DESC LIMIT 1
                ) revision ON NOT revision.deleted
                WHERE boundary.design_system_id = NULLIF(current_setting('ds.design_system_id', true), '')::uuid
                  AND boundary.status = 'draft'
            )
        """.trimIndent(),
    ) { rows -> rows.next() && rows.getBoolean(1) } ?: false
    if (!mutable) throw InaccessibleDesignSystemException()
    TransactionManager.current().putUserData(requestMutationScopeChecked, true)
}

/** Проверяет систему успешной пустой команды, если до записи проверка ещё не потребовалась. */
internal fun verifyRequestMutationScope(expected: UUID?) {
    if (expected != null && TransactionManager.current().getUserData(requestMutationScopeChecked) != true) {
        requireRequestDesignSystemMutable()
    }
}

/** Прерывает и откатывает транзакцию при нарушении ожидаемой границы. */
class InaccessibleDesignSystemException : RuntimeException()
