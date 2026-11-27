package com.dsbuilder.ds.tokens.data

import com.dsbuilder.ds.core.data.selectedVersionBoundarySql
import com.dsbuilder.ds.tokens.application.CreatePaletteEntry
import com.dsbuilder.ds.tokens.application.PaletteRepository
import com.dsbuilder.ds.tokens.domain.PaletteEntry
import com.dsbuilder.ds.tokens.domain.PaletteType
import org.jetbrains.exposed.v1.core.ResultRow
import org.jetbrains.exposed.v1.core.eq
import org.jetbrains.exposed.v1.core.inList
import org.jetbrains.exposed.v1.jdbc.deleteWhere
import org.jetbrains.exposed.v1.jdbc.insertReturning
import org.jetbrains.exposed.v1.jdbc.selectAll
import org.jetbrains.exposed.v1.jdbc.transactions.TransactionManager
import org.jetbrains.exposed.v1.jdbc.updateReturning
import java.time.Instant
import java.util.UUID

/** Exposed repository for the globally shared palette. */
class ExposedPaletteRepository : PaletteRepository {
    override suspend fun list(): List<PaletteEntry> {
        if (!com.dsbuilder.ds.core.data.hasDesignSystemCoreScope()) return PaletteTable.selectAll().map(::map)
        val ids = TransactionManager.current().exec(
            """
                SELECT DISTINCT revision.palette_id FROM token_values entity
                JOIN design_system_versions boundary ON boundary.design_system_id = entity.design_system_id
                  AND ${selectedVersionBoundarySql("boundary")}
                JOIN LATERAL (
                    SELECT palette_id, deleted FROM token_value_revisions candidate
                    WHERE candidate.token_value_id = entity.id
                      AND candidate.version_sequence_number <= boundary.sequence_number
                    ORDER BY candidate.version_sequence_number DESC LIMIT 1
                ) revision ON NOT revision.deleted
                WHERE revision.palette_id IS NOT NULL
            """.trimIndent(),
        ) { rows -> buildList { while (rows.next()) add(rows.getObject(1, UUID::class.java)) } }.orEmpty()
        return PaletteTable.selectAll().where { PaletteTable.id inList ids }.map(::map)
    }

    override suspend fun listByType(type: PaletteType): List<PaletteEntry> = PaletteTable
        .selectAll()
        .where { PaletteTable.type eq type }
        .map(::map)

    override suspend fun find(id: UUID): PaletteEntry? = PaletteTable
        .selectAll()
        .where { PaletteTable.id eq id }
        .limit(1)
        .singleOrNull()
        ?.let(::map)

    override suspend fun create(command: CreatePaletteEntry): PaletteEntry = PaletteTable.insertReturning {
        it[type] = command.type
        it[shade] = command.shade
        it[saturation] = command.saturation
        it[value] = command.value
    }.single().let(::map)

    override suspend fun updateValue(id: UUID, value: String): PaletteEntry? = PaletteTable.updateReturning(
        where = { PaletteTable.id eq id },
    ) {
        it[PaletteTable.value] = value
        it[updatedAt] = Instant.now()
    }.singleOrNull()?.let(::map)

    override suspend fun delete(id: UUID): Boolean = PaletteTable.deleteWhere { PaletteTable.id eq id } > 0

    private fun map(row: ResultRow) = PaletteEntry(
        id = row[PaletteTable.id],
        type = row[PaletteTable.type],
        shade = row[PaletteTable.shade],
        saturation = row[PaletteTable.saturation],
        value = row[PaletteTable.value],
        createdAt = row[PaletteTable.createdAt],
        updatedAt = row[PaletteTable.updatedAt],
    )
}
