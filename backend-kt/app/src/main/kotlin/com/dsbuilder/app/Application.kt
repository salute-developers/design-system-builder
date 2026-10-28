package com.dsbuilder.app

import com.dsbuilder.app.data.InProcessDesignSystemOwnership
import com.dsbuilder.app.data.KeycloakProxy
import com.dsbuilder.app.di.installBackendDependencies
import com.dsbuilder.app.presentation.RequestBodyLimit
import com.dsbuilder.app.presentation.cacheDsJsonBody
import com.dsbuilder.app.presentation.installPublicGateway
import com.dsbuilder.app.presentation.pluginPublicationBodyConsumed
import com.dsbuilder.app.presentation.verifiedRequestHeaders
import com.dsbuilder.authorization.AuthorizationPolicyLoader
import com.dsbuilder.authorization.PolicyEvaluator
import com.dsbuilder.documentation.app.DocumentationRuntime
import com.dsbuilder.documentation.app.createDocumentationRuntime
import com.dsbuilder.documentation.ingestion.presentation.configureIngestionPublicEntry
import com.dsbuilder.documentation.publication.presentation.configurePublicationPublicEntry
import com.dsbuilder.documentation.search.presentation.configureSearchPublicEntry
import com.dsbuilder.ds.app.DsRuntime
import com.dsbuilder.ds.app.DsServiceConfiguration
import com.dsbuilder.ds.app.createDsRuntime
import com.dsbuilder.ds.app.installDsHttpPlugins
import com.dsbuilder.ds.app.installDsRoutes
import com.dsbuilder.ds.core.presentation.configureDsBodyConsumption
import com.dsbuilder.ds.core.presentation.configureDsPublicEntry
import com.dsbuilder.identity.auth.application.GatewayAuthorizer
import com.dsbuilder.projects.app.initializeProjectsDatabase
import com.dsbuilder.projects.core.DatabaseProvider
import com.dsbuilder.projects.feature.projects.presentation.configureProjectsPublicEntry
import com.dsbuilder.projects.feature.projects.presentation.projectsRoutes
import io.ktor.http.HttpStatusCode
import io.ktor.server.application.Application
import io.ktor.server.application.ApplicationCall
import io.ktor.server.application.ApplicationStopped
import io.ktor.server.application.install
import io.ktor.server.engine.connector
import io.ktor.server.engine.embeddedServer
import io.ktor.server.netty.Netty
import io.ktor.server.request.path
import io.ktor.server.response.respond
import io.ktor.server.response.respondRedirect
import io.ktor.server.response.respondText
import io.ktor.server.routing.Route
import io.ktor.server.routing.get
import io.ktor.server.routing.route
import io.ktor.server.routing.routing
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import org.jetbrains.exposed.v1.jdbc.transactions.transaction
import org.koin.ktor.ext.getKoin

/** Единственная прикладная точка запуска backend. */
fun main() {
    val configuration = GatewayConfiguration.fromEnvironment()
    embeddedServer(
        Netty,
        configure = {
            connector { port = configuration.port }
            requestReadTimeoutSeconds = configuration.timeoutSeconds.toInt()
            responseWriteTimeoutSeconds = configuration.timeoutSeconds.toInt()
            shutdownGracePeriod = 1000
            shutdownTimeout = configuration.shutdownTimeoutMs
        },
    ) { monolith(configuration) }.start(wait = true)
}

