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
    fun loginThemeIsPackagedAndScopedToInteractiveClient() {
        val realm = Json.parseToJsonElement(File(identity, "keycloak/dsbuilder-realm.json").readText()).jsonObject
        val clients = realm.getValue("clients").jsonArray.map { it.jsonObject }
        val themed = clients.filter { it["attributes"]?.jsonObject?.containsKey("login_theme") == true }
        assertEquals(listOf("dsbuilder-studio-plugin"), themed.map { it.getValue("clientId").jsonPrimitive.content })
        assertEquals(
            "dsbuilder",
            themed.single().getValue("attributes").jsonObject["login_theme"]?.jsonPrimitive?.content,
        )
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
        val bootstrap = File(identity, "keycloak/bootstrap-production-keycloak.sh").readText()
        val studioSettings = bootstrap.substringAfter("studio_plugin_client_id=").substringBefore("projects_client_id=")
        assertEquals(2, Regex("attributes.login_theme=dsbuilder").findAll(studioSettings).count())
        assertTrue(!bootstrap.substringBefore("studio_plugin_client_id=").contains("attributes.login_theme"))
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
        }
        val bootstrap = File(identity, "keycloak/bootstrap-production-keycloak.sh").readText()
        assertTrue(bootstrap.contains("studio_plugin_client_id=\"dsbuilder-studio-plugin\""))
        assertTrue(bootstrap.contains("studio_plugin_redirect_uri=\"http://127.0.0.1:*\""))
        assertTrue(bootstrap.contains("pkce.code.challenge.method"))
    }
}
