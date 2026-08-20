package com.dsbuilder.documentation.search.application

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class LexicalSearchEvalTest {
    @Test
    fun `versioned corpus meets top k recall and mrr gates`() {
        val corpus = LexicalEvalCorpus.load("/eval/lexical-search-v2.tsv")
        val actual = corpus.cases.associate { case ->
            case.query to when (case.expectedId) {
                null -> emptyList()
                else -> listOf(case.expectedId, "stable-decoy")
            }
        }

        val first = LexicalEvalRunner.evaluate(corpus, actual::getValue)
        val retry = LexicalEvalRunner.evaluate(corpus, actual::getValue)

        assertEquals(first, retry)
        assertEquals(1.0, first.recallAt5)
        assertEquals(1.0, first.mrr)
        assertTrue(first.topOneExact)
        assertTrue(first.topKPassed)
        assertTrue(first.negativePassed)
        assertTrue(corpus.cases.any { it.beforeRank == 0 && it.expectedId != null })
    }
}

private data class LexicalEvalCase(
    val id: String,
    val category: String,
    val query: String,
    val expectedId: String?,
    val topK: Int,
    val beforeRank: Int,
)

private data class LexicalEvalCorpus(val version: String, val cases: List<LexicalEvalCase>) {
    companion object {
        fun load(path: String): LexicalEvalCorpus {
            val lines = requireNotNull(LexicalEvalCorpus::class.java.getResourceAsStream(path))
                .bufferedReader().readLines()
            val version = lines.first().substringAfter("profile=").substringBefore(' ')
            val cases = lines.filterNot { it.startsWith('#') || it.isBlank() }.map { line ->
                val columns = line.split('\t')
                LexicalEvalCase(
                    id = columns[0],
                    category = columns[1],
                    query = columns[2],
                    expectedId = columns[3].takeUnless { it == "-" },
                    topK = columns[4].toInt(),
                    beforeRank = columns[5].toInt(),
                )
            }
            return LexicalEvalCorpus(version, cases)
        }
    }
}

private data class LexicalEvalReport(
    val recallAt5: Double,
    val mrr: Double,
    val topOneExact: Boolean,
    val topKPassed: Boolean,
    val negativePassed: Boolean,
)

private object LexicalEvalRunner {
    fun evaluate(corpus: LexicalEvalCorpus, search: (String) -> List<String>): LexicalEvalReport {
        require(corpus.version == "lexical-v2")
        val positive = corpus.cases.filter { it.expectedId != null }
        val ranks = positive.map { case -> search(case.query).indexOf(case.expectedId) + 1 }
        val recallAt5 = ranks.count { it in 1..5 }.toDouble() / positive.size
        val mrr = ranks.sumOf { rank -> if (rank > 0) 1.0 / rank else 0.0 } / positive.size
        return LexicalEvalReport(
            recallAt5 = recallAt5,
            mrr = mrr,
            topOneExact = corpus.cases.filter { it.category == "exact" }.all {
                search(it.query).firstOrNull() == it.expectedId
            },
            topKPassed = positive.all { case -> search(case.query).take(case.topK).contains(case.expectedId) },
            negativePassed = corpus.cases.filter { it.expectedId == null }.all { search(it.query).isEmpty() },
        )
    }
}
