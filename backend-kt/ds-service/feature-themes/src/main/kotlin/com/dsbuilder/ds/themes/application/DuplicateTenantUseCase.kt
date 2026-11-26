package com.dsbuilder.ds.themes.application

import com.dsbuilder.authorization.ProjectScope
import com.dsbuilder.ds.core.application.DsAccessPolicy
import com.dsbuilder.ds.core.application.DsFailure
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.IdempotentCreateExecutor
import com.dsbuilder.ds.core.application.TransactionRunner
import com.dsbuilder.ds.core.application.UniqueKeyLockRepository
import com.dsbuilder.ds.themes.application.palette.TenantPaletteRepository
import com.dsbuilder.ds.themes.application.tokengroups.TokenGroupRepository
import com.dsbuilder.ds.themes.domain.Tenant

/**
 * Создаёт тему копией существующей темы активного черновика: описание и профиль, значения всех токенов и палитра
 * переносятся в одной транзакции. Копия независима от исходной темы.
 */
class DuplicateTenantUseCase(
    private val policy: DsAccessPolicy,
    private val transactions: TransactionRunner,
    private val repository: TenantRepository,
    private val values: TenantTokenValueCopier,
    private val palette: TenantPaletteRepository,
    private val repeatedCreates: IdempotentCreateExecutor,
    private val uniqueKeys: UniqueKeyLockRepository,
    private val tokenGroups: TokenGroupRepository,
) {
    /** Возвращает созданную копию или отказ без частично созданной темы. */
    suspend fun execute(
        context: DsRequestContext,
        command: DuplicateTenant,
        idempotencyKey: String? = null,
    ): DsResult<Tenant> = when (val allowed = policy.require(context, ProjectScope.TENANTS_WRITE)) {
        is DsResult.Failure -> allowed
        is DsResult.Success -> if (command.name.isBlank()) {
            DsResult.Failure(DsFailure.InvalidRequest("invalid_body"))
        } else {
            duplicate(context, command, idempotencyKey)
        }
    }

    private suspend fun duplicate(
        context: DsRequestContext,
        command: DuplicateTenant,
        idempotencyKey: String?,
    ): DsResult<Tenant> = transactions.required(context) {
        // Повтор с тем же ключом возвращает сохранённую копию до проверок: исходную тему могли удалить позже.
        repeatedCreates.execute(
            context,
            idempotencyKey,
            "duplicate-tenant",
            command,
            { id -> repository.findAccessible(context.projectId, id) },
            { source(context, command)?.let { create(context, it, command.name) } },
            Tenant::id,
            validateCreate = {
                if (source(context, command) == null) {
                    DsFailure.NotFound
                } else {
                    nameConflict(
                        context,
                        command,
                    )
                }
            },
        )
    }

    private suspend fun source(context: DsRequestContext, command: DuplicateTenant): Tenant? =
        repository.findAccessible(context.projectId, command.sourceTenantId)
            ?.takeIf { it.designSystemId == command.designSystemId }

    private suspend fun create(context: DsRequestContext, source: Tenant, name: String): Tenant? {
        val tenant = repository.createOwned(
            context.projectId,
            CreateTenant(source.designSystemId, name, source.description, source.colorConfiguration),
        ) ?: return null
        values.copy(source, tenant)
        palette.copy(source.id, tenant.id)
        tokenGroups.initializeColor(tenant.designSystemId)
        // Превью копии считается по её значениям, поэтому тема перечитывается после копирования.
        return repository.findAccessible(context.projectId, tenant.id) ?: tenant
    }

    private suspend fun nameConflict(context: DsRequestContext, command: DuplicateTenant): DsFailure? {
        val normalizedName = command.name.trim().lowercase()
        uniqueKeys.lock(command.designSystemId, "tenant", normalizedName)
        return if (repository.nameExists(context.projectId, command.designSystemId, normalizedName)) {
            DsFailure.Conflict("TENANT_NAME_CONFLICT")
        } else {
            null
        }
    }
}
