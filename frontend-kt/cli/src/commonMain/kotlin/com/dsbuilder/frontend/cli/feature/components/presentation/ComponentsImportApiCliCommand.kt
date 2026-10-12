package com.dsbuilder.frontend.cli.feature.components.presentation

import com.dsbuilder.frontend.cli.presentation.targetPlatform
import com.dsbuilder.frontend.core.domain.TargetPlatform
import com.dsbuilder.frontend.feature.components.application.ImportApiMetaCommand
import com.dsbuilder.frontend.feature.components.application.ImportApiMetaResult
import com.dsbuilder.frontend.feature.components.application.ImportApiMetaTarget
import com.dsbuilder.frontend.feature.components.application.ImportApiMetaUseCase
import com.dsbuilder.frontend.feature.components.domain.apimeta.ApiMetaImportReport
import com.github.ajalt.clikt.core.CliktCommand
import com.github.ajalt.clikt.core.Context
import com.github.ajalt.clikt.core.ProgramResult
import com.github.ajalt.clikt.core.UsageError
import com.github.ajalt.clikt.parameters.options.flag
import com.github.ajalt.clikt.parameters.options.help
import com.github.ajalt.clikt.parameters.options.multiple
import com.github.ajalt.clikt.parameters.options.option
import com.github.ajalt.clikt.parameters.options.required
import kotlinx.coroutines.runBlocking

/**
 * Presentation command для `dsbuilder components import-api`.
 */
internal class ComponentsImportApiCliCommand(
    private val importApiMetaUseCase: ImportApiMetaUseCase,
) : CliktCommand(name = "import-api") {
    private val from: String by option("--from")
        .required()
        .help("API meta file of the platform: the output of the meta generator or of the dsBuilder plugin.")

    private val platform: TargetPlatform by option("--platform").targetPlatform().required()
        .help("Platform of the API meta file.")

    private val apiUrl: String? by option("--api-url")
        .help("Backend API URL; the user session saved by `dsbuilder auth login` for this URL is used.")

    private val mapType: List<String> by option("--map-type")
        .multiple()
        .help("Replace a property type before sending, as from:to; may be repeated.")

    private val apply: Boolean by option("--apply").flag()
        .help("Write the changes. Without it the command performs a dry run.")

    private val dryRun: Boolean by option("--dry-run").flag()

    private val strict: Boolean by option("--strict").flag()
        .help("Exit with code 1 when the backend rejects any property.")

    override fun run() {
        if (apply && dryRun) {
            throw UsageError("Options --apply and --dry-run cannot be used together.")
        }
        val typeMap = parseTypeMap(mapType)

        val result = runBlocking {
            importApiMetaUseCase.execute(
                ImportApiMetaCommand(
                    platform = platform,
                    from = from,
                    dryRun = !apply,
                    typeMap = typeMap,
                    apiUrlOverride = apiUrl,
                ),
                onTarget = { target -> echo(target.render()) },
            )
        }

        when (result) {
            is ImportApiMetaResult.Imported -> {
                echo(result.render())
                if (strict && result.report.rejected.isNotEmpty()) {
                    throw ProgramResult(statusCode = 1)
                }
            }
            is ImportApiMetaResult.Failed -> {
                echo(result.message)
                throw ProgramResult(statusCode = 1)
            }
        }
    }

    override fun help(context: Context): String =
        "Import an API meta file into the DS Builder component layer (system administrator only)."
}

/**
 * Разбирает повторяемую опцию `--map-type from:to`.
 *
 * Ошибка формата — ошибка использования: отправлять запрос с искажённой подменой нельзя.
 */
private fun parseTypeMap(entries: List<String>): Map<String, String> = entries.associate { entry ->
    val from = entry.substringBefore(':', missingDelimiterValue = "")
    val to = entry.substringAfter(':', missingDelimiterValue = "")
    if (from.isEmpty() || to.isEmpty()) {
        throw UsageError("--map-type expects from:to, got '$entry'.")
    }
    from to to
}

/**
 * Печатает цель запроса и состав манифеста, чтобы обе стороны были видны до отправки.
 *
 * API key не выводится ни в каком виде.
 */
private fun ImportApiMetaTarget.render(): String = """
    Platform: ${platform.cliValue}
    Source: $source
    Components: $componentCount
    Properties: $propertyCount
    States: $stateCount
    API URL: ${apiUrl.value} (from ${apiUrl.sourceName})
""".trimIndent()

private fun ImportApiMetaResult.Imported.render(): String = buildString {
    appendLine(report.render())
    appendSection("Conflicting duplicates in the API meta (the first kept)", conflicts)
    if (conflicts.isNotEmpty()) appendLine()
    // Пропущенное нормализатором не отклоняется backend'ом, поэтому в отчёте его не видно: без этих
    // строк о неимпортированных свойствах узнать было бы неоткуда.
    skipped.forEach { appendLine("Skipped: ${it.count} ${it.category}") }
    append(if (dryRun) "Status: dry run, no changes were applied" else "Status: API meta imported")
}

private fun ApiMetaImportReport.render(): String = buildString {
    appendLine("Created components: $createdComponents")
    appendLine("Created properties: $createdProperties")
    appendLine("Created states: $createdStates")
    appendLine("Created platform names: $createdAliases")
    appendLine("Unchanged properties: $unchangedProperties")
    // Устаревание обновляется на существующих алиасах, поэтому строки печатаются, только если оно менялось.
    if (deprecatedMarked + deprecatedMessageChanged + deprecatedCleared > 0) {
        appendLine("Deprecated marked: $deprecatedMarked")
        appendLine("Deprecated message changed: $deprecatedMessageChanged")
        appendLine("Deprecated cleared: $deprecatedCleared")
    }
    append("Rejected: ${rejected.size}")
    rejected.forEach { rejection ->
        appendLine()
        append("  ${rejection.component}.${rejection.property}: ${rejection.reason}")
    }
    // Тип существующего свойства не меняется: глобальный слой общий для всех дизайн-систем.
    // Расхождение видно только здесь, поэтому его нельзя пропускать молча.
    if (typeMismatches.isNotEmpty()) {
        appendLine()
        append("Property type mismatches (types were not changed): ${typeMismatches.size}")
        typeMismatches.forEach { entry ->
            appendLine()
            append("  $entry")
        }
    }
    // Справочно: в базе есть, в мете нет. Ничего не удаляется и на код выхода не влияет.
    appendSection("Absent from meta (informational, nothing was removed)", absent)
}

/**
 * Печатает раздел с перечнем, если он не пуст.
 */
private fun StringBuilder.appendSection(title: String, entries: List<String>) {
    if (entries.isEmpty()) return

    appendLine()
    append("$title: ${entries.size}")
    entries.forEach { entry ->
        appendLine()
        append("  $entry")
    }
}
