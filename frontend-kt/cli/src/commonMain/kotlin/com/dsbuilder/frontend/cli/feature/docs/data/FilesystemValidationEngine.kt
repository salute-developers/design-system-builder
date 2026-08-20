package com.dsbuilder.frontend.cli.feature.docs.data

import com.dsbuilder.frontend.cli.core.config.CliFileSystem
import com.dsbuilder.frontend.cli.feature.docs.domain.ArtifactType
import com.dsbuilder.frontend.cli.feature.docs.domain.ContentRef
import com.dsbuilder.frontend.cli.feature.docs.domain.DocsValidationEngine
import com.dsbuilder.frontend.cli.feature.docs.domain.Manifest
import com.dsbuilder.frontend.cli.feature.docs.domain.ResolvedDocs
import com.dsbuilder.frontend.cli.feature.docs.domain.ValidationError
import com.dsbuilder.frontend.cli.feature.docs.domain.validateDuplicatePaths
import com.dsbuilder.frontend.cli.feature.docs.domain.validatePathSafety

/**
 * Реализация [DocsValidationEngine] на основе файловой системы.
 *
 * Проверяет:
 * - Content-файлы существуют в `content/{source}/`
 * - Нет дубликатов путей (domain-логика)
 * - Пути безопасны (domain-логика)
 * - Артефакты из manifest существуют на диске
 */
internal class FilesystemValidationEngine(
    private val fileSystem: CliFileSystem,
) : DocsValidationEngine {

    private val directoryTypes = setOf(
        ArtifactType.CONTENT_ROOT,
        ArtifactType.API_DOCS,
        ArtifactType.SCREENSHOTS,
        ArtifactType.CODE_EXAMPLES,
    )

    override fun validate(
        resolvedDocs: ResolvedDocs,
        manifest: Manifest,
        docsDir: String,
    ): List<ValidationError> {
        val errors = mutableListOf<ValidationError>()

        // Domain-валидации (не зависят от файловой системы)
        errors += validateDuplicatePaths(resolvedDocs.navigation)
        errors += validatePathSafety(resolvedDocs.navigation)

        // Filesystem-валидации
        errors += validateContentRefs(resolvedDocs, docsDir)
        errors += validateManifestArtifacts(manifest, docsDir)

        return errors
    }

    private fun validateContentRefs(
        resolvedDocs: ResolvedDocs,
        docsDir: String,
    ): List<ValidationError.MissingContent> {
        val missing = mutableListOf<ValidationError.MissingContent>()
        validateContentRefsRecursive(resolvedDocs.navigation, docsDir, missing)
        return missing
    }

    private fun validateContentRefsRecursive(
        nodes: List<com.dsbuilder.frontend.cli.feature.docs.domain.ResolvedNavigationNode>,
        docsDir: String,
        missing: MutableList<ValidationError.MissingContent>,
    ) {
        nodes.forEach { node ->
            node.contentRefs.forEach { ref ->
                val fullPath = resolveContentPath(docsDir, ref)
                if (!fileSystem.exists(fullPath)) {
                    missing.add(ValidationError.MissingContent(fullPath))
                }
            }
            validateContentRefsRecursive(node.items, docsDir, missing)
        }
    }

    private fun resolveContentPath(docsDir: String, ref: ContentRef): String {
        return "$docsDir/${ref.path}"
    }

    private fun validateManifestArtifacts(
        manifest: Manifest,
        docsDir: String,
    ): List<ValidationError.MissingArtifact> {
        val missing = mutableListOf<ValidationError.MissingArtifact>()
        manifest.artifacts.forEach { artifact ->
            val fullPath = "$docsDir/${artifact.path}"
            val exists = if (artifact.type in directoryTypes) {
                fileSystem.isDirectory(fullPath)
            } else {
                fileSystem.exists(fullPath) && !fileSystem.isDirectory(fullPath)
            }
            if (!exists) {
                missing.add(ValidationError.MissingArtifact(artifact.path, artifact.type.name))
            }
        }
        return missing
    }
}
