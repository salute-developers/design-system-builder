package com.dsbuilder.frontend.mcpserver

import com.dsbuilder.frontend.core.application.DraftOperationResult
import com.dsbuilder.frontend.core.network.HttpMutationResult
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.jsonObject
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class McpEditorResultTest {
    @Test
    fun coreConflictRetainsContextAndReportWithoutSecrets() {
        val response = HttpMutationResult.Response(
            409,
            """{
                "code":"CORE_COMPATIBILITY_CONFLICT",
                "blockingCount":2,
                "compatibilityPath":"/api/projects/project/design-systems/system/compatibility",
                "coreContext":{
                    "designSystemId":"system","draftRevision":7,
                    "coreReleases":[{"releaseId":"core-b","version":"B"}],
                    "accessToken":"secret"
                }
            }""",
            emptyMap(),
            true,
        )
        val result = DraftOperationResult.Executed(response, "project", "system", "repair-key").toEditorMcpResult()
        assertTrue(result.isError)
        val error = Json.parseToJsonElement(result.body).jsonObject
        assertEquals(JsonPrimitive("CONFLICT"), error["code"])
        val details = error.getValue("details").jsonObject
        assertEquals(JsonPrimitive("CORE_COMPATIBILITY_CONFLICT"), details["backendCode"])
        assertEquals(JsonPrimitive(2), details["blockingCount"])
        assertEquals(
            JsonPrimitive("/api/projects/project/design-systems/system/compatibility"),
            details["compatibilityPath"],
        )
        val context = details.getValue("coreContext").jsonObject
        assertEquals(JsonPrimitive(7), context["draftRevision"])
        assertTrue(context.containsKey("coreReleases"))
        assertFalse(result.body.contains("secret"))
    }

    @Test
    fun uuidCaseDoesNotChangeTheSelectedSystem() {
        val selected = "550E8400-E29B-41D4-A716-446655440000"
        val actual = selected.lowercase()
        val header = "{\"designSystemId\":\"$actual\",\"version\":\"draft\"}"
        val response = HttpMutationResult.Response(200, "{}", mapOf("x-ds-read-context" to header), true)
        val result = DraftOperationResult.Executed(response, "project", selected, null).toEditorMcpResult()
        assertFalse(result.isError, result.body)
        val context = Json.parseToJsonElement(result.body).jsonObject.getValue("context").jsonObject
        assertEquals(JsonPrimitive(actual), context["designSystemId"])
    }

    @Test
    fun opaqueIdentifiersRetainTheirCaseSensitiveMeaning() {
        val response = HttpMutationResult.Response(
            200,
            "{}",
            mapOf("x-ds-read-context" to "{\"designSystemId\":\"system\"}"),
            true,
        )
        val result = DraftOperationResult.Executed(response, "project", "SYSTEM", null).toEditorMcpResult()
        assertTrue(result.isError)
    }
}
