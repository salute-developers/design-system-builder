package com.dsbuilder.frontend.cli.presentation

import com.dsbuilder.frontend.cli.CLI_ANALYTICS_OPERATIONS
import com.dsbuilder.frontend.cli.CliAnalyticsSession
import com.dsbuilder.frontend.cli.recordSafely
import com.github.ajalt.clikt.core.Abort
import com.github.ajalt.clikt.core.CliktCommand
import com.github.ajalt.clikt.core.CliktError
import kotlinx.coroutines.CancellationException

/** Наблюдение после успешного разбора аргументов, ровно один раз на конечную команду. */
internal abstract class AnalyticsCliCommand(name: String, private val operation: String) : CliktCommand(name = name) {
    private var userCancelled = false
    protected fun markAnalyticsCancelled() { userCancelled = true }

    @Suppress("TooGenericExceptionCaught")
    final override fun run() {
        currentContext.findObject<CliAnalyticsSession>()?.prepare(consentPrompt())
        userCancelled = false
        var outcome = "success"
        try {
            runOperation()
        } catch (failure: Throwable) {
            outcome = when {
                userCancelled || failure is CancellationException || failure is Abort -> "cancelled"
                failure is CliktError && failure.statusCode == 0 -> "success"
                else -> "failure"
            }
            throw failure
        } finally {
            recordSafely {
                currentContext.findObject<CliAnalyticsSession>()?.record(
                    "cli",
                    CLI_ANALYTICS_OPERATIONS,
                    operation,
                    outcome,
                )
            }
        }
    }
    protected abstract fun runOperation()
}
