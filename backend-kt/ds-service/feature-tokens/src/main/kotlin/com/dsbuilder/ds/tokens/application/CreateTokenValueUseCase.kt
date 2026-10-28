package com.dsbuilder.ds.tokens.application

import com.dsbuilder.authorization.ProjectScope
import com.dsbuilder.ds.core.application.DsAccessPolicy
import com.dsbuilder.ds.core.application.DsFailure
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.IdempotentCreateExecutor
import com.dsbuilder.ds.core.application.TokenValueWrite
import com.dsbuilder.ds.core.application.TokenValueWritePolicy
import com.dsbuilder.ds.core.application.TransactionRunner
import com.dsbuilder.ds.core.application.UniqueKeyLockRepository
import com.dsbuilder.ds.core.application.prepareAll
import com.dsbuilder.ds.tokens.domain.TokenValue

/**
 * Creates a token value only when its token belongs to the project. Правила [writePolicies] других фич проверяют
 * значение до записи, приводят его к хранимой форме и реагируют на запись в той же транзакции; вызываются только
 * после проверки принадлежности токена и темы проекту.
 *
 * Сохранённый результат повторяемого запроса ищется по ключу до проверок принадлежности и правил: повтор успешного
 * запроса возвращает исходный ответ `201`, даже если токен с тех пор удалён. Отпечаток запроса считается по исходной
 * команде, а не по хранимой форме значения: разные тела с одним ключом — конфликт повторного использования ключа.
 * Блокировки нового значения берутся в общем порядке: определения семейства, затем ключ уникальности значения.
 */
class CreateTokenValueUseCase(
    private val policy: DsAccessPolicy,
    private val transactions: TransactionRunner,
    private val repository: TokenValueRepository,
    private val repeatedCreates: IdempotentCreateExecutor,
    private val uniqueKeys: UniqueKeyLockRepository,
    private val writePolicies: List<TokenValueWritePolicy> = emptyList(),
) {
    /** Performs the execute operation. */
    suspend fun execute(
        context: DsRequestContext,
        command: CreateTokenValue,
        idempotencyKey: String? = null,
    ): DsResult<TokenValue> =
        when (val allowed = policy.require(context, ProjectScope.TOKENS_WRITE)) {
            is DsResult.Failure -> allowed
            is DsResult.Success -> transactions.required(context) {
                var prepared = command
                repeatedCreates.execute(
                    context = context,
                    key = idempotencyKey,
                    operation = "create-token-value",
                    requestBody = command,
                    find = { id -> repository.findAccessible(context.projectId, id) },
                    create = { create(context, prepared) },
                    id = TokenValue::id,
                    validateCreate = {
                        when (val result = validate(context, command)) {
                            is DsResult.Failure -> result.error
                            is DsResult.Success -> null.also { prepared = result.value }
                        }
                    },
                ).also { result ->
                    val tokenId = (result as? DsResult.Success)?.value?.tokenId
                    tokenId?.let { token -> writePolicies.forEach { it.afterWrite(token) } }
                }
            }
        }

    /**
     * Команда с хранимой формой значения или отказ. Принадлежность токена и темы проверяется до правил записи: они
     * читают тип токена, палитру темы и семейство, а отказ проверки значения не должен раскрывать чужой токен.
     */
    private suspend fun validate(context: DsRequestContext, command: CreateTokenValue): DsResult<CreateTokenValue> {
        val allowed = context.principal.systemAdmin || repository.createAllowed(context.projectId, command)
        if (!allowed) return DsResult.Failure(DsFailure.NotFound)
        val write = command.write() ?: return DsResult.Success(command)
        return when (val result = writePolicies.prepareAll(write)) {
            is DsResult.Failure -> result
            is DsResult.Success -> DsResult.Success(command.copy(value = result.value))
        }
    }

    private fun CreateTokenValue.write(): TokenValueWrite? {
        val token = tokenId ?: return null
        val tenant = tenantId ?: return null
        return platform?.let { TokenValueWrite(token, tenant, it.wireValue, paletteId != null, value) }
    }

    private suspend fun create(context: DsRequestContext, command: CreateTokenValue): TokenValue? {
        val tokenId = requireNotNull(command.tokenId)
        uniqueKeys.lock(
            tokenId,
            "token-value",
            "${command.tenantId}:${command.platform?.wireValue}:${command.mode?.wireValue}",
        )
        return if (context.principal.systemAdmin) {
            repository.createSystemAdmin(command)
        } else {
            repository.createOwned(context.projectId, command)
        }
    }
}
