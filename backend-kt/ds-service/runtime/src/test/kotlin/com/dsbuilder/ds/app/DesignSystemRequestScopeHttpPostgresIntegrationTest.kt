@file:Suppress("ktlint:standard:max-line-length", "MaxLineLength", "LongMethod")

package com.dsbuilder.ds.app

import com.dsbuilder.authorization.ProjectActorType
import com.dsbuilder.authorization.ProjectPrincipal
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.data.ExposedTransactionRunner
import com.dsbuilder.ds.core.data.PostgresDatabasePool
import com.dsbuilder.ds.core.data.PostgresTransactionFailureMapper
import com.dsbuilder.ds.core.data.requestDesignSystemMatches
import com.dsbuilder.ds.core.presentation.configureDsPublicEntry
import io.ktor.client.HttpClient
import io.ktor.client.request.header
import io.ktor.client.request.request
import io.ktor.client.request.setBody
import io.ktor.client.statement.HttpResponse
import io.ktor.client.statement.bodyAsText
import io.ktor.http.ContentType
import io.ktor.http.HttpMethod
import io.ktor.http.HttpStatusCode
import io.ktor.http.contentType
import io.ktor.server.application.ApplicationStopped
import io.ktor.server.application.install
import io.ktor.server.testing.testApplication
import kotlinx.coroutines.withTimeout
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.jetbrains.exposed.v1.jdbc.transactions.TransactionManager
import org.koin.ktor.plugin.Koin
import java.io.File
import java.sql.DriverManager
import java.sql.SQLException
import java.util.UUID
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertIs
import kotlin.test.assertTrue

