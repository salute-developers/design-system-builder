package com.dsbuilder.ds.core.data

import com.dsbuilder.ds.core.application.BaselineSeedScope
import org.jetbrains.exposed.v1.core.UUIDColumnType
import org.jetbrains.exposed.v1.jdbc.transactions.TransactionManager
import java.util.UUID

/** PostgreSQL-реализация окна наполнения через функции миграции V22. */
class ExposedBaselineSeedScope : BaselineSeedScope {
    override suspend fun begin(designSystemId: UUID) = call("begin_design_system_baseline_seed", designSystemId)

    override suspend fun verify(designSystemId: UUID) = call("verify_design_system_baseline_seed", designSystemId)

    private fun call(function: String, designSystemId: UUID) {
        TransactionManager.current().exec(
            "SELECT $function(?)",
            listOf(UUIDColumnType() to designSystemId),
        ) { rows -> rows.next() }
    }
}
