package com.dsbuilder.ds.app

import com.dsbuilder.authorization.AuthorizationPolicyLoader
import com.dsbuilder.authorization.PolicyEvaluator
import com.dsbuilder.ds.components.application.AddStyleCombinationMemberUseCase
import com.dsbuilder.ds.components.application.CreateAppearanceUseCase
import com.dsbuilder.ds.components.application.CreateAppearanceVariationUseCase
import com.dsbuilder.ds.components.application.CreateAppearanceVariationValueUseCase
import com.dsbuilder.ds.components.application.CreateComponentDependencyUseCase
import com.dsbuilder.ds.components.application.CreateComponentReuseConfigUseCase
import com.dsbuilder.ds.components.application.CreateComponentUseCase
import com.dsbuilder.ds.components.application.CreateDesignSystemComponentUseCase
import com.dsbuilder.ds.components.application.CreateInvariantPlatformParamAdjustmentUseCase
import com.dsbuilder.ds.components.application.CreateInvariantPropertyValueUseCase
import com.dsbuilder.ds.components.application.CreatePropertyPlatformParamUseCase
import com.dsbuilder.ds.components.application.CreatePropertyUseCase
import com.dsbuilder.ds.components.application.CreatePropertyVariationUseCase
import com.dsbuilder.ds.components.application.CreateStateUseCase
import com.dsbuilder.ds.components.application.CreateStyleCombinationMemberUseCase
import com.dsbuilder.ds.components.application.CreateStyleCombinationUseCase
import com.dsbuilder.ds.components.application.CreateStyleUseCase
import com.dsbuilder.ds.components.application.CreateVariationPlatformParamAdjustmentUseCase
import com.dsbuilder.ds.components.application.CreateVariationPropertyValueUseCase
import com.dsbuilder.ds.components.application.CreateVariationUseCase
import com.dsbuilder.ds.components.application.DeleteAppearanceUseCase
import com.dsbuilder.ds.components.application.DeleteAppearanceVariationUseCase
import com.dsbuilder.ds.components.application.DeleteAppearanceVariationValueUseCase
import com.dsbuilder.ds.components.application.DeleteComponentDependencyUseCase
import com.dsbuilder.ds.components.application.DeleteComponentReuseConfigUseCase
import com.dsbuilder.ds.components.application.DeleteComponentUseCase
import com.dsbuilder.ds.components.application.DeleteDesignSystemComponentUseCase
import com.dsbuilder.ds.components.application.DeleteInvariantPlatformParamAdjustmentUseCase
import com.dsbuilder.ds.components.application.DeleteInvariantPropertyValueUseCase
import com.dsbuilder.ds.components.application.DeletePropertyPlatformParamUseCase
import com.dsbuilder.ds.components.application.DeletePropertyUseCase
import com.dsbuilder.ds.components.application.DeletePropertyVariationUseCase
import com.dsbuilder.ds.components.application.DeleteStateUseCase
import com.dsbuilder.ds.components.application.DeleteStyleCombinationMemberUseCase
import com.dsbuilder.ds.components.application.DeleteStyleCombinationUseCase
import com.dsbuilder.ds.components.application.DeleteStyleUseCase
import com.dsbuilder.ds.components.application.DeleteVariationPlatformParamAdjustmentUseCase
import com.dsbuilder.ds.components.application.DeleteVariationPropertyValueUseCase
import com.dsbuilder.ds.components.application.DeleteVariationUseCase
import com.dsbuilder.ds.components.application.ExportComponentConfigUseCase
import com.dsbuilder.ds.components.application.GetAppearanceUseCase
import com.dsbuilder.ds.components.application.GetAppearanceVariationUseCase
import com.dsbuilder.ds.components.application.GetAppearanceVariationValueUseCase
import com.dsbuilder.ds.components.application.GetComponentConfigUseCase
import com.dsbuilder.ds.components.application.GetComponentDependencyUseCase
import com.dsbuilder.ds.components.application.GetComponentReuseConfigUseCase
import com.dsbuilder.ds.components.application.GetComponentUseCase
import com.dsbuilder.ds.components.application.GetDesignSystemComponentUseCase
import com.dsbuilder.ds.components.application.GetInvariantPlatformParamAdjustmentUseCase
import com.dsbuilder.ds.components.application.GetInvariantPropertyValueUseCase
import com.dsbuilder.ds.components.application.GetPropertyPlatformParamUseCase
import com.dsbuilder.ds.components.application.GetPropertyUseCase
import com.dsbuilder.ds.components.application.GetPropertyVariationUseCase
import com.dsbuilder.ds.components.application.GetStateImpactUseCase
import com.dsbuilder.ds.components.application.GetStateSetUseCase
import com.dsbuilder.ds.components.application.GetStateUseCase
import com.dsbuilder.ds.components.application.GetStyleCombinationMemberUseCase
import com.dsbuilder.ds.components.application.GetStyleCombinationUseCase
import com.dsbuilder.ds.components.application.GetStyleUseCase
import com.dsbuilder.ds.components.application.GetVariationPlatformParamAdjustmentUseCase
import com.dsbuilder.ds.components.application.GetVariationPropertyValueUseCase
import com.dsbuilder.ds.components.application.GetVariationUseCase
import com.dsbuilder.ds.components.application.ImportComponentConfigUseCase
import com.dsbuilder.ds.components.application.ListAppearanceVariationAxesUseCase
import com.dsbuilder.ds.components.application.ListAppearanceVariationValuesUseCase
import com.dsbuilder.ds.components.application.ListAppearanceVariationsUseCase
import com.dsbuilder.ds.components.application.ListAppearancesUseCase
import com.dsbuilder.ds.components.application.ListComponentDependenciesUseCase
import com.dsbuilder.ds.components.application.ListComponentPropertiesUseCase
import com.dsbuilder.ds.components.application.ListComponentReuseConfigsByDependencyUseCase
import com.dsbuilder.ds.components.application.ListComponentReuseConfigsUseCase
import com.dsbuilder.ds.components.application.ListComponentVariationsUseCase
import com.dsbuilder.ds.components.application.ListComponentsUseCase
import com.dsbuilder.ds.components.application.ListDependenciesByComponentUseCase
import com.dsbuilder.ds.components.application.ListInvariantPlatformParamAdjustmentsUseCase
import com.dsbuilder.ds.components.application.ListInvariantPropertyValuesByComponentAndDesignSystemUseCase
import com.dsbuilder.ds.components.application.ListInvariantPropertyValuesUseCase
import com.dsbuilder.ds.components.application.ListMembersByStyleCombinationUseCase
import com.dsbuilder.ds.components.application.ListPropertiesUseCase
import com.dsbuilder.ds.components.application.ListPropertyPlatformParamsUseCase
import com.dsbuilder.ds.components.application.ListPropertyVariationsUseCase
import com.dsbuilder.ds.components.application.ListStateSetsUseCase
import com.dsbuilder.ds.components.application.ListStatesUseCase
import com.dsbuilder.ds.components.application.ListStyleCombinationMembersUseCase
import com.dsbuilder.ds.components.application.ListStyleCombinationsUseCase
import com.dsbuilder.ds.components.application.ListStylesByVariationAndDesignSystemUseCase
import com.dsbuilder.ds.components.application.ListStylesUseCase
import com.dsbuilder.ds.components.application.ListVariationPlatformParamAdjustmentsUseCase
import com.dsbuilder.ds.components.application.ListVariationPropertiesUseCase
import com.dsbuilder.ds.components.application.ListVariationPropertyValuesByAppearanceUseCase
import com.dsbuilder.ds.components.application.ListVariationPropertyValuesByStyleUseCase
import com.dsbuilder.ds.components.application.ListVariationPropertyValuesUseCase
import com.dsbuilder.ds.components.application.ListVariationStylesUseCase
import com.dsbuilder.ds.components.application.ListVariationsUseCase
import com.dsbuilder.ds.components.application.ResolveStateSetUseCase
import com.dsbuilder.ds.components.application.UpdateAppearanceUseCase
import com.dsbuilder.ds.components.application.UpdateAppearanceVariationUseCase
import com.dsbuilder.ds.components.application.UpdateAppearanceVariationValueUseCase
import com.dsbuilder.ds.components.application.UpdateComponentDependencyUseCase
import com.dsbuilder.ds.components.application.UpdateComponentReuseConfigUseCase
import com.dsbuilder.ds.components.application.UpdateComponentUseCase
import com.dsbuilder.ds.components.application.UpdateInvariantPlatformParamAdjustmentUseCase
import com.dsbuilder.ds.components.application.UpdateInvariantPropertyValueUseCase
import com.dsbuilder.ds.components.application.UpdatePropertyPlatformParamUseCase
import com.dsbuilder.ds.components.application.UpdatePropertyUseCase
import com.dsbuilder.ds.components.application.UpdateStateUseCase
import com.dsbuilder.ds.components.application.UpdateStyleCombinationUseCase
import com.dsbuilder.ds.components.application.UpdateStyleUseCase
import com.dsbuilder.ds.components.application.UpdateVariationPlatformParamAdjustmentUseCase
import com.dsbuilder.ds.components.application.UpdateVariationPropertyValueUseCase
import com.dsbuilder.ds.components.application.UpdateVariationUseCase
import com.dsbuilder.ds.components.di.componentModelModule
import com.dsbuilder.ds.components.di.componentsModule
import com.dsbuilder.ds.components.presentation.appearanceRoutes
import com.dsbuilder.ds.components.presentation.appearanceVariationRoutes
import com.dsbuilder.ds.components.presentation.appearanceVariationValueRoutes
import com.dsbuilder.ds.components.presentation.componentConfigRoutes
import com.dsbuilder.ds.components.presentation.componentDependencyRoutes
import com.dsbuilder.ds.components.presentation.componentReuseConfigRoutes
import com.dsbuilder.ds.components.presentation.componentRoutes
import com.dsbuilder.ds.components.presentation.designSystemComponentRoutes
import com.dsbuilder.ds.components.presentation.invariantPlatformParamAdjustmentRoutes
import com.dsbuilder.ds.components.presentation.invariantPropertyValueRoutes
import com.dsbuilder.ds.components.presentation.propertyPlatformParamRoutes
import com.dsbuilder.ds.components.presentation.propertyRoutes
import com.dsbuilder.ds.components.presentation.propertyVariationRoutes
import com.dsbuilder.ds.components.presentation.stateRoutes
import com.dsbuilder.ds.components.presentation.stateSetRoutes
import com.dsbuilder.ds.components.presentation.styleCombinationMemberRoutes
import com.dsbuilder.ds.components.presentation.styleCombinationRoutes
import com.dsbuilder.ds.components.presentation.styleRoutes
import com.dsbuilder.ds.components.presentation.variationPlatformParamAdjustmentRoutes
import com.dsbuilder.ds.components.presentation.variationPropertyValueRoutes
import com.dsbuilder.ds.components.presentation.variationRoutes
import com.dsbuilder.ds.core.application.Clock
import com.dsbuilder.ds.core.application.DsAccessPolicy
import com.dsbuilder.ds.core.application.IdGenerator
import com.dsbuilder.ds.core.application.TransactionRunner
import com.dsbuilder.ds.core.data.ExposedTransactionRunner
import com.dsbuilder.ds.core.data.PostgresDatabasePool
import com.dsbuilder.ds.core.data.PostgresTransactionFailureMapper
import com.dsbuilder.ds.core.presentation.ErrorResponse
import com.dsbuilder.ds.core.presentation.installLegacyValidationError
import com.dsbuilder.ds.core.presentation.markDsFailureOutcome
import com.dsbuilder.ds.designsystems.application.CreateDesignSystemChangeUseCase
import com.dsbuilder.ds.designsystems.application.CreateDesignSystemUseCase
import com.dsbuilder.ds.designsystems.application.CreateDesignSystemVersionUseCase
import com.dsbuilder.ds.designsystems.application.DeleteDesignSystemUseCase
import com.dsbuilder.ds.designsystems.application.DeleteDesignSystemVersionUseCase
import com.dsbuilder.ds.designsystems.application.GetDesignSystemChangeUseCase
import com.dsbuilder.ds.designsystems.application.GetDesignSystemUseCase
import com.dsbuilder.ds.designsystems.application.GetDesignSystemVersionUseCase
import com.dsbuilder.ds.designsystems.application.ListChangesByDesignSystemUseCase
import com.dsbuilder.ds.designsystems.application.ListDesignSystemAppearancesUseCase
import com.dsbuilder.ds.designsystems.application.ListDesignSystemChangeEntriesUseCase
import com.dsbuilder.ds.designsystems.application.ListDesignSystemComponentStylesUseCase
import com.dsbuilder.ds.designsystems.application.ListDesignSystemComponentsUseCase
import com.dsbuilder.ds.designsystems.application.ListDesignSystemTenantsUseCase
import com.dsbuilder.ds.designsystems.application.ListDesignSystemTokensUseCase
import com.dsbuilder.ds.designsystems.application.ListDesignSystemVersionsUseCase
import com.dsbuilder.ds.designsystems.application.ListDesignSystemsUseCase
import com.dsbuilder.ds.designsystems.application.ListVersionsByDesignSystemUseCase
import com.dsbuilder.ds.designsystems.application.UpdateDesignSystemUseCase
import com.dsbuilder.ds.designsystems.application.UpdateDesignSystemVersionUseCase
import com.dsbuilder.ds.designsystems.di.designSystemsModule
import com.dsbuilder.ds.designsystems.presentation.designSystemChangeRoutes
import com.dsbuilder.ds.designsystems.presentation.designSystemRoutes
import com.dsbuilder.ds.designsystems.presentation.designSystemVersionRoutes
import com.dsbuilder.ds.themes.application.CreateTenantUseCase
import com.dsbuilder.ds.themes.application.DeleteTenantUseCase
import com.dsbuilder.ds.themes.application.GetTenantTokenValuesUseCase
import com.dsbuilder.ds.themes.application.GetTenantUseCase
import com.dsbuilder.ds.themes.application.ListTenantsUseCase
import com.dsbuilder.ds.themes.application.SaveTenantTokenValuesUseCase
import com.dsbuilder.ds.themes.application.UpdateTenantUseCase
import com.dsbuilder.ds.themes.di.themesModule
import com.dsbuilder.ds.themes.presentation.tenantRoutes
import com.dsbuilder.ds.tokens.application.CreatePaletteEntryUseCase
import com.dsbuilder.ds.tokens.application.CreateTokenUseCase
import com.dsbuilder.ds.tokens.application.CreateTokenValueUseCase
import com.dsbuilder.ds.tokens.application.DeletePaletteEntryUseCase
import com.dsbuilder.ds.tokens.application.DeleteTokenUseCase
import com.dsbuilder.ds.tokens.application.DeleteTokenValueUseCase
import com.dsbuilder.ds.tokens.application.GetPaletteEntryUseCase
import com.dsbuilder.ds.tokens.application.GetTokenUseCase
import com.dsbuilder.ds.tokens.application.GetTokenValueUseCase
import com.dsbuilder.ds.tokens.application.GetTokenValuesUseCase
import com.dsbuilder.ds.tokens.application.ListPaletteByTypeUseCase
import com.dsbuilder.ds.tokens.application.ListPaletteUseCase
import com.dsbuilder.ds.tokens.application.ListTokenValuesUseCase
import com.dsbuilder.ds.tokens.application.ListTokensUseCase
import com.dsbuilder.ds.tokens.application.UpdatePaletteEntryUseCase
import com.dsbuilder.ds.tokens.application.UpdateTokenUseCase
import com.dsbuilder.ds.tokens.application.UpdateTokenValueUseCase
import com.dsbuilder.ds.tokens.di.tokensModule
import com.dsbuilder.ds.tokens.presentation.paletteRoutes
import com.dsbuilder.ds.tokens.presentation.tokenRoutes
import com.dsbuilder.ds.tokens.presentation.tokenValueRoutes
import io.ktor.http.ContentType
import io.ktor.http.HttpStatusCode
import io.ktor.serialization.kotlinx.json.json
import io.ktor.server.application.Application
import io.ktor.server.application.ApplicationCallPipeline
import io.ktor.server.application.ApplicationStopped
import io.ktor.server.application.install
import io.ktor.server.engine.embeddedServer
import io.ktor.server.netty.Netty
import io.ktor.server.plugins.BadRequestException
import io.ktor.server.plugins.callid.CallId
import io.ktor.server.plugins.callid.callId
import io.ktor.server.plugins.callid.callIdMdc
import io.ktor.server.plugins.calllogging.CallLogging
import io.ktor.server.plugins.contentnegotiation.ContentNegotiation
import io.ktor.server.plugins.doublereceive.DoubleReceive
import io.ktor.server.plugins.statuspages.StatusPages
import io.ktor.server.plugins.statuspages.exception
import io.ktor.server.request.httpMethod
import io.ktor.server.response.respond
import io.ktor.server.response.respondText
import io.ktor.server.routing.Route
import io.ktor.server.routing.get
import io.ktor.server.routing.routing
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import org.flywaydb.core.Flyway
import org.jetbrains.exposed.v1.jdbc.transactions.transaction
import org.koin.core.Koin
import org.koin.dsl.module
import org.koin.ktor.ext.getKoin
import org.koin.ktor.plugin.Koin
import org.koin.logger.slf4jLogger
import java.sql.DriverManager
import java.time.Instant
import java.util.UUID
import com.dsbuilder.ds.components.application.ListDesignSystemComponentsUseCase as ListComponentLinksUseCase

