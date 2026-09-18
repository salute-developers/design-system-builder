package com.dsbuilder.frontend.feature.theme.application

import com.dsbuilder.frontend.core.application.CredentialProvider
import com.dsbuilder.frontend.core.application.CredentialRequest
import com.dsbuilder.frontend.core.application.CredentialResult
import com.dsbuilder.frontend.core.application.ProjectApiUrlProvider
import com.dsbuilder.frontend.core.application.ProjectContextReadResult
import com.dsbuilder.frontend.core.application.ProjectContextReader
import com.dsbuilder.frontend.core.auth.BackendCredential
import com.dsbuilder.frontend.core.domain.ProjectApiUrl
import com.dsbuilder.frontend.core.domain.ProjectContext
import com.dsbuilder.frontend.feature.theme.domain.PaletteItem
import com.dsbuilder.frontend.feature.theme.domain.Tenant
import com.dsbuilder.frontend.feature.theme.domain.ThemeWritePlan
import com.dsbuilder.frontend.feature.theme.domain.ThemeWritePlanBuildResult
import com.dsbuilder.frontend.feature.theme.domain.ThemeWritePlanBuilder
import com.dsbuilder.frontend.feature.theme.domain.Token
import com.dsbuilder.frontend.feature.theme.domain.TokenValue

/**
 * Use case загрузки themes в локальную `.sdds` структуру.
 */
public class FetchThemesUseCase internal constructor(
    private val projectContextReader: ProjectContextReader,
    private val credentialProvider: CredentialProvider,
    private val projectApiUrlProvider: ProjectApiUrlProvider,
    private val remoteThemeDataSource: RemoteThemeDataSource,
    private val writePlanBuilder: ThemeWritePlanBuilder,
    private val localThemeWriter: LocalThemeWriter,
) {
    /**
     * Загружает themes и записывает их в локальную `.sdds` структуру.
     */
    public suspend fun execute(command: FetchThemesCommand): FetchThemesResult {
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
            is WritePlanResult.Built -> writeLocalTheme(
                runtime,
                remoteData,
                result.writePlan,
                command.destinationDirectory,
            )
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
        destinationDirectory: String?,
    ): FetchThemesResult =
        when (val result = localThemeWriter.write(runtime.context, writePlan, destinationDirectory)) {
            is LocalThemeWriteResult.Failed -> FetchThemesResult.Failed(result.message)
            is LocalThemeWriteResult.Written -> FetchThemesResult.Fetched(
                tenantCount = remoteData.tenants.size,
                fileCount = writePlan.files.size,
                configPath = result.configPath,
            )
        }

    @Suppress("ReturnCount")
    private suspend fun resolveRuntime(command: FetchThemesCommand): RuntimeResolutionResult {
        val found = when (
            val result = projectContextReader.requireContext(null, command.designSystemUri, command.projectKeyEnvName)
        ) {
            is ProjectContextReadResult.Failed -> return RuntimeResolutionResult.Failed(result.message)
            is ProjectContextReadResult.Found -> result
        }
        val context = found.context
        if (context.configPath.isBlank() && command.destinationDirectory.isNullOrBlank()) {
            return RuntimeResolutionResult.Failed(
                "theme fetch requires --destination <directory> without a local .sdds/config.json.",
            )
        }
        if (context.configPath.isNotBlank() && command.destinationDirectory != null) {
            return RuntimeResolutionResult.Failed(
                "--destination is only supported with a design-system link outside local .sdds.",
            )
        }
        val apiUrl = projectApiUrlProvider.resolve(command.apiUrlOverride, found.projectEnvironment)
        val credential = when (
            val result = credentialProvider.resolve(
                CredentialRequest(
                    apiUrl,
                    command.apiKeyOverride,
                    context.credentialEnvName,
                    context.credentialPolicy,
                    found.projectEnvironment,
                ),
            )
        ) {
            is CredentialResult.Selected -> result.credential
            is CredentialResult.Failed -> return RuntimeResolutionResult.Failed(result.message)
        }

        return RuntimeResolutionResult.Resolved(
            ThemeRuntime(
                context = context,
                apiUrl = apiUrl,
                credential = credential,
            ),
        )
    }

    private suspend fun fetchRemoteData(runtime: ThemeRuntime): RemoteDataLoadResult {
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
    val credential: BackendCredential,
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

/**
 * Command model для [FetchThemesUseCase].
 *
 * @property apiKeyOverride runtime override из `--api-key`.
 * @property apiUrlOverride runtime override из `--api-url`.
 * @property designSystemUri явная ссылка на дизайн-систему.
 * @property projectKeyEnvName env-переменная ключа для явной ссылки.
 * @property destinationDirectory локальный каталог для загрузки без `.sdds`.
 */
public data class FetchThemesCommand(
    public val apiKeyOverride: String?,
    public val apiUrlOverride: String?,
    public val designSystemUri: String? = null,
    public val projectKeyEnvName: String? = null,
    public val destinationDirectory: String? = null,
)

/**
 * Результат загрузки themes.
 */
public sealed interface FetchThemesResult {
    /**
     * Themes загружены и записаны локально.
     *
     * @property tenantCount количество загруженных tenants.
     * @property fileCount количество записанных файлов.
     * @property configPath путь project config.
     */
    public data class Fetched(
        public val tenantCount: Int,
        public val fileCount: Int,
        public val configPath: String,
    ) : FetchThemesResult

    /**
     * Загрузка завершилась ошибкой.
     *
     * @property message user-facing ошибка.
     */
    public data class Failed(
        public val message: String,
    ) : FetchThemesResult
}
