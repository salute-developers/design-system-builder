package com.dsbuilder.projects.feature.projects.data.keycloak

import io.ktor.server.config.ApplicationConfig
import kotlin.time.Duration
import kotlin.time.Duration.Companion.milliseconds

internal data class KeycloakIdentityLookupConfiguration(
    val baseUrl: String,
    val realm: String,
    val clientId: String,
    val clientSecret: String,
    val timeout: Duration,
)

internal fun ApplicationConfig.keycloakIdentityLookupConfiguration(): KeycloakIdentityLookupConfiguration =
    KeycloakIdentityLookupConfiguration(
        baseUrl = property("projects.identity.keycloak.baseUrl").getString().trimEnd('/'),
        realm = property("projects.identity.keycloak.realm").getString(),
        clientId = property("projects.identity.keycloak.clientId").getString(),
        clientSecret = property("projects.identity.keycloak.clientSecret").getString(),
        timeout = (propertyOrNull("projects.identity.keycloak.timeoutMs")?.getString()?.toLong() ?: 1_500L)
            .milliseconds,
    )
