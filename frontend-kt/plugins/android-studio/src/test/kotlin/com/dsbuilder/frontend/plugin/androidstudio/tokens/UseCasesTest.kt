package com.dsbuilder.frontend.plugin.androidstudio.tokens

import kotlinx.coroutines.runBlocking
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull

private const val TENANT_A = "tenant-a"

private class FakeDesignSystemDataClient(
    private val designSystems: List<DesignSystem> = emptyList(),
    private val tokens: List<DesignToken> = emptyList(),
    private val tokenValues: List<TokenValue> = emptyList(),
) : DesignSystemDataClient {
    override suspend fun listDesignSystems(projectId: String): List<DesignSystem> = designSystems

    override suspend fun listTokens(projectId: String): List<DesignToken> = tokens

    override suspend fun listTokenValues(projectId: String): List<TokenValue> = tokenValues
}

class ListDesignSystemsUseCaseTest {
    @Test
    fun returnsDesignSystemsForProject() = runBlocking<Unit> {
        val designSystems = listOf(DesignSystem(id = "ds1", name = "sdds_serv", description = null))
        val useCase = ListDesignSystemsUseCase(FakeDesignSystemDataClient(designSystems = designSystems))

        assertEquals(designSystems, useCase.execute("project-a"))
    }
}

class GetDesignSystemTokensUseCaseTest {
    @Test
    fun joinsTokensWithMatchingPlatformValue() = runBlocking<Unit> {
        val token =
            DesignToken(
                id = "t1",
                designSystemId = "ds1",
                name = "surface.default.primary",
                type = TokenType.COLOR,
                displayName = null,
            )
        val otherDsToken =
            DesignToken(id = "t2", designSystemId = "ds2", name = "other", type = TokenType.COLOR, displayName = null)
        val webValue = TokenValue(
            id = "v1",
            tokenId = "t1",
            tenantId = TENANT_A,
            platform = TokenPlatform.WEB,
            mode = null,
            rawValue = "\"#FF0000\"",
        )
        val androidValue = TokenValue(
            id = "v2",
            tokenId = "t1",
            tenantId = TENANT_A,
            platform = TokenPlatform.ANDROID,
            mode = null,
            rawValue = "\"#00FF00\"",
        )

        val useCase = GetDesignSystemTokensUseCase(
            FakeDesignSystemDataClient(
                tokens = listOf(token, otherDsToken),
                tokenValues = listOf(webValue, androidValue),
            ),
        )

        val result = useCase.execute(
            projectId = "project-a",
            designSystemId = "ds1",
            platform = TokenPlatform.WEB,
            mode = TokenMode.LIGHT,
            tenantId = TENANT_A,
        )

        assertEquals(1, result.size)
        assertEquals(token, result.single().token)
        assertEquals(webValue, result.single().value)
    }

    @Test
    fun tokenWithoutValueForPlatformStillAppearsWithNullValue() = runBlocking<Unit> {
        val token =
            DesignToken(
                id = "t1",
                designSystemId = "ds1",
                name = "surface.default.primary",
                type = TokenType.COLOR,
                displayName = null,
            )

        val useCase = GetDesignSystemTokensUseCase(FakeDesignSystemDataClient(tokens = listOf(token)))

        val result = useCase.execute(
            projectId = "project-a",
            designSystemId = "ds1",
            platform = TokenPlatform.IOS,
            mode = TokenMode.LIGHT,
            tenantId = TENANT_A,
        )

        assertEquals(1, result.size)
        assertNull(result.single().value)
    }

