package com.dsbuilder.frontend.runtime.node

import com.dsbuilder.frontend.core.process.ProcessLaunchException

/** The supervisor cannot launch user code until it has been assigned to this JobObject. */
internal class WindowsProcessOwner private constructor(private val directory: String, private val job: dynamic) {
    private var closed = false

    fun failure(): String? {
        val path = "$directory/error"
        return if (fs.existsSync(path) as Boolean) fs.readFileSync(path, "utf8") as String else null
    }

    fun terminate() {
        if (!closed) check(WindowsJobs.terminate(job, 130) != 0) { "Cannot terminate process job" }
    }

    fun close() {
        if (closed) return
        closed = true
        // KILL_ON_JOB_CLOSE is also the fallback when termination or the supervisor fails.
        WindowsJobs.close(job)
        fs.rmSync(directory, js("({recursive:true,force:true})"))
    }

    companion object {
        private val fs: dynamic = js("require('fs')")

        // Win32 errors and filesystem failures are JS Error values, not Kotlin exception subclasses.
        @Suppress("TooGenericExceptionCaught")
        fun start(executable: String, args: Array<String>, options: dynamic): NodeStartedProcess {
            val job = WindowsJobs.create(null, null)
            check(job != null) { "Cannot create process job" }
            var directory: String? = null
            var child: dynamic = null
            try {
                // JOBOBJECT_EXTENDED_LIMIT_INFORMATION: LimitFlags follows two LARGE_INTEGER fields.
                val limits: dynamic = js("Buffer").alloc(if (WindowsJobs.pointerSize == 8) 144 else 112)
                limits.writeUInt32LE(0x2000, 16)
                check(WindowsJobs.configure(job, 9, limits, limits.length) != 0) { "Cannot configure process job" }
                directory = fs.mkdtempSync(js("require('os').tmpdir()") + "/dsbuilder-process-") as String
                val request: dynamic = js("({})")
                request.executable = executable
                request.args = args
                request.environment = options.env
                request.verbatim = options.windowsVerbatimArguments == true
                fs.writeFileSync("$directory/request.json", js("JSON").stringify(request), js("({mode:384})"))
                val supervisorOptions: dynamic = js("Object.assign({}, options)")
                supervisorOptions.windowsVerbatimArguments = false
                supervisorOptions.env = js("Object.assign({}, options.env)")
                // Preloads must not run in the trusted supervisor before ownership is established.
                (js("Object.keys(supervisorOptions.env)") as Array<String>)
                    .filter { it.equals("NODE_OPTIONS", true) }
                    .forEach { js("Reflect").deleteProperty(supervisorOptions.env, it) }
                child = js("require('child_process')").spawn(
                    nodeProcess.execPath,
                    arrayOf("-e", SUPERVISOR, directory),
                    supervisorOptions,
                )
                child.once("error", { _: dynamic -> Unit })
                val handle = WindowsJobs.open(0x101, 0, child.pid)
                check(handle != null) { "Cannot open process supervisor" }
                try {
                    check(WindowsJobs.assign(job, handle) != 0) { "Cannot own process supervisor" }
                } finally { WindowsJobs.close(handle) }
                fs.writeFileSync("$directory/go", "", js("({mode:384})"))
                return NodeStartedProcess(child, WindowsProcessOwner(directory, job))
            } catch (error: Throwable) {
                if (child != null) child.kill("SIGKILL")
                WindowsJobs.close(job)
                if (directory != null) fs.rmSync(directory, js("({recursive:true,force:true})"))
                throw ProcessLaunchException("Cannot start process $executable", error)
            }
        }

        private val SUPERVISOR = """
            const fs = require('fs'), cp = require('child_process'), path = require('path');
            const directory = process.argv[1], deadline = Date.now() + 10000;
            const requestPath = path.join(directory, 'request.json');
            let request;
            try { request = JSON.parse(fs.readFileSync(requestPath, 'utf8')); }
            catch (_) {
                fs.writeFileSync(path.join(directory, 'error'), 'cannot read launch request', {mode:384});
                process.exitCode = 126;
            } finally { fs.rmSync(requestPath, {force:true}); }
            if (!request) process.exit(126);
            const timer = setInterval(() => {
                if (!fs.existsSync(path.join(directory, 'go'))) {
                    if (Date.now() > deadline) {
                        clearInterval(timer);
                        fs.writeFileSync(path.join(directory, 'error'), 'handshake timeout', {mode:384});
                        fs.rmSync(path.join(directory, 'request.json'), {force:true});
                        process.exitCode = 126;
                    }
                    return;
                }
                clearInterval(timer);
                let failed = false;
                const failure = error => {
                    failed = true;
                    fs.writeFileSync(path.join(directory, 'error'), String(error.code || 'spawn failed'), {mode:384});
                    process.exitCode = 126;
                };
                try {
                    const child = cp.spawn(request.executable, request.args, {
                        stdio:'inherit', env:request.environment, windowsVerbatimArguments:request.verbatim
                    });
                    child.on('error', failure);
                    child.on('exit', (code, signal) => {
                        if (!failed) process.exitCode = code == null
                            ? 128 + (require('os').constants.signals[signal] || 0) : code;
                    });
                } catch (error) { failure(error); }
            }, 10);
        """.trimIndent()
    }
}

private object WindowsJobs {
    private val koffi: dynamic = js("require('koffi')")
    private val kernel: dynamic = koffi.load("kernel32.dll")
    val pointerSize: Int = koffi.sizeof("void *") as Int
    val create: dynamic = kernel.func("__stdcall", "CreateJobObjectW", "void *", arrayOf("void *", "str16"))
    val configure: dynamic = kernel.func(
        "__stdcall",
        "SetInformationJobObject",
        "int",
        arrayOf("void *", "int", "void *", "uint32_t"),
    )
    val open: dynamic = kernel.func("__stdcall", "OpenProcess", "void *", arrayOf("uint32_t", "int", "uint32_t"))
    val assign: dynamic = kernel.func("__stdcall", "AssignProcessToJobObject", "int", arrayOf("void *", "void *"))
    val terminate: dynamic = kernel.func("__stdcall", "TerminateJobObject", "int", arrayOf("void *", "uint32_t"))
    val close: dynamic = kernel.func("__stdcall", "CloseHandle", "int", arrayOf("void *"))
}

internal class NodeStartedProcess(val child: dynamic, val owner: WindowsProcessOwner? = null)
