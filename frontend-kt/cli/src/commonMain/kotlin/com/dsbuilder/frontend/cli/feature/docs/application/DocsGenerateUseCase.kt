package com.dsbuilder.frontend.cli.feature.docs.application

import com.dsbuilder.frontend.cli.feature.docs.domain.Artifact
import com.dsbuilder.frontend.cli.feature.docs.domain.ArtifactType
import com.dsbuilder.frontend.cli.feature.docs.domain.DesignSystemInfo
import com.dsbuilder.frontend.cli.feature.docs.domain.DocsValidationEngine
import com.dsbuilder.frontend.cli.feature.docs.domain.DocumentationPlatform
import com.dsbuilder.frontend.cli.feature.docs.domain.Manifest
import com.dsbuilder.frontend.cli.feature.docs.domain.MergeEngine
import com.dsbuilder.frontend.cli.feature.docs.domain.ResolvedDocs
import com.dsbuilder.frontend.cli.feature.docs.domain.Structure
import okio.FileSystem
import okio.Path.Companion.toPath
import okio.SYSTEM

/**
 * Use case для сборки пакета документации.
 */
internal class DocsGenerateUseCase(
    private val structureReader: DocsStructureReader,
    private val platformContextReader: DocsPlatformContextReader,
    private val projectContextReader: DocsProjectContextReader,
    private val codec: DocsCodec,
    private val fileSystem: DocsFileSystem,
    private val validationEngine: DocsValidationEngine,
    private val ioFileSystem: FileSystem = FileSystem.SYSTEM,
) {
    /**
     * Собирает пакет документации из директории агрегатора.
     */
    @Suppress("ReturnCount")
    internal fun execute(command: DocsGenerateCommand): DocsGenerateResult {
        val platform = DocumentationPlatform.fromManifestValue(command.platform)
            ?: return DocsGenerateResult.Failed("Unknown documentation platform: ${command.platform}")
        val platformContext = try {
            platformContextReader.read("${command.docsDir}/meta/platform-context.json")
        } catch (error: IllegalArgumentException) {
            return DocsGenerateResult.Failed(error.message ?: "Failed to read platform context")
        }
        if (platformContext != null && platformContext.platform != platform.manifestValue) {
            return DocsGenerateResult.Failed(
                "Platform context mismatch: expected ${platform.manifestValue}, found ${platformContext.platform}",
            )
        }

        // 1. Read structures
        val corePath = "${command.docsDir}/structure-core.json"
        val userPath = "${command.docsDir}/structure-user.json"

        val coreStructure: Structure
        val userStructure: Structure

        try {
            coreStructure = structureReader.readStructure(corePath)
            userStructure = structureReader.readStructure(userPath)
        } catch (e: IllegalArgumentException) {
            return DocsGenerateResult.Failed("Failed to read structure files: ${e.message}")
        }

        // 2. Merge
        val resolvedDocs: ResolvedDocs
        try {
            resolvedDocs = MergeEngine.merge(coreStructure, userStructure)
        } catch (e: IllegalArgumentException) {
            return DocsGenerateResult.Failed("Merge failed: ${e.message}")
        }

        // 3. Serialize docs.json and manifest.json
        val docsJson = codec.serializeResolvedDocs(resolvedDocs)
        val docsJsonPath = "${command.docsDir}/docs.json"
        fileSystem.writeFile(docsJsonPath, docsJson)

        // Generate manifest.json
        val manifest = try {
            buildManifest(
                docsDir = command.docsDir,
                designSystemId = projectContextReader.designSystemId(),
                designSystemVersion = platformContext?.artifact?.version
                    ?: projectContextReader.designSystemVersion(),
                platform = platform,
            )
        } catch (error: IllegalArgumentException) {
            return DocsGenerateResult.Failed(error.message ?: "Unsupported documentation info-artifact")
        }
        val manifestJson = codec.serializeManifest(manifest)
        val manifestJsonPath = "${command.docsDir}/manifest.json"
        fileSystem.writeFile(manifestJsonPath, manifestJson)

        // 4. Validate (docs.json and manifest.json now exist on disk)
        val validationErrors = validationEngine.validate(resolvedDocs, manifest, command.docsDir)
        if (validationErrors.isNotEmpty()) {
            return DocsGenerateResult.ValidationFailed(validationErrors)
        }

        // 6. Create tar.gz archive
        val tarGzPath = createTarGzArchive(command.docsDir, command.outputGzipPath)

        return DocsGenerateResult.Success(
            bundlePath = tarGzPath,
        )
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
        return try {
            ioFileSystem.metadata(path.toPath()).isDirectory
        } catch (_: Exception) {
            false
        }
    }

    private fun hasFile(path: String): Boolean {
        return try {
            !ioFileSystem.metadata(path.toPath()).isDirectory
        } catch (_: Exception) {
            false
        }
    }

    private fun createTarGzArchive(docsDir: String, tarGzPath: String): String {
        fileSystem.createTarGzArchive(docsDir, tarGzPath)
        return tarGzPath
    }
}