    @Test
    fun prefersValueMatchingRequestedModeOverModeAgnosticValue() = runBlocking<Unit> {
        val token =
            DesignToken(
                id = "t1",
                designSystemId = "ds1",
                name = "surface.default",
                type = TokenType.COLOR,
                displayName = null,
            )
        val agnosticValue = TokenValue(
            id = "v1",
            tokenId = "t1",
            tenantId = TENANT_A,
            platform = TokenPlatform.ANDROID,
            mode = null,
            rawValue = "\"#000000\"",
        )
        val darkValue = TokenValue(
            id = "v2",
            tokenId = "t1",
            tenantId = TENANT_A,
            platform = TokenPlatform.ANDROID,
            mode = TokenMode.DARK,
            rawValue = "\"#FFFFFF\"",
        )

        val useCase = GetDesignSystemTokensUseCase(
            FakeDesignSystemDataClient(tokens = listOf(token), tokenValues = listOf(agnosticValue, darkValue)),
        )

        val result = useCase.execute(
            projectId = "project-a",
            designSystemId = "ds1",
            platform = TokenPlatform.ANDROID,
            mode = TokenMode.DARK,
            tenantId = TENANT_A,
        )

        assertEquals(darkValue, result.single().value)
    }

    @Test
    fun fallsBackToModeAgnosticValueWhenNoValueForRequestedMode() = runBlocking<Unit> {
        val token =
            DesignToken(
                id = "t1",
                designSystemId = "ds1",
                name = "spacing.s",
                type = TokenType.SPACING,
                displayName = null,
            )
        val agnosticValue = TokenValue(
            id = "v1",
            tokenId = "t1",
            tenantId = TENANT_A,
            platform = TokenPlatform.ANDROID,
            mode = null,
            rawValue = "8",
        )

        val useCase = GetDesignSystemTokensUseCase(
            FakeDesignSystemDataClient(tokens = listOf(token), tokenValues = listOf(agnosticValue)),
        )

        val result = useCase.execute(
            projectId = "project-a",
            designSystemId = "ds1",
            platform = TokenPlatform.ANDROID,
            mode = TokenMode.LIGHT,
            tenantId = TENANT_A,
        )

        assertEquals(agnosticValue, result.single().value)
    }

    @Test
    fun excludesValueForTheOtherMode() = runBlocking<Unit> {
        val token =
            DesignToken(
                id = "t1",
                designSystemId = "ds1",
                name = "surface.default",
                type = TokenType.COLOR,
                displayName = null,
            )
        val lightValue = TokenValue(
            id = "v1",
            tokenId = "t1",
            tenantId = TENANT_A,
            platform = TokenPlatform.ANDROID,
            mode = TokenMode.LIGHT,
            rawValue = "\"#FFFFFF\"",
        )

        val useCase = GetDesignSystemTokensUseCase(
            FakeDesignSystemDataClient(tokens = listOf(token), tokenValues = listOf(lightValue)),
        )

        val result = useCase.execute(
            projectId = "project-a",
            designSystemId = "ds1",
            platform = TokenPlatform.ANDROID,
            mode = TokenMode.DARK,
            tenantId = TENANT_A,
        )

        assertNull(result.single().value)
    }

    @Test
    fun excludesValueForAnotherTenant() = runBlocking<Unit> {
        val token =
            DesignToken(
                id = "t1",
                designSystemId = "ds1",
                name = "surface.default",
                type = TokenType.COLOR,
                displayName = null,
            )
        val otherTenantValue = TokenValue(
            id = "v1",
            tokenId = "t1",
            tenantId = "tenant-b",
            platform = TokenPlatform.ANDROID,
            mode = null,
            rawValue = "\"#000000\"",
        )
        val requestedTenantValue = TokenValue(
            id = "v2",
            tokenId = "t1",
            tenantId = TENANT_A,
            platform = TokenPlatform.ANDROID,
            mode = null,
            rawValue = "\"#FFFFFF\"",
        )

        val useCase = GetDesignSystemTokensUseCase(
            FakeDesignSystemDataClient(
                tokens = listOf(token),
                tokenValues = listOf(otherTenantValue, requestedTenantValue),
            ),
        )

        val result = useCase.execute(
            projectId = "project-a",
            designSystemId = "ds1",
            platform = TokenPlatform.ANDROID,
            mode = TokenMode.LIGHT,
            tenantId = TENANT_A,
        )

        assertEquals(requestedTenantValue, result.single().value)
    }
}
