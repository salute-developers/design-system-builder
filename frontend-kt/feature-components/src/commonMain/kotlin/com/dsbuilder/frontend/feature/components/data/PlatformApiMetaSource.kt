package com.dsbuilder.frontend.feature.components.data

import com.dsbuilder.frontend.core.domain.TargetPlatform
import com.dsbuilder.frontend.core.platform.Capability
import com.dsbuilder.frontend.core.platform.PlatformCapabilityRunner
import com.dsbuilder.frontend.core.platform.PlatformRunCommand
import com.dsbuilder.frontend.core.platform.PlatformRunPlan
import com.dsbuilder.frontend.core.platform.PlatformRunResult
import com.dsbuilder.frontend.core.workspace.WorkspaceFileSystem
import com.dsbuilder.frontend.feature.components.application.ApiMetaSource
import com.dsbuilder.frontend.feature.components.application.ApiMetaSourceResult

/**
 * Достаёт API-мету платформенным инструментом и читает файл, который он оставил в рабочей копии.
 *
 * Расположение файла — соглашение плагина `dsBuilder` (`theme-builder/components` внутри
 * `build`), а не ответ инструмента: делегат не возвращает путь. Если модуль переопределил
 * `buildDir` или плагин переместит вывод, чтение сломается, и сообщение об ошибке называет
 * ожидаемый путь, чтобы причину было видно сразу.
 */
internal class PlatformApiMetaSource(
    private val platformCapabilityRunner: PlatformCapabilityRunner,
    private val fileSystem: WorkspaceFileSystem,
) : ApiMetaSource {
    @Suppress("ReturnCount")
    override fun read(
        platform: TargetPlatform,
        toolOverride: String?,
        onPlan: (PlatformRunPlan) -> Unit,
    ): ApiMetaSourceResult {
        val fileName = META_FILE_NAMES[platform]
            ?: return ApiMetaSourceResult.Failed("Error: API meta of platform '${platform.cliValue}' is not supported.")

        val plan = when (
            val run = platformCapabilityRunner.execute(
                PlatformRunCommand(capability = Capability.API_META, platform = platform, toolOverride = toolOverride),
                onPlan,
            )
        ) {
            is PlatformRunResult.Failed -> return ApiMetaSourceResult.Failed(run.message)
            is PlatformRunResult.Completed -> run.plan
        }

        val path = META_DIRECTORY.fold(plan.workspace.workspaceDir) { parent, child ->
            fileSystem.resolve(parent, child)
        }.let { directory -> fileSystem.resolve(directory, fileName) }

        if (!fileSystem.exists(path)) {
            return ApiMetaSourceResult.Failed(
                "Error: the API meta file was not found at $path after the platform tool finished. " +
                    "The dsBuilder plugin writes it to build/theme-builder/components; check that the module " +
                    "does not override the build directory.",
            )
        }

        return ApiMetaSourceResult.Read(path = path, text = fileSystem.readText(path))
    }

    private companion object {
        val META_DIRECTORY: List<String> = listOf("build", "theme-builder", "components")

        val META_FILE_NAMES: Map<TargetPlatform, String> = mapOf(
            TargetPlatform.COMPOSE to "uikit-compose-api-meta.json",
            TargetPlatform.ANDROID_VIEW to "uikit-api-meta.json",
        )
    }
}
