package com.dsbuilder.frontend.core.platform

import com.dsbuilder.frontend.core.application.ProjectContextReadResult
import com.dsbuilder.frontend.core.application.ProjectContextReader
import com.dsbuilder.frontend.core.domain.TargetPlatform
import com.dsbuilder.frontend.core.workspace.WorkspaceFileSystem

/**
 * Общий сценарий делегирования: найти проект, выбрать платформу, взять делегат, проверить
 * toolchain и запустить его.
 *
 * Один и тот же порядок нужен `theme generate`, `components generate` и платформенному шагу
 * `docs generate`, поэтому он живёт здесь, а не в каждой фиче.
 */
public class PlatformCapabilityRunner internal constructor(
    private val projectContextReader: ProjectContextReader,
    private val registry: PlatformDelegateRegistry,
    private val fileSystem: WorkspaceFileSystem,
) {
    /**
     * Выполняет capability платформенным инструментом.
     *
     * @param command что запустить и с какими параметрами.
     * @param onPlan вызывается до запуска инструмента с разрешённым планом, чтобы presentation
     * успела напечатать, что и чем запускается.
     */
    @Suppress("ReturnCount")
    public fun execute(
        command: PlatformRunCommand,
        onPlan: (PlatformRunPlan) -> Unit = {},
    ): PlatformRunResult {
        val context = when (val result = projectContextReader.requireContext()) {
            is ProjectContextReadResult.Found -> result.context
            is ProjectContextReadResult.Failed -> return PlatformRunResult.Failed(result.message)
        }

        val platform = when (val resolution = PlatformResolver.resolve(command.platform, context.platforms)) {
            is PlatformResolution.Resolved -> resolution.platform
            is PlatformResolution.Failed -> return PlatformRunResult.Failed(resolution.message)
        }

        val delegate = registry.forPlatform(platform)
            ?: return PlatformRunResult.Failed(noDelegateMessage(platform))

        if (command.capability !in delegate.capabilities) {
            return PlatformRunResult.Failed(
                "Toolchain '${delegate.toolchain}' does not support ${command.capability.label} " +
                    "for platform '${platform.cliValue}'.",
            )
        }

        val workspace = WorkspacePaths.fromConfigPath(fileSystem.absolutePath(context.configPath))
        val plan = PlatformRunPlan(platform = platform, toolchain = delegate.toolchain, workspace = workspace)

        when (val status = delegate.doctor(workspace)) {
            is ToolchainStatus.Ready -> Unit
            is ToolchainStatus.Missing -> return PlatformRunResult.Failed(status.hint)
            is ToolchainStatus.Incompatible -> return PlatformRunResult.Failed(
                "Toolchain '${delegate.toolchain}' has version ${status.found}, " +
                    "but ${status.required} or newer is required.",
            )
        }

        onPlan(plan)

        val invocation = DelegateInvocation(
            capability = command.capability,
            platform = platform,
            workspace = workspace,
            output = command.output?.let(fileSystem::absolutePath),
            passthrough = command.passthrough,
            toolOverride = command.toolOverride?.let(fileSystem::absolutePath),
        )

        return when (val result = delegate.run(invocation)) {
            is DelegateResult.Completed -> PlatformRunResult.Completed(plan = plan, summary = result.summary)
            is DelegateResult.Failed -> PlatformRunResult.Failed(
                "Toolchain '${delegate.toolchain}' failed with exit code ${result.exitCode}: ${result.message}",
            )
            is DelegateResult.ToolchainMissing -> PlatformRunResult.Failed(result.hint)
            is DelegateResult.Unsupported -> PlatformRunResult.Failed(result.message)
        }
    }

    private fun noDelegateMessage(platform: TargetPlatform): String {
        val registered = registry.all.joinToString { it.toolchain.value }

        return if (registered.isEmpty()) {
            "No platform toolchain is registered for '${platform.cliValue}'."
        } else {
            "No platform toolchain is registered for '${platform.cliValue}'. Registered toolchains: $registered."
        }
    }
}

/**
 * Запрос на выполнение capability платформенным инструментом.
 *
 * @property capability что нужно сделать.
 * @property platform платформа из `--platform`; `null` — взять из project config.
 * @property output значение `--output`; относительный путь приводится к абсолютному.
 * @property passthrough аргументы после `--` для платформенного инструмента.
 * @property toolOverride путь инструмента из `--tool`.
 */
public data class PlatformRunCommand(
    public val capability: Capability,
    public val platform: TargetPlatform? = null,
    public val output: String? = null,
    public val passthrough: List<String> = emptyList(),
    public val toolOverride: String? = null,
)

/**
 * Разрешённый план запуска: что, чем и где будет выполнено.
 *
 * @property platform выбранная платформа.
 * @property toolchain toolchain, который её обслуживает.
 * @property workspace пути рабочей копии.
 */
public data class PlatformRunPlan(
    public val platform: TargetPlatform,
    public val toolchain: ToolchainId,
    public val workspace: WorkspacePaths,
)

/**
 * Результат делегирования.
 */
public sealed interface PlatformRunResult {
    /**
     * Инструмент отработал успешно.
     *
     * @property plan что и чем было выполнено.
     * @property summary краткий итог инструмента.
     */
    public data class Completed(
        public val plan: PlatformRunPlan,
        public val summary: String,
    ) : PlatformRunResult

    /**
     * Делегирование не состоялось или инструмент завершился с ошибкой.
     *
     * @property message user-facing объяснение.
     */
    public data class Failed(
        public val message: String,
    ) : PlatformRunResult
}