/** Проверяет границу системы через настоящий HTTP-вход и PostgreSQL, без пропуска недоступного Docker. */
class DesignSystemRequestScopeHttpPostgresIntegrationTest {
    @Test
    fun `resource ids cannot switch the selected system and deletion replay precedes existence`() {
        IsolatedPostgresDatabase.create().use { database ->
            testApplication {
                application {
                    module(
                        DsServiceConfiguration(
                            0, database.jdbcUrl, database.username, database.password,
                            4, 5_000, null, true, false, null,
                        ),
                    )
                }
                val a = createdId(api(client, "POST", ROOT, """{"name":"scope-a","projectName":"scope"}"""))
                val b = createdId(api(client, "POST", ROOT, """{"name":"scope-b","projectName":"scope"}"""))
                val createKey = UUID.randomUUID().toString()
                val token = createdId(
                    api(
                        client,
                        "POST",
                        "$ROOT/$b/tokens",
                        """{"name":"scope-only-b","type":"shape"}""",
                        key = createKey,
                    ),
                )
                assertEquals(HttpStatusCode.OK, api(client, "GET", "$ROOT/$b/tokens/$token").status)
                assertEquals(HttpStatusCode.NotFound, api(client, "GET", "$ROOT/$a/tokens/$token").status)
                assertEquals(
                    HttpStatusCode.NotFound,
                    api(client, "PATCH", "$ROOT/$a/tokens/$token", """{"displayName":"wrong"}""").status,
                )
                assertEquals(
                    HttpStatusCode.NotFound,
                    api(client, "GET", "$ROOT/$a/tokens/$token", admin = true).status,
                )
                assertEquals(
                    HttpStatusCode.NotFound,
                    api(client, "GET", "$ROOT/$a/tokens/$token?designSystemId=$b").status,
                )
                assertEquals(
                    HttpStatusCode.OK,
                    api(client, "GET", "$ROOT/catalog/components?designSystemId=not-a-uuid").status,
                )
                assertEquals(
                    HttpStatusCode.Conflict,
                    api(
                        client,
                        "POST",
                        "$ROOT/$a/tokens",
                        """{"name":"scope-only-b","type":"shape"}""",
                        key = createKey,
                    ).status,
                )
                val list = api(client, "GET", "$ROOT/$a/tokens")
                assertEquals(HttpStatusCode.OK, list.status, list.bodyAsText())
                assertFalse(list.bodyAsText().contains(token))
                assertEquals(HttpStatusCode.OK, api(client, "GET", "$ROOT/catalog/components").status)
                assertEquals(HttpStatusCode.BadRequest, api(client, "GET", "$ROOT/not-a-uuid/tokens").status)
                assertEquals(HttpStatusCode.NotFound, api(client, "GET", "/api/ds/tokens/$token").status)

                val tenant = createdId(api(client, "POST", "$ROOT/$a/tenants", """{"name":"scope-theme"}"""))
                val tenantDetail = Json.parseToJsonElement(api(client, "GET", "$ROOT/$a/tenants/$tenant").bodyAsText())
                val tenantPage = api(client, "GET", "$ROOT/$a/tenants?name=scope-theme&limit=1")
                val tenantList = Json.parseToJsonElement(tenantPage.bodyAsText()).jsonArray.single()
                assertEquals(tenantDetail, tenantList)
                assertEquals("1", tenantPage.headers["X-DS-Page-Limit"])
                assertTrue("editRevision" in tenantList.jsonObject)
                assertTrue("profile" in tenantList.jsonObject.getValue("colorConfig").jsonObject)
                val preview = tenantList.jsonObject.getValue("preview").jsonObject
                assertEquals(5, preview.size)
                assertTrue(preview.values.all { it.jsonPrimitive.content.startsWith("#") })
                java.time.Instant.parse(tenantList.jsonObject.getValue("createdAt").jsonPrimitive.content)
                val badValues = """{"editRevision":0,"values":[{"tokenId":"$token","platform":"web","mode":null,"value":[1],"baseRevision":0}]}"""
                val rejected = api(client, "PUT", "$ROOT/$a/tenants/$tenant/token-values", badValues)
                assertTrue(rejected.status.value in setOf(400, 404, 422), rejected.bodyAsText())
                assertEquals(
                    HttpStatusCode.NotFound,
                    api(client, "GET", "$ROOT/$b/tenants/$tenant").status,
                )

                val draft = Json.parseToJsonElement(api(client, "GET", "$ROOT/$a").bodyAsText()).jsonObject
                val publicationBody = """{"draftId":${draft.getValue(
                    "draftId",
                )},"draftRevision":${draft.getValue("draftRevision")},"version":"1.0.0"}"""
                val publicationKey = UUID.randomUUID().toString()
                val published = api(client, "POST", "$ROOT/$a/versions", publicationBody, publicationKey)
                assertEquals(HttpStatusCode.Created, published.status, published.bodyAsText())
                assertEquals(
                    HttpStatusCode.Conflict,
                    api(client, "POST", "$ROOT/$b/versions", publicationBody, publicationKey).status,
                )
                val key = UUID.randomUUID().toString()
                val deleted = api(client, "DELETE", "$ROOT/$a", key = key)
                assertEquals(HttpStatusCode.OK, deleted.status, deleted.bodyAsText())
                val replay = api(client, "DELETE", "$ROOT/$a", key = key)
                assertEquals(deleted.status, replay.status)
                assertEquals(deleted.bodyAsText(), replay.bodyAsText())
                assertEquals(deleted.headers["X-DS-Mutation-Metadata"], replay.headers["X-DS-Mutation-Metadata"])
                val repeatedPublication = api(client, "POST", "$ROOT/$a/versions", publicationBody, publicationKey)
                assertEquals(published.status, repeatedPublication.status)
                assertEquals(published.bodyAsText(), repeatedPublication.bodyAsText())
                val afterDelete = snapshot(database)
                assertEquals(HttpStatusCode.NotFound, api(client, "DELETE", "$ROOT/$a").status)
                for (newKey in listOf(null, UUID.randomUUID().toString())) {
                    assertEquals(
                        HttpStatusCode.NotFound,
                        api(
                            client,
                            "POST",
                            "$ROOT/$a/tokens",
                            """{"name":"after-delete","type":"shape"}""",
                            newKey,
                        ).status,
                    )
                    assertEquals(
                        HttpStatusCode.NotFound,
                        api(client, "POST", "$ROOT/$a/tenants", """{"name":"after-delete"}""", newKey).status,
                    )
                }
                assertEquals(HttpStatusCode.OK, api(client, "GET", "$ROOT/$a/tenants/$tenant?version=1.0.0").status)
                verifyEmptyMutationScopes(database, a, b)
                assertEquals(afterDelete, snapshot(database), "new commands after deletion changed data or events")
                assertEquals(HttpStatusCode.Conflict, api(client, "DELETE", "$ROOT/$b", key = key).status)

                // Конфликт занятого ключа имеет приоритет даже при уже удалённой системе пути.
                val otherKey = UUID.randomUUID().toString()
                val token2 = api(
                    client,
                    "POST",
                    "$ROOT/$b/tokens",
                    """{"name":"another-b","type":"shape"}""",
                    otherKey,
                )
                assertEquals(HttpStatusCode.Created, token2.status, token2.bodyAsText())
                assertEquals(HttpStatusCode.Conflict, api(client, "DELETE", "$ROOT/$a", key = otherKey).status)
                assertEquals(HttpStatusCode.OK, api(client, "GET", "$ROOT/catalog/palette").status)
                val bTokens = api(client, "GET", "$ROOT/$b/tokens")
                assertEquals(HttpStatusCode.OK, bTokens.status, bTokens.bodyAsText())
                assertTrue(
                    Json.parseToJsonElement(bTokens.bodyAsText()).jsonArray.any {
                        it.jsonObject["id"]?.jsonPrimitive?.content == token
                    },
                )
            }
        }
    }

