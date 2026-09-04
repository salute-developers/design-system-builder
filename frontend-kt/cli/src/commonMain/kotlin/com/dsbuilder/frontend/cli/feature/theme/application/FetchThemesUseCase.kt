package com.dsbuilder.frontend.cli.feature.theme.application

import com.dsbuilder.frontend.cli.core.application.ProjectApiKeyProvider
import com.dsbuilder.frontend.cli.core.application.ProjectApiKeyResult
import com.dsbuilder.frontend.cli.core.application.ProjectApiUrlProvider
import com.dsbuilder.frontend.cli.core.application.ProjectContextReadResult
import com.dsbuilder.frontend.cli.core.application.ProjectContextReader
import com.dsbuilder.frontend.cli.core.domain.ProjectApiKey
import com.dsbuilder.frontend.cli.core.domain.ProjectApiUrl
import com.dsbuilder.frontend.cli.core.domain.ProjectContext
import com.dsbuilder.frontend.cli.feature.theme.domain.PaletteItem
import com.dsbuilder.frontend.cli.feature.theme.domain.Tenant
import com.dsbuilder.frontend.cli.feature.theme.domain.ThemeWritePlan
import com.dsbuilder.frontend.cli.feature.theme.domain.ThemeWritePlanBuildResult
import com.dsbuilder.frontend.cli.feature.theme.domain.ThemeWritePlanBuilder
import com.dsbuilder.frontend.cli.feature.theme.domain.Token
import com.dsbuilder.frontend.cli.feature.theme.domain.TokenValue

/**
 * Use case загрузки themes в локальную `.sdds` структуру.
 */
