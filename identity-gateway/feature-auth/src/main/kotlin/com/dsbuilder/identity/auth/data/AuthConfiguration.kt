package com.dsbuilder.identity.auth.data

import com.dsbuilder.identity.auth.domain.model.ProjectRole
import io.ktor.server.config.ApplicationConfig
import kotlin.time.Duration
import kotlin.time.Duration.Companion.milliseconds

internal data class AuthConfiguration(
    val issuer: String,
    val audience: String,
    val jwksUrl: String,
    val projectAccess: ProjectAccessConfiguration,
)

internal sealed interface ProjectAccessConfiguration {
    data class Http(
        val baseUrl: String,
        val timeout: Duration,
        val internalApiKey: String,
    ) : ProjectAccessConfiguration

    data class AllowAuthenticated(
        val role: ProjectRole,
    ) : ProjectAccessConfiguration
}

internal fun ApplicationConfig.authConfiguration(): AuthConfiguration {
    val mode = propertyOrNull("auth.projectAccess.mode")?.getString() ?: PROJECT_ACCESS_MODE_ALLOW
    return AuthConfiguration(
        issuer = property("auth.keycloak.issuer").getString(),
        audience = property("auth.keycloak.audience").getString(),
        jwksUrl = property("auth.keycloak.jwksUrl").getString(),
        projectAccess = when (mode) {
            PROJECT_ACCESS_MODE_HTTP -> ProjectAccessConfiguration.Http(
                baseUrl = property("auth.projectAccess.baseUrl").getString().trimEnd('/'),
                timeout = (propertyOrNull("auth.projectAccess.timeoutMs")?.getString()?.toLong() ?: 1_500L)
                    .milliseconds,
                internalApiKey = property("auth.projectAccess.internalApiKey").getString(),
            )
            PROJECT_ACCESS_MODE_ALLOW -> ProjectAccessConfiguration.AllowAuthenticated(
                role = propertyOrNull("auth.projectAccess.defaultRole")
                    ?.getString()
                    ?.let { ProjectRole.valueOf(it.uppercase()) }
                    ?: ProjectRole.VIEWER,
            )
            else -> error("Unsupported auth.projectAccess.mode: $mode")
        },
    )
}

private const val PROJECT_ACCESS_MODE_HTTP = "http"
private const val PROJECT_ACCESS_MODE_ALLOW = "allow-authenticated"
