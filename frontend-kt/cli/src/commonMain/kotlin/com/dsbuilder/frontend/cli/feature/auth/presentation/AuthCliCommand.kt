package com.dsbuilder.frontend.cli.feature.auth.presentation

import com.dsbuilder.frontend.core.network.ApiUrlResolver
import com.dsbuilder.frontend.feature.auth.application.AuthStatusCommand
import com.dsbuilder.frontend.feature.auth.application.AuthStatusResult
import com.dsbuilder.frontend.feature.auth.application.AuthStatusUseCase
import com.dsbuilder.frontend.feature.auth.application.LoginCommand
import com.dsbuilder.frontend.feature.auth.application.LoginResult
import com.dsbuilder.frontend.feature.auth.application.LoginUseCase
import com.dsbuilder.frontend.feature.auth.application.LogoutCommand
import com.dsbuilder.frontend.feature.auth.application.LogoutResult
import com.dsbuilder.frontend.feature.auth.application.LogoutUseCase
import com.github.ajalt.clikt.core.CliktCommand
import com.github.ajalt.clikt.core.Context
import com.github.ajalt.clikt.core.ProgramResult
import com.github.ajalt.clikt.core.subcommands
import com.github.ajalt.clikt.parameters.options.option
import com.github.ajalt.clikt.parameters.options.prompt
import kotlinx.coroutines.runBlocking

/**
 * CLI command group for user auth lifecycle.
 */
internal class AuthCliCommand(
    subcommands: List<CliktCommand>,
) : CliktCommand(name = "auth") {
    init {
        subcommands(subcommands)
    }

    override fun help(context: Context): String = "Manage user authentication."

    override fun run(): Unit = Unit
}

/**
 * `dsbuilder auth login`.
 */
internal class AuthLoginCliCommand(
    private val useCase: LoginUseCase,
    private val apiUrlResolver: ApiUrlResolver,
) : CliktCommand(name = "login") {
    private val apiUrl: String? by option("--api-url")

    private val username: String by option("--username").prompt("Username")

    private val password: String by option("--password", hidden = true).prompt("Password", hideInput = true)

    override fun run() {
        val resolvedApiUrl = apiUrlResolver.resolve(apiUrl)
        echo("API URL: ${resolvedApiUrl.value} (from ${resolvedApiUrl.sourceName})")
        val result = runBlocking {
            useCase.execute(
                LoginCommand(
                    username = username,
                    password = password,
                    apiUrlOverride = resolvedApiUrl.value,
                ),
            )
        }
        when (result) {
            is LoginResult.Failed -> {
                echo(result.message)
                throw ProgramResult(1)
            }
            is LoginResult.LoggedIn -> echo("Logged in: ${result.username} (${result.apiUrl})")
        }
    }

    override fun help(context: Context): String = "Log in with a user session."
}

/**
 * `dsbuilder auth status`.
 */
internal class AuthStatusCliCommand(
    private val useCase: AuthStatusUseCase,
) : CliktCommand(name = "status") {
    private val apiUrl: String? by option("--api-url")

    override fun run() {
        val result = runBlocking { useCase.execute(AuthStatusCommand(apiUrlOverride = apiUrl)) }
        when (result) {
            is AuthStatusResult.LoggedIn -> echo("Logged in: ${result.username} (${result.apiUrl})")
            is AuthStatusResult.NotLoggedIn -> echo("Not logged in (${result.apiUrl})")
        }
    }

    override fun help(context: Context): String = "Show user auth status."
}

/**
 * `dsbuilder auth logout`.
 */
internal class AuthLogoutCliCommand(
    private val useCase: LogoutUseCase,
) : CliktCommand(name = "logout") {
    private val apiUrl: String? by option("--api-url")

    override fun run() {
        val result = runBlocking { useCase.execute(LogoutCommand(apiUrlOverride = apiUrl)) }
        when (result) {
            is LogoutResult.Failed -> {
                echo(result.message)
                throw ProgramResult(1)
            }
            is LogoutResult.LoggedOut -> echo("Logged out (${result.apiUrl})")
        }
    }

    override fun help(context: Context): String = "Log out and remove the local user session."
}
