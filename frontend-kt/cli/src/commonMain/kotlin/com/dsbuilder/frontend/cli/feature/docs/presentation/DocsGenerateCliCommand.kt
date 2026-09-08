package com.dsbuilder.frontend.cli.feature.docs.presentation

import com.dsbuilder.frontend.feature.docs.application.DocsGenerateCommand
import com.dsbuilder.frontend.feature.docs.application.DocsGenerateResult
import com.dsbuilder.frontend.feature.docs.application.DocsGenerateUseCase
import com.github.ajalt.clikt.core.CliktCommand
import com.github.ajalt.clikt.core.Context
import com.github.ajalt.clikt.core.ProgramResult
import com.github.ajalt.clikt.parameters.options.default
import com.github.ajalt.clikt.parameters.options.flag
import com.github.ajalt.clikt.parameters.options.help
import com.github.ajalt.clikt.parameters.options.option

/**
 * CLI command для `dsbuilder docs generate`.
 *
 * Собирает пакет документации из директории агрегатора:
 * merge structure-core.json + structure-user.json, генерирует docs.json,
 * manifest.json, валидирует и упаковывает в tar.gz.
 */
internal class DocsGenerateCliCommand(
    private val generateUseCase: DocsGenerateUseCase,
) : CliktCommand(name = "generate") {

    private val docsDir: String? by option("--docs-dir")
        .help("Ready documentation tree; the platform aggregation step is skipped when given.")

    private val outputGzip: String by option("--output")
        .default(".sdds/temp/docs-bundle.tar.gz")

    private val platform: String? by option("--platform")
        .help("Documentation platform; taken from .sdds/config.json when omitted.")

    private val noAggregate: Boolean by option("--no-aggregate")
        .flag()
        .help("Do not run the platform aggregation step; use the tree as it is.")

    private val tool: String? by option("--tool")
        .help("Path to the platform tool used by the aggregation step.")

    override fun run() {
        val result = generateUseCase.execute(
            DocsGenerateCommand(
                docsDir = docsDir,
                outputGzipPath = outputGzip,
                platform = platform,
                aggregate = !noAggregate,
                toolOverride = tool,
            ),
        )

        when (result) {
            is DocsGenerateResult.Success -> {
                result.aggregatedBy?.let { toolchain ->
                    echo("Documentation tree aggregated by toolchain '$toolchain' at ${result.docsDir}.")
                }
                echo("Bundle created at ${result.bundlePath}.")
            }
            is DocsGenerateResult.ValidationFailed -> {
                echo("Documentation validation failed:")
                result.errors.forEach { echo("  - $it") }
                throw ProgramResult(statusCode = 1)
            }
            is DocsGenerateResult.Failed -> {
                echo(result.message)
                throw ProgramResult(statusCode = 1)
            }
        }
    }

    override fun help(context: Context): String = "Generate documentation bundle from aggregator output."
}
