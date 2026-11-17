package com.dsbuilder.ai.chat.di

import com.dsbuilder.ai.chat.application.ChatToolContext
import com.dsbuilder.ai.chat.application.ChatToolExecutor
import com.dsbuilder.ai.chat.application.OwnershipCheck
import com.dsbuilder.ai.chat.data.tools.ChatToolCatalog
import com.dsbuilder.ai.chat.domain.ToolResult
import com.dsbuilder.authorization.ProjectPrincipal
import kotlinx.serialization.json.JsonObject
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertFalse
import kotlin.test.assertIs
import kotlin.test.assertTrue
import kotlin.time.Duration.Companion.seconds

class AiAssistantConfigurationTest {
    private fun read(vararg pairs: Pair<String, String>) = AiAssistantConfiguration.fromEnvironment(mapOf(*pairs)::get)

    @Test
    fun disabledIgnoresOtherVariablesEvenWhenBroken() {
        val configuration = read("AI_MAX_STEPS" to "many", "AI_EXTRA_BODY" to "{")
        assertEquals(AiAssistantConfiguration.DISABLED, configuration)
        assertEquals(AiAssistantConfiguration.DISABLED, read("AI_ENABLED" to "yes"))
    }

    @Test
    fun onlyKeyIsNeededForZaiDefaults() {
        val configuration = read("AI_ENABLED" to "true", "AI_API_KEY" to "key")
        val settings = assertIs<ProviderSettings.OpenAiCompatible>(configuration.providerSettings)

        assertEquals("https://api.z.ai/api/paas/v4", settings.baseUrl)
        assertEquals("glm-4.5-flash", settings.model)
        assertEquals(setOf("1234", "1305"), settings.retryErrorCodes)
        assertEquals("""{"thinking":{"type":"disabled"}}""", settings.extraBody.toString())
        assertEquals(30.seconds, configuration.limits!!.toolCallTimeout)
        assertEquals(64L * 1024 * 1024, configuration.limits!!.turnStoreMaxBytes)
    }

    @Test
    fun missingKeyAndBadNumbersNameTheVariableWithoutSecrets() {
        val missing = assertFailsWith<IllegalStateException> { read("AI_ENABLED" to "true") }
        assertTrue("AI_API_KEY" in missing.message.orEmpty())

        val number = assertFailsWith<IllegalStateException> {
            read("AI_ENABLED" to "true", "AI_API_KEY" to "secret-value", "AI_MAX_STEPS" to "many")
        }
        assertTrue("AI_MAX_STEPS" in number.message.orEmpty())
        assertFalse("secret-value" in number.message.orEmpty())

        val json = assertFailsWith<IllegalStateException> {
            read("AI_ENABLED" to "true", "AI_API_KEY" to "k", "AI_EXTRA_BODY" to "[1]")
        }
        assertTrue("AI_EXTRA_BODY" in json.message.orEmpty())
    }

    @Test
    fun gigachatHasCurrentDefaults() {
        val configuration = read("AI_ENABLED" to "true", "AI_PROVIDER" to "gigachat", "AI_GIGACHAT_AUTH_KEY" to "auth")
        val settings = assertIs<ProviderSettings.GigaChat>(configuration.providerSettings)

        assertEquals("https://api.giga.chat/v1", settings.baseUrl)
        assertEquals("https://ngw.devices.sberbank.ru:9443/api/v2/oauth", settings.oauthUrl)
        assertEquals("GIGACHAT_API_PERS", settings.scope)
        assertFalse("auth" in settings.toString().substringAfter("authKey"))
    }

    @Test
    fun secretsAreMaskedInToString() {
        val configuration = read("AI_ENABLED" to "true", "AI_API_KEY" to "very-secret-key")
        assertFalse("very-secret-key" in configuration.toString())
    }

    @Test
    fun incompatibleHistoryLimitFailsAtAssemblyWithBothNames() {
        val configuration = read("AI_ENABLED" to "true", "AI_API_KEY" to "k", "AI_HISTORY_MAX_CHARS" to "9000")
        val failure = assertFailsWith<IllegalStateException> {
            createAiAssistant(configuration, { _, _ -> OwnershipCheck.OWNED }, AllTools)
        }
        assertTrue("AI_HISTORY_MAX_CHARS" in failure.message.orEmpty())
        assertTrue("AI_MESSAGE_MAX_CHARS" in failure.message.orEmpty())
    }

    @Test
    fun defaultLimitsAssemble() {
        val configuration = read("AI_ENABLED" to "true", "AI_API_KEY" to "k")
        createAiAssistant(configuration, { _, _ -> OwnershipCheck.OWNED }, AllTools).close()
    }
}

/** Исполнитель со всеми инструментами каталога; в проверках сборки подсистемы не вызывается. */
private object AllTools : ChatToolExecutor {
    override val supportedTools = ChatToolCatalog.names

    override suspend fun execute(name: String, arguments: JsonObject, context: ChatToolContext) =
        ToolResult("", name, "{}", isError = false)

    override suspend fun activeDraftId(principal: ProjectPrincipal, designSystemId: String) = "draft"
}
