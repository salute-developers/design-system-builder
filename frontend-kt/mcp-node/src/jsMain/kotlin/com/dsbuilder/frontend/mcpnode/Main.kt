package com.dsbuilder.frontend.mcpnode

import com.dsbuilder.frontend.core.application.ClientRuntime
import com.dsbuilder.frontend.core.application.ContextResolver
import com.dsbuilder.frontend.core.application.coreApplicationModule
import com.dsbuilder.frontend.core.auth.CredentialStoreFileSystem
import com.dsbuilder.frontend.core.auth.CredentialStoreLock
import com.dsbuilder.frontend.core.auth.EnvironmentReader
import com.dsbuilder.frontend.core.auth.FileCredentialStore
import com.dsbuilder.frontend.core.network.ApiUrlResolver
import com.dsbuilder.frontend.core.network.KtorAuthenticatedHttpClientFactory
import com.dsbuilder.frontend.core.network.KtorTokenClient
import com.dsbuilder.frontend.core.workspace.WorkspaceFileSystem
import com.dsbuilder.frontend.feature.auth.application.AuthStatusCommand
import com.dsbuilder.frontend.feature.auth.application.AuthStatusResult
import com.dsbuilder.frontend.feature.auth.application.AuthStatusUseCase
import com.dsbuilder.frontend.feature.auth.application.LoginCommand
import com.dsbuilder.frontend.feature.auth.application.LoginResult
import com.dsbuilder.frontend.feature.auth.application.LoginUseCase
import com.dsbuilder.frontend.feature.auth.application.LogoutCommand
import com.dsbuilder.frontend.feature.auth.application.LogoutResult
import com.dsbuilder.frontend.feature.auth.application.LogoutUseCase
import com.dsbuilder.frontend.feature.auth.authApplicationModule
import com.dsbuilder.frontend.feature.components.application.ComponentReadUseCases
import com.dsbuilder.frontend.feature.components.componentsApplicationModule
import com.dsbuilder.frontend.feature.docs.application.DocsReadUseCases
import com.dsbuilder.frontend.feature.docs.docsApplicationModule
import com.dsbuilder.frontend.feature.status.application.CheckProjectStatusUseCase
import com.dsbuilder.frontend.feature.status.statusApplicationModule
import com.dsbuilder.frontend.feature.theme.application.TokenReadUseCases
import com.dsbuilder.frontend.feature.theme.themeApplicationModule
import com.dsbuilder.frontend.mcpserver.CheckProjectStatusMcpReader
import com.dsbuilder.frontend.mcpserver.DsBuilderMcpServerCore
import com.dsbuilder.frontend.mcpserver.MCP_SERVER_VERSION
import com.dsbuilder.frontend.mcpserver.McpServerConfig
import com.dsbuilder.frontend.mcpserver.serveStandardIo
import io.ktor.client.HttpClient
import io.ktor.client.engine.js.Js
import kotlinx.coroutines.MainScope
import kotlinx.coroutines.await
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import okio.BufferedSink
import org.koin.core.Koin
import org.koin.core.component.get
import org.koin.dsl.koinApplication
import kotlin.js.Promise

private val nodeFs: dynamic = js("require('fs')")
private val nodeOs: dynamic = js("require('os')")
private val nodePath: dynamic = js("require('path')")
private val nodeProcess: dynamic = js("process")
private val nodeReadline: dynamic = js("require('readline')")

private const val CREDENTIAL_LOCK_TIMEOUT_MILLIS = 30_000L
private const val CREDENTIAL_LOCK_RETRY_MILLIS = 50L

public fun main() {
    val args = (nodeProcess.argv as Array<String>).drop(2)
    val exitCode = runNodeCli(args)
    if (exitCode != null) {
        nodeProcess.exit(exitCode)
    }
}

internal fun runNodeCli(args: List<String>): Int? =
    when {
        args.isEmpty() || args.first() == "--help" || args.first() == "-h" -> {
            printRootHelp()
            0
        }
        args.first() == "--version" -> {
            println("dsbuilder-mcp $MCP_SERVER_VERSION")
            0
        }
        args.first() == "serve" -> {
            val serveArgs = args.drop(1)
            if (serveArgs.contains("--help") || serveArgs.contains("-h")) {
                printServeHelp()
                0
            } else {
                serve(serveArgs)
                null
            }
        }
        args.first() == "auth" -> {
            runAuth(args.drop(1))
        }
        else -> {
            println("Error: unknown command `${args.first()}`.")
            1
        }
    }

