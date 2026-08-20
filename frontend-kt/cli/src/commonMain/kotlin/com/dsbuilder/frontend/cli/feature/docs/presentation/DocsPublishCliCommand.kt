package com.dsbuilder.frontend.cli.feature.docs.presentation

import com.dsbuilder.frontend.cli.feature.docs.application.DocsPublishCommand
import com.dsbuilder.frontend.cli.feature.docs.application.DocsPublishResult
import com.dsbuilder.frontend.cli.feature.docs.application.DocsPublishUseCase
import com.github.ajalt.clikt.core.CliktCommand
import com.github.ajalt.clikt.core.Context
import com.github.ajalt.clikt.core.ProgramResult
import com.github.ajalt.clikt.parameters.options.default
import com.github.ajalt.clikt.parameters.options.option

/**
 * CLI command для `dsbuilder docs publish`.
 *
 * Отправляет gzip-архив пакета в сервис документации.
 */
internal class DocsPublishCliCommand(
    private val publishUseCase: DocsPublishUseCase,
) : CliktCommand(name = "publish") {

    private val bundle: String by option("--bundle")
        .default(".sdds/temp/docs-bundle.tar.gz")

    private val apiKey: String? by option("--api-key")

    private val apiUrl: String? by option("--api-url")

    override fun run() {
        val result = publishUseCase.execute(
            DocsPublishCommand(
                bundlePath = bundle,
                apiKeyOverride = apiKey,
                apiUrlOverride = apiUrl,
            ),
        )

        when (result) {
            is DocsPublishResult.Accepted -> {
                echo("Bundle ID: ${result.bundleId}, Job ID: ${result.jobId}, Status: ${result.status}")
            }
            is DocsPublishResult.Failed -> {
                echo(result.message)
                throw ProgramResult(statusCode = 1)
            }
        }
    }

    override fun help(context: Context): String = "Publish documentation bundle to the documentation service."
}
