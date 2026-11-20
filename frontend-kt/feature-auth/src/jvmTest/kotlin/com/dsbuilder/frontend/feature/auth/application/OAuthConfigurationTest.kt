package com.dsbuilder.frontend.feature.auth.application

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import java.io.File
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class OAuthConfigurationTest {
    private val root = generateSequence(File(".").absoluteFile) { it.parentFile }
        .first { File(it, "openspec/config.yaml").exists() }
    private val identity = File(root, "backend-kt/identity-gateway")

    @Test
    fun studioClientRemainsPublicWithPkceAudienceAndLoopbackAndWebIsUnchanged() {
        val realm = Json.parseToJsonElement(File(identity, "keycloak/dsbuilder-realm.json").readText()).jsonObject
        val clients = realm.getValue("clients").jsonArray.map { it.jsonObject }
        val studio = clients.single { it.getValue("clientId").jsonPrimitive.content == "dsbuilder-studio-plugin" }
        assertEquals("true", studio.getValue("publicClient").jsonPrimitive.content)
        assertEquals("false", studio.getValue("directAccessGrantsEnabled").jsonPrimitive.content)
        assertEquals("true", studio.getValue("standardFlowEnabled").jsonPrimitive.content)
        assertEquals(
            "S256",
            studio.getValue("attributes").jsonObject
                .getValue("pkce.code.challenge.method").jsonPrimitive.content,
        )
        assertTrue(studio.getValue("redirectUris").jsonArray.any { it.jsonPrimitive.content == "http://127.0.0.1:*" })
        val mappers = studio.getValue("protocolMappers").jsonArray.map { it.jsonObject }
        assertTrue(
            mappers.any {
                it.getValue("config").jsonObject["included.client.audience"]
                    ?.jsonPrimitive?.content == "dsbuilder-api"
            },
        )
        assertTrue(clients.any { it.getValue("clientId").jsonPrimitive.content == "dsbuilder-api" })
    }

    @Test
    fun loginThemeIsPackagedAndScopedToInteractiveClients() {
        val realm = Json.parseToJsonElement(File(identity, "keycloak/dsbuilder-realm.json").readText()).jsonObject
        val clients = realm.getValue("clients").jsonArray.map { it.jsonObject }
        val themed = clients.filter { it["attributes"]?.jsonObject?.containsKey("login_theme") == true }
        assertEquals(
            listOf("dsbuilder-figma-plugin", "dsbuilder-studio-plugin"),
            themed.map { it.getValue("clientId").jsonPrimitive.content }.sorted(),
        )
        themed.forEach { client ->
            assertEquals("dsbuilder", client.getValue("attributes").jsonObject["login_theme"]?.jsonPrimitive?.content)
        }
        assertTrue(!realm.containsKey("loginTheme"))
        val theme = File(identity, "keycloak/themes/dsbuilder/login")
        val properties = java.util.Properties().apply { File(theme, "theme.properties").reader().use { load(it) } }
        assertEquals("keycloak", properties.getProperty("parent"))
        assertEquals("css/login.css css/dsbuilder.css", properties.getProperty("styles"))
        val css = File(theme, "resources/css/dsbuilder.css").readText()
        Regex("url\\(\"([^\"]+)\"\\)").findAll(css).forEach { match ->
            assertTrue(File(theme, "resources/css/${match.groupValues[1]}").isFile)
        }
        assertTrue(File(identity, "keycloak/Dockerfile").readText().contains("/opt/keycloak/themes/dsbuilder"))
        assertTrue(
            File(root, "backend-kt/docker-compose.local.yml").readText().contains("/opt/keycloak/themes/dsbuilder:ro"),
        )
        val studioSettings = Json.parseToJsonElement(
            File(identity, "keycloak/studio-plugin-client.json").readText(),
        ).jsonObject
        assertEquals(
            "dsbuilder",
            studioSettings.getValue("attributes").jsonObject.getValue("login_theme").jsonPrimitive.content,
        )
    }

    @Test
    fun figmaPluginAsksConsentAndHasBoundedOfflineSession() {
        val realm = Json.parseToJsonElement(File(identity, "keycloak/dsbuilder-realm.json").readText()).jsonObject
        val plugin = realm.getValue("clients").jsonArray.map { it.jsonObject }
            .single { it.getValue("clientId").jsonPrimitive.content == "dsbuilder-figma-plugin" }
        assertEquals("true", plugin.getValue("consentRequired").jsonPrimitive.content)
        val attributes = plugin.getValue("attributes").jsonObject
        assertEquals("2592000", attributes["client.offline.session.idle.timeout"]?.jsonPrimitive?.content)
        assertEquals("7776000", attributes["client.offline.session.max.lifespan"]?.jsonPrimitive?.content)
        assertEquals("true", realm.getValue("offlineSessionMaxLifespanEnabled").jsonPrimitive.content)
        assertEquals("7776000", realm.getValue("offlineSessionMaxLifespan").jsonPrimitive.content)
        val production = Json.parseToJsonElement(
            File(identity, "keycloak/figma-plugin-client.json").readText(),
        ).jsonObject
        assertEquals("true", production.getValue("consentRequired").jsonPrimitive.content)
        assertEquals(attributes, production.getValue("attributes").jsonObject)
    }

    @Test
    fun localAndProductionGatewayKeepTokenLogoutAndRealmEndpoints() {
        for (name in listOf("nginx.local.conf", "nginx.prod.conf.template")) {
            val config = File(identity, "gateway/$name").readText()
            assertTrue(config.contains("location = /auth/token {"))
            assertTrue(config.contains("location = /auth/logout {"))
            assertTrue(config.contains("location /realms/ {"))
            assertTrue(config.contains("protocol/openid-connect/token"))
            assertTrue(config.contains("protocol/openid-connect/logout"))
            // gzip только в маршрутах дизайн-системы и только для JSON: SSE и аутентификация не сжимаются.
            val ds = config.substringAfter(
                "location ~ ^/api/projects/([^/]+)/design-systems(/.*)?$ {",
            ).substringBefore("\n        }")
            assertTrue(ds.contains("gzip on;") && ds.contains("gzip_types application/json;"), name)
            assertEquals(1, Regex("gzip on;").findAll(config).count(), name)
        }
        val studio = Json.parseToJsonElement(File(identity, "keycloak/studio-plugin-client.json").readText()).jsonObject
        assertEquals("dsbuilder-studio-plugin", studio.getValue("clientId").jsonPrimitive.content)
        assertEquals("http://127.0.0.1:*", studio.getValue("redirectUris").jsonArray.single().jsonPrimitive.content)
        assertEquals(
            "S256",
            studio.getValue("attributes").jsonObject.getValue("pkce.code.challenge.method").jsonPrimitive.content,
        )
    }
}
