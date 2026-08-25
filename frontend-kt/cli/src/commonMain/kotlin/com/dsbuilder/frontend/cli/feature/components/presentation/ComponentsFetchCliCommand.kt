package com.dsbuilder.frontend.cli.feature.components.presentation

import com.dsbuilder.frontend.cli.feature.components.application.ComponentDestination
import com.dsbuilder.frontend.cli.feature.components.application.FetchComponentsCommand
import com.dsbuilder.frontend.cli.feature.components.application.FetchComponentsResult
import com.dsbuilder.frontend.cli.feature.components.application.FetchComponentsUseCase
import com.dsbuilder.frontend.cli.feature.components.application.FetchSource
import com.github.ajalt.clikt.core.CliktCommand
import com.github.ajalt.clikt.core.Context
import com.github.ajalt.clikt.core.ProgramResult
import com.github.ajalt.clikt.parameters.options.option

/**
 * Presentation command для `dsbuilder components fetch`.
 */
internal class ComponentsFetchCliCommand(
    private val fetchComponentsUseCase: FetchComponentsUseCase,
) : CliktCommand(name = "fetch") {
    private val to: String? by option("--to")

    private val apiKey: String? by option("--api-key")

    private val apiUrl: String? by option("--api-url")

    override fun run() {
        val result = fetchComponentsUseCase.execute(
            FetchComponentsCommand(
                destination = ComponentDestination(directory = to),
                apiKeyOverride = apiKey,
                apiUrlOverride = apiUrl,
            ),
        )

        result.source?.let { echo(it.render()) }

        when (result) {
            is FetchComponentsResult.Fetched -> echo(result.render())
            is FetchComponentsResult.Failed -> {
                echo(result.message)
                throw ProgramResult(statusCode = 1)
            }
        }
    }

    override fun help(context: Context): String =
        "Fetch design system component configurations from DS Builder into the working copy."
}

/**
 * Печатает источник пакета и его состав до вывода результата записи.
 *
 * API key не выводится ни в каком виде.
 */
private fun FetchSource.render(): String = """
    Package: $packageName
    Version: $packageVersion
    Configurations: $configurationCount
    API URL: ${apiUrl.value} (from ${apiUrl.sourceName})
    Project: $projectId
    Design system: $designSystemId
""".trimIndent()

/**
 * Печатает результат записи.
 *
 * Оба списка — отчёт, а не отказ: пакет уже записан, статус остаётся нулевым. Умолчать о них
 * нельзя, потому что оба означают расхождение между тем, что лежит в директории, и тем, что
 * из неё соберётся.
 */
private fun FetchComponentsResult.Fetched.render(): String = buildString {
    appendLine("Written to: $path")
    appendLine("Files: ${fileNames.size}")

    appendSection(
        "Values whose paint kind could not be derived (written with the property type)",
        underivedTypes,
    )
    appendSection("Files left from a previous composition (not removed)", unrelatedFiles)
}.trimEnd()

private fun StringBuilder.appendSection(title: String, entries: List<String>) {
    if (entries.isEmpty()) {
        return
    }
    appendLine()
    appendLine("$title:")
    entries.forEach { entry -> appendLine("  $entry") }
}
