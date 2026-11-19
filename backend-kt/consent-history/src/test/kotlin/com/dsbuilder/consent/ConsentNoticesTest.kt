package com.dsbuilder.consent

import com.dsbuilder.consent.application.sha256
import com.dsbuilder.consent.di.loadConsentPolicies
import kotlin.test.Test
import kotlin.test.assertEquals

class ConsentNoticesTest {
    @Test
    fun `веб использует сокращённую редакцию с хешем показанных байтов`() {
        val policies = loadConsentPolicies()
        val web = policies.getValue("web")
        val expected = "Разрешить отправку аналитики для улучшения DS Builder? " +
            "Передаются просмотры разделов, cookies и технические данные браузера и устройства.\n"
        assertEquals("web-v1", web.version)
        assertEquals(expected, web.text)
        assertEquals(sha256(expected.toByteArray(Charsets.UTF_8)), web.sha256)
        assertEquals("cli_mcp-v1", policies.getValue("cli_mcp").version)
    }
}
