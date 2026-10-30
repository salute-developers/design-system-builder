package com.dsbuilder.ds.app

import io.ktor.client.HttpClient
import io.ktor.client.request.HttpRequestBuilder
import io.ktor.client.request.delete
import io.ktor.client.request.get
import io.ktor.client.request.header
import io.ktor.client.request.patch
import io.ktor.client.request.post
import io.ktor.client.request.put
import io.ktor.client.request.request
import io.ktor.client.request.setBody
import io.ktor.client.statement.bodyAsText
import io.ktor.http.ContentType
import io.ktor.http.HttpMethod
import io.ktor.http.HttpStatusCode
import io.ktor.http.contentType
import io.ktor.server.testing.runTestApplication
import io.ktor.test.dispatcher.runTestWithRealTime
import io.ktor.utils.io.ByteReadChannel
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import java.sql.DriverManager
import java.time.Instant
import java.util.UUID
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue
import kotlin.time.Duration.Companion.seconds

/** End-to-end contract gate for HTTP, RBAC, ownership and component-config transactions. */
class DsServiceHttpPostgresIntegrationTest {
    private val json = Json { ignoreUnknownKeys = false }

    @Test
    fun `project resources are isolated and component config import is atomic`() {
        IsolatedPostgresDatabase.create().use { postgres ->
            runTestWithRealTime(timeout = 240.seconds) {
                runTestApplication {
                    application { module(configuration(postgres)) }

                    val openApi = json.parseToJsonElement(client.get("/openapi.json").bodyAsText()).jsonObject
                    val operations = openApi.getValue("paths").jsonObject.flatMap { (template, pathItem) ->
                        pathItem.jsonObject.keys.map { method -> template to method }
                    }
                    assertEquals(190, operations.size)
                    operations.forEach { (template, method) ->
                        val path = template.replace(Regex("\\{[^}]+}"), MISSING_ID)
                        val response = client.request(path) { this.method = HttpMethod.parse(method.uppercase()) }
                        assertEquals(HttpStatusCode.Forbidden, response.status, "$method $template must enforce RBAC")
                    }

                    val forbidden = client.post("/api/ds/design-systems") {
                        trusted("project-a", "viewer")
                        jsonBody("""{"name":"forbidden","projectName":"forbidden"}""")
                    }
                    assertEquals(HttpStatusCode.Forbidden, forbidden.status)

                    val invalid = client.post("/api/ds/design-systems") {
                        trusted("project-a", "owner")
                        jsonBody("""{"name":" ","projectName":"alpha"}""")
                    }
                    assertEquals(HttpStatusCode.BadRequest, invalid.status)
                    assertEquals(
                        """{"error":{"formErrors":[],"fieldErrors":{"name":""" +
                            """["Too small: expected string to have >=1 characters"]}}}""",
                        invalid.bodyAsText(),
                    )

                    val missingFields = client.post("/api/ds/design-systems") {
                        trusted("project-a", "owner")
                        jsonBody("{}")
                    }
                    assertEquals(
                        """{"error":{"formErrors":[],"fieldErrors":{"name":""" +
                            """["Invalid input: expected string, received undefined"],"projectName":""" +
                            """["Invalid input: expected string, received undefined"]}}}""",
                        missingFields.bodyAsText(),
                    )

                    val wrongType = client.post("/api/ds/design-systems") {
                        trusted("project-a", "owner")
                        jsonBody("""{"name":42,"projectName":"alpha"}""")
                    }
                    assertEquals(HttpStatusCode.BadRequest, wrongType.status)
                    assertEquals(
                        """{"error":{"formErrors":[],"fieldErrors":{"name":""" +
                            """["Invalid input: expected string, received number"]}}}""",
                        wrongType.bodyAsText(),
                    )

                    verifyThemeCreationWithoutComponentMetadata(client, postgres)

                    val componentIds = seedComponentPrerequisites(postgres)
                    val componentId = componentIds.getValue("Button")
                    val designSystem = client.post("/api/ds/design-systems") {
                        trusted("project-a", "owner")
                        jsonBody("""{"name":"alpha","projectName":"alpha"}""")
                    }
                    assertEquals(HttpStatusCode.Created, designSystem.status, designSystem.bodyAsText())
                    val designSystemId = id(designSystem.bodyAsText())
                    verifyEmptyDesignSystemPatch(client, designSystemId)
                    assertEquals(1, versionBoundaryCount(postgres, designSystemId, "baseline"))
                    assertEquals(1, versionBoundaryCount(postgres, designSystemId, "draft"))
                    assertTrue(rowCount(postgres, "design_system_components") > 0)
                    assertTrue(rowCount(postgres, "appearances") > 0)

                    val changes = client.get("/api/ds/design-systems/$designSystemId/changes") {
                        trusted("project-a", "viewer")
                    }
                    assertEquals(HttpStatusCode.OK, changes.status)

                    val hidden = client.get("/api/ds/design-systems/$designSystemId") {
                        trusted("project-b", "owner")
                    }
                    assertEquals(HttpStatusCode.NotFound, hidden.status)

                    val tenant = client.post("/api/ds/tenants") {
                        trusted("project-a", "editor")
                        jsonBody("""{"designSystemId":"$designSystemId","name":"dark"}""")
                    }
                    assertEquals(HttpStatusCode.Created, tenant.status, tenant.bodyAsText())
                    val tenantId = id(tenant.bodyAsText())
                    verifyEmptyTenantPatch(client, postgres, tenantId)
                    assertEquals(63, rowCount(postgres, "design_system_components"))
                    assertEquals(66, rowCount(postgres, "appearances"))
                    assertEquals(
                        "malachite",
                        json.parseToJsonElement(tenant.bodyAsText()).jsonObject
                            .getValue("colorConfig").jsonObject.getValue("profile").jsonPrimitive.content,
                    )
                    val duplicateTenant = client.post("/api/ds/tenants") {
                        trusted("project-a", "editor")
                        jsonBody("""{"designSystemId":"$designSystemId","name":"  dark  "}""")
                    }
                    assertEquals(HttpStatusCode.Conflict, duplicateTenant.status, duplicateTenant.bodyAsText())
                    assertEquals(
                        "TENANT_NAME_CONFLICT",
                        json.parseToJsonElement(duplicateTenant.bodyAsText()).jsonObject
                            .getValue("code").jsonPrimitive.content,
                    )
                    val initialValues = client.get("/api/ds/tenants/$tenantId/token-values") {
                        trusted("project-a", "viewer")
                    }
                    assertEquals(HttpStatusCode.OK, initialValues.status)
                    assertTrue(initialValues.bodyAsText().length > 2)
                    assertEquals(
                        tenantTokenValueCount(postgres, tenantId),
                        tenantCreationBaselineCount(postgres, tenantId),
                    )
                    val savedValues = client.put("/api/ds/tenants/$tenantId/token-values") {
                        trusted("project-a", "editor")
                        jsonBody("""{"editRevision":0,"values":[]}""")
                    }
                    assertEquals(HttpStatusCode.OK, savedValues.status, savedValues.bodyAsText())
                    assertTrue(
                        json.parseToJsonElement(savedValues.bodyAsText()).jsonObject
                            .getValue("editRevision").jsonPrimitive.content.toLong() >= 0,
                    )
                    assertEquals(
                        0,
                        json.parseToJsonElement(savedValues.bodyAsText()).jsonObject.getValue("values").jsonArray.size,
                    )
                    val staleValues = client.put("/api/ds/tenants/$tenantId/token-values") {
                        trusted("project-a", "editor")
                        jsonBody("""{"editRevision":0,"values":[]}""")
                    }
                    assertEquals(HttpStatusCode.OK, staleValues.status, staleValues.bodyAsText())

                    val tokenFixture = verifyMultiUserTokenEditing(client, designSystemId, tenantId)
                    val tokenId = tokenFixture.tokenId

                    val imported = client.post("/api/ds/component-config/import") {
                        trusted("project-a", "editor")
                        header("Idempotency-Key", "component-config-import")
                        jsonBody(importBody(designSystemId, "default", dryRun = false))
                    }
                    assertEquals(HttpStatusCode.OK, imported.status, imported.bodyAsText())
                    val report = json.parseToJsonElement(imported.bodyAsText()).jsonObject
                    // The seeded design system already owns the web "default" appearance of Button:
                    // the import updates it.
                    assertEquals("0", report.getValue("created").jsonPrimitive.content, imported.bodyAsText())
                    assertEquals("1", report.getValue("updated").jsonPrimitive.content, imported.bodyAsText())
                    assertEquals("[]", report.getValue("unknownStates").toString())
                    val repeatedImport = client.post("/api/ds/component-config/import") {
                        trusted("project-a", "editor")
                        header("Idempotency-Key", "component-config-import")
                        jsonBody(importBody(designSystemId, "default", dryRun = false))
                    }
                    assertEquals(imported.bodyAsText(), repeatedImport.bodyAsText())

                    val (draftId, draftRevision) = activeDraft(postgres, designSystemId)
                    val version = client.post("/api/ds/design-system-versions") {
                        trusted("project-a", "owner")
                        header("Idempotency-Key", "integration-publication")
                        jsonBody(
                            """{"designSystemId":"$designSystemId","draftId":"$draftId",""" +
                                """"draftRevision":$draftRevision,"version":"1.0.0","changelog":"Integration"}""",
                        )
                    }
                    assertEquals(HttpStatusCode.Created, version.status, version.bodyAsText())
                    val publishedVersionId = id(version.bodyAsText())
                    verifyPublicationReplay(
                        client,
                        designSystemId,
                        draftId,
                        draftRevision,
                        version.bodyAsText(),
                    )
                    verifyVersionSelection(client, designSystemId, publishedVersionId, tenantId)

                    verifyInheritedNameConflicts(client, designSystemId)

                    verifyPublishedTokenValueRestoration(client, tokenFixture, tenantId)

                    val single = client.get(
                        "/api/ds/component-config?ds=alpha&version=1.0.0&appearance=default" +
                            "&component=Button&platform=web",
                    ) { trusted("project-a", "viewer") }
                    assertEquals(HttpStatusCode.OK, single.status, single.bodyAsText())
                    assertTrue(single.bodyAsText().contains("pressed"))

                    val exported = client.post("/api/ds/component-config/export") {
                        trusted("project-a", "viewer")
                        jsonBody("""{"designSystemId":"$designSystemId","platform":"web","components":["button"]}""")
                    }
                    assertEquals(HttpStatusCode.OK, exported.status, exported.bodyAsText())
                    assertTrue(exported.bodyAsText().contains("\"version\":\"draft\""))

                    val countsBeforeDryRun = counts(postgres)
                    val dryRun = client.post("/api/ds/component-config/import") {
                        trusted("project-a", "editor")
                        jsonBody(importBody(designSystemId, "preview", dryRun = true))
                    }
                    assertEquals(HttpStatusCode.OK, dryRun.status, dryRun.bodyAsText())
                    assertEquals(countsBeforeDryRun, counts(postgres))

                    val absentPreview = client.get(
                        "/api/ds/component-config?ds=alpha&version=1.0.0&appearance=preview" +
                            "&component=Button&platform=web",
                    ) { trusted("project-a", "viewer") }
                    assertEquals(HttpStatusCode.NotFound, absentPreview.status)

                    val tooLarge = client.post("/api/ds/component-config/import") {
                        trusted("project-a", "editor")
                        jsonBody(
                            importBody(designSystemId, "oversize", dryRun = false)
                                .replace("kotlin-test", "x".repeat(16 * 1024 * 1024)),
                        )
                    }
                    assertEquals(HttpStatusCode.PayloadTooLarge, tooLarge.status)

                    val crossProjectImport = client.post("/api/ds/component-config/import") {
                        trusted("project-b", "editor")
                        jsonBody(importBody(designSystemId, "hidden", dryRun = false))
                    }
                    assertEquals(HttpStatusCode.NotFound, crossProjectImport.status)

                    val foreignDesignSystem = client.post("/api/ds/design-systems") {
                        trusted("project-b", "owner")
                        jsonBody("""{"name":"beta","projectName":"beta"}""")
                    }
                    assertEquals(HttpStatusCode.Created, foreignDesignSystem.status)
                    val foreignDesignSystemId = id(foreignDesignSystem.bodyAsText())
                    val foreignTenant = client.post("/api/ds/tenants") {
                        trusted("project-b", "editor")
                        jsonBody("""{"designSystemId":"$foreignDesignSystemId","name":"foreign"}""")
                    }
                    assertEquals(HttpStatusCode.Created, foreignTenant.status)
                    val foreignTenantId = id(foreignTenant.bodyAsText())
                    val crossProjectTokenValue = client.post("/api/ds/token-values") {
                        trusted("project-a", "editor")
                        jsonBody("""{"tokenId":"$tokenId","tenantId":"$foreignTenantId","value":"#fff"}""")
                    }
                    assertEquals(HttpStatusCode.NotFound, crossProjectTokenValue.status)

                    verifyStateImpactIsolation(client, postgres, foreignDesignSystemId)

                    val sharedMutation = client.patch("/api/ds/components/$componentId") {
                        trusted("project-a", "editor")
                        jsonBody("""{"description":"must stay shared"}""")
                    }
                    assertEquals(HttpStatusCode.NotFound, sharedMutation.status)

                    val privateComponent = client.post("/api/ds/components") {
                        trustedSystemAdmin()
                        jsonBody("""{"name":"PrivateButton","platform":"web"}""")
                    }
                    assertEquals(HttpStatusCode.Created, privateComponent.status)
                    val privateComponentId = id(privateComponent.bodyAsText())
                    val privateLink = client.post("/api/ds/design-system-components") {
                        trusted("project-a", "editor")
                        jsonBody("""{"designSystemId":"$designSystemId","componentId":"$privateComponentId"}""")
                    }
                    assertEquals(HttpStatusCode.Created, privateLink.status)
                    val privateState = client.post("/api/ds/states") {
                        trustedSystemAdmin()
                        jsonBody("""{"componentId":"$privateComponentId","name":"private-state"}""")
                    }
                    assertEquals(HttpStatusCode.Created, privateState.status)
                    val privateStateId = id(privateState.bodyAsText())
                    val privateStateSet = client.post("/api/ds/state-sets/resolve") {
                        trustedSystemAdmin()
                        jsonBody("""{"stateIds":["$privateStateId"]}""")
                    }
                    assertTrue(
                        privateStateSet.status == HttpStatusCode.OK || privateStateSet.status == HttpStatusCode.Created,
                    )
                    val privateStateSetId = id(privateStateSet.bodyAsText())
                    assertEquals(
                        HttpStatusCode.NotFound,
                        client.get("/api/ds/states/$privateStateId") { trusted("project-b", "viewer") }.status,
                    )
                    assertEquals(
                        HttpStatusCode.NotFound,
                        client.get("/api/ds/state-sets/$privateStateSetId") { trusted("project-b", "viewer") }.status,
                    )

                    val chunkedOversize = client.post("/api/ds/component-config/import") {
                        trusted("project-a", "editor")
                        contentType(ContentType.Application.Json)
                        setBody(ByteReadChannel("x".repeat(16 * 1024 * 1024 + 1).encodeToByteArray()))
                    }
                    assertEquals(HttpStatusCode.PayloadTooLarge, chunkedOversize.status)

                    verifyHistoricalComponentsAfterRenameAndDelete(
                        client,
                        postgres,
                        designSystemId,
                        id(version.bodyAsText()),
                    )
                }
            }
        }
    }