    @Test
    fun `admin token value creation checks owners before policies and retains deleted system replay`() {
        IsolatedPostgresDatabase.create().use { database ->
            testApplication {
                application { module(configuration(database)) }
                val a = createdId(api(client, "POST", ROOT, """{"name":"admin-a","projectName":"scope"}"""))
                val b = createdId(api(client, "POST", ROOT, """{"name":"admin-b","projectName":"scope"}"""))
                val c =
                    createdId(
                        api(client, "POST", ROOT, """{"name":"admin-c","projectName":"scope"}""", project = "other"),
                    )
                val ta = createdId(api(client, "POST", "$ROOT/$a/tenants", """{"name":"a"}"""))
                val tb = createdId(api(client, "POST", "$ROOT/$b/tenants", """{"name":"b"}"""))
                val tc = createdId(api(client, "POST", "$ROOT/$c/tenants", """{"name":"c"}""", project = "other"))
                val tokenA = createdId(api(client, "POST", "$ROOT/$a/tokens", """{"name":"admin-a","type":"shape"}"""))
                val tokenB = createdId(api(client, "POST", "$ROOT/$b/tokens", """{"name":"admin-b","type":"shape"}"""))
                val tokenC =
                    createdId(
                        api(
                            client,
                            "POST",
                            "$ROOT/$c/tokens",
                            """{"name":"admin-c","type":"shape"}""",
                            project = "other",
                        ),
                    )
                fun body(
                    token: String,
                    tenant: String,
                ) = """{"tokenId":"$token","tenantId":"$tenant","platform":"web","mode":null,"value":[3]}"""
                val before = snapshot(database)
                for (key in listOf(null, UUID.randomUUID().toString())) {
                    for (payload in listOf(
                        body(tokenB, ta),
                        body(tokenA, tb),
                        body(tokenC, tc),
                        body(UUID.randomUUID().toString(), ta),
                    )) {
                        val response = api(client, "POST", "$ROOT/$a/token-values", payload, key, admin = true)
                        assertEquals(HttpStatusCode.NotFound, response.status, response.bodyAsText())
                    }
                }
                assertEquals(before, snapshot(database))
                // Администратор сохраняет обход проектной ACL при совпадающей системе пути.
                assertEquals(
                    HttpStatusCode.Created,
                    api(client, "POST", "$ROOT/$c/token-values", body(tokenC, tc), key = null, admin = true).status,
                )
                val key = UUID.randomUUID().toString()
                val payload = body(tokenA, ta)
                val created = api(client, "POST", "$ROOT/$a/token-values", payload, key, admin = true)
                assertEquals(HttpStatusCode.Created, created.status, created.bodyAsText())
                assertEquals(HttpStatusCode.OK, api(client, "DELETE", "$ROOT/$a", key = null).status)
                val afterDelete = snapshot(database)
                val repeated = api(client, "POST", "$ROOT/$a/token-values", payload, key, admin = true)
                assertEquals(created.status, repeated.status)
                assertEquals(created.bodyAsText(), repeated.bodyAsText())
                assertEquals(created.headers["X-DS-Mutation-Metadata"], repeated.headers["X-DS-Mutation-Metadata"])
                assertEquals(
                    HttpStatusCode.Conflict,
                    api(client, "POST", "$ROOT/$a/token-values", body(tokenB, tb), key, admin = true).status,
                )
                assertEquals(
                    HttpStatusCode.NotFound,
                    api(client, "POST", "$ROOT/$a/token-values", payload, key = null, admin = true).status,
                )
                assertEquals(afterDelete, snapshot(database))
            }
        }
    }