private fun serve(args: List<String>) {
    val apiUrl = optionValue(args, "--api-url")
    val workspace = optionValue(args, "--workspace")
    val runtime = defaultNodeRuntime()
    val koin = nodeKoin(runtime)
    val core = DsBuilderMcpServerCore(
        config = McpServerConfig(apiUrlOverride = apiUrl, workspace = workspace),
        contextResolver = koin.get<ContextResolver>(),
        apiUrlResolver = koin.get<ApiUrlResolver>(),
        projectStatusReader = CheckProjectStatusMcpReader(koin.get<CheckProjectStatusUseCase>()),
        docsReadUseCases = koin.get<DocsReadUseCases>(),
        tokenReadUseCases = koin.get<TokenReadUseCases>(),
        componentReadUseCases = koin.get<ComponentReadUseCases>(),
    )
    MainScope().launch {
        try {
            core.serveStandardIo { error ->
                nodeProcess.stderr.write("${error.message ?: "MCP stdio error"}\n")
            }
        } finally {
            runtime.close()
            nodeProcess.exit(0)
        }
    }
}

private fun runAuth(args: List<String>): Int? {
    if (args.isEmpty() || args.contains("--help") || args.contains("-h")) {
        printAuthHelp()
        return 0
    }
    if (args.any { it == "--password" || it.startsWith("--password=") }) {
        println("Error: password must be entered interactively and cannot be passed as a command-line argument.")
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
    val username = optionValue(args, "--username") ?: prompt("Username: ")
    val password = promptHidden("Password: ")
    val result = koin.get<LoginUseCase>().execute(
        LoginCommand(
            username = username,
            password = password,
            apiUrlOverride = optionValue(args, "--api-url"),
            updatedAt = currentTimeMillis(),
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

private fun nodeKoin(runtime: ClientRuntime): Koin =
    koinApplication {
        modules(
            coreApplicationModule(runtime),
            authApplicationModule(),
            statusApplicationModule(),
            docsApplicationModule(),
            themeApplicationModule(),
            componentsApplicationModule(),
        )
    }.koin

private fun defaultNodeRuntime(): ClientRuntime {
    val httpClient = HttpClient(Js)
    return ClientRuntime(
        fileSystem = NodeWorkspaceFileSystem,
        environmentReader = EnvironmentReader { name -> nodeProcess.env[name] as? String },
        httpClientFactory = KtorAuthenticatedHttpClientFactory { httpClient },
        credentialStore = FileCredentialStore(NodeCredentialStoreFileSystem, NodeCredentialStoreLock),
        tokenClient = KtorTokenClient(httpClient),
        close = { httpClient.close() },
    )
}

private object NodeWorkspaceFileSystem : WorkspaceFileSystem {
    override fun currentWorkingDirectory(): String = nodeProcess.cwd() as String

    override fun parent(path: String): String? =
        (nodePath.dirname(path) as String).takeIf { it != path }

    override fun resolve(parent: String, child: String): String =
        nodePath.resolve(parent, child) as String

    override fun absolutePath(path: String): String =
        nodePath.resolve(path) as String

    override fun exists(path: String): Boolean = nodeFs.existsSync(path) as Boolean

    override fun createDirectories(path: String) {
        nodeFs.mkdirSync(path, js("{ recursive: true }"))
    }

    override fun listFiles(path: String): List<String> =
        (nodeFs.readdirSync(path) as Array<String>).map { resolve(path, it) }

    override fun isDirectory(path: String): Boolean =
        nodeFs.statSync(path).isDirectory() as Boolean

    override fun readText(path: String): String =
        nodeFs.readFileSync(path, "utf8") as String

    override fun readBytes(path: String): ByteArray =
        error("Binary reads are not used by the MCP Node launcher.")

    override fun writeText(path: String, text: String) {
        nodeFs.writeFileSync(path, text)
    }

    override fun writeBytes(path: String, bytes: ByteArray) {
        error("Binary writes are not used by the MCP Node launcher.")
    }

    override fun sink(path: String): BufferedSink =
        error("File sinks are not used by the MCP Node launcher.")

    override fun deleteFile(path: String) {
        if (exists(path)) {
            nodeFs.unlinkSync(path)
        }
    }
}

private object NodeCredentialStoreFileSystem : CredentialStoreFileSystem {
    override fun homeDirectory(): String = nodeOs.homedir() as String

    override fun resolve(parent: String, child: String): String =
        nodePath.resolve(parent, child) as String

    override fun exists(path: String): Boolean = nodeFs.existsSync(path) as Boolean

    override fun createDirectories(path: String) {
        nodeFs.mkdirSync(path, js("{ recursive: true }"))
    }

    override fun readText(path: String): String = nodeFs.readFileSync(path, "utf8") as String

    override fun writeText(path: String, text: String) {
        nodeFs.writeFileSync(path, text)
    }

    override fun atomicReplace(source: String, target: String) {
        nodeFs.renameSync(source, target)
    }

    override fun deleteFile(path: String) {
        if (exists(path)) {
            nodeFs.unlinkSync(path)
        }
    }

    override fun setPosixPermissions(path: String, mode: String) {
        nodeFs.chmodSync(path, js("parseInt")(mode, 8))
    }
}

private object NodeCredentialStoreLock : CredentialStoreLock {
    override suspend fun <T> withLock(lockPath: String, block: suspend () -> T): T {
        NodeCredentialStoreFileSystem.createDirectories(nodePath.dirname(lockPath) as String)
        val deadline = currentTimeMillis() + CREDENTIAL_LOCK_TIMEOUT_MILLIS
        while (!tryAcquire(lockPath)) {
            if (currentTimeMillis() >= deadline) {
                error("Timed out waiting for credential store lock: $lockPath")
            }
            delay(CREDENTIAL_LOCK_RETRY_MILLIS)
        }
        try {
            return block()
        } finally {
            NodeCredentialStoreFileSystem.deleteFile(lockPath)
        }
    }

    private fun tryAcquire(lockPath: String): Boolean =
        try {
            val descriptor = nodeFs.openSync(lockPath, "wx") as Int
            nodeFs.closeSync(descriptor)
            true
        } catch (exception: Throwable) {
            false
        }
}

private fun printRootHelp() {
    println(
        """
        Usage: dsbuilder-mcp [--version] [--help] <command> [<args>]

        Commands:
          serve    Serve DS Builder MCP tools over stdio.
          auth     Manage DS Builder user authentication.
        """.trimIndent(),
    )
}

private fun printServeHelp() {
    println(
        """
        Usage: dsbuilder-mcp serve [--api-url <url>] [--workspace <path>]

        Options:
          --api-url     Override the DS Builder backend API URL.
          --workspace   Resolve project context from this workspace path.
        """.trimIndent(),
    )
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

private suspend fun prompt(label: String): String =
    Promise<String> { resolve, _ ->
        val reader = nodeReadline.createInterface(js("{ input: process.stdin, output: process.stdout }"))
        reader.question(label) { answer: String ->
            reader.close()
            resolve(answer)
        }
    }.await()

private suspend fun promptHidden(label: String): String {
    nodeProcess.stderr.write(label)
    return Promise<String> { resolve, _ ->
        val stdin = nodeProcess.stdin
        val chunks = mutableListOf<String>()
        val isTty = stdin.isTTY == true
        if (isTty) {
            stdin.setRawMode(true)
        }
        stdin.resume()
        lateinit var onData: (dynamic) -> Unit
        onData = { data ->
            val value = data.toString() as String
            when {
                value == "\r" || value == "\n" -> {
                    stdin.removeListener("data", onData)
                    if (isTty) {
                        stdin.setRawMode(false)
                    }
                    stdin.pause()
                    nodeProcess.stderr.write("\n")
                    resolve(chunks.joinToString(""))
                }
                value == "\u0003" -> nodeProcess.exit(130)
                value == "\u007f" -> if (chunks.isNotEmpty()) {
                    chunks.removeAt(chunks.lastIndex)
                }
                else -> chunks += value
            }
        }
        stdin.on("data", onData)
    }.await()
}

private fun currentTimeMillis(): Long =
    (js("Date.now()") as Double).toLong()

private fun optionValue(args: List<String>, name: String): String? {
    val index = args.indexOf(name)
    return when {
        index >= 0 && index + 1 < args.size -> args[index + 1]
        else -> args.firstOrNull { it.startsWith("$name=") }?.substringAfter("=")
    }
}
