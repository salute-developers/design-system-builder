package com.dsbuilder.frontend.core.application

import com.dsbuilder.frontend.core.auth.EnvironmentReader
import com.dsbuilder.frontend.core.workspace.ProjectEnvParseException
import com.dsbuilder.frontend.core.workspace.ProjectEnvParser
import com.dsbuilder.frontend.core.workspace.WorkspaceFileSystem

/** Читает один снимок `.env` рядом с найденной `.sdds` без изменения env процесса. */
public class ProjectEnvironmentLoader(
    private val fileSystem: WorkspaceFileSystem,
    private val parser: ProjectEnvParser = ProjectEnvParser(),
) {
    /** Возвращает локальные значения одного проекта или `null`, если файла нет. */
    public fun load(configPath: String): EnvironmentReader? {
        val projectDirectory = projectDirectory(configPath)
        val envPath = fileSystem.resolve(projectDirectory, ".env")
        if (!fileSystem.exists(envPath)) return null
        val content = readContent(envPath)
        val values = try {
            parser.parse(content)
        } catch (error: ProjectEnvParseException) {
            throw ProjectEnvironmentException("Invalid project .env at $envPath, line ${error.lineNumber}.")
        }
        return EnvironmentReader { name -> values[name] }
    }

    private fun projectDirectory(configPath: String): String {
        val configDirectory = fileSystem.parent(fileSystem.absolutePath(configPath))
            ?: throw ProjectEnvironmentException("Invalid project config path.")
        return fileSystem.parent(configDirectory)
            ?: throw ProjectEnvironmentException("Invalid project config path.")
    }

    private fun readContent(envPath: String): String {
        val bytes = try {
            fileSystem.readBytes(envPath)
        } catch (_: Exception) {
            throw ProjectEnvironmentException("Cannot read project .env at $envPath.")
        }
        return try {
            bytes.decodeToString(throwOnInvalidSequence = true)
        } catch (_: Exception) {
            throw ProjectEnvironmentException("Invalid UTF-8 in project .env at $envPath.")
        }
    }
}

/** Диагностика project env без значения секретной переменной. */
public class ProjectEnvironmentException(message: String) : IllegalArgumentException(message)