/** Starts ds-service on `DS_SERVICE_PORT`, defaulting to 8085. */
fun main() {
    val configuration = DsServiceConfiguration.fromEnvironment()
    embeddedServer(Netty, port = configuration.port) { module(configuration) }.start(wait = true)
}

/** Installs the DS runtime and HTTP endpoints. */
fun Application.module(configuration: DsServiceConfiguration = DsServiceConfiguration.fromEnvironment()) {
    val runtime = createRuntime(configuration)
    monitor.subscribe(ApplicationStopped) { runtime.databasePool.close() }
    val json = Json {
        ignoreUnknownKeys = false
        explicitNulls = true
    }
    installDependencyGraph(configuration, runtime)
    installHttpPlugins(json, runtime.metrics)
    installServiceRoutes(runtime, json)
}

private fun Application.installDependencyGraph(configuration: DsServiceConfiguration, runtime: DsRuntime) {
    install(Koin) {
        slf4jLogger()
        modules(
            module {
                single { configuration }
                single { runtime.database }
                single { runtime.evaluator }
                single { runtime.accessPolicy }
                single<TransactionRunner> {
                    ExposedTransactionRunner(
                        runtime.database,
                        PostgresTransactionFailureMapper(),
                    )
                }
                single<Clock> { Clock(Instant::now) }
                single<IdGenerator> { IdGenerator(UUID::randomUUID) }
            },
            designSystemsModule,
            themesModule,
            tokensModule,
            componentsModule,
            componentModelModule,
        )
    }
}