internal class FetchThemesUseCase(
    private val projectContextReader: ProjectContextReader,
    private val projectApiKeyProvider: ProjectApiKeyProvider,
    private val projectApiUrlProvider: ProjectApiUrlProvider,
    private val remoteThemeDataSource: RemoteThemeDataSource,
    private val writePlanBuilder: ThemeWritePlanBuilder,
    private val localThemeWriter: LocalThemeWriter,
) {
    fun execute(command: FetchThemesCommand): FetchThemesResult {
        val runtime = when (val result = resolveRuntime(command)) {
            is RuntimeResolutionResult.Failed -> return FetchThemesResult.Failed(result.message)
            is RuntimeResolutionResult.Resolved -> result.runtime
        }
        val remoteData = when (val result = fetchRemoteData(runtime)) {
            is RemoteDataLoadResult.Failed -> return FetchThemesResult.Failed(result.message)
            is RemoteDataLoadResult.Loaded -> result.remoteData
        }

        return when (val result = buildWritePlan(remoteData)) {
            is WritePlanResult.Failed -> FetchThemesResult.Failed(result.message)
            is WritePlanResult.Built -> writeLocalTheme(runtime, remoteData, result.writePlan)
        }
    }

    private fun buildWritePlan(remoteData: ThemeRemoteData): WritePlanResult =
        when (
            val result = writePlanBuilder.build(
                tenants = remoteData.tenants,
                tokens = remoteData.tokens,
                paletteItems = remoteData.paletteItems,
                valuesByTenantId = remoteData.valuesByTenantId,
            )
        ) {
            is ThemeWritePlanBuildResult.Failed -> WritePlanResult.Failed(result.message)
            is ThemeWritePlanBuildResult.Success -> WritePlanResult.Built(result.writePlan)
        }

    private fun writeLocalTheme(
        runtime: ThemeRuntime,
        remoteData: ThemeRemoteData,
        writePlan: ThemeWritePlan,
    ): FetchThemesResult =
        when (val result = localThemeWriter.write(runtime.context, writePlan)) {
            is LocalThemeWriteResult.Failed -> FetchThemesResult.Failed(result.message)
            LocalThemeWriteResult.Written -> FetchThemesResult.Fetched(
                tenantCount = remoteData.tenants.size,
                fileCount = writePlan.files.size,
                configPath = runtime.context.configPath,
            )
        }

    private fun resolveRuntime(command: FetchThemesCommand): RuntimeResolutionResult {
        val context = when (val result = projectContextReader.requireContext()) {
            is ProjectContextReadResult.Failed -> return RuntimeResolutionResult.Failed(result.message)
            is ProjectContextReadResult.Found -> result.context
        }
        val apiKey = when (
            val result = projectApiKeyProvider.resolve(
                override = command.apiKeyOverride,
                credentialEnvName = context.credentialEnvName,
            )
        ) {
            is ProjectApiKeyResult.Found -> result.value
            is ProjectApiKeyResult.Missing -> return RuntimeResolutionResult.Failed(result.message)
        }

        return RuntimeResolutionResult.Resolved(
            ThemeRuntime(
                context = context,
                apiUrl = projectApiUrlProvider.resolve(command.apiUrlOverride),
                apiKey = apiKey,
            ),
        )
    }

    private fun fetchRemoteData(runtime: ThemeRuntime): RemoteDataLoadResult {
        val remoteCommand = RemoteThemeCommand(
            context = runtime.context,
            apiUrl = runtime.apiUrl,
            apiKey = runtime.apiKey,
        )
        return when (val tenantsResult = fetchTenants(remoteCommand)) {
            is TenantsLoadResult.Failed -> RemoteDataLoadResult.Failed(tenantsResult.message)
            is TenantsLoadResult.Loaded -> fetchTokensAndValues(runtime, remoteCommand, tenantsResult.tenants)
        }
    }

    private fun fetchTokensAndValues(
        runtime: ThemeRuntime,
        remoteCommand: RemoteThemeCommand,
        tenants: List<Tenant>,
    ): RemoteDataLoadResult =
        when (val tokensResult = fetchTokens(remoteCommand)) {
            is TokensLoadResult.Failed -> RemoteDataLoadResult.Failed(tokensResult.message)
            is TokensLoadResult.Loaded -> fetchPaletteAndValues(
                runtime = runtime,
                remoteCommand = remoteCommand,
                tenants = tenants,
                tokens = tokensResult.tokens,
            )
        }

    private fun fetchPaletteAndValues(
        runtime: ThemeRuntime,
        remoteCommand: RemoteThemeCommand,
        tenants: List<Tenant>,
        tokens: List<Token>,
    ): RemoteDataLoadResult =
        when (val paletteResult = fetchPalette(remoteCommand)) {
            is PaletteLoadResult.Failed -> RemoteDataLoadResult.Failed(paletteResult.message)
            is PaletteLoadResult.Loaded -> fetchValuesAndBuildRemoteData(
                runtime = runtime,
                tenants = tenants,
                tokens = tokens,
                paletteItems = paletteResult.paletteItems,
            )
        }

    private fun fetchValuesAndBuildRemoteData(
        runtime: ThemeRuntime,
        tenants: List<Tenant>,
        tokens: List<Token>,
        paletteItems: List<PaletteItem>,
    ): RemoteDataLoadResult =
        when (val valuesResult = fetchTokenValues(runtime, tenants)) {
            is TenantValuesLoadResult.Failed -> RemoteDataLoadResult.Failed(valuesResult.message)
            is TenantValuesLoadResult.Loaded -> RemoteDataLoadResult.Loaded(
                ThemeRemoteData(
                    tenants = tenants,
                    tokens = tokens,
                    paletteItems = paletteItems,
                    valuesByTenantId = valuesResult.valuesByTenantId,
                ),
            )
        }

    private fun fetchTenants(command: RemoteThemeCommand): TenantsLoadResult =
        when (val result = remoteThemeDataSource.fetchTenants(command)) {
            is RemoteThemeResult.Failed -> TenantsLoadResult.Failed(result.message)
            is RemoteThemeResult.Success -> TenantsLoadResult.Loaded(result.value)
        }

    private fun fetchTokens(command: RemoteThemeCommand): TokensLoadResult =
        when (val result = remoteThemeDataSource.fetchTokens(command)) {
            is RemoteThemeResult.Failed -> TokensLoadResult.Failed(result.message)
            is RemoteThemeResult.Success -> TokensLoadResult.Loaded(result.value)
        }

    private fun fetchPalette(command: RemoteThemeCommand): PaletteLoadResult =
        when (val result = remoteThemeDataSource.fetchPalette(command)) {
            is RemoteThemeResult.Failed -> PaletteLoadResult.Failed(result.message)
            is RemoteThemeResult.Success -> PaletteLoadResult.Loaded(result.value)
        }

    private fun fetchTokenValues(
        runtime: ThemeRuntime,
        tenants: List<Tenant>,
    ): TenantValuesLoadResult {
        val valuesByTenantId = mutableMapOf<String, List<TokenValue>>()
        for (tenant in tenants) {
            val tenantValues = when (
                val result = remoteThemeDataSource.fetchTokenValues(
                    RemoteTenantThemeCommand(
                        context = runtime.context,
                        apiUrl = runtime.apiUrl,
                        apiKey = runtime.apiKey,
                        tenantId = tenant.id,
                    ),
                )
            ) {
                is RemoteThemeResult.Failed -> return TenantValuesLoadResult.Failed(result.message)
                is RemoteThemeResult.Success -> result.value
            }
            valuesByTenantId[tenant.id] = tenantValues
        }
        return TenantValuesLoadResult.Loaded(valuesByTenantId)
    }
}

