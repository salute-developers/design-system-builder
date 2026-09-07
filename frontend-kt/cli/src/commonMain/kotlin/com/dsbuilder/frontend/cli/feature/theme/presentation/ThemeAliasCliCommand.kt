package com.dsbuilder.frontend.cli.feature.theme.presentation

import com.dsbuilder.frontend.core.workspace.ProjectConfigTenant
import com.dsbuilder.frontend.feature.theme.application.ListThemeAliasesUseCase
import com.dsbuilder.frontend.feature.theme.application.SetThemeAliasCommand
import com.dsbuilder.frontend.feature.theme.application.SetThemeAliasUseCase
import com.dsbuilder.frontend.feature.theme.application.ThemeAliasListResult
import com.dsbuilder.frontend.feature.theme.application.ThemeAliasMutationResult
import com.dsbuilder.frontend.feature.theme.application.UnsetThemeAliasCommand
import com.dsbuilder.frontend.feature.theme.application.UnsetThemeAliasUseCase
import com.github.ajalt.clikt.core.CliktCommand
import com.github.ajalt.clikt.core.Context
import com.github.ajalt.clikt.core.ProgramResult
import com.github.ajalt.clikt.core.subcommands
import com.github.ajalt.clikt.parameters.arguments.argument
import com.github.ajalt.clikt.parameters.options.option
import com.github.ajalt.clikt.parameters.options.required

/**
 * Command group `theme alias`.
 */
internal class ThemeAliasCliCommand(
    listCommand: ThemeAliasListCliCommand,
    setCommand: ThemeAliasSetCliCommand,
    unsetCommand: ThemeAliasUnsetCliCommand,
) : CliktCommand(name = "alias") {
    init {
        subcommands(listCommand, setCommand, unsetCommand)
    }

    override fun help(context: Context): String = "Manage local tenant aliases."

    override fun run(): Unit = Unit
}

/**
 * Presentation command для `dsbuilder theme alias list`.
 */
internal class ThemeAliasListCliCommand(
    private val useCase: ListThemeAliasesUseCase,
) : CliktCommand(name = "list") {
    override fun run() {
        when (val result = useCase.execute()) {
            is ThemeAliasListResult.Failed -> fail(result.message)
            is ThemeAliasListResult.Listed -> echo(formatTenants(result.tenants))
        }
    }

    override fun help(context: Context): String = "List local tenant aliases."

    private fun formatTenants(tenants: List<ProjectConfigTenant>): String =
        if (tenants.isEmpty()) {
            "No tenants found."
        } else {
            tenants.joinToString(separator = "\n") { tenant ->
                "Tenant: ${tenant.id} | Name: ${tenant.name} | Alias: ${tenant.alias ?: "-"}"
            }
        }
}

/**
 * Presentation command для `dsbuilder theme alias set`.
 */
internal class ThemeAliasSetCliCommand(
    private val useCase: SetThemeAliasUseCase,
) : CliktCommand(name = "set") {
    private val tenantId: String by option("--tenant-id").required()

    private val alias: String by option("--alias").required()

    override fun run() {
        when (
            val result = useCase.execute(
                SetThemeAliasCommand(
                    tenantId = tenantId,
                    alias = alias,
                ),
            )
        ) {
            is ThemeAliasMutationResult.Changed -> echo(result.message)
            is ThemeAliasMutationResult.Failed -> fail(result.message)
        }
    }

    override fun help(context: Context): String = "Set local tenant alias."
}

/**
 * Presentation command для `dsbuilder theme alias unset`.
 */
internal class ThemeAliasUnsetCliCommand(
    private val useCase: UnsetThemeAliasUseCase,
) : CliktCommand(name = "unset") {
    private val alias: String by argument()

    override fun run() {
        when (val result = useCase.execute(UnsetThemeAliasCommand(alias))) {
            is ThemeAliasMutationResult.Changed -> echo(result.message)
            is ThemeAliasMutationResult.Failed -> fail(result.message)
        }
    }

    override fun help(context: Context): String = "Unset local tenant alias."
}

private fun CliktCommand.fail(message: String): Nothing {
    echo(message)
    throw ProgramResult(statusCode = 1)
}
