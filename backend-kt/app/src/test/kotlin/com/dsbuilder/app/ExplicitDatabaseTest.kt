package com.dsbuilder.app

import java.io.File
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

/** Защищает монолит от случайного выбора последней зарегистрированной в Exposed базы. */
class ExplicitDatabaseTest {
    @Test
    fun `production Exposed transactions always name their database`() {
        val backend = File("..").canonicalFile
        val contours = listOf("app", "identity-gateway", "projects-service", "ds-service", "documentation-service")
        val violations = contours.flatMap { contour ->
            File(backend, contour).walkTopDown().onEnter { it.name !in setOf("build", ".gradle", ".kotlin") }
                .filter { it.extension == "kt" && "/src/main/kotlin/" in it.invariantSeparatorsPath }
                .flatMap { file -> violations(file.readText()).map { "${file.relativeTo(backend)}:$it" } }.toList()
        }
        assertTrue(violations.isEmpty(), "Use transaction(db = ownedDatabase):\n${violations.joinToString("\n")}")
    }

    @Test
    fun `guard rejects implicit null aliased qualified and suspended calls`() {
        val calls = listOf(
            "transaction { work() }",
            "transaction { transaction(db = owned) { work() } }",
            "transaction() { work() }",
            "transaction<Unit> { work() }",
            "transaction(db = null) { work() }",
            "transaction(transactionIsolation = 2) { work() }",
            "transaction(owned) { work() }",
        )
        calls.forEach { call -> assertEquals(1, violations("import $TRANSACTIONS.transaction\n$call").size, call) }
        assertEquals(1, violations("import $TRANSACTIONS.transaction as tx\ntx { work() }").size)
        assertEquals(1, violations("$TRANSACTIONS.transaction { work() }").size)
        assertEquals(1, violations("import $TRANSACTIONS.*\ntransaction(db = owned) { work() }").size)
        val suspended = "import $TRANSACTIONS.experimental.newSuspendedTransaction\n" +
            "newSuspendedTransaction { work() }"
        assertEquals(1, violations(suspended).size)
    }

    @Test
    fun `guard permits explicit calls declarations comments and non Exposed ports`() {
        val source = """
            import $TRANSACTIONS.transaction
            fun transaction(block: () -> Unit) = Unit
            // transaction { ignored() }
            val text = "transaction { ignored() }"
            transaction(db = provider.database) { work() }
            transaction<Unit>(db = provider.database) { work() }
            transactions.transaction { work() }
            $TRANSACTIONS.transaction(db = owned) { work() }
        """.trimIndent()
        assertTrue(violations(source).isEmpty())
    }

    private fun violations(source: String): List<Int> {
        // Mask comments/literals while retaining offsets for useful line numbers.
        val masked = Regex("\"\"\"[\\s\\S]*?\"\"\"|\"(?:\\\\.|[^\"\\\\])*\"|/\\*[\\s\\S]*?\\*/|//[^\\n]*")
            .replace(source) { match -> match.value.map { if (it == '\n') '\n' else ' ' }.joinToString("") }
        val imports = Regex(
            "import\\s+(org\\.jetbrains\\.exposed\\.[\\w.]+)\\." +
                "(transaction|newSuspendedTransaction|suspendTransaction|\\*)" +
                "(?:[ \\t]+as[ \\t]+(\\w+))?",
        )
            .findAll(masked).filter { ".transactions" in it.groupValues[1] }.toList()
        val wildcard = imports.filter { it.groupValues[2] == "*" }.map { it.range.first }
        val names = imports.filter { it.groupValues[2] != "*" }.map { it.groupValues[3].ifEmpty { it.groupValues[2] } }
        val qualified = "org\\.jetbrains\\.exposed\\.[\\w.]*transactions\\.(?:experimental\\.)?" +
            "(?:transaction|newSuspendedTransaction|suspendTransaction)"
        val selectors = listOf(qualified) + names.map(Regex::escape)
        val call = Regex("(?<![\\w.])(?:${selectors.joinToString("|")})\\s*(?:<[^(){};]+>\\s*)?(?=[({])")
        val implicit = call.findAll(masked).filter { match ->
            val prefix = masked.substring(0, match.range.first)
            val declaration = Regex("\\bfun\\s+(?:<[^>]+>\\s+)?$").containsMatchIn(prefix)
            val arguments = masked.substring(match.range.last + 1)
            !declaration && !Regex("^\\(\\s*db\\s*=\\s*(?!null\\b)[A-Za-z_]").containsMatchIn(arguments)
        }.map { it.range.first }.toList()
        return (wildcard + implicit).map { offset -> source.take(offset).count { it == '\n' } + 1 }
    }

    private companion object {
        const val TRANSACTIONS = "org.jetbrains.exposed.v1.jdbc.transactions"
    }
}
