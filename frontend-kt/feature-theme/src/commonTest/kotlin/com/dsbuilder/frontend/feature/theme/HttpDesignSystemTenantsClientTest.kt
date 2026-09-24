package com.dsbuilder.frontend.feature.theme

import com.dsbuilder.frontend.core.auth.BackendCredential
import com.dsbuilder.frontend.core.network.KtorAuthenticatedHttpClientFactory
import com.dsbuilder.frontend.feature.theme.application.DesignSystemTenant
import com.dsbuilder.frontend.feature.theme.application.DesignSystemTenantsErrorCode
import com.dsbuilder.frontend.feature.theme.application.DesignSystemTenantsResult
import com.dsbuilder.frontend.feature.theme.data.HttpDesignSystemTenantsClient
import io.ktor.client.HttpClient
import io.ktor.client.engine.mock.MockEngine
import io.ktor.client.engine.mock.respond
import io.ktor.http.HttpStatusCode
import kotlinx.coroutines.test.runTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertIs

class HttpDesignSystemTenantsClientTest {
    private fun client(
        status: HttpStatusCode,
        body: String,
        onPath: (String) -> Unit = {},
    ): HttpDesignSystemTenantsClient {
        val engine = MockEngine { request ->
            onPath(request.url.encodedPath)
            respond(body, status)
        }
        return HttpDesignSystemTenantsClient(KtorAuthenticatedHttpClientFactory { HttpClient(engine) })
    }

    private val credential = BackendCredential.Bearer("token")

    @Test
    fun parsesTenantsFromDesignSystemScopedPath() = runTest {
        var path = ""
        val result = client(
            HttpStatusCode.OK,
            """[{"id":"t1","designSystemId":"ds1","name":"sdds_cs","description":null}]""",
        ) { path = it }.listTenants("https://gw", credential, "p1", "ds1")

        assertEquals("/api/projects/p1/ds/design-systems/ds1/tenants", path)
        assertIs<DesignSystemTenantsResult.Success>(result)
        assertEquals(listOf(DesignSystemTenant("t1", "sdds_cs", null)), result.tenants)
    }

    @Test
    fun mapsUnauthorizedAndMalformedBody() = runTest {
        val unauthorized = client(HttpStatusCode.Unauthorized, "").listTenants("https://gw", credential, "p", "d")
        assertIs<DesignSystemTenantsResult.Failed>(unauthorized)
        assertEquals(DesignSystemTenantsErrorCode.AUTH_REQUIRED, unauthorized.code)

        val malformed = client(HttpStatusCode.OK, "nope").listTenants("https://gw", credential, "p", "d")
        assertIs<DesignSystemTenantsResult.Failed>(malformed)
        assertEquals(DesignSystemTenantsErrorCode.BACKEND_UNAVAILABLE, malformed.code)
    }
}