    private suspend fun verifyHistoricalComponentsAfterRenameAndDelete(
        client: HttpClient,
        postgres: IsolatedPostgresDatabase,
        designSystemId: String,
        versionId: String,
    ) {
        val renamed = client.patch("/api/ds/design-systems/$designSystemId") {
            trusted("project-a", "owner")
            jsonBody("""{"name":"alpha-renamed"}""")
        }
        assertEquals(HttpStatusCode.OK, renamed.status, renamed.bodyAsText())
        assertHistoricalAppearance(client, versionId)

        val deleted = client.delete("/api/ds/design-systems/$designSystemId") {
            trusted("project-a", "owner")
        }
        assertEquals(HttpStatusCode.OK, deleted.status)
        assertHistoricalAppearance(client, versionId)
        assertTrue(exists(postgres, "design_systems", designSystemId))
        assertEquals(
            1,
            rowCount(
                postgres,
                "design_system_revisions revision JOIN design_system_versions boundary " +
                    "ON boundary.id = revision.design_system_version_id " +
                    "WHERE revision.design_system_id = '$designSystemId' AND boundary.status = 'draft' " +
                    "AND revision.deleted",
            ),
        )
    }

    private suspend fun assertHistoricalAppearance(client: HttpClient, versionId: String) {
        val historical = client.get("/api/ds/appearances?versionId=$versionId") {
            trusted("project-a", "viewer")
        }
        assertEquals(HttpStatusCode.OK, historical.status, historical.bodyAsText())
        assertTrue(historical.bodyAsText().contains("default"))
    }

