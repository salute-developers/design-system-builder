package com.dsbuilder.ds.components

import com.dsbuilder.ds.components.domain.Component
import com.dsbuilder.ds.components.domain.ComponentDependency
import com.dsbuilder.ds.components.domain.ComponentDependencyGraph
import com.dsbuilder.ds.components.domain.ComponentPropertySummary
import com.dsbuilder.ds.components.presentation.ComponentDependencyGraphResponse
import com.dsbuilder.ds.components.presentation.ComponentPropertySummaryResponse
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import java.time.Instant
import java.util.UUID
import kotlin.test.Test
import kotlin.test.assertContains
import kotlin.test.assertFalse

/** Проверяет совместимость прежних ответов при добавлении необязательного include. */
class ComponentReadEnrichmentResponseTest {
    private val json = Json { encodeDefaults = true }
    private val now = Instant.parse("2024-01-01T00:00:00Z")

    @Test
    fun `property platform params appear only when included`() {
        val property = ComponentPropertySummary(UUID.randomUUID(), null, "color", "color", null, null, now, now)
        val plain = json.encodeToString(ComponentPropertySummaryResponse.from(property))
        val enriched = json.encodeToString(ComponentPropertySummaryResponse.from(property, emptyList()))

        assertFalse("platformParams" in plain)
        assertContains(enriched, "\"platformParams\":[]")
    }

    @Test
    fun `dependency reuse config appears only when included`() {
        val parentId = UUID.randomUUID()
        val childId = UUID.randomUUID()
        val dependency = ComponentDependency(
            UUID.randomUUID(),
            parentId,
            childId,
            ComponentDependency.RelationType.REUSE,
            null,
            now,
            now,
        )
        val child = Component(childId, "child", "web", null, now, now)
        val graph = ComponentDependencyGraph(listOf(ComponentDependencyGraph.WithChild(dependency, child)), emptyList())
        val plain = json.encodeToString(ComponentDependencyGraphResponse.from(graph))
        val enriched = json.encodeToString(ComponentDependencyGraphResponse.from(graph, emptyMap()))

        assertFalse("reuseConfig" in plain)
        assertContains(enriched, "\"reuseConfig\":[]")
    }
}
