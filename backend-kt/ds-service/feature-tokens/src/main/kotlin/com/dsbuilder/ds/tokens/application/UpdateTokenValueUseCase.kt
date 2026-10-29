package com.dsbuilder.ds.tokens.application

import com.dsbuilder.authorization.ProjectScope
import com.dsbuilder.ds.core.application.DsAccessPolicy
import com.dsbuilder.ds.core.application.DsFailure
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.TokenValueWrite
import com.dsbuilder.ds.core.application.TokenValueWritePolicy
import com.dsbuilder.ds.core.application.TransactionRunner
import com.dsbuilder.ds.core.application.prepareAll
import com.dsbuilder.ds.tokens.domain.TokenValue
import java.util.UUID

/**
 * Updates a token value reachable through a project-owned token. Правила [writePolicies] других фич проверяют
 * итоговое значение до записи, приводят его к хранимой форме и реагируют на запись в той же транзакции.
 */
class UpdateTokenValueUseCase(
    private val policy: DsAccessPolicy,
    private val transactions: TransactionRunner,
    private val repository: TokenValueRepository,
    private val writePolicies: List<TokenValueWritePolicy> = emptyList(),
) {
    /** Performs the execute operation. */
    suspend fun execute(
        context: DsRequestContext,
        id: UUID,
        command: UpdateTokenValue,
    ): DsResult<TokenValue> = when (val allowed = policy.require(context, ProjectScope.TOKENS_WRITE)) {
        is DsResult.Failure -> allowed
        is DsResult.Success -> transactions.required(context) {
            when (val prepared = prepare(context, id, command)) {
                is DsResult.Failure -> prepared
                is DsResult.Success -> repository.updateOwned(context.projectId, id, prepared.value)
                    ?.also { updated ->
                        updated.tokenId?.let { token -> writePolicies.forEach { it.afterWrite(token) } }
                    }
                    ?.let { DsResult.Success(it) }
                    ?: DsResult.Failure(DsFailure.NotFound)
            }
        }
    }

    /** Команда с хранимой формой значения или отказ правила; без правил и без значения команда не меняется. */
    private suspend fun prepare(
        context: DsRequestContext,
        id: UUID,
        command: UpdateTokenValue,
    ): DsResult<UpdateTokenValue> {
        val changes = writePolicies.isNotEmpty() && (command.valuePresent || command.paletteIdPresent)
        if (!changes) return DsResult.Success(command)
        // Существующее значение блокируется до правил: они блокируют определения семейства. Порядок «значение,
        // затем определения» общий для изменения, удаления и отката существующего значения (TokenValueWritePolicy).
        if (!repository.lockOwned(context.projectId, id)) return DsResult.Failure(DsFailure.NotFound)
        val write = repository.findAccessible(context.projectId, id)?.write(command)
        return when (val result = write?.let { writePolicies.prepareAll(it) }) {
            null -> DsResult.Success(command)
            is DsResult.Failure -> result
            is DsResult.Success ->
                DsResult.Success(if (command.valuePresent) command.copy(value = result.value) else command)
        }
    }

    /** Итоговое значение после патча [command] или `null`, если у значения нет токена, темы или платформы. */
    private fun TokenValue.write(command: UpdateTokenValue): TokenValueWrite? {
        val token = tokenId ?: return null
        val tenant = tenantId ?: return null
        val paletteId = if (command.paletteIdPresent) command.paletteId else paletteId
        val value = if (command.valuePresent) command.value else value
        return platform?.let { TokenValueWrite(token, tenant, it.wireValue, paletteId != null, value) }
    }
}
