package com.dsbuilder.frontend.mcpserver

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNull

class McpResponseProjectionsTest {
    @Test
    fun documentationFetchDropsSearchTextAndKeepsMarkdownMetadata() {
        val json = Json
        val input = McpToolResult(
            false,
            """
            {
              "source":"documentation",
              "data":{
                "kbUrl":"dsb://documentation/pub/content/0",
                "publicationId":"pub",
                "designSystemId":"ds",
                "version":"1.0.0",
                "platform":"compose",
                "pageId":"page",
                "pagePath":"components/badge",
                "pageTitle":"Badge",
                "contentId":"content",
                "sourcePath":"components/badge.md",
                "ordinal":0,
                "headingPath":["Badge"],
                "markdown":"## Badge",
                "searchText":"Badge",
                "subjects":["components.badge"]
              }
            }
            """.trimIndent(),
        )

        val data = json.parseToJsonElement(compactDocumentationFetch(json, input).body)
            .jsonObject.getValue("data").jsonObject

        assertEquals("## Badge", data.getValue("markdown").jsonPrimitive.content)
        assertEquals("Badge", data.getValue("pageTitle").jsonPrimitive.content)
        assertFalse(data.containsKey("searchText"))
    }

    @Test
    fun tokenListReturnsExactCompactSummary() {
        val json = Json
        val input = McpToolResult(
            false,
            """
            {
              "source":"design-system-model-api",
              "data":[
                {"id":"1","name":"surface.default","type":"color","displayName":"Surface","description":null,"createdAt":"now"},
                {"id":"2","name":"surface.default.clear","type":"color","createdAt":"now"}
              ]
            }
            """.trimIndent(),
        )

        val data = json.parseToJsonElement(compactTokenList(input, json, "surface.default", null).body)
            .jsonObject.getValue("data").jsonArray
        val token = data.single().jsonObject

        assertEquals("1", token.getValue("id").jsonPrimitive.content)
        assertEquals("surface.default", token.getValue("name").jsonPrimitive.content)
        assertFalse(token.containsKey("createdAt"))
    }

    @Test
    fun componentListReturnsCompactSummariesAndAppliesExplicitLimit() {
        val json = Json
        val input = McpToolResult(
            false,
            """
            {
              "source":"design-system-model-api",
              "data":[
                {"id":"1","name":"badge","description":"Badge","updatedAt":"now"},
                {"id":"2","name":"button","description":"Button","updatedAt":"now"}
              ]
            }
            """.trimIndent(),
        )

        val unbounded = json.parseToJsonElement(compactComponentList(input, json, null, null).body)
            .jsonObject.getValue("data").jsonArray
        val data = json.parseToJsonElement(compactComponentList(input, json, null, 1).body)
            .jsonObject.getValue("data").jsonArray
        val component = data.single().jsonObject

        assertEquals(2, unbounded.size)
        assertEquals("badge", component.getValue("name").jsonPrimitive.content)
        assertFalse(component.containsKey("updatedAt"))
    }

    @Test
    fun searchKeepsCursorAndDropsOnlyBindingPayload() {
        val json = Json
        val input = McpToolResult(
            false,
            """
            {
              "source":"documentation",
              "data":{
                "items":[{
                  "id":"b-1",
                  "subject":"components.basic-button",
                  "kind":"component-style",
                  "name":"BasicButton",
                  "platform":"compose",
                  "platformPayload":{"styles":[1,2]}
                }],
                "nextCursor":"next"
              }
            }
            """.trimIndent(),
        )

        val output = compactBindingSearch(json, input)
        val page = json.parseToJsonElement(output.body).jsonObject.getValue("data").jsonObject
        val binding = page.getValue("items").jsonArray.single().jsonObject

        assertEquals("next", page.getValue("nextCursor").jsonPrimitive.content)
        assertEquals("b-1", binding.getValue("id").jsonPrimitive.content)
        assertFalse(binding.containsKey("platformPayload"))
    }

    @Test
    fun selectionSyntaxRejectsDuplicates() {
        assertNull(parseVariationSelection("size=s,size=xl"))
        assertNull(parseVariationSelection("size"))
        assertEquals(mapOf("size" to "s"), parseVariationSelection("size=s"))
    }