private fun Application.installHttpPlugins(json: Json, metrics: DsMetrics) {
    val applicationLog = environment.log
    val validationErrors = LegacyValidationErrorFactory(OpenApiDocumentResource(json).create())
    install(CallId) {
        header("X-Correlation-Id")
        verify(String::isNotBlank)
        generate { UUID.randomUUID().toString() }
        replyToHeader("X-Correlation-Id")
    }
    install(DsObservability) { this.metrics = metrics }
    install(DoubleReceive)
    intercept(ApplicationCallPipeline.Setup) {
        context.installLegacyValidationError { validationErrors.invalidBody(context) }
    }
    install(CallLogging) {
        callIdMdc("correlationId")
        format { call ->
            val status = call.response.status()?.value ?: 500
            val actorType = call.request.headers["X-Actor-Type"].orEmpty().jsonLogValue()
            val projectId = call.request.headers["X-Project-Id"].orEmpty().jsonLogValue()
            "{\"event\":\"http_request\",\"correlationId\":\"${call.callId.orEmpty().jsonLogValue()}\"," +
                "\"method\":\"${call.request.httpMethod.value}\"," +
                "\"route\":\"${call.routeTemplate().jsonLogValue()}\"," +
                "\"permission\":\"${call.routePermission().jsonLogValue()}\"," +
                "\"outcome\":\"${call.requestOutcome().jsonLogValue()}\"," +
                "\"durationMs\":${call.requestDurationMillis()}," +
                "\"actorType\":\"$actorType\",\"projectId\":\"$projectId\",\"status\":$status}"
        }
    }
    install(ContentNegotiation) {
        json(json)
    }
    install(StatusPages) {
        exception<BadRequestException> { call, cause ->
            call.markDsFailureOutcome("invalid_request")
            val error = validationErrors.fromBadRequest(call, cause)
            call.respond(HttpStatusCode.BadRequest, error?.let(::ErrorResponse) ?: ErrorResponse("Invalid request"))
        }
        exception<Throwable> { call, cause ->
            applicationLog.error("Unhandled request failure", cause)
            call.markDsFailureOutcome("technical_failure")
            call.respond(HttpStatusCode.InternalServerError, ErrorResponse("Internal server error"))
        }
    }
}