    @Test
    fun `component families batches imports and publication stay in the selected system`() {
        IsolatedPostgresDatabase.create().use { database ->
            ComponentSeedFixture.seed(database.jdbcUrl, database.username, database.password)
            testApplication {
                application { module(configuration(database)) }
                val a = createdId(api(client, "POST", ROOT, """{"name":"matrix-a","projectName":"scope"}"""))
                val b = createdId(api(client, "POST", ROOT, """{"name":"matrix-b","projectName":"scope"}"""))
                val c =
                    createdId(
                        api(client, "POST", ROOT, """{"name":"matrix-c","projectName":"scope"}""", project = "other"),
                    )
                val tenant = createdId(api(client, "POST", "$ROOT/$b/tenants", """{"name":"b-theme"}"""))
                val families = listOf(
                    "tokens", "token_values", "tenants", "design_system_components", "variations", "styles",
                    "appearances", "appearance_variations", "appearance_variation_values", "property_variations",
                    "invariant_property_values", "variation_property_values",
                )
                val ids = families.associateWith { table ->
                    sql(database, "SELECT id::text FROM $table WHERE design_system_id = '$b' LIMIT 1")
                }
                val aBinding = invariantBinding(database, a)
                val bBinding = invariantBinding(database, b)
                fun combinationBody(binding: List<String>, tokenId: String? = null): String =
                    """{"propertyId":"${binding[1]}","appearanceId":"${binding[3]}","stateSetId":"${binding[4]}","value":"scope"${tokenId?.let { ",\"tokenId\":\"$it\"" }.orEmpty()}}"""
                val combinationA =
                    createdId(
                        api(client, "POST", "$ROOT/$a/style-combinations", combinationBody(aBinding), admin = true),
                    )
                val combinationB =
                    createdId(
                        api(client, "POST", "$ROOT/$b/style-combinations", combinationBody(bBinding), admin = true),
                    )
                val occupiedKey = UUID.randomUUID().toString()
                createdId(
                    api(
                        client,
                        "POST",
                        "$ROOT/$b/tokens",
                        """{"name":"scope-occupied-b","type":"shape"}""",
                        occupiedKey,
                    ),
                )
                val cDetail = Json.parseToJsonElement(
                    api(client, "GET", "$ROOT/$c", project = "other").bodyAsText(),
                ).jsonObject
                val cPublish = """{"draftId":${cDetail.getValue(
                    "draftId",
                )},"draftRevision":${cDetail.getValue("draftRevision")},"version":"1.0.0"}"""
                val before = snapshot(database)
                val parentLists = listOf(
                    "variation-property-values/by-style/${ids.getValue("styles")}",
                    "variation-property-values/by-appearance/${ids.getValue("appearances")}",
                    "styles/by-variation/${ids.getValue("variations")}",
                    "style-combinations/$combinationB/members",
                    "variations/${ids.getValue("variations")}/styles",
                    "variations/${ids.getValue("variations")}/properties",
                )
                for (suffix in parentLists) {
                    assertEquals(HttpStatusCode.OK, api(client, "GET", "$ROOT/$b/$suffix").status, suffix)
                    for (admin in listOf(false, true)) {
                        assertEquals(
                            HttpStatusCode.NotFound,
                            api(client, "GET", "$ROOT/$a/$suffix", admin = admin).status,
                            suffix,
                        )
                    }
                }
                val foreignToken = ids.getValue("tokens")
                val invariantBody = """{"propertyId":"${aBinding[1]}","componentId":"${aBinding[2]}","appearanceId":"${aBinding[3]}","stateSetId":"${aBinding[4]}","tokenId":"$foreignToken"}"""
                assertEquals(
                    HttpStatusCode.NotFound,
                    api(client, "POST", "$ROOT/$a/invariant-property-values", invariantBody, admin = true).status,
                )
                assertEquals(
                    HttpStatusCode.NotFound,
                    api(
                        client,
                        "POST",
                        "$ROOT/$a/style-combinations",
                        combinationBody(aBinding, foreignToken),
                        admin = true,
                    ).status,
                )
                val variationValueA =
                    sql(database, "SELECT id::text FROM variation_property_values WHERE design_system_id='$a' LIMIT 1")
                for (suffix in listOf(
                    "invariant-property-values/${aBinding[0]}",
                    "variation-property-values/$variationValueA",
                    "style-combinations/$combinationA",
                )) {
                    assertEquals(
                        HttpStatusCode.NotFound,
                        api(
                            client,
                            "PATCH",
                            "$ROOT/$a/$suffix",
                            """{"tokenId":"$foreignToken"}""",
                            admin = true,
                        ).status,
                        suffix,
                    )
                }
                DriverManager.getConnection(database.jdbcUrl, database.username, database.password).use { lock ->
                    lock.createStatement().use { statement ->
                        statement.execute("SELECT pg_advisory_lock(hashtextextended('$c', 684313))")
                        try {
                            for (admin in listOf(false, true)) {
                                val hidden =
                                    withTimeout(
                                        3_000,
                                    ) { api(client, "POST", "$ROOT/$c/versions", cPublish, admin = admin) }
                                assertEquals(HttpStatusCode.NotFound, hidden.status, hidden.bodyAsText())
                                val conflict =
                                    withTimeout(
                                        3_000,
                                    ) { api(client, "POST", "$ROOT/$c/versions", cPublish, occupiedKey, admin = admin) }
                                assertEquals(HttpStatusCode.Conflict, conflict.status, conflict.bodyAsText())
                            }
                        } finally {
                            statement.execute("SELECT pg_advisory_unlock(hashtextextended('$c', 684313))")
                        }
                    }
                }
                for ((table, id) in ids) {
                    val resource = table.replace('_', '-')
                    assertEquals(HttpStatusCode.OK, api(client, "GET", "$ROOT/$b/$resource/$id").status, table)
                    assertEquals(HttpStatusCode.NotFound, api(client, "GET", "$ROOT/$a/$resource/$id").status, table)
                    assertEquals(
                        HttpStatusCode.NotFound,
                        api(client, "GET", "$ROOT/$a/$resource/$id", admin = true).status,
                        table,
                    )
                }
                // Новые GET/DELETE для этих ресурсов автоматически попадают в отрицательную матрицу.
                // Манифест уже сверяется с OpenAPI отдельным контрактным тестом.
                val resources = ids.mapKeys { (table, _) -> table.replace('_', '-') }
                val manifest = Json.parseToJsonElement(File("../contracts/route-manifest.json").readText()).jsonObject
                val operations = manifest.getValue("groups").jsonArray
                    .flatMap { it.jsonObject.getValue("operations").jsonArray }
                    .map { it.jsonArray }
                val paths = operations.mapNotNull { operation ->
                    val method = operation[0].jsonPrimitive.content
                    val path = operation[1].jsonPrimitive.content
                    val parts = path.split('/')
                    val owner = resources[parts.getOrNull(2)]
                    if (method !in setOf("GET", "DELETE") || parts.getOrNull(1) != "{designSystemId}" ||
                        owner == null || parts.getOrNull(3) != "{id}"
                    ) {
                        return@mapNotNull null
                    }
                    // У DELETE токена/темы/оформления тела нет; другие тела требуют отдельного сценария.
                    if (method == "DELETE" && operation[2].jsonPrimitive.content != "null") return@mapNotNull null
                    // Удаление значения свойства требует query-область; её нельзя заменить случайными ID.
                    if (method == "DELETE" && path.endsWith("/{id}/property-values")) return@mapNotNull null
                    val resolvedPath = path.replace("{designSystemId}", a).replace("{id}", owner)
                        .replace("{axisId}", ids.getValue("appearance_variations"))
                        .replace("{valueId}", ids.getValue("appearance_variation_values"))
                    assertFalse(resolvedPath.contains('{'), "Add a fixture for $method $path")
                    method to resolvedPath
                }
                assertTrue(paths.isNotEmpty())
                for ((method, path) in paths) {
                    val response = api(client, method, "$ROOT$path")
                    assertEquals(HttpStatusCode.NotFound, response.status, "$method $path: ${response.bodyAsText()}")
                }
                assertEquals(before, snapshot(database), "manifest-driven foreign reads/deletes changed database")
                val appearance = ids.getValue("appearances")
                val token = ids.getValue("tokens")
                val property =
                    sql(
                        database,
                        "SELECT property_id::text FROM invariant_property_values WHERE design_system_id='$b' LIMIT 1",
                    )
                val requests = listOf(
                    Triple("POST", "appearances/$appearance/duplicate", """{"name":"outside"}"""),
                    Triple(
                        "PUT",
                        "appearances/$appearance/property-values",
                        """{"propertyId":"$property","value":"outside"}""",
                    ),
                    Triple("POST", "appearances/$appearance/axis-order", """{"axisIds":[]}"""),
                    Triple("PUT", "tenants/$tenant/token-values", """{"values":[],"editRevision":0}"""),
                    Triple("PATCH", "tokens/$token", """{"displayName":"outside"}"""),
                    Triple("DELETE", "design-system-components/${ids.getValue("design_system_components")}", null),
                )
                for ((method, suffix, body) in requests) {
                    val response = api(client, method, "$ROOT/$a/$suffix", body)
                    assertTrue(response.status.value in setOf(400, 404), "$method $suffix: ${response.bodyAsText()}")
                }
                for (dryRun in listOf(false, true)) {
                    val unknown = UUID.randomUUID()
                    val body = """{"platform":"web","dryRun":$dryRun,"meta":{"name":"empty","source":"test"},"components":[{"componentName":"button","styleName":"scope","config":{"invariants":{}}}]}"""
                    assertEquals(
                        HttpStatusCode.NotFound,
                        api(client, "POST", "$ROOT/$unknown/component-config/import", body).status,
                    )
                    assertEquals(
                        HttpStatusCode.NotFound,
                        api(client, "POST", "$ROOT/$c/component-config/import", body).status,
                    )
                }
                val draft =
                    sql(
                        database,
                        "SELECT id::text FROM design_system_versions WHERE design_system_id='$b' AND status='draft'",
                    )
                val revision = sql(database, "SELECT resolved_draft_revision('$draft')::text")
                val publish = """{"draftId":"$draft","draftRevision":$revision,"version":"1.0.0"}"""
                assertEquals(HttpStatusCode.Conflict, api(client, "POST", "$ROOT/$a/versions", publish).status)
                assertEquals(HttpStatusCode.NotFound, api(client, "GET", "$ROOT/$c/tokens").status)
                assertEquals(before, snapshot(database), "rejected operations changed data or idempotency results")
                verifyConnectionReuse(database, a, b)
                val importKey = UUID.randomUUID().toString()
                val importBody = """{"platform":"web","dryRun":false,"meta":{"name":"repeat","source":"test"},"components":[{"componentName":"button","styleName":"scope","config":{"invariants":{}}}]}"""
                val imported = api(client, "POST", "$ROOT/$b/component-config/import", importBody, importKey)
                assertEquals(HttpStatusCode.OK, imported.status, imported.bodyAsText())
                val afterImport = snapshot(database)
                val repeated = api(client, "POST", "$ROOT/$b/component-config/import", importBody, importKey)
                assertEquals(imported.bodyAsText(), repeated.bodyAsText())
                assertEquals(
                    HttpStatusCode.Conflict,
                    api(client, "POST", "$ROOT/$a/component-config/import", importBody, importKey).status,
                )
                assertEquals(afterImport, snapshot(database))
            }
        }
    }

