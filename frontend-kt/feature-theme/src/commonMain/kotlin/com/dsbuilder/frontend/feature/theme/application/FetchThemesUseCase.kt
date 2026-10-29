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
import com.dsbuilder.frontend.feature.theme.domain.ThemeWritePlan
import com.dsbuilder.frontend.feature.theme.domain.ThemeWritePlanBuildResult
import com.dsbuilder.frontend.feature.theme.domain.ThemeWritePlanBuilder

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
    private val remoteLoader = ThemeRemoteDataLoader(remoteThemeDataSource)

    /**
     * Загружает themes и записывает их в локальную `.sdds` структуру.
     */
    public suspend fun execute(command: FetchThemesCommand): FetchThemesResult {
        val runtime = when (val result = resolveRuntime(command)) {
            is RuntimeResolutionResult.Failed -> return FetchThemesResult.Failed(result.message)
            is RuntimeResolutionResult.Resolved -> result.runtime
        }
        val remoteData = when (val result = remoteLoader.fetchRemoteData(runtime)) {
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
}

private sealed interface WritePlanResult {
    data class Built(
        val writePlan: ThemeWritePlan,
    ) : WritePlanResult

    data class Failed(
        val message: String,
    ) : WritePlanResult
}

internal data class ThemeRuntime(
    val context: ProjectContext,
    val apiUrl: ProjectApiUrl,
    val credential: BackendCredential,
)

private sealed interface RuntimeResolutionResult {
    data class Resolved(
        val runtime: ThemeRuntime,
    ) : RuntimeResolutionResult

    data class Failed(
        val message: String,
    ) : RuntimeResolutionResult
}

/**
 * Command model для [FetchThemesUseCase].
 *
 * @property apiKeyOverride runtime override из `--api-key`.
 * @property apiUrlOverride runtime API URL override.
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
