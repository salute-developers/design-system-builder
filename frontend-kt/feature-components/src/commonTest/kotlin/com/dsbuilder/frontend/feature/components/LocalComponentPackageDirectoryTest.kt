package com.dsbuilder.frontend.feature.components

import com.dsbuilder.frontend.core.domain.CredentialEnvName
import com.dsbuilder.frontend.core.domain.DesignSystemId
import com.dsbuilder.frontend.core.domain.ProjectContext
import com.dsbuilder.frontend.core.domain.ProjectId
import com.dsbuilder.frontend.feature.components.application.ComponentDestination
import com.dsbuilder.frontend.feature.components.application.ComponentDirectoryReadResult
import com.dsbuilder.frontend.feature.components.application.ComponentPackageWriteResult
import com.dsbuilder.frontend.feature.components.data.LocalComponentPackageDirectoryReader
import com.dsbuilder.frontend.feature.components.data.LocalComponentPackageFileWriter
import com.dsbuilder.frontend.feature.components.domain.ComponentPackageFile
import com.dsbuilder.frontend.feature.components.domain.ComponentPackageWritePlan
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

/**
 * Тесты чтения целевой директории и записи пакета.
 *
 * Реализации решений не принимают, поэтому проверяется ровно исполнение: что прочитано,
 * что записано и куда.
 */
class LocalComponentPackageDirectoryTest {

    private val context = ProjectContext(
        projectId = ProjectId("project-a"),
        designSystemId = DesignSystemId("ds-a"),
        credentialEnvName = CredentialEnvName("DSBUILDER_API_KEY"),
        configPath = "/work/.sdds/config.json",
    )

    private val defaultDirectory = "/work/.sdds/components"

    @Test
    fun readsEmptyStateWhenDirectoryIsAbsent() {
        val reader = LocalComponentPackageDirectoryReader(InMemoryWorkspaceFileSystem())

        val result = reader.read(ComponentDestination(), context)

        // Пустая директория — не отказ: пакет пишется в неё целиком.
        val read = result as ComponentDirectoryReadResult.Read
        assertEquals(defaultDirectory, read.path)
        assertTrue(read.value.entries.isEmpty())
        assertTrue(read.value.fileNames.isEmpty())
    }

    @Test
    fun readsEntriesAndFileNames() {
        val fileSystem = InMemoryWorkspaceFileSystem(
            initialFiles = mapOf(
                "$defaultDirectory/meta.json" to """
                    {"name":"sdds_serv","components":[
                      {"componentName":"check-box","styleName":"check-box","config":"checkbox_config.json"}
                    ]}
                """.trimIndent(),
                "$defaultDirectory/checkbox_config.json" to "{}",
                "$defaultDirectory/badge_config.json" to "{}",
                "$defaultDirectory/README.md" to "",
            ),
        )
        fileSystem.directories += defaultDirectory

        val read = LocalComponentPackageDirectoryReader(fileSystem)
            .read(ComponentDestination(), context) as ComponentDirectoryReadResult.Read

        assertEquals(
            listOf("check-box" to "checkbox_config.json"),
            read.value.entries.map { it.styleName to it.config },
        )
        // Посторонние файлы директории пакетом не считаются и в перечень не попадают.
        assertEquals(listOf("badge_config.json", "checkbox_config.json", "meta.json"), read.value.fileNames)
    }

    @Test
    fun refusesUnreadableMeta() {
        val fileSystem = InMemoryWorkspaceFileSystem(
            initialFiles = mapOf("$defaultDirectory/meta.json" to "{ not json"),
        )
        fileSystem.directories += defaultDirectory

        val result = fileSystem.let { LocalComponentPackageDirectoryReader(it).read(ComponentDestination(), context) }

        // Пустое состояние вместо отказа означало бы переименование всех файлов пакета.
        val failure = result as ComponentDirectoryReadResult.Failed
        assertTrue(failure.message.contains("meta.json"), failure.message)
    }

    @Test
    fun readsExplicitDestination() {
        val fileSystem = InMemoryWorkspaceFileSystem()

        val read = LocalComponentPackageDirectoryReader(fileSystem)
            .read(ComponentDestination("/tmp/pkg"), context) as ComponentDirectoryReadResult.Read

        assertEquals("/tmp/pkg", read.path)
    }

    @Test
    fun writesPlanIntoDirectory() {
        val fileSystem = InMemoryWorkspaceFileSystem()
        val plan = ComponentPackageWritePlan(
            configFiles = listOf(ComponentPackageFile("avatar_config.json", "{\"props\":{}}")),
            meta = ComponentPackageFile("meta.json", "{\"name\":\"sdds_serv\"}"),
        )

        val result = LocalComponentPackageFileWriter(fileSystem).write(plan, ComponentDestination(), context)

        assertEquals(defaultDirectory, (result as ComponentPackageWriteResult.Written).path)
        assertEquals(listOf(defaultDirectory), fileSystem.createdDirectories)
        assertEquals("{\"props\":{}}", fileSystem.files["$defaultDirectory/avatar_config.json"])
        assertEquals("{\"name\":\"sdds_serv\"}", fileSystem.files["$defaultDirectory/meta.json"])
    }

    @Test
    fun leavesUnrelatedFilesInPlace() {
        val fileSystem = InMemoryWorkspaceFileSystem(
            initialFiles = mapOf("$defaultDirectory/spinner_config.json" to "{}"),
        )
        val plan = ComponentPackageWritePlan(
            configFiles = listOf(ComponentPackageFile("avatar_config.json", "{}")),
            meta = ComponentPackageFile("meta.json", "{}"),
            unrelatedFiles = listOf("spinner_config.json"),
        )

        LocalComponentPackageFileWriter(fileSystem).write(plan, ComponentDestination(), context)

        // Директория принадлежит разработчику: сироты предъявляются, а не удаляются.
        assertTrue("$defaultDirectory/spinner_config.json" in fileSystem.files)
    }
}