    @Test
    fun `public entry uses the same catalog and owner boundary without internal or legacy aliases`() {
        IsolatedPostgresDatabase.create().use { database ->
            testApplication {
                application {
                    val configuration = configuration(database)
                    val runtime = createDsRuntime(configuration)
                    monitor.subscribe(ApplicationStopped) { runtime.close() }
                    val json = Json { explicitNulls = true }
                    this.install(Koin) { modules(dsDependencyModules(configuration, runtime)) }
                    configureDsPublicEntry("/api/projects/{projectId}/design-systems") { it.request.headers }
                    installDsHttpPlugins(json, runtime.metrics)
                    installDsRoutes(runtime, json, diagnostics = false)
                }
                val prefix = "/api/projects/scope-project/design-systems"
                val a = createdId(api(client, "POST", prefix, """{"name":"public-a","projectName":"scope"}"""))
                val b = createdId(api(client, "POST", prefix, """{"name":"public-b","projectName":"scope"}"""))
                val token = createdId(api(client, "POST", "$prefix/$b/tokens", """{"name":"b-only","type":"shape"}"""))
                assertEquals(
                    HttpStatusCode.NotFound,
                    api(client, "GET", "$prefix/$a/tokens/$token?designSystemId=$b").status,
                )
                assertEquals(HttpStatusCode.OK, api(client, "GET", "$prefix/catalog/components").status)
                assertEquals(
                    HttpStatusCode.NotFound,
                    api(client, "GET", "$prefix/catalog/components/$token/variations").status,
                )
                assertEquals(HttpStatusCode.BadRequest, api(client, "GET", "$prefix/not-a-uuid/tokens").status)
                for (path in listOf(
                    "/api/ds",
                    "/api/ds/tokens",
                    "/api/projects/scope-project/ds/tokens",
                    ROOT,
                    "$ROOT/$b/tokens",
                )) {
                    assertEquals(HttpStatusCode.NotFound, api(client, "GET", path).status, path)
                }
            }
        }
    }