private fun Application.installServiceRoutes(runtime: DsRuntime, json: Json) {
    routing {
        registerHealthRoutes(runtime)
        get("/openapi.json") { call.respond(OpenApiDocumentResource(json).create()) }
        get("/metrics") {
            call.respondText(runtime.metrics.render(runtime.databasePool), ContentType.Text.Plain)
        }
        val koin = getKoin()
        registerDesignSystemFeature(runtime, json, koin)
        registerThemesFeature(runtime, json, koin)
        registerTokensFeature(runtime, json, koin)
        registerComponentsFeature(runtime, json, koin)
    }
}

@Suppress("LongMethod")
private fun Route.registerComponentsFeature(runtime: DsRuntime, json: Json, koin: Koin) {
    componentConfigRoutes(
        runtime.evaluator,
        koin.get<GetComponentConfigUseCase>(),
        koin.get<ImportComponentConfigUseCase>(),
        koin.get<ExportComponentConfigUseCase>(),
    )
    componentRoutes(
        runtime.evaluator,
        koin.get<ListComponentsUseCase>(),
        koin.get<GetComponentUseCase>(),
        koin.get<CreateComponentUseCase>(),
        koin.get<UpdateComponentUseCase>(),
        koin.get<DeleteComponentUseCase>(),
        koin.get<ListComponentVariationsUseCase>(),
        koin.get<ListComponentPropertiesUseCase>(),
        koin.get<ListDependenciesByComponentUseCase>(),
        json,
    )
    designSystemComponentRoutes(
        runtime.evaluator,
        koin.get<ListComponentLinksUseCase>(),
        koin.get<GetDesignSystemComponentUseCase>(),
        koin.get<CreateDesignSystemComponentUseCase>(),
        koin.get<DeleteDesignSystemComponentUseCase>(),
    )
    componentDependencyRoutes(
        runtime.evaluator,
        koin.get<ListComponentDependenciesUseCase>(),
        koin.get<GetComponentDependencyUseCase>(),
        koin.get<CreateComponentDependencyUseCase>(),
        koin.get<UpdateComponentDependencyUseCase>(),
        koin.get<DeleteComponentDependencyUseCase>(),
        json,
    )
    componentReuseConfigRoutes(
        runtime.evaluator,
        koin.get<ListComponentReuseConfigsUseCase>(),
        koin.get<GetComponentReuseConfigUseCase>(),
        koin.get<ListComponentReuseConfigsByDependencyUseCase>(),
        koin.get<CreateComponentReuseConfigUseCase>(),
        koin.get<UpdateComponentReuseConfigUseCase>(),
        koin.get<DeleteComponentReuseConfigUseCase>(),
    )
    variationRoutes(
        runtime.evaluator,
        koin.get<ListVariationsUseCase>(),
        koin.get<GetVariationUseCase>(),
        koin.get<CreateVariationUseCase>(),
        koin.get<UpdateVariationUseCase>(),
        koin.get<DeleteVariationUseCase>(),
        koin.get<ListVariationStylesUseCase>(),
        koin.get<ListVariationPropertiesUseCase>(),
        json,
    )
    propertyRoutes(
        runtime.evaluator,
        koin.get<ListPropertiesUseCase>(),
        koin.get<GetPropertyUseCase>(),
        koin.get<CreatePropertyUseCase>(),
        koin.get<UpdatePropertyUseCase>(),
        koin.get<DeletePropertyUseCase>(),
        json,
    )
    propertyPlatformParamRoutes(
        runtime.evaluator,
        koin.get<ListPropertyPlatformParamsUseCase>(),
        koin.get<GetPropertyPlatformParamUseCase>(),
        koin.get<CreatePropertyPlatformParamUseCase>(),
        koin.get<UpdatePropertyPlatformParamUseCase>(),
        koin.get<DeletePropertyPlatformParamUseCase>(),
    )
    propertyVariationRoutes(
        runtime.evaluator,
        koin.get<ListPropertyVariationsUseCase>(),
        koin.get<GetPropertyVariationUseCase>(),
        koin.get<CreatePropertyVariationUseCase>(),
        koin.get<DeletePropertyVariationUseCase>(),
    )
    variationPlatformParamAdjustmentRoutes(
        runtime.evaluator,
        koin.get<ListVariationPlatformParamAdjustmentsUseCase>(),
        koin.get<GetVariationPlatformParamAdjustmentUseCase>(),
        koin.get<CreateVariationPlatformParamAdjustmentUseCase>(),
        koin.get<UpdateVariationPlatformParamAdjustmentUseCase>(),
        koin.get<DeleteVariationPlatformParamAdjustmentUseCase>(),
        json,
    )
    invariantPlatformParamAdjustmentRoutes(
        runtime.evaluator,
        koin.get<ListInvariantPlatformParamAdjustmentsUseCase>(),
        koin.get<GetInvariantPlatformParamAdjustmentUseCase>(),
        koin.get<CreateInvariantPlatformParamAdjustmentUseCase>(),
        koin.get<UpdateInvariantPlatformParamAdjustmentUseCase>(),
        koin.get<DeleteInvariantPlatformParamAdjustmentUseCase>(),
        json,
    )
    styleRoutes(
        runtime.evaluator,
        koin.get<ListStylesUseCase>(),
        koin.get<GetStyleUseCase>(),
        koin.get<ListStylesByVariationAndDesignSystemUseCase>(),
        koin.get<CreateStyleUseCase>(),
        koin.get<UpdateStyleUseCase>(),
        koin.get<DeleteStyleUseCase>(),
        json,
    )
    appearanceRoutes(
        runtime.evaluator,
        koin.get<ListAppearancesUseCase>(),
        koin.get<GetAppearanceUseCase>(),
        koin.get<CreateAppearanceUseCase>(),
        koin.get<UpdateAppearanceUseCase>(),
        koin.get<DeleteAppearanceUseCase>(),
        koin.get<ListAppearanceVariationAxesUseCase>(),
        json,
    )
    appearanceVariationRoutes(
        runtime.evaluator,
        koin.get<ListAppearanceVariationsUseCase>(),
        koin.get<GetAppearanceVariationUseCase>(),
        koin.get<CreateAppearanceVariationUseCase>(),
        koin.get<UpdateAppearanceVariationUseCase>(),
        koin.get<DeleteAppearanceVariationUseCase>(),
        json,
    )
    appearanceVariationValueRoutes(
        runtime.evaluator,
        koin.get<ListAppearanceVariationValuesUseCase>(),
        koin.get<GetAppearanceVariationValueUseCase>(),
        koin.get<CreateAppearanceVariationValueUseCase>(),
        koin.get<UpdateAppearanceVariationValueUseCase>(),
        koin.get<DeleteAppearanceVariationValueUseCase>(),
        json,
    )
    variationPropertyValueRoutes(
        runtime.evaluator,
        koin.get<ListVariationPropertyValuesUseCase>(),
        koin.get<GetVariationPropertyValueUseCase>(),
        koin.get<ListVariationPropertyValuesByStyleUseCase>(),
        koin.get<ListVariationPropertyValuesByAppearanceUseCase>(),
        koin.get<CreateVariationPropertyValueUseCase>(),
        koin.get<UpdateVariationPropertyValueUseCase>(),
        koin.get<DeleteVariationPropertyValueUseCase>(),
        json,
    )
    invariantPropertyValueRoutes(
        runtime.evaluator,
        koin.get<ListInvariantPropertyValuesUseCase>(),
        koin.get<GetInvariantPropertyValueUseCase>(),
        koin.get<ListInvariantPropertyValuesByComponentAndDesignSystemUseCase>(),
        koin.get<CreateInvariantPropertyValueUseCase>(),
        koin.get<UpdateInvariantPropertyValueUseCase>(),
        koin.get<DeleteInvariantPropertyValueUseCase>(),
        json,
    )
    stateRoutes(
        runtime.evaluator,
        koin.get<ListStatesUseCase>(),
        koin.get<GetStateUseCase>(),
        koin.get<GetStateImpactUseCase>(),
        koin.get<CreateStateUseCase>(),
        koin.get<UpdateStateUseCase>(),
        koin.get<DeleteStateUseCase>(),
        json,
    )
    stateSetRoutes(
        runtime.evaluator,
        koin.get<ListStateSetsUseCase>(),
        koin.get<GetStateSetUseCase>(),
        koin.get<ResolveStateSetUseCase>(),
    )
    styleCombinationRoutes(
        runtime.evaluator,
        koin.get<ListStyleCombinationsUseCase>(),
        koin.get<GetStyleCombinationUseCase>(),
        koin.get<CreateStyleCombinationUseCase>(),
        koin.get<UpdateStyleCombinationUseCase>(),
        koin.get<DeleteStyleCombinationUseCase>(),
        koin.get<ListMembersByStyleCombinationUseCase>(),
        koin.get<AddStyleCombinationMemberUseCase>(),
        json,
    )
    styleCombinationMemberRoutes(
        runtime.evaluator,
        koin.get<ListStyleCombinationMembersUseCase>(),
        koin.get<GetStyleCombinationMemberUseCase>(),
        koin.get<CreateStyleCombinationMemberUseCase>(),
        koin.get<DeleteStyleCombinationMemberUseCase>(),
    )
}

