package com.dsbuilder.frontend.cli.feature.previewplugin.presentation

import com.dsbuilder.frontend.cli.feature.components.presentation.render
import com.dsbuilder.frontend.cli.presentation.targetPlatform
import com.dsbuilder.frontend.core.auth.SERVICE_ACCOUNT_CLIENT_ID_ENV
import com.dsbuilder.frontend.core.auth.SERVICE_ACCOUNT_CLIENT_SECRET_ENV
import com.dsbuilder.frontend.core.domain.TargetPlatform
import com.dsbuilder.frontend.feature.components.application.PublishPreviewPluginCommand
import com.dsbuilder.frontend.feature.components.application.PublishPreviewPluginResult
import com.dsbuilder.frontend.feature.components.application.PublishPreviewPluginTarget
import com.dsbuilder.frontend.feature.components.application.PublishPreviewPluginUseCase
import com.github.ajalt.clikt.core.CliktCommand
import com.github.ajalt.clikt.core.Context
import com.github.ajalt.clikt.core.ProgramResult
import com.github.ajalt.clikt.parameters.options.flag
import com.github.ajalt.clikt.parameters.options.help
import com.github.ajalt.clikt.parameters.options.option
import com.github.ajalt.clikt.parameters.options.required
import kotlinx.coroutines.runBlocking

/**
 * Presentation command для `dsbuilder preview-plugin publish`.
 *
 * Без `--apply` выполняется пробная отправка: backend проверяет архив и мету и ничего не записывает.
 */
internal class PreviewPluginPublishCliCommand(
    private val publishUseCase: PublishPreviewPluginUseCase,
) : CliktCommand(name = "publish") {
    private val platform: TargetPlatform by option("--platform").targetPlatform().required()
        .help("Platform of the plugin: compose or react (the web plugin).")

    private val from: String by option("--from").required()
        .help(
            "Plugin archive (preview-compose-plugin.zip or preview-web-plugin.zip) with preview-plugin.json " +
                "and api-meta.json.",
        )

    private val apiUrl: String? by option("--api-url")
        .help("Backend API URL; an explicit URL is required because the command writes to the backend.")

    private val apply: Boolean by option("--apply").flag()
        .help("Write the build. Without it the command performs a dry run.")

    override fun run() {
        val result = runBlocking {
            publishUseCase.execute(
                PublishPreviewPluginCommand(
                    platform = platform,
                    from = from,
                    apply = apply,
                    apiUrlOverride = apiUrl,
                ),
                onTarget = { target -> echo(target.render()) },
            )
        }
        when (result) {
            is PublishPreviewPluginResult.Published -> echo(result.render())
            is PublishPreviewPluginResult.Conflict -> {
                echo("Error: ${result.message}")
                throw ProgramResult(statusCode = 1)
            }
            is PublishPreviewPluginResult.Failed -> {
                echo(result.message)
                throw ProgramResult(statusCode = 1)
            }
        }
    }

    override fun help(context: Context): String =
        "Send a plugin build to the backend: the archive is stored and its API meta is imported in one step. " +
            "Authenticates as the service account from $SERVICE_ACCOUNT_CLIENT_ID_ENV and " +
            "$SERVICE_ACCOUNT_CLIENT_SECRET_ENV, otherwise as the saved user session."
}

/** Цель и состав печатаются до запроса; секреты и токены не выводятся. */
private fun PublishPreviewPluginTarget.render(): String = """
    Plugin: $source
    Build: $buildId (${platform.libraryName()} $libraryVersion)
    Components: $componentCount
    Properties: $propertyCount
    States: $stateCount
    API URL: ${apiUrl.value} (from ${apiUrl.sourceName})
""".trimIndent()

private fun PublishPreviewPluginResult.Published.render(): String = buildString {
    appendLine(
        when (outcome) {
            "unchanged" -> "Outcome: unchanged (build $buildId is already published and active)"
            "activated" -> "Outcome: activated (the earlier build $buildId is active again)"
            else -> "Outcome: $outcome"
        },
    )
    appendLine("Build: $buildId (${target.platform.libraryName()} $libraryVersion)")
    appendLine("Plugin URL: $pluginUrl")
    appendLine(report.render())
    append(if (dryRun) "Status: dry run, nothing was written" else "Status: plugin build published")
}

/** Библиотека компонентов, версия которой записана в manifest плагина платформы. */
private fun TargetPlatform.libraryName(): String = when (this) {
    TargetPlatform.REACT -> "plasma-new-hope"
    else -> "uikit-compose"
}