    private suspend fun verifyEmptyMutationScopes(database: IsolatedPostgresDatabase, deleted: String, live: String) {
        PostgresDatabasePool.create(database.jdbcUrl, database.username, database.password, 1, 5_000).use { pool ->
            val runner = ExposedTransactionRunner(pool.database, PostgresTransactionFailureMapper())
            val context = DsRequestContext(
                ProjectPrincipal(ProjectActorType.USER, "owner", "scope-project", projectRole = "owner"),
                "no-key",
            )
            // После успешной проверки того же соединения маркер не должен перейти в другую команду.
            assertIs<DsResult.Success<List<UUID>>>(
                runner.required(context.copy(designSystemId = UUID.fromString(live))) {
                    DsResult.Success(emptyList<UUID>())
                },
            )
            for (id in listOf(UUID.randomUUID(), UUID.fromString(deleted))) {
                val result = runner.required(context.copy(designSystemId = id)) { DsResult.Success(emptyList<UUID>()) }
                assertEquals(DsResult.Failure(com.dsbuilder.ds.core.application.DsFailure.NotFound), result)
            }
            assertIs<DsResult.Success<List<UUID>>>(runner.required(context) { DsResult.Success(emptyList<UUID>()) })
        }
    }

    private suspend fun verifyConnectionReuse(database: IsolatedPostgresDatabase, a: String, b: String) {
        PostgresDatabasePool.create(database.jdbcUrl, database.username, database.password, 1, 5_000).use { pool ->
            val runner = ExposedTransactionRunner(pool.database, PostgresTransactionFailureMapper())
            val global =
                DsRequestContext(
                    ProjectPrincipal(ProjectActorType.USER, "owner", "scope-project", projectRole = "owner"),
                    "scope",
                )
            val contextA = global.copy(designSystemId = UUID.fromString(a))
            val contextB = global.copy(designSystemId = UUID.fromString(b))
            var backend: Int? = null
            val check = suspend {
                val pid = TransactionManager.current().exec("SELECT pg_backend_pid()") {
                    it.next()
                    it.getInt(1)
                }
                if (backend == null) backend = pid else assertEquals(backend, pid)
            }
            assertIs<DsResult.Success<Unit>>(
                runner.required(contextA) {
                    check()
                    assertFalse(requestDesignSystemMatches(UUID.fromString(b)))
                    DsResult.Success(Unit)
                },
            )
            assertIs<DsResult.Success<Unit>>(
                runner.rollback(contextA) {
                    check()
                    assertFalse(requestDesignSystemMatches(UUID.fromString(b)))
                    DsResult.Success(Unit)
                },
            )
            assertIs<DsResult.Success<Unit>>(
                runner.readOnly(global) {
                    check()
                    assertTrue(requestDesignSystemMatches(UUID.fromString(a)))
                    assertTrue(requestDesignSystemMatches(UUID.fromString(b)))
                    DsResult.Success(Unit)
                },
            )
            assertIs<DsResult.Success<Unit>>(
                runner.required {
                    check()
                    assertTrue(requestDesignSystemMatches(UUID.fromString(a)))
                    assertTrue(requestDesignSystemMatches(UUID.fromString(b)))
                    DsResult.Success(Unit)
                },
            )
            assertIs<DsResult.Success<Unit>>(
                runner.rollback {
                    check()
                    assertTrue(requestDesignSystemMatches(UUID.fromString(a)))
                    assertTrue(requestDesignSystemMatches(UUID.fromString(b)))
                    DsResult.Success(Unit)
                },
            )
            var attempts = 0
            assertIs<DsResult.Success<Unit>>(
                runner.required(contextB) {
                    check()
                    assertTrue(requestDesignSystemMatches(UUID.fromString(b)))
                    assertFalse(requestDesignSystemMatches(UUID.fromString(a)))
                    if (attempts++ == 0) throw SQLException("retry scope", "40001")
                    DsResult.Success(Unit)
                },
            )
            assertTrue(attempts >= 2)
        }
    }

