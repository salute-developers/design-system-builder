package com.dsbuilder.frontend.feature.components.application

import com.dsbuilder.frontend.core.domain.TargetPlatform
import com.dsbuilder.frontend.core.platform.Capability
import com.dsbuilder.frontend.core.platform.PlatformCapabilityRunner
import com.dsbuilder.frontend.core.platform.PlatformRunCommand
import com.dsbuilder.frontend.core.platform.PlatformRunPlan
import com.dsbuilder.frontend.core.platform.PlatformRunResult

/**
 * Use case для команды `dsbuilder components generate`.
 *
 * Код компонентов генерирует платформенный инструмент; CLI только выбирает его по целевой
 * платформе и передаёт пути рабочей копии.
 */
public class GenerateComponentsUseCase internal constructor(
    private val platformCapabilityRunner: PlatformCapabilityRunner,
) {
    /**
     * Запускает генерацию компонентов платформенным инструментом.
     *
     * @param command параметры запуска.
     * @param onPlan вызывается до запуска инструмента, чтобы presentation напечатала, что и чем запускается.
     */
    public fun execute(
        command: GenerateComponentsCommand,
        onPlan: (PlatformRunPlan) -> Unit = {},
    ): PlatformRunResult =
        platformCapabilityRunner.execute(
            PlatformRunCommand(
                capability = Capability.COMPONENTS,
                platform = command.platform,
                output = command.output,
                passthrough = command.passthrough,
                toolOverride = command.toolOverride,
            ),
            onPlan = onPlan,
        )
}

/**
 * Command model для [GenerateComponentsUseCase].
 *
 * @property platform целевая платформа из `--platform`; `null` — взять из project config.
 * @property output значение `--output`: куда платформенный инструмент положит результат.
 * @property passthrough аргументы после `--`, которые инструмент получает без изменений.
 * @property toolOverride путь инструмента из `--tool`.
 */
public data class GenerateComponentsCommand(
    public val platform: TargetPlatform? = null,
    public val output: String? = null,
    public val passthrough: List<String> = emptyList(),
    public val toolOverride: String? = null,
)
