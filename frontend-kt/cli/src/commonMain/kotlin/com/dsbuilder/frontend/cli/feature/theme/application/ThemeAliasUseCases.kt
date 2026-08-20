package com.dsbuilder.frontend.cli.feature.theme.application

import com.dsbuilder.frontend.cli.core.config.ProjectConfig
import com.dsbuilder.frontend.cli.core.config.ProjectConfigTenant

/**
 * Port доступа к локальному config для команд `theme alias`.
 */
internal interface ThemeAliasConfigRepository {
    /**
     * Читает ближайший project config.
     */
    fun readNearestConfig(): ThemeAliasConfigReadResult

    /**
     * Записывает обновленный project config.
     */
    fun writeConfig(
        configPath: String,
        config: ProjectConfig,
    ): ThemeAliasConfigWriteResult
}

/**
 * Use case вывода tenant aliases.
 */
internal class ListThemeAliasesUseCase(
    private val repository: ThemeAliasConfigRepository,
) {
    fun execute(): ThemeAliasListResult =
        when (val result = repository.readNearestConfig()) {
            is ThemeAliasConfigReadResult.Failed -> ThemeAliasListResult.Failed(result.message)
            is ThemeAliasConfigReadResult.Found -> ThemeAliasListResult.Listed(result.config.tenants)
        }
}

/**
 * Use case установки tenant alias.
 */
internal class SetThemeAliasUseCase(
    private val repository: ThemeAliasConfigRepository,
) {
    fun execute(command: SetThemeAliasCommand): ThemeAliasMutationResult {
        val alias = command.alias.trim()
        if (alias.isBlank()) {
            return ThemeAliasMutationResult.Failed("Error: Alias must not be blank.")
        }

        return when (val result = repository.readNearestConfig()) {
            is ThemeAliasConfigReadResult.Failed -> ThemeAliasMutationResult.Failed(result.message)
            is ThemeAliasConfigReadResult.Found -> setAlias(result, command.tenantId, alias)
        }
    }

    private fun setAlias(
        context: ThemeAliasConfigReadResult.Found,
        tenantId: String,
        alias: String,
    ): ThemeAliasMutationResult {
        val target = context.config.tenants.firstOrNull { it.id == tenantId }
            ?: return ThemeAliasMutationResult.Failed("Error: Tenant not found: $tenantId.")
        val duplicate = context.config.tenants
            .firstOrNull { tenant -> tenant.id != tenantId && tenant.alias == alias }
        if (duplicate != null) {
            return ThemeAliasMutationResult.Failed("Error: Alias already exists: $alias.")
        }

        val updatedTenants = context.config.tenants.map { tenant ->
            if (tenant.id == target.id) tenant.copy(alias = alias) else tenant
        }
        return when (
            val writeResult = repository.writeConfig(
                configPath = context.configPath,
                config = context.config.copy(tenants = updatedTenants),
            )
        ) {
            is ThemeAliasConfigWriteResult.Failed -> ThemeAliasMutationResult.Failed(writeResult.message)
            ThemeAliasConfigWriteResult.Written -> ThemeAliasMutationResult.Changed("Alias set: $alias -> $tenantId")
        }
    }
}

/**
 * Use case удаления tenant alias.
 */
internal class UnsetThemeAliasUseCase(
    private val repository: ThemeAliasConfigRepository,
) {
    fun execute(command: UnsetThemeAliasCommand): ThemeAliasMutationResult =
        when (val result = repository.readNearestConfig()) {
            is ThemeAliasConfigReadResult.Failed -> ThemeAliasMutationResult.Failed(result.message)
            is ThemeAliasConfigReadResult.Found -> unsetAlias(result, command.alias)
        }

    private fun unsetAlias(
        context: ThemeAliasConfigReadResult.Found,
        alias: String,
    ): ThemeAliasMutationResult {
        val target = context.config.tenants.firstOrNull { it.alias == alias }
            ?: return ThemeAliasMutationResult.Failed("Error: Alias not found: $alias.")
        val updatedTenants = context.config.tenants.map { tenant ->
            if (tenant.id == target.id) tenant.copy(alias = null) else tenant
        }

        return when (
            val writeResult = repository.writeConfig(
                configPath = context.configPath,
                config = context.config.copy(tenants = updatedTenants),
            )
        ) {
            is ThemeAliasConfigWriteResult.Failed -> ThemeAliasMutationResult.Failed(writeResult.message)
            ThemeAliasConfigWriteResult.Written -> ThemeAliasMutationResult.Changed("Alias unset: $alias")
        }
    }
}

/**
 * Command установки tenant alias.
 *
 * @property tenantId идентификатор tenant.
 * @property alias локальный alias.
 */
internal data class SetThemeAliasCommand(
    val tenantId: String,
    val alias: String,
)

/**
 * Command удаления tenant alias.
 *
 * @property alias локальный alias.
 */
internal data class UnsetThemeAliasCommand(
    val alias: String,
)

/**
 * Результат чтения config для alias-команд.
 */
internal sealed interface ThemeAliasConfigReadResult {
    data class Found(
        val configPath: String,
        val config: ProjectConfig,
    ) : ThemeAliasConfigReadResult

    data class Failed(
        val message: String,
    ) : ThemeAliasConfigReadResult
}

/**
 * Результат записи config для alias-команд.
 */
internal sealed interface ThemeAliasConfigWriteResult {
    data object Written : ThemeAliasConfigWriteResult

    data class Failed(
        val message: String,
    ) : ThemeAliasConfigWriteResult
}

/**
 * Результат вывода tenant aliases.
 */
internal sealed interface ThemeAliasListResult {
    data class Listed(
        val tenants: List<ProjectConfigTenant>,
    ) : ThemeAliasListResult

    data class Failed(
        val message: String,
    ) : ThemeAliasListResult
}

/**
 * Результат изменения tenant alias.
 */
internal sealed interface ThemeAliasMutationResult {
    data class Changed(
        val message: String,
    ) : ThemeAliasMutationResult

    data class Failed(
        val message: String,
    ) : ThemeAliasMutationResult
}
