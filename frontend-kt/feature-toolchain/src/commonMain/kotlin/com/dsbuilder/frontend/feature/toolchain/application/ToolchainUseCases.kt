package com.dsbuilder.frontend.feature.toolchain.application

import com.dsbuilder.frontend.core.application.ProjectContextReadResult
import com.dsbuilder.frontend.core.application.ProjectContextReader
import com.dsbuilder.frontend.core.domain.TargetPlatform
import com.dsbuilder.frontend.core.platform.Capability
import com.dsbuilder.frontend.core.platform.PlatformDelegate
import com.dsbuilder.frontend.core.platform.PlatformDelegateRegistry
import com.dsbuilder.frontend.core.platform.ToolchainId
import com.dsbuilder.frontend.core.platform.ToolchainStatus
import com.dsbuilder.frontend.core.platform.WorkspacePaths
import com.dsbuilder.frontend.core.workspace.WorkspaceFileSystem

/**
 * Use case для команды `dsbuilder toolchain list`.
 *
 * Показывает, какие платформенные инструменты собраны в этот клиент, ничего не запуская.
 */
public class ListToolchainsUseCase internal constructor(
    private val registry: PlatformDelegateRegistry,
) {
    /**
     * Возвращает зарегистрированные toolchain'ы в порядке регистрации.
     */
    public fun execute(): List<ToolchainSummary> = registry.all.map(PlatformDelegate::toSummary)
}

/**
 * Use case для команды `dsbuilder toolchain doctor`.
 *
 * Спрашивает у делегатов состояние их инструментов, ничего не генерируя.
 */
public class DoctorToolchainsUseCase internal constructor(
    private val registry: PlatformDelegateRegistry,
    private val projectContextReader: ProjectContextReader,
    private val fileSystem: WorkspaceFileSystem,
) {
    /**
     * Проверяет один toolchain (если задана платформа) либо все зарегистрированные.
     */
    public fun execute(command: DoctorToolchainsCommand): DoctorToolchainsResult {
        val delegates = when (val platform = command.platform) {
            null -> registry.all
            else -> listOf(
                registry.forPlatform(platform)
                    ?: return DoctorToolchainsResult.Failed(
                        "No platform toolchain is registered for '${platform.cliValue}'.",
                    ),
            )
        }
        val workspace = resolveWorkspace()

        val toolOverride = command.toolOverride?.let(fileSystem::absolutePath)

        return DoctorToolchainsResult.Checked(
            workspace = workspace,
            entries = delegates.map { delegate ->
                ToolchainDoctorEntry(
                    summary = delegate.toSummary(),
                    status = delegate.doctor(workspace, toolOverride),
                )
            },
        )
    }

    /**
     * Пути рабочей копии: от найденного `.sdds/config.json`, а без проекта — от текущей директории,
     * чтобы `doctor` оставался пригоден в свежем checkout.
     */
    private fun resolveWorkspace(): WorkspacePaths =
        when (val context = projectContextReader.requireContext()) {
            is ProjectContextReadResult.Found ->
                WorkspacePaths.fromConfigPath(fileSystem.absolutePath(context.context.configPath))

            is ProjectContextReadResult.Failed -> {
                val workingDirectory = fileSystem.currentWorkingDirectory()
                WorkspacePaths(
                    sddsDir = fileSystem.resolve(workingDirectory, ".sdds"),
                    workspaceDir = workingDirectory,
                )
            }
        }
}

/**
 * Command model для [DoctorToolchainsUseCase].
 *
 * @property platform платформа из `--platform`; `null` — проверить все toolchain'ы.
 * @property toolOverride путь инструмента из `--tool`: проверяется именно он, а не стандартные места.
 */
public data class DoctorToolchainsCommand(
    public val platform: TargetPlatform? = null,
    public val toolOverride: String? = null,
)

/**
 * Результат команды `toolchain doctor`.
 */
public sealed interface DoctorToolchainsResult {
    /**
     * Проверка выполнена.
     *
     * @property workspace рабочая копия, относительно которой проверялись инструменты.
     * @property entries состояние каждого проверенного toolchain'а.
     */
    public data class Checked(
        public val workspace: WorkspacePaths,
        public val entries: List<ToolchainDoctorEntry>,
    ) : DoctorToolchainsResult

    /**
     * Проверить нечего: запрошенная платформа никем не обслуживается.
     *
     * @property message user-facing объяснение.
     */
    public data class Failed(
        public val message: String,
    ) : DoctorToolchainsResult
}

/**
 * Состояние одного toolchain'а.
 *
 * @property summary что это за toolchain.
 * @property status что сообщил его `doctor`.
 */
public data class ToolchainDoctorEntry(
    public val summary: ToolchainSummary,
    public val status: ToolchainStatus,
)

/**
 * Описание зарегистрированного toolchain'а.
 *
 * @property toolchain идентификатор toolchain'а.
 * @property platforms платформы, которые он обслуживает.
 * @property capabilities что он умеет.
 */
public data class ToolchainSummary(
    public val toolchain: ToolchainId,
    public val platforms: List<TargetPlatform>,
    public val capabilities: List<Capability>,
)

/** Порядок платформ и capability берётся из их объявления, чтобы вывод был детерминированным. */
private fun PlatformDelegate.toSummary(): ToolchainSummary = ToolchainSummary(
    toolchain = toolchain,
    platforms = TargetPlatform.entries.filter { it in platforms },
    capabilities = Capability.entries.filter { it in capabilities },
)
