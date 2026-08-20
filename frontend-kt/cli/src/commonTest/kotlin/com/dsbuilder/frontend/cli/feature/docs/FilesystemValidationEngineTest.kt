package com.dsbuilder.frontend.cli.feature.docs

import com.dsbuilder.frontend.cli.feature.docs.data.FilesystemValidationEngine
import com.dsbuilder.frontend.cli.feature.docs.domain.Artifact
import com.dsbuilder.frontend.cli.feature.docs.domain.ArtifactType
import com.dsbuilder.frontend.cli.feature.docs.domain.ContentRef
import com.dsbuilder.frontend.cli.feature.docs.domain.DesignSystemInfo
import com.dsbuilder.frontend.cli.feature.docs.domain.DocsValidationEngine
import com.dsbuilder.frontend.cli.feature.docs.domain.Manifest
import com.dsbuilder.frontend.cli.feature.docs.domain.ResolvedDocs
import com.dsbuilder.frontend.cli.feature.docs.domain.ResolvedNavigationNode
import com.dsbuilder.frontend.cli.feature.docs.domain.Source
import com.dsbuilder.frontend.cli.feature.docs.domain.validateDuplicatePaths
import com.dsbuilder.frontend.cli.feature.docs.domain.validatePathSafety
import okio.FileSystem
import okio.Path
import okio.SYSTEM
import kotlin.random.Random
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class FilesystemValidationEngineTest {

    @Test
    fun validateDuplicatePathsReturnsError() {
        val resolvedDocs = ResolvedDocs(
            navigation = listOf(
                ResolvedNavigationNode(
                    title = "Group",
                    subjects = emptyList(),
                    items = listOf(
                        ResolvedNavigationNode(
                            title = "Page1",
                            path = "page.md",
                            subjects = emptyList(),
                            contentRefs = emptyList(),
                        ),
                        ResolvedNavigationNode(
                            title = "Page2",
                            path = "page.md",
                            subjects = emptyList(),
                            contentRefs = emptyList(),
                        ),
                    ),
                ),
            ),
        )

        val errors = validateDuplicatePaths(resolvedDocs.navigation)

        assertEquals(1, errors.size)
        assertEquals("page.md", errors[0].path)
    }

    @Test
    fun validatePathSafetyReturnsError() {
        val resolvedDocs = ResolvedDocs(
            navigation = listOf(
                ResolvedNavigationNode(
                    title = "Page",
                    subjects = emptyList(),
                    path = "../../etc/passwd",
                    contentRefs = emptyList(),
                ),
            ),
        )

        val errors = validatePathSafety(resolvedDocs.navigation)

        assertEquals(1, errors.size)
        assertEquals("../../etc/passwd", errors[0].path)
    }

    @Test
    fun validatePathSafetyPasses() {
        val resolvedDocs = ResolvedDocs(
            navigation = listOf(
                ResolvedNavigationNode(
                    title = "Page",
                    subjects = emptyList(),
                    path = "components/ButtonUsage.md",
                    contentRefs = emptyList(),
                ),
            ),
        )

        val errors = validatePathSafety(resolvedDocs.navigation)

        assertTrue(errors.isEmpty())
    }

    @Test
    fun fileSystemValidationChecksContentExists() {
        withTempDirectory { tempRoot ->
            val coreDir = tempRoot / "content" / "core"
            FileSystem.SYSTEM.createDirectories(coreDir)
            FileSystem.SYSTEM.write(coreDir / "page.md") { writeUtf8("# Page") }

            val docsDir = tempRoot.toString()
            val fileSystem = TestCliFileSystem(docsDir)
            val engine: DocsValidationEngine = FilesystemValidationEngine(fileSystem)

            val resolvedDocs = ResolvedDocs(
                navigation = listOf(
                    ResolvedNavigationNode(
                        title = "Page",
                        subjects = emptyList(),
                        path = "page.md",
                        contentRefs = listOf(
                            ContentRef(Source.Core, "page.md"),
                            ContentRef(Source.User, "user.md"),
                        ),
                    ),
                ),
            )

            val manifest = Manifest(
                schemaVersion = "1.0",
                designSystem = DesignSystemInfo(id = "test", version = "1.0"),
                platform = "compose",
                artifacts = emptyList(),
            )

            val errors = engine.validate(resolvedDocs, manifest, docsDir)

            assertTrue(
                errors.any { it is com.dsbuilder.frontend.cli.feature.docs.domain.ValidationError.MissingContent },
            )
        }
    }

    @Test
    fun fileSystemValidationChecksManifestArtifacts() {
        withTempDirectory { tempRoot ->
            FileSystem.SYSTEM.createDirectories(tempRoot / "content")

            val docsDir = tempRoot.toString()
            val fileSystem = TestCliFileSystem(tempRoot.toString())
            val engine: DocsValidationEngine = FilesystemValidationEngine(fileSystem)

            val resolvedDocs = ResolvedDocs(navigation = emptyList())
            val manifest = Manifest(
                schemaVersion = "1.0",
                designSystem = DesignSystemInfo(id = "test", version = "1.0"),
                platform = "compose",
                artifacts = listOf(
                    Artifact(ArtifactType.CONTENT_ROOT, "content/"),
                    Artifact(ArtifactType.SCREENSHOTS, "assets/screenshots/"),
                ),
            )

            val errors = engine.validate(resolvedDocs, manifest, docsDir)

            assertTrue(
                errors.any { it is com.dsbuilder.frontend.cli.feature.docs.domain.ValidationError.MissingArtifact },
            )
        }
    }

    @Test
    fun validateReturnsEmptyListForValidPackage() {
        withTempDirectory { tempRoot ->
            val contentCore = tempRoot / "content" / "core"
            val contentUser = tempRoot / "content" / "user"
            FileSystem.SYSTEM.createDirectories(contentCore)
            FileSystem.SYSTEM.createDirectories(contentUser)
            FileSystem.SYSTEM.createDirectories(tempRoot / "assets")
            FileSystem.SYSTEM.write(contentCore / "page.md") { writeUtf8("# Page") }
            FileSystem.SYSTEM.write(contentUser / "page.md") { writeUtf8("# User page") }

            val docsDir = tempRoot.toString()
            val fileSystem = TestCliFileSystem(tempRoot.toString())
            val engine: DocsValidationEngine = FilesystemValidationEngine(fileSystem)

            val resolvedDocs = ResolvedDocs(
                navigation = listOf(
                    ResolvedNavigationNode(
                        title = "Page",
                        subjects = emptyList(),
                        path = "page.md",
                        contentRefs = listOf(
                            ContentRef(Source.Core, "content/core/page.md"),
                            ContentRef(Source.User, "content/user/page.md"),
                        ),
                    ),
                ),
            )

            val manifest = Manifest(
                schemaVersion = "1.0",
                designSystem = DesignSystemInfo(id = "test", version = "1.0"),
                platform = "compose",
                artifacts = listOf(
                    Artifact(ArtifactType.CONTENT_ROOT, "content/"),
                    Artifact(ArtifactType.SCREENSHOTS, "assets/"),
                ),
            )

            val errors = engine.validate(resolvedDocs, manifest, docsDir)

            assertTrue(errors.isEmpty())
        }
    }

    private fun withTempDirectory(block: (Path) -> Unit) {
        val root = FileSystem.SYSTEM_TEMPORARY_DIRECTORY / "docs-validate-${Random.nextLong()}"
        FileSystem.SYSTEM.createDirectories(root)
        try {
            block(root)
        } finally {
            FileSystem.SYSTEM.deleteRecursively(root, mustExist = false)
        }
    }
}
