package com.dsbuilder.frontend.cli

import com.dsbuilder.frontend.cli.di.cliModule
import com.dsbuilder.frontend.cli.feature.components.di.componentsCliPresentationModule
import com.dsbuilder.frontend.cli.feature.docs.di.docsCliPresentationModule
import com.dsbuilder.frontend.cli.feature.init.di.initCliPresentationModule
import com.dsbuilder.frontend.cli.feature.status.di.statusCliPresentationModule
import com.dsbuilder.frontend.cli.feature.theme.di.themeCliPresentationModule
import com.dsbuilder.frontend.cli.presentation.RootCliCommand
import com.dsbuilder.frontend.core.application.ClientRuntime
import com.dsbuilder.frontend.core.application.coreApplicationModule
import com.dsbuilder.frontend.feature.components.componentsApplicationModule
import com.dsbuilder.frontend.feature.docs.docsApplicationModule
import com.dsbuilder.frontend.feature.init.initApplicationModule
import com.dsbuilder.frontend.feature.status.statusApplicationModule
import com.dsbuilder.frontend.feature.theme.themeApplicationModule
import com.github.ajalt.clikt.core.CliktError
import com.github.ajalt.clikt.core.parse
import com.github.ajalt.clikt.core.terminal
import com.github.ajalt.mordant.rendering.AnsiLevel
import com.github.ajalt.mordant.terminal.Terminal
import com.github.ajalt.mordant.terminal.TerminalRecorder
import org.koin.dsl.koinApplication

internal const val VERSION = "0.1.0"

/**
 * Результат обработки CLI-вызова `dsbuilder`.
 *
 * @property exitCode код завершения процесса.
 * @property output текст, который нужно вывести пользователю.
 */
public data class CliResult(
    public val exitCode: Int,
    public val output: String,
)

/**
 * Composition root CLI-приложения `dsbuilder`.
 */
public class DsBuilderCli(
    private val runtime: ClientRuntime = defaultClientRuntime(),
) {
    /**
     * Обрабатывает аргументы CLI и возвращает детерминированный результат.
     *
     * @param args аргументы командной строки без имени исполняемого файла.
     * @return результат обработки вызова.
     */
    public fun execute(args: List<String>): CliResult {
        val koin = koinApplication {
            modules(
                coreApplicationModule(runtime),
                docsApplicationModule(),
                docsCliPresentationModule(),
                initApplicationModule(),
                initCliPresentationModule(),
                statusApplicationModule(),
                statusCliPresentationModule(),
                themeApplicationModule(),
                themeCliPresentationModule(),
                componentsApplicationModule(),
                componentsCliPresentationModule(),
                cliModule(),
            )
        }.koin

        return koin.get<RootCliCommand>().executeForResult(args)
    }
}

private fun RootCliCommand.executeForResult(args: List<String>): CliResult {
    var exitCode = 0
    val recorder = TerminalRecorder(AnsiLevel.NONE)

    configureContext {
        terminal = Terminal(
            theme = terminal.theme,
            tabWidth = terminal.tabWidth,
            terminalInterface = recorder,
        )
    }

    try {
        parse(args)
    } catch (error: CliktError) {
        echoFormattedHelp(error)
        exitCode = error.statusCode
    }

    return CliResult(
        exitCode = exitCode,
        output = recorder.output().trimEnd(),
    )
}
