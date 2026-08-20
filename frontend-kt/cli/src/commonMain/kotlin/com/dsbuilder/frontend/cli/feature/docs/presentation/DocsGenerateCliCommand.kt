package com.dsbuilder.frontend.cli.feature.docs.presentation

import com.dsbuilder.frontend.cli.feature.docs.application.DocsGenerateCommand
import com.dsbuilder.frontend.cli.feature.docs.application.DocsGenerateResult
import com.dsbuilder.frontend.cli.feature.docs.application.DocsGenerateUseCase
import com.github.ajalt.clikt.core.CliktCommand
import com.github.ajalt.clikt.core.Context
import com.github.ajalt.clikt.core.ProgramResult
import com.github.ajalt.clikt.parameters.options.default
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

    private val docsDir: String by option("--docs-dir")
        .default(".sdds/temp/docs")

    private val outputGzip: String by option("--output")
        .default(".sdds/temp/docs-bundle.tar.gz")

    private val platform: String by option("--platform")
        .default("compose")

    override fun run() {
        val result = generateUseCase.execute(
            DocsGenerateCommand(
                docsDir = docsDir,
                outputGzipPath = outputGzip,
                platform = platform,
            ),
        )

        when (result) {
            is DocsGenerateResult.Success -> {
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
