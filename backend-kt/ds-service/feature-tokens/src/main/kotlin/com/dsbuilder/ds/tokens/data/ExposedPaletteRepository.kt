package com.dsbuilder.ds.tokens.data

import com.dsbuilder.ds.tokens.application.CreatePaletteEntry
import com.dsbuilder.ds.tokens.application.PaletteRepository
import com.dsbuilder.ds.tokens.domain.PaletteEntry
import com.dsbuilder.ds.tokens.domain.PaletteType
import org.jetbrains.exposed.v1.core.ResultRow
import org.jetbrains.exposed.v1.core.eq
import org.jetbrains.exposed.v1.jdbc.deleteWhere
import org.jetbrains.exposed.v1.jdbc.insertReturning
import org.jetbrains.exposed.v1.jdbc.selectAll
import org.jetbrains.exposed.v1.jdbc.updateReturning
import java.time.Instant
import java.util.UUID

/** Exposed repository for the globally shared palette. */
class ExposedPaletteRepository : PaletteRepository {
    override suspend fun list(): List<PaletteEntry> = PaletteTable.selectAll().map(::map)

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
