package com.dsbuilder.frontend.cli.presentation

import com.dsbuilder.frontend.core.analytics.AnalyticsConsent
import com.github.ajalt.clikt.core.CliktCommand
import com.github.ajalt.clikt.core.subcommands
import com.github.ajalt.clikt.core.terminal
import com.github.ajalt.mordant.terminal.prompt
import kotlinx.coroutines.runBlocking

/** Явное управление общим выбором CLI/MCP без продуктовых просмотров. */
internal class AnalyticsSettingsCliCommand(consent: AnalyticsConsent?) : CliktCommand(name = "analytics") {
    init {
        subcommands(
            ConsentAction("enable", consent),
            ConsentAction("disable", consent),
            ConsentAction("status", consent),
        )
    }
    override fun run() = Unit
}

private class ConsentAction(private val action: String, private val consent: AnalyticsConsent?) : CliktCommand(
    name = action,
) {
    override fun run() {
        val configured = consent ?: return echo("Аналитика не настроена.")
        val message = runBlocking {
            when (action) {
                "enable" -> {
                    val question = consentPrompt()
                        ?: return@runBlocking "Для разрешения аналитики нужен интерактивный терминал."
                    configured.enable(question)
                }
                "disable" -> configured.disable()
                else -> configured.status()
            }
        }
        echo(message)
    }
}

/** Вопрос доступен только настоящему интерактивному терминалу; Enter означает отказ. */
internal fun CliktCommand.consentPrompt(): ((String) -> Boolean?)? {
    if (!terminal.terminalInfo.interactive) return null
    return { notice ->
        echo(notice)
        terminal.prompt("Разрешить аналитику? [y/N]", default = "n")
            ?.let { it.lowercase() in setOf("y", "yes", "д", "да") }
    }
}