    private fun sql(database: IsolatedPostgresDatabase, query: String): String =
        DriverManager.getConnection(database.jdbcUrl, database.username, database.password).use { connection ->
            connection.createStatement().use { statement ->
                statement.executeQuery(query).use { rows ->
                    assertTrue(rows.next(), "Fixture has no row for $query")
                    rows.getString(1)
                }
            }
        }

    private fun invariantBinding(database: IsolatedPostgresDatabase, system: String): List<String> = sql(
        database,
        """
            SELECT entity.id::text || ',' || entity.property_id || ',' || entity.component_id || ',' ||
                   entity.appearance_id || ',' || revision.state_set_id
            FROM invariant_property_values entity
            JOIN LATERAL (
                SELECT state_set_id FROM invariant_property_value_revisions
                WHERE invariant_property_value_id = entity.id
                ORDER BY version_sequence_number DESC LIMIT 1
            ) revision ON true
            WHERE entity.design_system_id = '$system' LIMIT 1
        """.trimIndent(),
    ).split(',')

    private fun snapshot(database: IsolatedPostgresDatabase): String {
        val tables =
            sql(
                database,
                "SELECT string_agg(tablename, ',' ORDER BY tablename) FROM pg_tables WHERE schemaname='public'",
            )
        return tables.split(',').joinToString("\n") { table ->
            "$table:" + sql(database, "SELECT md5(coalesce(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text)::text, '')) FROM $table t")
        }
    }

    private fun configuration(database: IsolatedPostgresDatabase) = DsServiceConfiguration(
        0, database.jdbcUrl, database.username, database.password, 4, 5_000, null, true, false, null,
    )

    private suspend fun createdId(response: HttpResponse): String {
        assertEquals(HttpStatusCode.Created, response.status, response.bodyAsText())
        return Json.parseToJsonElement(response.bodyAsText()).jsonObject.getValue("id").jsonPrimitive.content
    }

    private suspend fun api(
        client: HttpClient,
        method: String,
        path: String,
        body: String? = null,
        key: String? = UUID.randomUUID().toString(),
        admin: Boolean = false,
        project: String = "scope-project",
    ): HttpResponse = client.request(path) {
        this.method = HttpMethod.parse(method)
        header("X-Actor-Type", "user")
        header("X-User-Id", "scope-owner")
        header("X-Project-Id", project)
        header("X-Project-Role", "owner")
        header("X-System-Admin", admin.toString())
        key?.let { header("Idempotency-Key", it) }
        body?.let {
            contentType(ContentType.Application.Json)
            setBody(it)
        }
    }

    private companion object {
        const val ROOT = "/api/design-systems"
    }
}