    private suspend fun verifyEmptyDesignSystemPatch(client: HttpClient, designSystemId: String) {
        val describedDesignSystem = client.patch("/api/ds/design-systems/$designSystemId") {
            trusted("project-a", "owner")
            jsonBody("""{"description":"description kept after no-op"}""")
        }
        assertEquals(HttpStatusCode.OK, describedDesignSystem.status, describedDesignSystem.bodyAsText())
        val emptyDesignSystemPatch = client.patch("/api/ds/design-systems/$designSystemId") {
            trusted("project-a", "owner")
            jsonBody("{}")
        }
        assertEquals(HttpStatusCode.OK, emptyDesignSystemPatch.status, emptyDesignSystemPatch.bodyAsText())
        assertEquals(
            "description kept after no-op",
            json.parseToJsonElement(emptyDesignSystemPatch.bodyAsText()).jsonObject
                .getValue("description").jsonPrimitive.content,
        )
    }

    private suspend fun verifyEmptyTenantPatch(
        client: HttpClient,
        postgres: IsolatedPostgresDatabase,
        tenantId: String,
    ) {
        val revisionBefore = entityEditRevision(postgres, "tenant", tenantId)
        val before = client.get("/api/ds/tenants/$tenantId") { trusted("project-a", "viewer") }
        val emptyPatch = client.patch("/api/ds/tenants/$tenantId") {
            trusted("project-a", "editor")
            jsonBody("{}")
        }
        assertEquals(HttpStatusCode.OK, emptyPatch.status, emptyPatch.bodyAsText())
        assertEquals(before.bodyAsText(), emptyPatch.bodyAsText())
        assertEquals(revisionBefore, entityEditRevision(postgres, "tenant", tenantId))
        assertTrue(emptyPatch.headers["X-DS-Mutation-Metadata"].isNullOrEmpty())
    }

