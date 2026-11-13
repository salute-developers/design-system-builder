package com.dsbuilder.frontend.cli.feature.icons.presentation

import com.dsbuilder.frontend.core.auth.SERVICE_ACCOUNT_CLIENT_ID_ENV
import com.dsbuilder.frontend.core.auth.SERVICE_ACCOUNT_CLIENT_SECRET_ENV
import com.dsbuilder.frontend.feature.components.application.IconCatalogReport
import com.dsbuilder.frontend.feature.components.application.IconInUse
import com.dsbuilder.frontend.feature.components.application.PublishIconCatalogCommand
import com.dsbuilder.frontend.feature.components.application.PublishIconCatalogResult
import com.dsbuilder.frontend.feature.components.application.PublishIconCatalogTarget
import com.dsbuilder.frontend.feature.components.application.PublishIconCatalogUseCase
import com.github.ajalt.clikt.core.CliktCommand
import com.github.ajalt.clikt.core.Context
import com.github.ajalt.clikt.core.ProgramResult
import com.github.ajalt.clikt.core.UsageError
import com.github.ajalt.clikt.parameters.options.flag
import com.github.ajalt.clikt.parameters.options.help
import com.github.ajalt.clikt.parameters.options.option
import com.github.ajalt.clikt.parameters.options.required
import kotlinx.coroutines.runBlocking

/**
 * Presentation command для `dsbuilder icons publish`.
 *
 * Без `--apply` выполняется пробная отправка: backend считает различия и ничего не записывает.
 */
internal class IconsPublishCliCommand(
    private val publishUseCase: PublishIconCatalogUseCase,
) : CliktCommand(name = "publish") {
    private val fromDir: String? by option("--from-dir")
        .help("Root of the @salutejs/sdds-icons package (packages/sdds-icons) with svg/16, svg/24, svg/36.")

    private val from: String? by option("--from")
        .help("Ready icons-manifest.json instead of --from-dir.")

    private val apiUrl: String by option("--api-url").required()
        .help("Backend API URL; an explicit URL is required because the command writes to the backend.")

    private val packageVersion: String? by option("--package-version")
        .help("Version of the source package; by default package.json of --from-dir, otherwise 'unknown'.")

    private val writeManifest: String? by option("--write-manifest")
        .help("With --from-dir: also write the assembled manifest to this file.")

    private val allowRemovingUsed: Boolean by option("--allow-removing-used").flag()
        .help("Allow removing icons that component configurations still reference.")

    private val apply: Boolean by option("--apply").flag()
        .help("Write the catalog. Without it the command performs a dry run.")

    override fun run() {
        if ((fromDir == null) == (from == null)) {
            throw UsageError("Pass exactly one of --from-dir and --from.")
        }
        if (writeManifest != null && fromDir == null) {
            throw UsageError("--write-manifest requires --from-dir.")
        }
        val result = runBlocking {
            publishUseCase.execute(
                PublishIconCatalogCommand(
                    fromDir = fromDir,
                    from = from,
                    packageVersion = packageVersion,
                    writeManifest = writeManifest,
                    allowRemovingUsed = allowRemovingUsed,
                    apply = apply,
                    apiUrlOverride = apiUrl,
                ),
                onTarget = { target -> echo(target.render()) },
            )
        }
        when (result) {
            is PublishIconCatalogResult.Published -> echo(result.render())
            is PublishIconCatalogResult.InUse -> {
                echo(result.render())
                throw ProgramResult(statusCode = 1)
            }
            is PublishIconCatalogResult.Failed -> {
                echo(result.message)
                throw ProgramResult(statusCode = 1)
            }
        }
    }

    override fun help(context: Context): String =
        "Send the icon catalog to the backend: the SVG files are stored and the catalog is switched in one step. " +
            "Authenticates as the service account from $SERVICE_ACCOUNT_CLIENT_ID_ENV and " +
            "$SERVICE_ACCOUNT_CLIENT_SECRET_ENV, otherwise as the saved user session."
}

private const val NAME_LIMIT = 20
private const val WARNING_LIMIT = 20

/** Цель и состав печатаются до запроса; секреты и токены не выводятся. */
private fun PublishIconCatalogTarget.render(): String = buildString {
    appendLine("Source: $source")
    appendLine("Package: $packageName $packageVersion")
    appendLine("Icons: $iconCount (${sizeCounts.entries.joinToString { "${it.key}px: ${it.value}" }})")
    appendLine("API URL: ${apiUrl.value} (from ${apiUrl.sourceName})")
    warnings.take(WARNING_LIMIT).forEach { appendLine("Warning: $it") }
    if (warnings.size > WARNING_LIMIT) appendLine("Warning: ${warnings.size - WARNING_LIMIT} more warnings omitted.")
}.trimEnd()

private fun PublishIconCatalogResult.Published.render(): String = buildString {
    appendLine(
        when (report.outcome) {
            "unchanged" -> "Outcome: unchanged (the catalog is already active)"
            "activated" -> "Outcome: activated (the earlier catalog is active again)"
            else -> "Outcome: ${report.outcome}"
        },
    )
    report.loadId?.let { appendLine("Load: $it") }
    appendLine(report.render())
    append(if (dryRun) "Status: dry run, nothing was written" else "Status: icon catalog published")
}

private fun PublishIconCatalogResult.InUse.render(): String = buildString {
    appendLine("Error: $message")
    appendLine("The upload removes icons that component configurations still reference:")
    items.forEach { appendLine("  ${it.render()}") }
    append("Pass --allow-removing-used to publish anyway.")
}

private fun IconCatalogReport.render(): String = buildString {
    appendLine(
        "Added: ${counts.added}, removed: ${counts.removed}, changed: ${counts.changed}, " +
            "unchanged: ${counts.unchanged}",
    )
    appendNames("Added", added)
    appendNames("Removed", removed)
    appendNames("Changed", changed)
    if (truncated) appendLine("Name lists are truncated by the backend.")
    if (removedInUse.isNotEmpty()) {
        appendLine("Used icons removed by this upload:")
        removedInUse.forEach { appendLine("  ${it.render()}") }
    }
    append("Reconciliation: ${reconciliation.resolved} resolved, ${reconciliation.unresolved} unresolved")
    if (reconciliation.unresolvedValues.isNotEmpty()) {
        append("\nUnresolved values: ${reconciliation.unresolvedValues.take(NAME_LIMIT).joinToString()}")
        val rest = reconciliation.unresolvedValues.size - NAME_LIMIT
        if (rest > 0) append(" and $rest more")
    }
}

private fun StringBuilder.appendNames(title: String, names: List<String>) {
    if (names.isEmpty()) return
    append("$title: ${names.take(NAME_LIMIT).joinToString()}")
    if (names.size > NAME_LIMIT) append(" and ${names.size - NAME_LIMIT} more")
    appendLine()
}

private fun IconInUse.render(): String =
    "$name (sizes ${sizes.joinToString()}), $references reference${if (references == 1) "" else "s"}"
