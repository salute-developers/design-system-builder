package com.dsbuilder.ds.tokens.application

import com.dsbuilder.ds.tokens.domain.PaletteEntry
import com.dsbuilder.ds.tokens.domain.PaletteType
import java.util.UUID

/** Global palette storage contract. Mutations are guarded in application use cases. */
interface PaletteRepository {
    /** Performs the list operation. */
    suspend fun list(): List<PaletteEntry>

    /** Performs the listByType operation. */
    suspend fun listByType(type: PaletteType): List<PaletteEntry>

    /** Performs the find operation. */
    suspend fun find(id: UUID): PaletteEntry?

    /** Performs the create operation. */
    suspend fun create(command: CreatePaletteEntry): PaletteEntry

    /** Performs the updateValue operation. */
    suspend fun updateValue(id: UUID, value: String): PaletteEntry?

    /** Performs the delete operation. */
    suspend fun delete(id: UUID): Boolean
}
