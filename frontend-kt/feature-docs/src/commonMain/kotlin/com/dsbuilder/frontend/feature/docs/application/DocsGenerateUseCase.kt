package com.dsbuilder.frontend.feature.docs.application

import com.dsbuilder.frontend.feature.docs.domain.Artifact
import com.dsbuilder.frontend.feature.docs.domain.ArtifactType
import com.dsbuilder.frontend.feature.docs.domain.DesignSystemInfo
import com.dsbuilder.frontend.feature.docs.domain.DocsValidationEngine
import com.dsbuilder.frontend.feature.docs.domain.DocumentationPlatform
import com.dsbuilder.frontend.feature.docs.domain.DocumentationPlatformContext
import com.dsbuilder.frontend.feature.docs.domain.Manifest
import com.dsbuilder.frontend.feature.docs.domain.MergeEngine
import com.dsbuilder.frontend.feature.docs.domain.ResolvedDocs
import com.dsbuilder.frontend.feature.docs.domain.Structure

/**
 * Use case для сборки пакета документации.
 */
public class DocsGenerateUseCase internal constructor(
    private val structureReader: DocsStructureReader,
    private val platformContextReader: DocsPlatformContextReader,
    private val projectContextReader: DocsProjectContextReader,
    private val codec: DocsCodec,
    private val fileSystem: DocsFileSystem,
    private val validationEngine: DocsValidationEngine,
    private val platformAggregator: DocsPlatformAggregator = DocsPlatformAggregator { _, _ ->
        DocsAggregationResult.Skipped
    },
) {
    private val source = DocsGenerationSource(projectContextReader, platformAggregator)

    /**
     * Собирает пакет документации: при необходимости запускает платформенный шаг, затем мержит
     * структуры, пишет `docs.json` и `manifest.json`, валидирует дерево и пакует его в tar.gz.
     */
    @Suppress("ReturnCount")
    public fun execute(command: DocsGenerateCommand): DocsGenerateResult {
        val selection = when (val result = source.selectPlatform(command.platform)) {
            is PlatformSelection.Failure -> return DocsGenerateResult.Failed(result.message)
            is PlatformSelection.Selected -> result
        }
        val platform = selection.documentation
        val tree = when (val result = source.selectDocsTree(command, selection.target)) {
            is DocsTreeSelection.Failure -> return DocsGenerateResult.Failed(result.message)
            is DocsTreeSelection.Selected -> result
        }
        val docsDir = tree.docsDir

        val platformContext = when (val result = readPlatformContext(docsDir, platform)) {
            is PlatformContextRead.Failure -> return DocsGenerateResult.Failed(result.message)
            is PlatformContextRead.Read -> result.context
        }

        // 1. Read and merge structures
        val resolvedDocs = when (val result = readResolvedDocs(docsDir)) {
            is ResolvedDocsRead.Failure -> return DocsGenerateResult.Failed(result.message)
            is ResolvedDocsRead.Read -> result.docs
        }

        // 2. Serialize docs.json and manifest.json
        fileSystem.writeFile("$docsDir/docs.json", codec.serializeResolvedDocs(resolvedDocs))

        val manifest = try {
            buildManifest(
                docsDir = docsDir,
                designSystemId = projectContextReader.designSystemId(),
                designSystemVersion = platformContext?.artifact?.version
                    ?: projectContextReader.designSystemVersion(),
                platform = platform,
            )
        } catch (error: IllegalArgumentException) {
            return DocsGenerateResult.Failed(error.message ?: "Unsupported documentation info-artifact")
        }
        fileSystem.writeFile("$docsDir/manifest.json", codec.serializeManifest(manifest))

        // 3. Validate (docs.json and manifest.json now exist on disk)
        val validationErrors = validationEngine.validate(resolvedDocs, manifest, docsDir)
        if (validationErrors.isNotEmpty()) {
            return DocsGenerateResult.ValidationFailed(validationErrors)
        }

        // 4. Create tar.gz archive
        return DocsGenerateResult.Success(
            bundlePath = createTarGzArchive(docsDir, command.outputGzipPath),
            docsDir = docsDir,
            aggregatedBy = tree.aggregatedBy,
        )
    }

    /**
     * Platform context платформенного агрегатора необязателен, но если он есть, его платформа
     * обязана совпасть с выбранной: иначе пакет соберётся из чужого дерева.
     */
    private fun readPlatformContext(docsDir: String, platform: DocumentationPlatform): PlatformContextRead {
        val context = try {
            platformContextReader.read("$docsDir/meta/platform-context.json")
        } catch (error: IllegalArgumentException) {
            return PlatformContextRead.Failure(error.message ?: "Failed to read platform context")
        }
        if (context != null && context.platform != platform.manifestValue) {
            return PlatformContextRead.Failure(
                "Platform context mismatch: expected ${platform.manifestValue}, found ${context.platform}",
            )
        }

        return PlatformContextRead.Read(context)
    }

    private fun readResolvedDocs(docsDir: String): ResolvedDocsRead {
        val coreStructure: Structure
        val userStructure: Structure
        try {
            coreStructure = structureReader.readStructure("$docsDir/structure-core.json")
            userStructure = structureReader.readOptionalStructure("$docsDir/structure-user.json")
                ?: Structure(schemaVersion = coreStructure.schemaVersion, navigation = emptyList())
        } catch (error: IllegalArgumentException) {
            return ResolvedDocsRead.Failure("Failed to read structure files: ${error.message}")
        }

        return try {
            ResolvedDocsRead.Read(MergeEngine.merge(coreStructure, userStructure))
        } catch (error: IllegalArgumentException) {
            ResolvedDocsRead.Failure("Merge failed: ${error.message}")
        }
    }

    private fun buildManifest(
        docsDir: String,
        designSystemId: String,
        designSystemVersion: String,
        platform: DocumentationPlatform,
    ): Manifest {
        val artifacts = mutableListOf<Artifact>()
        // Всегда включаем docs.json — его мы только что сгенерировали.
        artifacts += Artifact(type = ArtifactType.RESOLVED_DOCS, path = "docs.json", format = "dsb-resolved-docs-v1")

        if (hasDirectory("$docsDir/content")) {
            artifacts += Artifact(type = ArtifactType.CONTENT_ROOT, path = "content/")
        }
        if (hasDirectory("$docsDir/api")) {
            artifacts += Artifact(type = ArtifactType.API_DOCS, path = "api/")
        }
        if (hasFile("$docsDir/meta/components-info.json")) {
            artifacts += infoArtifact(platform, ArtifactType.COMPONENTS_INFO, "meta/components-info.json")
        }
        if (hasFile("$docsDir/meta/theme-info.json")) {
            artifacts += infoArtifact(platform, ArtifactType.THEME_INFO, "meta/theme-info.json")
        }
        if (hasDirectory("$docsDir/assets/screenshots")) {
            artifacts += Artifact(type = ArtifactType.SCREENSHOTS, path = "assets/screenshots/")
        }
        if (hasDirectory("$docsDir/assets/examples")) {
            artifacts += Artifact(type = ArtifactType.CODE_EXAMPLES, path = "assets/examples/")
        }

        return Manifest(
            schemaVersion = "1.0",
            designSystem = DesignSystemInfo(
                id = designSystemId,
                version = designSystemVersion,
            ),
            platform = platform.manifestValue,
            artifacts = artifacts,
        )
    }

    private fun infoArtifact(
        platform: DocumentationPlatform,
        type: ArtifactType,
        path: String,
    ): Artifact {
        val format = requireNotNull(platform.infoArtifactFormat(type)) {
            "Platform ${platform.manifestValue} does not support ${type.name}"
        }
        return Artifact(type = type, path = path, format = format)
    }

    private fun hasDirectory(path: String): Boolean {
        return DocsLocalFileMetadata.hasDirectory(path)
    }

    private fun hasFile(path: String): Boolean {
        return DocsLocalFileMetadata.hasFile(path)
    }

    private fun createTarGzArchive(docsDir: String, tarGzPath: String): String {
        fileSystem.createTarGzArchive(docsDir, tarGzPath)
        return tarGzPath
    }
}

/**
 * Прочитанный platform context платформенного агрегатора.
 */
private sealed interface PlatformContextRead {
    data class Read(
        val context: DocumentationPlatformContext?,
    ) : PlatformContextRead

    data class Failure(
        val message: String,
    ) : PlatformContextRead
}

/**
 * Смерженные структуры документации.
 */
private sealed interface ResolvedDocsRead {
    data class Read(
        val docs: ResolvedDocs,
    ) : ResolvedDocsRead

    data class Failure(
        val message: String,
    ) : ResolvedDocsRead
}