private fun Route.registerHealthRoutes(runtime: DsRuntime) {
    get("/health") { call.respond(HealthResponse("ok")) }
    get("/ready") {
        val databaseReady = runCatching {
            transaction(runtime.database) { exec("SELECT 1") }
        }.isSuccess
        val response = ReadinessResponse(
            status = if (databaseReady) "ready" else "not-ready",
            database = databaseReady,
            flyway = runtime.flywayValidated,
            applicationRegistered = runtime.policyCoverageValid,
            policyVersion = runtime.accessPolicy.diagnostics.policyVersion,
            policySha256 = runtime.accessPolicy.diagnostics.contentSha256,
        )
        val ready = databaseReady && runtime.flywayValidated && runtime.policyCoverageValid
        call.respond(if (ready) HttpStatusCode.OK else HttpStatusCode.ServiceUnavailable, response)
    }
}

private fun Route.registerDesignSystemFeature(runtime: DsRuntime, json: Json, koin: Koin) {
    designSystemRoutes(
        runtime.evaluator,
        koin.get<ListDesignSystemsUseCase>(),
        koin.get<GetDesignSystemUseCase>(),
        koin.get<CreateDesignSystemUseCase>(),
        koin.get<UpdateDesignSystemUseCase>(),
        koin.get<DeleteDesignSystemUseCase>(),
        koin.get<ListDesignSystemComponentsUseCase>(),
        koin.get<ListDesignSystemTokensUseCase>(),
        koin.get<ListDesignSystemComponentStylesUseCase>(),
        koin.get<ListDesignSystemTenantsUseCase>(),
        koin.get<ListDesignSystemAppearancesUseCase>(),
        json,
    )
    designSystemVersionRoutes(
        runtime.evaluator,
        koin.get<ListDesignSystemVersionsUseCase>(),
        koin.get<GetDesignSystemVersionUseCase>(),
        koin.get<ListVersionsByDesignSystemUseCase>(),
        koin.get<CreateDesignSystemVersionUseCase>(),
        koin.get<UpdateDesignSystemVersionUseCase>(),
        koin.get<DeleteDesignSystemVersionUseCase>(),
        json,
    )
    designSystemChangeRoutes(
        runtime.evaluator,
        koin.get<ListDesignSystemChangeEntriesUseCase>(),
        koin.get<GetDesignSystemChangeUseCase>(),
        koin.get<ListChangesByDesignSystemUseCase>(),
        koin.get<CreateDesignSystemChangeUseCase>(),
    )
}

