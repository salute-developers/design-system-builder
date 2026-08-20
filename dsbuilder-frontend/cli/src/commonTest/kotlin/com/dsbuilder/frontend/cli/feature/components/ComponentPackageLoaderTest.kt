package com.dsbuilder.frontend.cli.feature.components

import com.dsbuilder.frontend.cli.core.config.CliFileSystem
import com.dsbuilder.frontend.cli.core.domain.CredentialEnvName
import com.dsbuilder.frontend.cli.core.domain.DesignSystemId
import com.dsbuilder.frontend.cli.core.domain.ProjectContext
import com.dsbuilder.frontend.cli.core.domain.ProjectId
import com.dsbuilder.frontend.cli.feature.components.application.ComponentSource
import com.dsbuilder.frontend.cli.feature.components.data.DefaultComponentPackageLoader
import com.dsbuilder.frontend.cli.feature.components.domain.ComponentPackage
import com.dsbuilder.frontend.cli.feature.components.domain.ComponentPackageResult
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue
import kotlin.test.fail

class ComponentPackageLoaderTest {
    private val context = ProjectContext(
        projectId = ProjectId("project-a"),
        designSystemId = DesignSystemId("ds-a"),
        credentialEnvName = CredentialEnvName("DSBUILDER_API_KEY"),
        configPath = "/work/.sdds/config.json",
    )

    @Test
    fun readsDefaultLocalDirectory() {
        val fileSystem = fileSystemWithPackage("/work/.sdds/components")

        val loaded = loadOrFail(loader(fileSystem), ComponentSource())

        assertEquals("sdds_sbcom", loaded.name)
        assertEquals("/work/.sdds/components", loaded.origin)
        assertEquals(2, loaded.configurations.size)
    }

    @Test
    fun readsExplicitLocalDirectory() {
        val fileSystem = fileSystemWithPackage("/elsewhere/configs")

        val loaded = loadOrFail(loader(fileSystem), ComponentSource("/elsewhere/configs"))

        assertEquals("/elsewhere/configs", loaded.origin)
        assertEquals(2, loaded.configurations.size)
    }

    @Test
    fun keepsComponentIdentityFromMeta() {
        val fileSystem = fileSystemWithPackage("/work/.sdds/components")

        val loaded = loadOrFail(loader(fileSystem), ComponentSource())

        assertEquals(listOf("badge", "badge"), loaded.configurations.map { it.componentName })
        assertEquals(listOf("badge-clear", "badge-solid"), loaded.configurations.map { it.styleName })
    }

    @Test
    fun rejectsMissingDirectory() {
        val message = failureOf(loader(FakeFileSystem()), ComponentSource())

        assertTrue(message.contains("does not exist"), message)
        assertTrue(message.contains("/work/.sdds/components"), message)
    }

    @Test
    fun rejectsMissingMeta() {
        val fileSystem = FakeFileSystem().apply { addDirectory("/work/.sdds/components") }

        val message = failureOf(loader(fileSystem), ComponentSource())

        assertTrue(message.contains("meta.json"), message)
    }

    @Test
    fun rejectsConfigReferencedByMetaButAbsent() {
        val fileSystem = FakeFileSystem().apply {
            addDirectory("/work/.sdds/components")
            addFile(
                "/work/.sdds/components/meta.json",
                """{"name":"x","components":[{"componentName":"a","styleName":"a","config":"a_config.json"}]}""",
            )
        }

        val message = failureOf(loader(fileSystem), ComponentSource())

        assertTrue(message.contains("a_config.json"), message)
        assertTrue(message.contains("absent"), message)
    }

    @Test
    fun rejectsUnparsableMeta() {
        val fileSystem = FakeFileSystem().apply {
            addDirectory("/work/.sdds/components")
            addFile("/work/.sdds/components/meta.json", "{not json")
        }

        val message = failureOf(loader(fileSystem), ComponentSource())

        assertTrue(message.contains("cannot be parsed"), message)
    }

    private fun loader(fileSystem: CliFileSystem) = DefaultComponentPackageLoader(fileSystem)

    private fun loadOrFail(
        loader: DefaultComponentPackageLoader,
        source: ComponentSource,
    ): ComponentPackage = when (val result = loader.load(source, context)) {
        is ComponentPackageResult.Loaded -> result.value
        is ComponentPackageResult.Failed -> fail("чтение пакета отказало: ${result.message}")
    }

    private fun failureOf(
        loader: DefaultComponentPackageLoader,
        source: ComponentSource,
    ): String = when (val result = loader.load(source, context)) {
        is ComponentPackageResult.Loaded -> fail("ожидался отказ, пакет прочитан")
        is ComponentPackageResult.Failed -> result.message
    }

    private fun fileSystemWithPackage(directory: String): FakeFileSystem = FakeFileSystem().apply {
        addDirectory(directory)
        addFile(
            "$directory/meta.json",
            """
            {"name":"sdds_sbcom","version":"0.1.0","components":[
              {"componentName":"badge","styleName":"badge-clear","config":"badge_clear_config.json"},
              {"componentName":"badge","styleName":"badge-solid","config":"badge_solid_config.json"}
            ]}
            """.trimIndent(),
        )
        addFile("$directory/badge_clear_config.json", NativeConfigCorpus.plasmaStardsDivider)
        addFile("$directory/badge_solid_config.json", NativeConfigCorpus.plasmaB2cAvatarGroup)
    }
}

/**
 * Минимальная файловая система в памяти для тестов источников.
 */
private class FakeFileSystem : CliFileSystem {
    private val files = mutableMapOf<String, String>()
    private val directories = mutableSetOf<String>()

    fun addFile(path: String, text: String) {
        files[path] = text
    }

    fun addDirectory(path: String) {
        directories += path
    }

    override fun currentWorkingDirectory(): String = "/work"

    override fun parent(path: String): String? = path.substringBeforeLast('/', "").takeIf { it.isNotEmpty() }

    override fun resolve(parent: String, child: String): String = "${parent.trimEnd('/')}/$child"

    override fun exists(path: String): Boolean = path in files || path in directories

    override fun createDirectories(path: String) {
        directories += path
    }

    override fun listFiles(path: String): List<String> = files.keys.filter { parent(it) == path }

    override fun readText(path: String): String = files.getValue(path)

    override fun writeText(path: String, text: String) {
        files[path] = text
    }

    override fun deleteFile(path: String) {
        files.remove(path)
    }
}
