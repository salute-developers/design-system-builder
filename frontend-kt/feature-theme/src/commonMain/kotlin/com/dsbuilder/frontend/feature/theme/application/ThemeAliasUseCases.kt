package com.dsbuilder.frontend.feature.theme.application

import com.dsbuilder.frontend.core.workspace.ProjectConfig
import com.dsbuilder.frontend.core.workspace.ProjectConfigTenant

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
public class ListThemeAliasesUseCase internal constructor(
    private val repository: ThemeAliasConfigRepository,
) {
    /**
     * Возвращает tenants с локальными aliases из ближайшего project config.
     */
    public fun execute(): ThemeAliasListResult =
        when (val result = repository.readNearestConfig()) {
            is ThemeAliasConfigReadResult.Failed -> ThemeAliasListResult.Failed(result.message)
            is ThemeAliasConfigReadResult.Found -> ThemeAliasListResult.Listed(result.config.tenants)
        }
}

/**
 * Use case установки tenant alias.
 */
public class SetThemeAliasUseCase internal constructor(
    private val repository: ThemeAliasConfigRepository,
) {
    /**
     * Устанавливает локальный alias для tenant.
     */
    public fun execute(command: SetThemeAliasCommand): ThemeAliasMutationResult {
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
public class UnsetThemeAliasUseCase internal constructor(
    private val repository: ThemeAliasConfigRepository,
) {
    /**
     * Удаляет локальный alias tenant.
     */
    public fun execute(command: UnsetThemeAliasCommand): ThemeAliasMutationResult =
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
public data class SetThemeAliasCommand(
    public val tenantId: String,
    public val alias: String,
)

/**
 * Command удаления tenant alias.
 *
 * @property alias локальный alias.
 */
public data class UnsetThemeAliasCommand(
    public val alias: String,
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
public sealed interface ThemeAliasListResult {
    /**
     * Tenants найдены.
     *
     * @property tenants список tenants с локальными aliases.
     */
    public data class Listed(
        public val tenants: List<ProjectConfigTenant>,
    ) : ThemeAliasListResult

    /**
     * Вывод завершился ошибкой.
     *
     * @property message user-facing ошибка.
     */
    public data class Failed(
        public val message: String,
    ) : ThemeAliasListResult
}

/**
 * Результат изменения tenant alias.
 */
public sealed interface ThemeAliasMutationResult {
    /**
     * Alias изменен.
     *
     * @property message user-facing сообщение.
     */
    public data class Changed(
        public val message: String,
    ) : ThemeAliasMutationResult

    /**
     * Изменение завершилось ошибкой.
     *
     * @property message user-facing ошибка.
     */
    public data class Failed(
        public val message: String,
    ) : ThemeAliasMutationResult
}