private fun Route.registerThemesFeature(runtime: DsRuntime, json: Json, koin: Koin) {
    tenantRoutes(
        runtime.evaluator,
        koin.get<ListTenantsUseCase>(),
        koin.get<GetTenantUseCase>(),
        koin.get<CreateTenantUseCase>(),
        koin.get<UpdateTenantUseCase>(),
        koin.get<DeleteTenantUseCase>(),
        koin.get<GetTenantTokenValuesUseCase>(),
        koin.get<SaveTenantTokenValuesUseCase>(),
        json,
    )
}

private fun Route.registerTokensFeature(runtime: DsRuntime, json: Json, koin: Koin) {
    tokenRoutes(
        runtime.evaluator,
        koin.get<ListTokensUseCase>(),
        koin.get<GetTokenUseCase>(),
        koin.get<CreateTokenUseCase>(),
        koin.get<UpdateTokenUseCase>(),
        koin.get<DeleteTokenUseCase>(),
        koin.get<GetTokenValuesUseCase>(),
        json,
    )
    tokenValueRoutes(
        runtime.evaluator,
        koin.get<ListTokenValuesUseCase>(),
        koin.get<GetTokenValueUseCase>(),
        koin.get<CreateTokenValueUseCase>(),
        koin.get<UpdateTokenValueUseCase>(),
        koin.get<DeleteTokenValueUseCase>(),
        json,
    )
    paletteRoutes(
        runtime.evaluator,
        koin.get<ListPaletteUseCase>(),
        koin.get<GetPaletteEntryUseCase>(),
        koin.get<ListPaletteByTypeUseCase>(),
        koin.get<CreatePaletteEntryUseCase>(),
        koin.get<UpdatePaletteEntryUseCase>(),
        koin.get<DeletePaletteEntryUseCase>(),
    )
}