private sealed interface WritePlanResult {
    data class Built(
        val writePlan: ThemeWritePlan,
    ) : WritePlanResult

    data class Failed(
        val message: String,
    ) : WritePlanResult
}

private data class ThemeRuntime(
    val context: ProjectContext,
    val apiUrl: ProjectApiUrl,
    val apiKey: ProjectApiKey,
)

private data class ThemeRemoteData(
    val tenants: List<Tenant>,
    val tokens: List<Token>,
    val paletteItems: List<PaletteItem>,
    val valuesByTenantId: Map<String, List<TokenValue>>,
)

private sealed interface RuntimeResolutionResult {
    data class Resolved(
        val runtime: ThemeRuntime,
    ) : RuntimeResolutionResult

    data class Failed(
        val message: String,
    ) : RuntimeResolutionResult
}

private sealed interface RemoteDataLoadResult {
    data class Loaded(
        val remoteData: ThemeRemoteData,
    ) : RemoteDataLoadResult

    data class Failed(
        val message: String,
    ) : RemoteDataLoadResult
}

private sealed interface TenantsLoadResult {
    data class Loaded(
        val tenants: List<Tenant>,
    ) : TenantsLoadResult

    data class Failed(
        val message: String,
    ) : TenantsLoadResult
}

private sealed interface TokensLoadResult {
    data class Loaded(
        val tokens: List<Token>,
    ) : TokensLoadResult

    data class Failed(
        val message: String,
    ) : TokensLoadResult
}

private sealed interface PaletteLoadResult {
    data class Loaded(
        val paletteItems: List<PaletteItem>,
    ) : PaletteLoadResult

    data class Failed(
        val message: String,
    ) : PaletteLoadResult
}

private sealed interface TenantValuesLoadResult {
    data class Loaded(
        val valuesByTenantId: Map<String, List<TokenValue>>,
    ) : TenantValuesLoadResult

    data class Failed(
        val message: String,
    ) : TenantValuesLoadResult
}

internal data class FetchThemesCommand(
    val apiKeyOverride: String?,
    val apiUrlOverride: String?,
)

internal sealed interface FetchThemesResult {
    data class Fetched(
        val tenantCount: Int,
        val fileCount: Int,
        val configPath: String,
    ) : FetchThemesResult

    data class Failed(
        val message: String,
    ) : FetchThemesResult
}