/** Соединяет библиотечные подсистемы с одним сервером и одним графом DI. */
// Закрываем все частично созданные ресурсы при любой ошибке инициализации.
@Suppress("TooGenericExceptionCaught")
fun Application.monolith(configuration: GatewayConfiguration = GatewayConfiguration.fromEnvironment()) {
    val policyPaths = listOfNotNull(
        System.getenv("AUTHORIZATION_POLICY_PATH"),
        System.getenv("PROJECT_AUTHORIZATION_POLICY_PATH"),
    ).filter(String::isNotBlank).distinct()
    require(policyPaths.size <= 1) { "Authorization policy paths must identify the same shared policy" }
    val evaluator = PolicyEvaluator(AuthorizationPolicyLoader.load(policyPaths.singleOrNull()))
    val dsConfiguration = DsServiceConfiguration.fromEnvironment()
    val ds = createDsRuntime(dsConfiguration, evaluator)
    val owned = mutableListOf<AutoCloseable>(ds)
    monitor.subscribe(ApplicationStopped) { owned.asReversed().forEach { runCatching { it.close() } } }
    try {
        installBackendDependencies(evaluator, dsConfiguration, ds)
        val koin = getKoin()
        owned += koin.get<DatabaseProvider>()
        initializeProjectsDatabase(koin)
        val documentation = createDocumentationRuntime(evaluator, InProcessDesignSystemOwnership(koin.get()))
        owned += documentation
        val proxy = KeycloakProxy(configuration)
        owned += proxy
        installPublicGateway(configuration, koin.get<GatewayAuthorizer>())
        installDsHttpPlugins(
            Json {
                ignoreUnknownKeys = false
                explicitNulls = true
            },
            ds.metrics,
            cacheJsonBody = ::cacheDsJsonBody,
        )
        install(RequestBodyLimit)
        configureDsBodyConsumption { it.pluginPublicationBodyConsumed() }
        configureDsPublicEntry("/api/projects/{projectId}/ds") { it.verifiedRequestHeaders() }
        configureProjectsPublicEntry("/projects") { it.verifiedRequestHeaders() }
        val documentationPrefix = "/api/projects/{projectId}/documentation"
        configureIngestionPublicEntry(documentationPrefix) { it.verifiedRequestHeaders() }
        configurePublicationPublicEntry(documentationPrefix) { it.verifiedRequestHeaders() }
        configureSearchPublicEntry(documentationPrefix) { it.verifiedRequestHeaders() }
        installDsRoutes(
            ds,
            Json {
                ignoreUnknownKeys = false
                explicitNulls = true
            },
            diagnostics = false,
        )
        projectsRoutes(internalApiKey = null, publicEntry = true)
        registerBackendRoutes(configuration, ds, documentation, proxy)
        documentation.start(this)
    } catch (failure: Throwable) {
        owned.asReversed().forEach { runCatching { it.close() } }
        throw failure
    }
}

private fun Application.registerBackendRoutes(
    configuration: GatewayConfiguration,
    ds: DsRuntime,
    documentation: DocumentationRuntime,
    proxy: KeycloakProxy,
) {
    routing {
        documentation.registerRoutes(this)
        get("/health") { call.respondText("ok\n") }
        get("/ready") { call.respondBackendReadiness(ds, documentation) }
        route("/api/projects/") { handle { call.permanentRedirect("/api/projects") } }
        get("/auth/login") { call.respondText("", status = HttpStatusCode.NotFound) }
        get("/auth/register") { call.respondText("", status = HttpStatusCode.NotFound) }
        get("/auth/account") { call.respondRedirect("/realms/${configuration.realm}/account/") }
        route("/admin") { handle { call.permanentRedirect("/admin/") } }
        registerKeycloakProxy(configuration, proxy)
    }
}

private fun Route.registerKeycloakProxy(
    configuration: GatewayConfiguration,
    proxy: KeycloakProxy,
) {
    route("/{path...}") {
        handle {
            val path = call.request.path()
            val blocked = java.net.URI(path).path in setOf(
                "/auth/login", "/auth/register",
                "/realms/${configuration.realm}/protocol/openid-connect/registrations",
                "/realms/${configuration.realm}/login-actions/registration",
            )
            val upstream = when {
                blocked -> null
                path == "/auth/token" -> "/realms/${configuration.realm}/protocol/openid-connect/token"
                path == "/auth/logout" -> "/realms/${configuration.realm}/protocol/openid-connect/logout"
                path.startsWith("/auth/") -> path.removePrefix("/auth")
                listOf("/realms/", "/resources/", "/admin/").any(path::startsWith) -> path
                else -> null
            }
            if (upstream == null) {
                call.respondText("", status = HttpStatusCode.NotFound)
            } else {
                proxy.forward(call, upstream)
            }
        }
    }
}

private suspend fun ApplicationCall.respondBackendReadiness(
    ds: DsRuntime,
    documentation: DocumentationRuntime,
) {
    val dsReady = ds.readiness()
    val documentationReady = documentation.readiness()
    val projectsReady = withContext(Dispatchers.IO) {
        try {
            transaction(db = application.getKoin().get<DatabaseProvider>().database) { exec("SELECT 1") }
            true
        } catch (cancelled: CancellationException) {
            throw cancelled
        } catch (_: Exception) {
            false
        }
    }
    val ready = dsReady.ready && projectsReady && documentationReady.ready
    val report = buildJsonObject {
        put("ready", JsonPrimitive(ready))
        put(
            "checks",
            buildJsonObject {
                dsReady.checks.forEach { (name, result) ->
                    put("ds.$name", JsonPrimitive(result))
                }
                put("projects.database", JsonPrimitive(projectsReady))
                documentationReady.checks.forEach { (name, result) ->
                    put("documentation.$name", JsonPrimitive(result))
                }
            },
        )
    }
    respond(if (ready) HttpStatusCode.OK else HttpStatusCode.ServiceUnavailable, report)
}

private suspend fun ApplicationCall.permanentRedirect(location: String) {
    response.headers.append("Location", location)
    respondText("", status = HttpStatusCode.PermanentRedirect)
}
