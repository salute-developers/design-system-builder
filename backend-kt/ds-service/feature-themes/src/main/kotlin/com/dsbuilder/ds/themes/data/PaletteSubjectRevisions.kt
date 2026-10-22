package com.dsbuilder.ds.themes.data

import org.jetbrains.exposed.v1.core.JoinType
import org.jetbrains.exposed.v1.core.eq
import org.jetbrains.exposed.v1.jdbc.selectAll
import java.util.UUID

/** Адреса, уже используемые операциями палитры, связываются с редакциями прочитанного состояния. */
internal fun paletteSubjectRevisions(tenantId: UUID): Map<String, Long> = buildMap {
    TenantPaletteGroupsTable.selectAll().where { TenantPaletteGroupsTable.tenantId eq tenantId }.forEach { row ->
        put("group/${row[TenantPaletteGroupsTable.id]}", row[TenantPaletteGroupsTable.editRevision])
    }
    val ramps = TenantPaletteRampsTable.join(
        TenantPaletteGroupsTable,
        JoinType.INNER,
        TenantPaletteRampsTable.groupId,
        TenantPaletteGroupsTable.id,
    )
    ramps.selectAll().where { TenantPaletteGroupsTable.tenantId eq tenantId }.forEach { row ->
        val slot = paletteSlot(row)
        put("ramp/$slot", row[TenantPaletteRampsTable.editRevision])
    }
    ramps.join(TenantPaletteStepsTable, JoinType.INNER, TenantPaletteRampsTable.id, TenantPaletteStepsTable.rampId)
        .selectAll().where { TenantPaletteGroupsTable.tenantId eq tenantId }.forEach { row ->
            val slot = paletteSlot(row)
            put("step/$slot/${row[TenantPaletteStepsTable.step]}", row[TenantPaletteStepsTable.editRevision])
        }
    TenantPaletteTokenGroupsTable.selectAll()
        .where { TenantPaletteTokenGroupsTable.tenantId eq tenantId }
        .forEach { row ->
            put(
                "assignment/${row[TenantPaletteTokenGroupsTable.tokenId]}",
                row[TenantPaletteTokenGroupsTable.editRevision],
            )
        }
}

private fun paletteSlot(row: org.jetbrains.exposed.v1.core.ResultRow): String =
    "${row[TenantPaletteRampsTable.groupId]}/" +
        "${row[TenantPaletteRampsTable.slotType].wireValue}/${row[TenantPaletteRampsTable.slotShade]}"