private fun createRuntime(configuration: DsServiceConfiguration): DsRuntime {
    val loadedPolicy = AuthorizationPolicyLoader.load(configuration.authorizationPolicyPath)
    val manifestPermissions = OpenApiDocumentResource(Json.Default).permissions()
    val missingPermissions = manifestPermissions - loadedPolicy.policy.permissions.toSet()
    check(missingPermissions.isEmpty()) {
        "Authorization policy does not define manifest permissions: ${missingPermissions.sorted().joinToString()}"
    }
    val evaluator = PolicyEvaluator(loadedPolicy)
    val databasePool = PostgresDatabasePool.create(
        configuration.databaseUrl,
        configuration.databaseUser,
        configuration.databasePassword,
        configuration.databasePoolSize,
        configuration.databaseConnectionTimeoutMs,
    )
    val flyway = Flyway.configure()
        .dataSource(configuration.databaseUrl, configuration.databaseUser, configuration.databasePassword)
        .locations("classpath:db/migration")
        .validateMigrationNaming(true)
        .load()
    if (configuration.adoptExistingSchema) {
        val expectedFingerprint = requireNotNull(configuration.expectedSchemaFingerprint) {
            "DS_EXPECTED_SCHEMA_SHA256 is required when adoption is enabled"
        }
        DriverManager.getConnection(
            configuration.databaseUrl,
            configuration.databaseUser,
            configuration.databasePassword,
        ).use { connection ->
            ExistingDatabaseAdopter(SchemaFingerprintCalculator()).adopt(connection, flyway, expectedFingerprint)
        }
    }
    val migration = if (configuration.runFlyway) {
        flyway.migrate()
    } else {
        null
    }
    val flywayValidated = configuration.runFlyway && flyway.validateWithResult().validationSuccessful
    check(!configuration.runFlyway || flywayValidated) { "Flyway validation failed" }
    return DsRuntime(
        databasePool,
        evaluator,
        DsAccessPolicy(evaluator),
        DsMetrics(),
        migration,
        flywayValidated,
        policyCoverageValid = true,
    )
}

private fun String.jsonLogValue(): String =
    replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", "\\n").take(512)

@Serializable
private data class HealthResponse(val status: String)

@Serializable
private data class ReadinessResponse(
    val status: String,
    val database: Boolean,
    val flyway: Boolean,
    val applicationRegistered: Boolean,
    val policyVersion: String,
    val policySha256: String,
)
