package com.dsbuilder.frontend.cli.feature.docs.application

import com.dsbuilder.frontend.cli.feature.docs.domain.DocsValidationEngine
import com.dsbuilder.frontend.cli.feature.docs.domain.DocumentationArtifactContext
import com.dsbuilder.frontend.cli.feature.docs.domain.DocumentationPlatformContext
import com.dsbuilder.frontend.cli.feature.docs.domain.Manifest
import com.dsbuilder.frontend.cli.feature.docs.domain.ResolvedDocs
import com.dsbuilder.frontend.cli.feature.docs.domain.Structure
import com.dsbuilder.frontend.cli.feature.docs.domain.ValidationError
import kotlin.test.Test
import kotlin.test.assertContains
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertIs
import kotlin.test.assertTrue

class DocsGenerateUseCaseTest {
    @Test
    fun `validation errors fail generation without creating archive`() {
        val fileSystem = RecordingDocsFileSystem()
        val codec = RecordingDocsCodec()
        val useCase = DocsGenerateUseCase(
            structureReader = object : DocsStructureReader {
                override fun readStructure(path: String) = Structure("1.0", emptyList())
            },
            platformContextReader = DocsPlatformContextReader { platformContext() },
            projectContextReader = object : DocsProjectContextReader {
                override fun designSystemId() = "design-system"

                override fun designSystemVersion() = "0.0.0"
            },
            codec = codec,
            fileSystem = fileSystem,
            validationEngine = object : DocsValidationEngine {
                override fun validate(
                    resolvedDocs: ResolvedDocs,
                    manifest: Manifest,
                    docsDir: String,
                ) = listOf(ValidationError.MissingArtifact("content", "directory"))
            },
        )

        val result = useCase.execute(DocsGenerateCommand("/docs", "/output/docs.tar.gz", "compose"))

        val failure = assertIs<DocsGenerateResult.ValidationFailed>(result)
        assertEquals(listOf(ValidationError.MissingArtifact("content", "directory")), failure.errors)
        assertFalse(fileSystem.archiveCreated)
    }

    @Test
    fun `platform artifact version is written to manifest`() {
        val fileSystem = RecordingDocsFileSystem()
        val codec = RecordingDocsCodec()
        val useCase = useCase(fileSystem, codec, platformContext(version = "0.12.0"))

        val result = useCase.execute(DocsGenerateCommand("/docs", "/output/docs.tar.gz", "compose"))

        assertIs<DocsGenerateResult.Success>(result)
        assertEquals("0.12.0", codec.manifest?.designSystem?.version)
        assertTrue(fileSystem.archiveCreated)
    }

    @Test
    fun `missing platform context uses project context version`() {
        val fileSystem = RecordingDocsFileSystem()
        val codec = RecordingDocsCodec()
        val useCase = useCase(fileSystem, codec, null, fallbackVersion = "0.0.0")

        val result = useCase.execute(DocsGenerateCommand("/docs", "/output/docs.tar.gz", "compose"))

        assertIs<DocsGenerateResult.Success>(result)
        assertEquals("0.0.0", codec.manifest?.designSystem?.version)
        assertTrue(fileSystem.archiveCreated)
    }

    @Test
    fun `platform mismatch fails generation without creating archive`() {
        val fileSystem = RecordingDocsFileSystem()
        val result = useCase(
            fileSystem,
            RecordingDocsCodec(),
            platformContext(platform = "android-view"),
        ).execute(DocsGenerateCommand("/docs", "/output/docs.tar.gz", "compose"))

        val failure = assertIs<DocsGenerateResult.Failed>(result)
        assertContains(failure.message, "Platform context mismatch")
        assertFalse(fileSystem.archiveCreated)
    }

    private fun useCase(
        fileSystem: RecordingDocsFileSystem,
        codec: RecordingDocsCodec,
        platformContext: DocumentationPlatformContext?,
        fallbackVersion: String = "0.0.0",
    ) = DocsGenerateUseCase(
        structureReader = object : DocsStructureReader {
            override fun readStructure(path: String) = Structure("1.0", emptyList())
        },
        platformContextReader = DocsPlatformContextReader { platformContext },
        projectContextReader = object : DocsProjectContextReader {
            override fun designSystemId() = "design-system"

            override fun designSystemVersion() = fallbackVersion
        },
        codec = codec,
        fileSystem = fileSystem,
        validationEngine = object : DocsValidationEngine {
            override fun validate(
                resolvedDocs: ResolvedDocs,
                manifest: Manifest,
                docsDir: String,
            ) = emptyList<ValidationError>()
        },
    )

    private fun platformContext(
        version: String = "0.12.0",
        platform: String = "compose",
    ) = DocumentationPlatformContext(
        artifact = DocumentationArtifactContext("sdds-sbcom-compose", version),
        platform = platform,
    )

    private class RecordingDocsCodec : DocsCodec {
        var manifest: Manifest? = null

        override fun serializeResolvedDocs(docs: ResolvedDocs) = "{}"

        override fun serializeManifest(manifest: Manifest): String {
            this.manifest = manifest
            return "{}"
        }
    }

    private class RecordingDocsFileSystem : DocsFileSystem {
        var archiveCreated = false

        override fun writeFile(path: String, content: String) = Unit

        override fun createTarGzArchive(sourceDir: String, tarGzPath: String) {
            archiveCreated = true
        }
    }
}
