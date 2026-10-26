package com.dsbuilder.frontend.mcpnode

import com.dsbuilder.frontend.feature.auth.application.AuthStatusCommand
import com.dsbuilder.frontend.feature.auth.application.AuthStatusResult
import com.dsbuilder.frontend.feature.auth.application.AuthStatusUseCase
import com.dsbuilder.frontend.feature.auth.application.LoginCommand
import com.dsbuilder.frontend.feature.auth.application.LoginResult
import com.dsbuilder.frontend.feature.auth.application.LoginUseCase
import com.dsbuilder.frontend.feature.auth.application.LogoutCommand
import com.dsbuilder.frontend.feature.auth.application.LogoutResult
import com.dsbuilder.frontend.feature.auth.application.LogoutUseCase
import kotlinx.coroutines.MainScope
import kotlinx.coroutines.launch
import org.koin.core.Koin
import org.koin.core.component.get

internal fun runAuth(args: List<String>): Int? {
    if (args.isEmpty() || args.contains("--help") || args.contains("-h")) {
        printAuthHelp()
        return 0
    }
    if (args.any { it == "--password" || it.startsWith("--password=") }) {
        println("Error: password login was removed; use auth login to open the system browser.")
        return 1
    }
    val runtime = defaultNodeRuntime()
    val koin = nodeKoin(runtime)
    MainScope().launch {
        val exitCode = when (args.first()) {
            "login" -> authLogin(args.drop(1), koin)
            "status" -> authStatus(args.drop(1), koin)
            "logout" -> authLogout(args.drop(1), koin)
            else -> {
                println("Error: unknown auth command `${args.first()}`.")
                1
            }
        }
        runtime.close()
        nodeProcess.exit(exitCode)
    }
    return null
}

private suspend fun authLogin(args: List<String>, koin: Koin): Int {
    if (args.any { it == "--username" || it.startsWith("--username=") }) {
        println("Error: username arguments were removed; use browser authentication.")
        return 1
    }
    val result = koin.get<LoginUseCase>().execute(
        LoginCommand(
            apiUrlOverride = optionValue(args, "--api-url"),
        ),
    )
    return when (result) {
        is LoginResult.Failed -> {
            println(result.message)
            1
        }
        is LoginResult.LoggedIn -> {
            println("Logged in to ${result.apiUrl} as ${result.username}.")
            0
        }
    }
}

private suspend fun authStatus(args: List<String>, koin: Koin): Int =
    when (val result = koin.get<AuthStatusUseCase>().execute(AuthStatusCommand(optionValue(args, "--api-url")))) {
        is AuthStatusResult.LoggedIn -> {
            println("Logged in to ${result.apiUrl} as ${result.username}.")
            0
        }
        is AuthStatusResult.NotLoggedIn -> {
            println("Not logged in to ${result.apiUrl}.")
            1
        }
    }

private suspend fun authLogout(args: List<String>, koin: Koin): Int =
    when (val result = koin.get<LogoutUseCase>().execute(LogoutCommand(optionValue(args, "--api-url")))) {
        is LogoutResult.Failed -> {
            println(result.message)
            1
        }
        is LogoutResult.LoggedOut -> {
            println("Logged out from ${result.apiUrl}.")
            0
        }
    }

private fun printAuthHelp() {
    println(
        """
        Usage: dsbuilder-mcp auth <command>

        Commands:
          login    Log in and store a local refresh session.
          status   Show local auth status without printing tokens.
          logout   Revoke and remove a local refresh session.
        """.trimIndent(),
    )
}
