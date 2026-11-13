package com.dsbuilder.frontend.feature.theme.application

import com.dsbuilder.frontend.feature.theme.domain.PaletteItem
import com.dsbuilder.frontend.feature.theme.domain.Tenant
import com.dsbuilder.frontend.feature.theme.domain.Token
import com.dsbuilder.frontend.feature.theme.domain.TokenValue

/** Загружает согласованный набор tenants, токенов, палитры и значений для локальной записи. */
internal class ThemeRemoteDataLoader(private val remoteThemeDataSource: RemoteThemeDataSource) {
    suspend fun fetchRemoteData(runtime: ThemeRuntime): RemoteDataLoadResult {
        val remoteCommand = RemoteThemeCommand(
            context = runtime.context,
            apiUrl = runtime.apiUrl,
            credential = runtime.credential,
        )
        return when (val tenantsResult = fetchTenants(remoteCommand)) {
            is TenantsLoadResult.Failed -> RemoteDataLoadResult.Failed(tenantsResult.message)
            is TenantsLoadResult.Loaded -> fetchTokensAndValues(runtime, remoteCommand, tenantsResult.tenants)
        }
    }

    private suspend fun fetchTokensAndValues(
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

    private suspend fun fetchPaletteAndValues(
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

    private suspend fun fetchValuesAndBuildRemoteData(
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

    private suspend fun fetchTenants(command: RemoteThemeCommand): TenantsLoadResult =
        when (val result = remoteThemeDataSource.fetchTenants(command)) {
            is RemoteThemeResult.Failed -> TenantsLoadResult.Failed(result.message)
            is RemoteThemeResult.Success -> TenantsLoadResult.Loaded(result.value)
        }

    private suspend fun fetchTokens(command: RemoteThemeCommand): TokensLoadResult =
        when (val result = remoteThemeDataSource.fetchTokens(command)) {
            is RemoteThemeResult.Failed -> TokensLoadResult.Failed(result.message)
            is RemoteThemeResult.Success -> TokensLoadResult.Loaded(result.value)
        }

    private suspend fun fetchPalette(command: RemoteThemeCommand): PaletteLoadResult =
        when (val result = remoteThemeDataSource.fetchPalette(command)) {
            is RemoteThemeResult.Failed -> PaletteLoadResult.Failed(result.message)
            is RemoteThemeResult.Success -> PaletteLoadResult.Loaded(result.value)
        }

    private suspend fun fetchTokenValues(
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
                        credential = runtime.credential,
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

internal data class ThemeRemoteData(
    val tenants: List<Tenant>,
    val tokens: List<Token>,
    val paletteItems: List<PaletteItem>,
    val valuesByTenantId: Map<String, List<TokenValue>>,
)

internal sealed interface RemoteDataLoadResult {
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
