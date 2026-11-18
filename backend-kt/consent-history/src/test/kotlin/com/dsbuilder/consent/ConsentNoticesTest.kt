package com.dsbuilder.consent

import com.dsbuilder.consent.application.sha256
import com.dsbuilder.consent.di.ConsentRuntime
import com.dsbuilder.consent.di.loadConsentPolicies
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull

class ConsentNoticesTest {
    @Test
    fun `веб использует сокращённую редакцию с хешем показанных байтов`() {
        val web = loadConsentPolicies().getValue("web")
        val expected = "Разрешить отправку аналитики для улучшения DS Builder? " +
            "Передаются просмотры разделов, cookies и технические данные браузера и устройства.\n"
        assertEquals("web-v2", web.version)
        assertEquals(expected, web.text)
        assertEquals(sha256(expected.toByteArray(Charsets.UTF_8)), web.sha256)
    }

    @Test
    fun `старая веб редакция сохранена а CLI использует прежний текст`() {
        val old = assertNotNull(ConsentRuntime::class.java.getResourceAsStream("/dsbuilder/consent/notices/web-v1.txt"))
            .use { it.readBytes().toString(Charsets.UTF_8) }
        assertEquals(true, old.contains("Яндекс Метрику"))
        assertEquals("cli_mcp-v1", loadConsentPolicies().getValue("cli_mcp").version)
    }
}