    @Test
    fun componentBindingVariationProjectionFiltersNamesAndDropsStyleApi() {
        val json = Json
        val input = McpToolResult(
            false,
            """
            {
              "source":"documentation",
              "data":{
                "id":"badge-binding","subject":"components.badge","kind":"component-style","name":"Badge",
                "platform":"compose",
                "platformPayload":{
                  "key":"badge",
                  "coreName":"Badge",
                  "styles":[
                    {
                      "key":"badge","coreName":"Badge","styleName":"BadgeClear",
                      "styleApi":{"returnTypeName":"BadgeStyle"},
                      "variations":[
                        {"name":"L.Default","composeReference":"BadgeClear.L.Default"},
                        {"name":"S.Pilled","composeReference":"BadgeClear.S.Pilled"}
                      ]
                    },
                    {
                      "key":"badge","coreName":"Badge","styleName":"BadgeSolid",
                      "variations":[
                        {"name":"L.Default","composeReference":"BadgeSolid.L.Default"}
                      ]
                    }
                  ]
                }
              }
            }
            """.trimIndent(),
        )

        val output = projectComponentBinding(
            input,
            json,
            appearanceNames = setOf("BadgeClear"),
            variationNames = setOf("L.Default"),
            detail = CodeBindingDetail.VARIATIONS,
        )
        val payload = json.parseToJsonElement(output.body).jsonObject
            .getValue("data").jsonObject
            .getValue("platformPayload").jsonObject
        val appearance = payload.getValue("styles").jsonArray.single().jsonObject
        val variation = appearance.getValue("variations").jsonArray.single().jsonObject

        assertEquals("BadgeClear", appearance.getValue("styleName").jsonPrimitive.content)
        assertEquals("L.Default", variation.getValue("name").jsonPrimitive.content)
        assertEquals(1, appearance.getValue("variationCount").jsonPrimitive.content.toInt())
        assertEquals(1, payload.getValue("totalVariationCount").jsonPrimitive.content.toInt())
        assertFalse(appearance.containsKey("styleApi"))
        assertEquals("badge", payload.getValue("key").jsonPrimitive.content)
    }

    @Test
    fun componentBindingSummaryKeepsAxesDefaultsAndCountsWithoutExpandedPayload() {
        val json = Json
        val input = McpToolResult(
            false,
            """
            {
              "source":"documentation",
              "data":{
                "id":"badge-binding",
                "subject":"components.badge",
                "kind":"component-style",
                "name":"Badge",
                "platform":"compose",
                "platformPayload":{
                  "key":"badge",
                  "coreName":"Badge",
                  "styles":[{
                    "key":"badge",
                    "coreName":"Badge",
                    "styleName":"BadgeClear",
                    "props":[{"name":"size","values":["l","m"],"defaultValue":"l"}],
                    "styleApi":{"returnTypeName":"BadgeStyle"},
                    "variations":[
                      {"name":"l.default","composeReference":"BadgeClear.L.Default"},
                      {"name":"m.default","composeReference":"BadgeClear.M.Default"}
                    ]
                  }]
                }
              }
            }
            """.trimIndent(),
        )

        val output = projectComponentBinding(
            input,
            json,
            appearanceNames = emptySet(),
            variationNames = emptySet(),
            detail = CodeBindingDetail.SUMMARY,
        )
        val payload = json.parseToJsonElement(output.body).jsonObject
            .getValue("data").jsonObject
            .getValue("platformPayload").jsonObject
        val appearance = payload.getValue("styles").jsonArray.single().jsonObject

        assertEquals("BadgeClear", appearance.getValue("styleName").jsonPrimitive.content)
        val propertyName = appearance.getValue("props").jsonArray.single().jsonObject
            .getValue("name").jsonPrimitive.content
        assertEquals("size", propertyName)
        assertEquals(2, appearance.getValue("variationCount").jsonPrimitive.content.toInt())
        assertEquals(2, payload.getValue("totalVariationCount").jsonPrimitive.content.toInt())
        assertFalse(appearance.containsKey("styleApi"))
        assertFalse(appearance.containsKey("variations"))
    }

    @Test
    fun componentBindingFullDetailPreservesUnfilteredPublishedPayload() {
        val json = Json
        val input = McpToolResult(
            false,
            """{"source":"documentation","data":{"kind":"component-style","platformPayload":{"styles":[]}}}""",
        )

        val output = projectComponentBinding(
            input,
            json,
            appearanceNames = emptySet(),
            variationNames = emptySet(),
            detail = CodeBindingDetail.FULL,
        )

        assertEquals(input.body, output.body)
    }
}
