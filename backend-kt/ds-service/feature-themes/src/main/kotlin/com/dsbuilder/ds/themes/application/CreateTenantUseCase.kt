package com.dsbuilder.ds.themes.application

import com.dsbuilder.authorization.ProjectScope
import com.dsbuilder.ds.core.application.DsAccessPolicy
import com.dsbuilder.ds.core.application.DsFailure
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.IdempotentCreateExecutor
import com.dsbuilder.ds.core.application.TransactionRunner
import com.dsbuilder.ds.core.application.UniqueKeyLockRepository
import com.dsbuilder.ds.themes.application.colortokens.ColorTokenRepository
import com.dsbuilder.ds.themes.application.palette.TenantPaletteRepository
import com.dsbuilder.ds.themes.application.tokengroups.TokenGroupRepository
import com.dsbuilder.ds.themes.domain.Tenant
import com.dsbuilder.ds.themes.domain.TenantTokenValueInput

/** Creates a theme only below an accessible design system, with token values and its own palette copy. */
class CreateTenantUseCase(
    private val policy: DsAccessPolicy,
    private val transactions: TransactionRunner,
    private val repository: TenantRepository,
    private val tokenValueInitializer: TenantTokenValueInitializer,
    private val paletteRepository: TenantPaletteRepository,
    private val repeatedCreates: IdempotentCreateExecutor,
    private val uniqueKeys: UniqueKeyLockRepository,
    private val tokenGroups: TokenGroupRepository,
    tokens: ColorTokenRepository,
) {
    private val checks = TenantTokenValueChecks(tokens, paletteRepository)

    /** Performs the execute operation. */
    suspend fun execute(
        context: DsRequestContext,
        command: CreateTenant,
        idempotencyKey: String? = null,
    ): DsResult<Tenant> = when (
        val allowed = policy.require(context, ProjectScope.TENANTS_WRITE)
    ) {
        is DsResult.Failure -> allowed
        is DsResult.Success -> if (command.initialValues.hasDuplicateKey()) {
            DsResult.Failure(DsFailure.InvalidRequest("invalid_body"))
        } else {
            create(context, command, idempotencyKey)
        }
    }

    private suspend fun create(
        context: DsRequestContext,
        command: CreateTenant,
        idempotencyKey: String?,
    ): DsResult<Tenant> = transactions.required(context) {
        // Отказ проверки переданных значений возвращается из транзакции и откатывает созданную тему.
        var rejected: DsFailure? = null
        val created = repeatedCreates.execute(
            context,
            idempotencyKey,
            "create-tenant",
            command,
            { id -> repository.findAccessible(context.projectId, id) },
            {
                repository.createOwned(context.projectId, command)?.let { tenant ->
                    rejected = initialize(tenant, command.initialValues)
                    tenant.takeIf { rejected == null }
                }
            },
            Tenant::id,
            validateCreate = {
                command.name?.let { name ->
                    val normalizedName = name.trim().lowercase()
                    uniqueKeys.lock(command.designSystemId, "tenant", normalizedName)
                    if (repository.nameExists(
                            context.projectId,
                            command.designSystemId,
                            normalizedName,
                        )
                    ) {
                        DsFailure.Conflict("TENANT_NAME_CONFLICT")
                    } else {
                        null
                    }
                }
            },
        )
        rejected?.let { DsResult.Failure(it) } ?: created
    }

    /**
     * Записывает начальные значения, палитру и цветовые группы новой темы. Возвращает отказ, если переданные значения
     * ссылаются на чужой токен или недопустимы для палитры темы.
     */
    private suspend fun initialize(tenant: Tenant, values: List<TenantTokenValueInput>): DsFailure? {
        if (!tokenValueInitializer.initialize(tenant, checks.storedForm(values))) {
            return DsFailure.InvalidRequest("invalid_tenant_token")
        }
        paletteRepository.initialize(tenant.id)
        tokenGroups.initializeColor(tenant.designSystemId)
        // Правило цветовых значений зависит от палитры темы, поэтому проверка идёт после её инициализации.
        return checks.colorViolation(tenant.id, values)
    }
}
