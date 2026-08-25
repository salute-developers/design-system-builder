package com.dsbuilder.frontend.cli.feature.components.presentation

import com.dsbuilder.frontend.cli.feature.components.application.ComponentSource
import com.dsbuilder.frontend.cli.feature.components.application.PushComponentsCommand
import com.dsbuilder.frontend.cli.feature.components.application.PushComponentsResult
import com.dsbuilder.frontend.cli.feature.components.application.PushComponentsUseCase
import com.dsbuilder.frontend.cli.feature.components.application.PushTarget
import com.dsbuilder.frontend.cli.feature.components.domain.ComponentImportReport
import com.github.ajalt.clikt.core.CliktCommand
import com.github.ajalt.clikt.core.Context
import com.github.ajalt.clikt.core.ProgramResult
import com.github.ajalt.clikt.core.UsageError
import com.github.ajalt.clikt.parameters.options.flag
import com.github.ajalt.clikt.parameters.options.option

/**
 * Presentation command для `dsbuilder components push`.
 */
internal class ComponentsPushCliCommand(
    private val pushComponentsUseCase: PushComponentsUseCase,
) : CliktCommand(name = "push") {
    private val from: String? by option("--from")

    private val apiKey: String? by option("--api-key")

    private val apiUrl: String? by option("--api-url")

    private val apply: Boolean by option("--apply").flag()

    private val dryRun: Boolean by option("--dry-run").flag()

    override fun run() {
        if (apply && dryRun) {
            throw UsageError("Options --apply and --dry-run cannot be used together.")
        }
        val result = pushComponentsUseCase.execute(
            PushComponentsCommand(
                source = ComponentSource(directory = from),
                dryRun = !apply,
                apiKeyOverride = apiKey,
                apiUrlOverride = apiUrl,
            ),
        )

        result.target?.let { echo(it.render()) }

        when (result) {
            is PushComponentsResult.Pushed -> echo(result.render())
            is PushComponentsResult.Failed -> {
                echo(result.message)
                throw ProgramResult(statusCode = 1)
            }
        }
    }

    override fun help(context: Context): String =
        "Push design system component configurations into DS Builder."
}

/**
 * Печатает цель запроса и состав пакета рядом, чтобы обе стороны были видны перед `--apply`.
 *
 * API key не выводится ни в каком виде.
 */
private fun PushTarget.render(): String = """
    Package: $packageName
    Source: $packageOrigin
    Configurations: $configurationCount
    API URL: ${apiUrl.value} (from ${apiUrl.sourceName})
    Project: $projectId
    Design system: $designSystemId
""".trimIndent()

private fun PushComponentsResult.Pushed.render(): String = buildString {
    appendLine(report.render())
    append(if (dryRun) "Status: dry run, no changes were applied" else "Status: components pushed")
}

private fun ComponentImportReport.render(): String = buildString {
    appendLine("Created: $created")
    appendLine("Updated: $updated")
    appendLine("Unchanged: $unchanged")
    append("Rejected: ${rejected.size}")
    rejected.forEach { rejection ->
        appendLine()
        append("  ${rejection.componentName} (${rejection.styleName}): ${rejection.reason}")
    }

    // Эти расхождения не отменяют импорт, но означают потерю данных либо противоречие
    // между кодом компонента и оформлением. Без вывода о них узнать неоткуда.
    // Имена токенов, которых нет в дизайн-системе. Прежде отчёт их не печатал, и ссылка
    // в пустоту оставалась незамеченной: значение сохранялось текстом, а вид заливки
    // выводить было уже не из чего.
    appendSection("Token references not found in the design system", unresolvedTokens)
    appendSection("Component style references not matched", unresolvedComponentStyles)
    appendSection("Properties absent from the global layer", unknownProperties)
    appendSection("States absent from the global layer", unknownStates)
    appendSection("Property type mismatches", typeMismatches)
    // Отдельной секцией, а не среди расхождений типа: слот color покрывает и градиент,
    // поэтому это расхождение оформления и кода, а не ошибка типа.
    appendSection("Paint properties without a solid colour", gradientOnlyProperties)
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
