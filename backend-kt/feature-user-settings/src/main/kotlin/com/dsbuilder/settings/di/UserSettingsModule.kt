package com.dsbuilder.settings.di

import com.dsbuilder.authorization.PolicyEvaluator
import com.dsbuilder.settings.application.PersonalAccessTokens
import com.dsbuilder.settings.application.TokenUseCases
import com.dsbuilder.settings.application.tokenScopeCatalog
import com.dsbuilder.settings.data.CachedAccountIdentityReader
import com.dsbuilder.settings.data.ExposedTokenRepository
import com.dsbuilder.settings.data.KeycloakAccountIdentityReader
import com.dsbuilder.settings.data.KeycloakIdentityConfiguration
import com.dsbuilder.settings.data.Sha256TokenSecretManager
import com.dsbuilder.settings.presentation.userSettingsRoutes
import com.zaxxer.hikari.HikariConfig
import com.zaxxer.hikari.HikariDataSource
import io.ktor.client.HttpClient
import io.ktor.client.engine.cio.CIO
import io.ktor.client.plugins.HttpTimeout
import io.ktor.client.plugins.contentnegotiation.ContentNegotiation
import io.ktor.http.Headers
import io.ktor.serialization.kotlinx.json.json
import io.ktor.server.application.ApplicationCall
import io.ktor.server.config.ApplicationConfig
import io.ktor.server.routing.Route
import kotlinx.serialization.json.Json
import org.flywaydb.core.Flyway
import org.jetbrains.exposed.v1.jdbc.Database
import java.time.Clock

/** Владеет ресурсами пользовательских настроек в существующем процессе backend. */
class UserSettingsModule(configuration: ApplicationConfig, evaluator: PolicyEvaluator) : AutoCloseable {
    private val pool = HikariDataSource(
        HikariConfig().apply {
            jdbcUrl = configuration.property("database.url").getString()
            username = configuration.property("database.username").getString()
            password = configuration.property("database.password").getString()
            maximumPoolSize = 4
            minimumIdle = 0
            poolName = "user-settings"
        },
    )
    private val database = Database.connect(pool)
    private val client = HttpClient(CIO) {
        install(ContentNegotiation) { json(Json { ignoreUnknownKeys = true }) }
        install(HttpTimeout) {
            requestTimeoutMillis = 1500
            connectTimeoutMillis = 1500
        }
    }
    private val scopes = evaluator.personalAccessTokenScopes()
    private val useCases = TokenUseCases(
        ExposedTokenRepository(database),
        Sha256TokenSecretManager(),
        CachedAccountIdentityReader(
            KeycloakAccountIdentityReader(
                KeycloakIdentityConfiguration(
                    configuration.property("projects.identity.keycloak.baseUrl").getString().trimEnd('/'),
                    configuration.property("projects.identity.keycloak.realm").getString(),
                    configuration.property("projects.identity.keycloak.clientId").getString(),
                    configuration.property("projects.identity.keycloak.clientSecret").getString(),
                ),
                client,
            ),
        ),
        scopes,
        Clock.systemUTC(),
    )

    /** Прикладная проверка токенов без доступа вызывающего к моделям хранения. */
    val tokens: PersonalAccessTokens get() = useCases

    /** Применяет собственные миграции до публикации API; исходная база проектов уже инициализирована. */
    fun initialize() {
        tokenScopeCatalog(scopes)
        Flyway.configure().dataSource(pool).table("user_settings_schema_history")
            .baselineOnMigrate(true).baselineVersion("0")
            .locations("classpath:dsbuilder/user-settings/migrations", "classpath:dsbuilder/projects/pat-migrations")
            .load().migrate()
    }

    /** Регистрирует API, принимающий только проверенный шлюзом контекст. */
    fun registerRoutes(route: Route, headers: (ApplicationCall) -> Headers) {
        route.userSettingsRoutes(useCases, scopes, headers)
    }

    /** Закрывает только собственные ресурсы. */
    override fun close() {
        client.close()
        pool.close()
        org.jetbrains.exposed.v1.jdbc.transactions.TransactionManager.closeAndUnregister(database)
    }
}