    private suspend fun verifyMultiUserTokenEditing(
        client: HttpClient,
        designSystemId: String,
        tenantId: String,
    ): TokenFixture {
        val token = client.post("/api/ds/tokens") {
            trusted("project-a", "owner")
            jsonBody(
                """{"designSystemId":"$designSystemId",""" +
                    """"name":"integration.surface.default","type":"color"}""",
            )
        }
        assertEquals(HttpStatusCode.Created, token.status)
        val tokenId = id(token.bodyAsText())
        val initialTokenUpdatedAt = Instant.parse(
            json.parseToJsonElement(token.bodyAsText()).jsonObject.getValue("updatedAt").jsonPrimitive.content,
        )
        val repeatedTokenBody =
            """{"designSystemId":"$designSystemId","name":"integration.idempotent","type":"color"}"""
        val firstRepeatedToken = client.post("/api/ds/tokens") {
            trusted("project-a", "editor")
            header("Idempotency-Key", "token-create-replay")
            jsonBody(repeatedTokenBody)
        }
        val secondRepeatedToken = client.post("/api/ds/tokens") {
            trusted("project-a", "editor")
            header("Idempotency-Key", "token-create-replay")
            jsonBody(repeatedTokenBody)
        }
        assertEquals(HttpStatusCode.Created, firstRepeatedToken.status, firstRepeatedToken.bodyAsText())
        assertEquals(firstRepeatedToken.bodyAsText(), secondRepeatedToken.bodyAsText())
        val repeatedTokenId = id(firstRepeatedToken.bodyAsText())
        val changedRepeatedToken = client.patch("/api/ds/tokens/$repeatedTokenId") {
            trusted("project-a", "editor")
            jsonBody("""{"description":"must not change replay"}""")
        }
        assertEquals(HttpStatusCode.OK, changedRepeatedToken.status, changedRepeatedToken.bodyAsText())
        val replayAfterUpdate = client.post("/api/ds/tokens") {
            trusted("project-a", "editor")
            header("Idempotency-Key", "token-create-replay")
            jsonBody(repeatedTokenBody)
        }
        assertEquals(firstRepeatedToken.bodyAsText(), replayAfterUpdate.bodyAsText())
        val mismatchedRepeatedToken = client.post("/api/ds/tokens") {
            trusted("project-a", "editor")
            header("Idempotency-Key", "token-create-replay")
            jsonBody(repeatedTokenBody.replace("integration.idempotent", "integration.other"))
        }
        assertEquals(HttpStatusCode.Conflict, mismatchedRepeatedToken.status)
        val replayJournal = client.get("/api/ds/design-systems/$designSystemId/changes") {
            trusted("project-a", "viewer")
        }
        val repeatedTokenChange = json.parseToJsonElement(replayJournal.bodyAsText()).jsonArray
            .first { it.jsonObject["entityId"]?.jsonPrimitive?.content == repeatedTokenId }
            .jsonObject
        val revertPath = "/api/ds/design-systems/$designSystemId/changes/${
            repeatedTokenChange.getValue("changeId").jsonPrimitive.content
        }/revert"
        val revertRevision = repeatedTokenChange.getValue("editRevision").jsonPrimitive.content
        val firstRevert = client.post(revertPath) {
            trusted("project-a", "owner")
            header("X-DS-Base-Revision", revertRevision)
            header("Idempotency-Key", "token-revert-replay")
            jsonBody("{}")
        }
        val repeatedRevert = client.post(revertPath) {
            trusted("project-a", "owner")
            header("X-DS-Base-Revision", revertRevision)
            header("Idempotency-Key", "token-revert-replay")
            jsonBody("{}")
        }
        assertEquals(HttpStatusCode.OK, firstRevert.status, firstRevert.bodyAsText())
        assertEquals(firstRevert.status, repeatedRevert.status)
        assertEquals(firstRevert.bodyAsText(), repeatedRevert.bodyAsText())
        val (rename, description) = coroutineScope {
            val renameRequest = async {
                client.patch("/api/ds/tokens/$tokenId") {
                    trusted("project-a", "editor")
                    header("X-DS-Base-Revision", "1")
                    jsonBody("""{"name":"integration.surface.renamed"}""")
                }
            }
            val descriptionRequest = async {
                client.patch("/api/ds/tokens/$tokenId") {
                    trusted("project-a", "editor")
                    header("X-DS-Base-Revision", "1")
                    jsonBody("""{"description":"changed in parallel"}""")
                }
            }
            renameRequest.await() to descriptionRequest.await()
        }
        assertEquals(HttpStatusCode.OK, rename.status, rename.bodyAsText())
        assertTrue(rename.headers["X-DS-Mutation-Metadata"].orEmpty().contains("\"warnings\": []"))
        assertEquals(HttpStatusCode.OK, description.status, description.bodyAsText())
        assertTrue(description.headers["X-DS-Mutation-Metadata"].orEmpty().contains("\"warnings\": []"))
        val merged = client.get("/api/ds/tokens/$tokenId") { trusted("project-a", "viewer") }
        val mergedBody = json.parseToJsonElement(merged.bodyAsText()).jsonObject
        assertEquals("integration.surface.renamed", mergedBody.getValue("name").jsonPrimitive.content)
        assertEquals("changed in parallel", mergedBody.getValue("description").jsonPrimitive.content)
        assertTrue(Instant.parse(mergedBody.getValue("updatedAt").jsonPrimitive.content) > initialTokenUpdatedAt)
        val overlapping = client.patch("/api/ds/tokens/$tokenId") {
            trusted("project-a", "editor")
            header("X-DS-Base-Revision", "1")
            jsonBody("""{"name":"integration.surface.last"}""")
        }
        assertEquals(HttpStatusCode.OK, overlapping.status, overlapping.bodyAsText())
        assertTrue(overlapping.headers["X-DS-Mutation-Metadata"].orEmpty().contains("/name"))
        val emptyTokenPatch = client.patch("/api/ds/tokens/$tokenId") {
            trusted("project-a", "editor")
            jsonBody("{}")
        }
        assertEquals(HttpStatusCode.OK, emptyTokenPatch.status, emptyTokenPatch.bodyAsText())
        assertEquals(
            "integration.surface.last",
            json.parseToJsonElement(emptyTokenPatch.bodyAsText()).jsonObject.getValue("name").jsonPrimitive.content,
        )
        val persistentTokenValue = client.post("/api/ds/token-values") {
            trusted("project-a", "editor")
            header("Idempotency-Key", "persistent-token-value")
            jsonBody(
                """{"tokenId":"$tokenId","tenantId":"$tenantId","platform":"web",""" +
                    """"mode":"light","value":"#fff"}""",
            )
        }
        assertEquals(HttpStatusCode.Created, persistentTokenValue.status, persistentTokenValue.bodyAsText())
        val tokenValueId = id(persistentTokenValue.bodyAsText())
        val changedTokenValue = client.patch("/api/ds/token-values/$tokenValueId") {
            trusted("project-a", "editor")
            jsonBody("""{"value":"#abcdef"}""")
        }
        assertEquals(HttpStatusCode.OK, changedTokenValue.status, changedTokenValue.bodyAsText())
        val emptyTokenValuePatch = client.patch("/api/ds/token-values/$tokenValueId") {
            trusted("project-a", "editor")
            jsonBody("{}")
        }
        assertEquals(HttpStatusCode.OK, emptyTokenValuePatch.status, emptyTokenValuePatch.bodyAsText())
        assertEquals(
            "#abcdef",
            json.parseToJsonElement(emptyTokenValuePatch.bodyAsText()).jsonObject.getValue("value")
                .jsonPrimitive.content,
        )
        val tenantValues = client.get("/api/ds/tenants/$tenantId/token-values") {
            trusted("project-a", "viewer")
        }
        val currentTokenValue = json.parseToJsonElement(tenantValues.bodyAsText()).jsonArray
            .first { it.jsonObject.getValue("id").jsonPrimitive.content == tokenValueId }
            .jsonObject
        val valueRevision = currentTokenValue.getValue("editRevision").jsonPrimitive.content.toLong()
        val batchUpdate = client.put("/api/ds/tenants/$tenantId/token-values") {
            trusted("project-a", "editor")
            jsonBody(
                """{"editRevision":0,"values":[{"tokenId":"$tokenId","platform":"web",""" +
                    """"mode":"light","value":"#fedcba","baseRevision":$valueRevision}]}""",
            )
        }
        assertEquals(HttpStatusCode.OK, batchUpdate.status, batchUpdate.bodyAsText())
        assertTrue(batchUpdate.headers["X-DS-Mutation-Metadata"].orEmpty().contains("\"warnings\": []"))
        assertEquals(
            1,
            json.parseToJsonElement(batchUpdate.bodyAsText()).jsonObject.getValue("values").jsonArray.size,
        )
        assertTrue(
            json.parseToJsonElement(batchUpdate.bodyAsText()).jsonObject.getValue("values").jsonArray
                .any { value ->
                    value.jsonObject.getValue("id").jsonPrimitive.content == tokenValueId &&
                        value.jsonObject.getValue("editRevision").jsonPrimitive.content.toLong() > valueRevision
                },
        )
        verifyConcurrentTokenValueWrites(client, tokenValueId, tenantId, tokenId, valueRevision)
        val immutableKeyUpdate = client.patch("/api/ds/token-values/$tokenValueId") {
            trusted("project-a", "editor")
            jsonBody("""{"platform":"ios"}""")
        }
        assertEquals(HttpStatusCode.BadRequest, immutableKeyUpdate.status)
        val journal = client.get("/api/ds/design-systems/$designSystemId/changes") {
            trusted("project-a", "viewer")
        }
        val tokenChange = json.parseToJsonElement(journal.bodyAsText()).jsonArray
            .first { it.jsonObject["entityType"]?.jsonPrimitive?.content == "token" }
            .jsonObject
        val staleRevert = client.post(
            "/api/ds/design-systems/$designSystemId/changes/${tokenChange.getValue(
                "changeId",
            ).jsonPrimitive.content}/revert",
        ) {
            trusted("project-a", "owner")
            header("X-DS-Base-Revision", "0")
            header("Idempotency-Key", "stale-token-revert")
            jsonBody("{}")
        }
        assertEquals(HttpStatusCode.Conflict, staleRevert.status, staleRevert.bodyAsText())
        assertTrue(staleRevert.bodyAsText().contains("DRAFT_CHANGE_STALE"))
        return TokenFixture(tokenId, tokenValueId)
    }

    private suspend fun verifyPublishedTokenValueRestoration(
        client: HttpClient,
        fixture: TokenFixture,
        tenantId: String,
    ) {
        val removed = client.delete("/api/ds/token-values/${fixture.tokenValueId}") {
            trusted("project-a", "owner")
        }
        assertEquals(HttpStatusCode.OK, removed.status, removed.bodyAsText())
        val restored = client.post("/api/ds/token-values") {
            trusted("project-a", "owner")
            header("Idempotency-Key", "restore-persistent-token-value")
            jsonBody(
                """{"tokenId":"${fixture.tokenId}","tenantId":"$tenantId","platform":"web",""" +
                    """"mode":"light","value":"#000"}""",
            )
        }
        assertEquals(HttpStatusCode.Created, restored.status, restored.bodyAsText())
        assertEquals(fixture.tokenValueId, id(restored.bodyAsText()))
    }

    private suspend fun verifyInheritedNameConflicts(client: HttpClient, designSystemId: String) {
        val tenantDuplicate = client.post("/api/ds/tenants") {
            trusted("project-a", "editor")
            jsonBody("""{"designSystemId":"$designSystemId","name":" DARK "}""")
        }
        assertEquals(HttpStatusCode.Conflict, tenantDuplicate.status, tenantDuplicate.bodyAsText())
        val tokenDuplicate = client.post("/api/ds/tokens") {
            trusted("project-a", "editor")
            jsonBody(
                """{"designSystemId":"$designSystemId",""" +
                    """"name":" INTEGRATION.SURFACE.LAST ","type":"color"}""",
            )
        }
        assertEquals(HttpStatusCode.Conflict, tokenDuplicate.status, tokenDuplicate.bodyAsText())
        val renameCandidate = client.post("/api/ds/tokens") {
            trusted("project-a", "editor")
            jsonBody("""{"designSystemId":"$designSystemId","name":"rename-candidate","type":"color"}""")
        }
        assertEquals(HttpStatusCode.Created, renameCandidate.status, renameCandidate.bodyAsText())
        val renameCollision = client.patch("/api/ds/tokens/${id(renameCandidate.bodyAsText())}") {
            trusted("project-a", "editor")
            jsonBody("""{"name":"Integration.Surface.Last"}""")
        }
        assertEquals(HttpStatusCode.Conflict, renameCollision.status, renameCollision.bodyAsText())
    }

    private suspend fun verifyPublicationReplay(
        client: HttpClient,
        designSystemId: String,
        draftId: String,
        draftRevision: Long,
        publishedBody: String,
    ) {
        val replayed = client.post("/api/ds/design-system-versions") {
            trusted("project-a", "owner")
            header("Idempotency-Key", "integration-publication")
            jsonBody(
                """{"designSystemId":"$designSystemId","draftId":"$draftId",""" +
                    """"draftRevision":$draftRevision,"version":"1.0.0","changelog":"Integration"}""",
            )
        }
        assertEquals(publishedBody, replayed.bodyAsText())
        val stale = client.post("/api/ds/design-system-versions") {
            trusted("project-a", "owner")
            header("Idempotency-Key", "stale-integration-publication")
            jsonBody(
                """{"designSystemId":"$designSystemId","draftId":"$draftId",""" +
                    """"draftRevision":$draftRevision,"version":"2.0.0","changelog":"Stale"}""",
            )
        }
        assertEquals(HttpStatusCode.Conflict, stale.status, stale.bodyAsText())
        assertTrue(stale.bodyAsText().contains("DRAFT_STALE"))
    }

    private suspend fun verifyVersionSelection(
        client: HttpClient,
        designSystemId: String,
        versionId: String,
        tenantId: String,
    ) {
        val historical = client.get(
            "/api/ds/design-systems/$designSystemId/tokens?versionId=$versionId",
        ) { trusted("project-a", "viewer") }
        assertEquals(HttpStatusCode.OK, historical.status, historical.bodyAsText())
        val historicalSystemBefore = client.get(
            "/api/ds/design-systems/$designSystemId?versionId=$versionId",
        ) { trusted("project-a", "viewer") }
        assertEquals(HttpStatusCode.OK, historicalSystemBefore.status, historicalSystemBefore.bodyAsText())
        val historicalSystemJson = json.parseToJsonElement(historicalSystemBefore.bodyAsText()).jsonObject
        assertTrue(historicalSystemJson.getValue("draftId") is kotlinx.serialization.json.JsonNull)
        assertTrue(historicalSystemJson.getValue("draftRevision") is kotlinx.serialization.json.JsonNull)
        val historicalTenantBefore = client.get("/api/ds/tenants/$tenantId?versionId=$versionId") {
            trusted("project-a", "viewer")
        }
        assertEquals(HttpStatusCode.OK, historicalTenantBefore.status, historicalTenantBefore.bodyAsText())

        val currentValuesSave = client.put("/api/ds/tenants/$tenantId/token-values") {
            trusted("project-a", "editor")
            jsonBody("""{"editRevision":0,"values":[]}""")
        }
        assertEquals(HttpStatusCode.OK, currentValuesSave.status, currentValuesSave.bodyAsText())
        val currentSystemUpdate = client.patch("/api/ds/design-systems/$designSystemId") {
            trusted("project-a", "owner")
            jsonBody("""{"description":"current draft only"}""")
        }
        assertEquals(HttpStatusCode.OK, currentSystemUpdate.status, currentSystemUpdate.bodyAsText())

        val historicalSystemAfter = client.get(
            "/api/ds/design-systems/$designSystemId?versionId=$versionId",
        ) { trusted("project-a", "viewer") }
        val historicalTenantAfter = client.get("/api/ds/tenants/$tenantId?versionId=$versionId") {
            trusted("project-a", "viewer")
        }
        assertEquals(historicalSystemBefore.bodyAsText(), historicalSystemAfter.bodyAsText())
        assertEquals(historicalTenantBefore.bodyAsText(), historicalTenantAfter.bodyAsText())
        val missing = client.get(
            "/api/ds/design-systems/$designSystemId/tokens?versionId=${UUID.randomUUID()}",
        ) { trusted("project-a", "viewer") }
        assertEquals(HttpStatusCode.NotFound, missing.status, missing.bodyAsText())
        val foreign = client.get(
            "/api/ds/design-systems/$designSystemId/tokens?versionId=$versionId",
        ) { trusted("project-b", "viewer") }
        assertEquals(HttpStatusCode.NotFound, foreign.status, foreign.bodyAsText())

        val otherDesignSystem = client.post("/api/ds/design-systems") {
            trusted("project-a", "owner")
            jsonBody("""{"name":"other-version-owner","projectName":"other-version-owner"}""")
        }
        assertEquals(HttpStatusCode.Created, otherDesignSystem.status, otherDesignSystem.bodyAsText())
        val otherDesignSystemId = id(otherDesignSystem.bodyAsText())
        val otherDesignSystemUpdate = client.patch("/api/ds/design-systems/$otherDesignSystemId") {
            trusted("project-a", "owner")
            jsonBody("""{"description":"publishable change"}""")
        }
        assertEquals(HttpStatusCode.OK, otherDesignSystemUpdate.status, otherDesignSystemUpdate.bodyAsText())
        val otherCurrent = client.get("/api/ds/design-systems/$otherDesignSystemId") {
            trusted("project-a", "viewer")
        }
        val otherCurrentJson = json.parseToJsonElement(otherCurrent.bodyAsText()).jsonObject
        val otherPublished = client.post("/api/ds/design-system-versions") {
            trusted("project-a", "owner")
            header("Idempotency-Key", "other-version-selection")
            jsonBody(
                """{"designSystemId":"$otherDesignSystemId",""" +
                    """"draftId":"${otherCurrentJson.getValue("draftId").jsonPrimitive.content}",""" +
                    """"draftRevision":${otherCurrentJson.getValue("draftRevision").jsonPrimitive.content},""" +
                    """"version":"1.0.0","changelog":"Other"}""",
            )
        }
        assertEquals(HttpStatusCode.Created, otherPublished.status, otherPublished.bodyAsText())
        val mismatchedVersion = client.get(
            "/api/ds/design-systems/$designSystemId/tokens?versionId=${id(otherPublished.bodyAsText())}",
        ) { trusted("project-a", "viewer") }
        assertEquals(HttpStatusCode.NotFound, mismatchedVersion.status, mismatchedVersion.bodyAsText())
    }

    private fun seedComponentPrerequisites(postgres: IsolatedPostgresDatabase): Map<String, UUID> {
        val root = requireNotNull(javaClass.getResourceAsStream("/component-seeds.json"))
            .bufferedReader().use { json.parseToJsonElement(it.readText()).jsonObject }
        val componentIds = linkedMapOf<String, UUID>()
        DriverManager.getConnection(postgres.jdbcUrl, postgres.username, postgres.password).use { connection ->
            root.getValue("components").jsonArray.forEach { element ->
                val component = element.jsonObject
                val componentName = component.getValue("name").jsonPrimitive.content
                val componentId = connection.prepareStatement(
                    "INSERT INTO components (name, description, platform) VALUES (?, '', 'web') RETURNING id",
                ).use { statement ->
                    statement.setString(1, componentName)
                    statement.executeQuery().use { rows ->
                        rows.next()
                        rows.getObject(1, UUID::class.java)
                    }
                }
                componentIds[componentName] = componentId
                val propertyNames = linkedSetOf<String>()
                component.getValue("propertyVariations").jsonArray.forEach {
                    propertyNames += it.jsonObject.getValue("property").jsonPrimitive.content
                }
                collectPropertyNames(component.getValue("appearances"), propertyNames)
                propertyNames.forEach { propertyName ->
                    val propertyId = connection.prepareStatement(
                        "INSERT INTO properties (component_id, name, type) " +
                            "VALUES (?, ?, 'value'::property_type) RETURNING id",
                    ).use { statement ->
                        statement.setObject(1, componentId)
                        statement.setString(2, propertyName)
                        statement.executeQuery().use { rows ->
                            rows.next()
                            rows.getObject(1, UUID::class.java)
                        }
                    }
                    val params = linkedSetOf<Pair<String, String>>()
                    collectAdjustments(component.getValue("appearances"), propertyName, params)
                    params.forEach { (platform, name) ->
                        connection.prepareStatement(
                            "INSERT INTO property_platform_params (property_id, platform, name) " +
                                "VALUES (?, ?::component_platform, ?)",
                        ).use { statement ->
                            statement.setObject(1, propertyId)
                            statement.setString(2, platform)
                            statement.setString(3, name)
                            statement.executeUpdate()
                        }
                    }
                }
            }
        }
        return componentIds
    }
    private suspend fun verifyThemeCreationWithoutComponentMetadata(
        client: HttpClient,
        postgres: IsolatedPostgresDatabase,
    ) {
        val designSystem = client.post("/api/ds/design-systems") {
            trusted("project-a", "owner")
            jsonBody("""{"name":"missing-prerequisites","projectName":"alpha"}""")
        }
        assertEquals(HttpStatusCode.Created, designSystem.status)
        val designSystemId = id(designSystem.bodyAsText())
        assertTrue(
            rowCount(
                postgres,
                "token_revisions revision JOIN design_system_versions boundary " +
                    "ON boundary.id = revision.design_system_version_id " +
                    "WHERE revision.design_system_id = '$designSystemId' AND boundary.status = 'baseline'",
            ) > 0,
        )
        assertEquals(
            0,
            rowCount(
                postgres,
                "token_revisions revision JOIN design_system_versions boundary " +
                    "ON boundary.id = revision.design_system_version_id " +
                    "WHERE revision.design_system_id = '$designSystemId' AND boundary.status = 'draft'",
            ),
        )
        val tenant = client.post("/api/ds/tenants") {
            trusted("project-a", "editor")
            jsonBody("""{"designSystemId":"$designSystemId","name":"without-components"}""")
        }
        assertEquals(HttpStatusCode.Created, tenant.status, tenant.bodyAsText())
        val tenantId = id(tenant.bodyAsText())
        assertEquals(1, rowCount(postgres, "design_systems"))
        assertTrue(rowCount(postgres, "tokens") > 0)
        assertEquals(1, rowCount(postgres, "tenants"))
        assertTrue(rowCount(postgres, "token_values") > 0)
        assertEquals(0, rowCount(postgres, "design_system_components"))
        assertEquals(0, rowCount(postgres, "appearances"))
        val changes = client.get("/api/ds/design-systems/$designSystemId/changes") {
            trusted("project-a", "viewer")
        }
        assertEquals(HttpStatusCode.OK, changes.status, changes.bodyAsText())
        val visibleChanges = json.parseToJsonElement(changes.bodyAsText()).jsonArray
        assertEquals(1, visibleChanges.size, changes.bodyAsText())
        assertEquals(
            "tenant",
            visibleChanges.single().jsonObject.getValue("entityType").jsonPrimitive.content,
            changes.bodyAsText(),
        )
        val tenantDeleted = client.delete("/api/ds/tenants/$tenantId") {
            trusted("project-a", "owner")
        }
        assertEquals(HttpStatusCode.OK, tenantDeleted.status, tenantDeleted.bodyAsText())
        assertEquals(0, rowCount(postgres, "tenants"))
        assertEquals(0, rowCount(postgres, "token_values"))
        assertEquals(0, rowCount(postgres, "tenant_revisions"))
        assertEquals(0, rowCount(postgres, "token_value_revisions"))
        val deleted = client.delete("/api/ds/design-systems/$designSystemId") {
            trusted("project-a", "owner")
        }
        assertEquals(HttpStatusCode.OK, deleted.status)
        assertEquals(1, rowCount(postgres, "design_systems"))
        assertTrue(rowCount(postgres, "tokens") > 0)
        assertEquals(
            1,
            rowCount(
                postgres,
                "design_system_revisions revision JOIN design_system_versions boundary " +
                    "ON boundary.id = revision.design_system_version_id " +
                    "WHERE revision.design_system_id = '$designSystemId' AND boundary.status = 'draft' " +
                    "AND revision.deleted",
            ),
        )
    }

    private fun collectPropertyNames(value: JsonElement, target: MutableSet<String>) {
        when (value) {
            is JsonArray -> value.forEach { collectPropertyNames(it, target) }
            is JsonObject -> {
                value["prop"]?.jsonPrimitive?.content?.let(target::add)
                value.values.forEach { collectPropertyNames(it, target) }
            }
            else -> Unit
        }
    }

    private fun collectAdjustments(
        value: JsonElement,
        propertyName: String,
        target: MutableSet<Pair<String, String>>,
        currentProperty: String? = null,
    ) {
        when (value) {
            is JsonArray -> value.forEach { collectAdjustments(it, propertyName, target, currentProperty) }
            is JsonObject -> {
                val property = value["prop"]?.jsonPrimitive?.content ?: currentProperty
                if (property == propertyName) {
                    value["adjust"]?.jsonArray?.forEach { adjustment ->
                        val entry = adjustment.jsonObject
                        target += entry.getValue("platform").jsonPrimitive.content to
                            entry.getValue("param").jsonPrimitive.content
                    }
                }
                value.values.forEach { collectAdjustments(it, propertyName, target, property) }
            }
            else -> Unit
        }
    }

    private fun configuration(postgres: IsolatedPostgresDatabase) = DsServiceConfiguration(
        port = 0,
        databaseUrl = postgres.jdbcUrl,
        databaseUser = postgres.username,
        databasePassword = postgres.password,
        databasePoolSize = 4,
        databaseConnectionTimeoutMs = 5_000,
        authorizationPolicyPath = null,
        runFlyway = true,
        adoptExistingSchema = false,
        expectedSchemaFingerprint = null,
    )

    private fun HttpRequestBuilder.trusted(projectId: String, role: String) {
        header("X-Actor-Type", "user")
        header("X-User-Id", "integration-user")
        header("X-Project-Id", projectId)
        header("X-Project-Role", role)
        header("X-System-Admin", "false")
    }

    private suspend fun verifyStateImpactIsolation(
        client: HttpClient,
        postgres: IsolatedPostgresDatabase,
        designSystemId: String,
    ) {
        val component = client.post("/api/ds/components") {
            trustedSystemAdmin()
            jsonBody("""{"name":"ForeignOnly","platform":"web"}""")
        }
        val componentId = id(component.bodyAsText())
        val link = client.post("/api/ds/design-system-components") {
            trusted("project-b", "editor")
            jsonBody("""{"designSystemId":"$designSystemId","componentId":"$componentId"}""")
        }
        assertEquals(HttpStatusCode.Created, link.status, link.bodyAsText())
        val property = client.post("/api/ds/properties") {
            trustedSystemAdmin()
            jsonBody("""{"componentId":"$componentId","name":"foreign","type":"value"}""")
        }
        val propertyId = id(property.bodyAsText())
        val appearance = client.post("/api/ds/appearances") {
            trusted("project-b", "editor")
            jsonBody("""{"designSystemId":"$designSystemId","componentId":"$componentId"}""")
        }
        val appearanceId = id(appearance.bodyAsText())
        val state = client.post("/api/ds/states") {
            trustedSystemAdmin()
            jsonBody("""{"name":"global-impact"}""")
        }
        val stateId = id(state.bodyAsText())
        val stateSet = client.post("/api/ds/state-sets/resolve") {
            trustedSystemAdmin()
            jsonBody("""{"stateIds":["$stateId"]}""")
        }
        val stateSetId = id(stateSet.bodyAsText())
        val value = client.post("/api/ds/invariant-property-values") {
            trusted("project-b", "editor")
            jsonBody(
                """{"propertyId":"$propertyId","designSystemId":"$designSystemId",""" +
                    """"componentId":"$componentId","appearanceId":"$appearanceId",""" +
                    """"value":"foreign","stateSetId":"$stateSetId"}""",
            )
        }
        assertEquals(HttpStatusCode.Created, value.status, value.bodyAsText())
        verifyHistoricalStateImpact(
            client,
            postgres,
            designSystemId,
            componentId,
            appearanceId,
            stateId,
            stateSetId,
        )
        val scopedImpact = client.get("/api/ds/states/$stateId/impact") {
            trusted("project-a", "viewer")
        }
        assertEquals(HttpStatusCode.OK, scopedImpact.status)
        assertEquals("""{"stateSets":0,"values":0,"components":0}""", scopedImpact.bodyAsText())
    }

    private suspend fun verifyHistoricalStateImpact(
        client: HttpClient,
        postgres: IsolatedPostgresDatabase,
        designSystemId: String,
        componentId: String,
        appearanceId: String,
        stateId: String,
        stateSetId: String,
    ) {
        val (draftId, draftRevision) = activeDraft(postgres, designSystemId)
        val version = client.post("/api/ds/design-system-versions") {
            trusted("project-b", "owner")
            header("Idempotency-Key", "foreign-impact-version")
            jsonBody(
                """{"designSystemId":"$designSystemId","draftId":"$draftId",""" +
                    """"draftRevision":$draftRevision,"version":"1.0.0",""" +
                    """"changelog":"Impact boundary"}""",
            )
        }
        assertEquals(HttpStatusCode.Created, version.status, version.bodyAsText())
        val versionId = id(version.bodyAsText())
        val impactBefore = client.get("/api/ds/states/$stateId/impact?versionId=$versionId") {
            trusted("project-b", "viewer")
        }
        assertEquals(HttpStatusCode.OK, impactBefore.status, impactBefore.bodyAsText())
        // Дополнительное значение занимает другой логический слот, а не дублирует опубликованный.
        val draftProperty = client.post("/api/ds/properties") {
            trustedSystemAdmin()
            jsonBody("""{"componentId":"$componentId","name":"foreignDraft","type":"value"}""")
        }
        assertEquals(HttpStatusCode.Created, draftProperty.status, draftProperty.bodyAsText())
        val draftPropertyId = id(draftProperty.bodyAsText())
        val draftOnlyValue = client.post("/api/ds/invariant-property-values") {
            trusted("project-b", "editor")
            jsonBody(
                """{"propertyId":"$draftPropertyId","designSystemId":"$designSystemId",""" +
                    """"componentId":"$componentId","appearanceId":"$appearanceId",""" +
                    """"value":"draft-only","stateSetId":"$stateSetId"}""",
            )
        }
        assertEquals(HttpStatusCode.Created, draftOnlyValue.status, draftOnlyValue.bodyAsText())
        val impactAfter = client.get("/api/ds/states/$stateId/impact?versionId=$versionId") {
            trusted("project-b", "viewer")
        }
        assertEquals(impactBefore.bodyAsText(), impactAfter.bodyAsText())
    }

    private suspend fun verifyConcurrentTokenValueWrites(
        client: HttpClient,
        tokenValueId: String,
        tenantId: String,
        tokenId: String,
        baseRevision: Long,
    ) {
        val responses = coroutineScope {
            listOf(
                async {
                    client.patch("/api/ds/token-values/$tokenValueId") {
                        trusted("project-a", "editor")
                        header("X-DS-Base-Revision", baseRevision.toString())
                        jsonBody("""{"value":"#112233"}""")
                    }
                },
                async {
                    client.put("/api/ds/tenants/$tenantId/token-values") {
                        trusted("project-a", "editor")
                        jsonBody(
                            """{"editRevision":0,"values":[{"tokenId":"$tokenId","platform":"web",""" +
                                """"mode":"light","value":"#334455","baseRevision":$baseRevision}]}""",
                        )
                    }
                },
            ).map { it.await() }
        }
        responses.forEach { response ->
            assertEquals(HttpStatusCode.OK, response.status, response.bodyAsText())
        }
    }

    private fun HttpRequestBuilder.trustedSystemAdmin() {
        header("X-Actor-Type", "user")
        header("X-User-Id", "integration-admin")
        header("X-Project-Id", "global")
        header("X-System-Admin", "true")
    }

    private fun HttpRequestBuilder.jsonBody(value: String) {
        contentType(ContentType.Application.Json)
        setBody(value)
    }

    private fun id(body: String): String = json.parseToJsonElement(body).jsonObject.getValue("id").jsonPrimitive.content

    private data class TokenFixture(val tokenId: String, val tokenValueId: String)

    private fun importBody(designSystemId: String, styleName: String, dryRun: Boolean) =
        """
        {
          "designSystemId":"$designSystemId",
          "platform":"web",
          "meta":{"name":"integration-fixture","source":"kotlin-test"},
          "dryRun":$dryRun,
          "components":[{
            "componentName":"button",
            "styleName":"$styleName",
            "config":{
              "invariants":{
                "shape":{
                  "type":"value",
                  "value":{"radius":8},
                  "states":[{"state":["pressed"],"type":"value","value":{"radius":10}}]
                }
              }
            }
          }]
        }
        """.trimIndent()

    private fun counts(postgres: IsolatedPostgresDatabase): Map<String, Int> =
        DriverManager.getConnection(postgres.jdbcUrl, postgres.username, postgres.password).use { connection ->
            listOf("appearances", "invariant_property_values").associateWith { table ->
                connection.createStatement().use { statement ->
                    statement.executeQuery("SELECT count(*) FROM $table").use { rows ->
                        rows.next()
                        rows.getInt(1)
                    }
                }
            }
        }

    private fun exists(postgres: IsolatedPostgresDatabase, table: String, id: String): Boolean =
        DriverManager.getConnection(postgres.jdbcUrl, postgres.username, postgres.password).use { connection ->
            connection.prepareStatement("SELECT EXISTS(SELECT 1 FROM $table WHERE id = ?::uuid)").use { statement ->
                statement.setString(1, id)
                statement.executeQuery().use { rows -> rows.next() && rows.getBoolean(1) }
            }
        }

    private fun rowCount(postgres: IsolatedPostgresDatabase, table: String): Int =
        DriverManager.getConnection(postgres.jdbcUrl, postgres.username, postgres.password).use { connection ->
            connection.createStatement().use { statement ->
                statement.executeQuery("SELECT count(*) FROM $table").use { rows ->
                    rows.next()
                    rows.getInt(1)
                }
            }
        }

    private fun tenantTokenValueCount(postgres: IsolatedPostgresDatabase, tenantId: String): Int =
        tenantScopedCount(postgres, tenantId, "token_values value", "value.tenant_id")

    private fun tenantCreationBaselineCount(postgres: IsolatedPostgresDatabase, tenantId: String): Int =
        tenantScopedCount(
            postgres,
            tenantId,
            "token_value_creation_baselines baseline JOIN token_values value ON value.id = baseline.token_value_id",
            "value.tenant_id",
        )

    private fun tenantScopedCount(
        postgres: IsolatedPostgresDatabase,
        tenantId: String,
        from: String,
        tenantColumn: String,
    ): Int = DriverManager.getConnection(postgres.jdbcUrl, postgres.username, postgres.password).use { connection ->
        connection.prepareStatement("SELECT count(*) FROM $from WHERE $tenantColumn = ?::uuid").use { statement ->
            statement.setString(1, tenantId)
            statement.executeQuery().use { rows ->
                rows.next()
                rows.getInt(1)
            }
        }
    }

    private fun entityEditRevision(
        postgres: IsolatedPostgresDatabase,
        entityType: String,
        entityId: String,
    ): Long = DriverManager.getConnection(postgres.jdbcUrl, postgres.username, postgres.password).use { connection ->
        connection.prepareStatement(
            "SELECT revision FROM entity_edit_states WHERE entity_type = ? AND entity_id = ?::uuid",
        ).use { statement ->
            statement.setString(1, entityType)
            statement.setString(2, entityId)
            statement.executeQuery().use { rows ->
                check(rows.next())
                rows.getLong(1)
            }
        }
    }

    private fun versionBoundaryCount(
        postgres: IsolatedPostgresDatabase,
        designSystemId: String,
        status: String,
    ): Int = DriverManager.getConnection(postgres.jdbcUrl, postgres.username, postgres.password).use { connection ->
        connection.prepareStatement(
            "SELECT count(*) FROM design_system_versions WHERE design_system_id = ?::uuid AND status::text = ?",
        ).use { statement ->
            statement.setString(1, designSystemId)
            statement.setString(2, status)
            statement.executeQuery().use { rows ->
                rows.next()
                rows.getInt(1)
            }
        }
    }

    private fun activeDraft(
        postgres: IsolatedPostgresDatabase,
        designSystemId: String,
    ): Pair<String, Long> =
        DriverManager.getConnection(postgres.jdbcUrl, postgres.username, postgres.password).use { connection ->
            connection.prepareStatement(
                "SELECT id::text, resolved_draft_revision(id) FROM design_system_versions " +
                    "WHERE design_system_id = ?::uuid AND status = 'draft'",
            ).use { statement ->
                statement.setString(1, designSystemId)
                statement.executeQuery().use { rows ->
                    rows.next()
                    rows.getString(1) to rows.getLong(2)
                }
            }
        }

    private companion object {
        const val MISSING_ID = "ffffffff-ffff-4fff-8fff-ffffffffffff"
    }
}
