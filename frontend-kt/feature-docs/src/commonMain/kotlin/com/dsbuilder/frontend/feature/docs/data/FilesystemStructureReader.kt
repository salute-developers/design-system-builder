package com.dsbuilder.frontend.feature.docs.data

import com.dsbuilder.frontend.core.workspace.WorkspaceFileSystem
import com.dsbuilder.frontend.feature.docs.application.DocsStructureReader
import com.dsbuilder.frontend.feature.docs.domain.Structure
import kotlinx.serialization.json.Json

/**
 * Filesystem-based reader for structure-core.json and structure-user.json.
 */
internal class FilesystemStructureReader(
    private val fileSystem: WorkspaceFileSystem,
    private val json: Json,
) : DocsStructureReader {
    override fun readStructure(path: String): Structure {
        return try {
            val content = fileSystem.readText(path)
            json.decodeFromString(Structure.serializer(), content)
        } catch (e: IllegalArgumentException) {
            throw IllegalArgumentException("Failed to read structure file at $path: ${e.message}", e)
        }
    }
}
