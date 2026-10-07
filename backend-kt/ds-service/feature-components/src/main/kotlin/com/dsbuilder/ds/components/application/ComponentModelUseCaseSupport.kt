package com.dsbuilder.ds.components.application

import com.dsbuilder.authorization.ProjectScope
import com.dsbuilder.ds.core.application.DsAccessPolicy
import com.dsbuilder.ds.core.application.DsFailure
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.TransactionRunner

internal suspend fun <T> modelList(
    policy: DsAccessPolicy,
    transactions: TransactionRunner,
    context: DsRequestContext,
    block: suspend () -> T,
): DsResult<T> = policy.read(context, ProjectScope.COMPONENT_VARIATIONS_READ) {
    transactions.readOnly { DsResult.Success(block()) }
}

internal suspend fun <T : Any> modelFind(
    policy: DsAccessPolicy,
    transactions: TransactionRunner,
    context: DsRequestContext,
    block: suspend () -> T?,
): DsResult<T> = policy.read(context, ProjectScope.COMPONENT_VARIATIONS_READ) {
    transactions.readOnly { block()?.let { DsResult.Success(it) } ?: DsResult.Failure(DsFailure.NotFound) }
}

internal suspend fun <T> modelFindList(
    policy: DsAccessPolicy,
    transactions: TransactionRunner,
    context: DsRequestContext,
    block: suspend () -> List<T>?,
): DsResult<List<T>> = policy.read(context, ProjectScope.COMPONENT_VARIATIONS_READ) {
    transactions.readOnly {
        block()?.let { DsResult.Success(it) } ?: if (context.principal.systemAdmin) {
            DsResult.Success(emptyList())
        } else {
            DsResult.Failure(DsFailure.NotFound)
        }
    }
}

internal suspend fun <T : Any> modelMutate(
    policy: DsAccessPolicy,
    transactions: TransactionRunner,
    context: DsRequestContext,
    permission: String = ProjectScope.COMPONENT_VARIATIONS_WRITE,
    block: suspend () -> T?,
): DsResult<T> = policy.read(context, permission) {
    transactions.required { block()?.let { DsResult.Success(it) } ?: DsResult.Failure(DsFailure.NotFound) }
}

/** Как [modelMutate], но пересечение ролей осей превращает в конфликт и откатывает транзакцию. */
internal suspend fun <T : Any> modelMutateAxisRoles(
    policy: DsAccessPolicy,
    transactions: TransactionRunner,
    context: DsRequestContext,
    block: suspend () -> T?,
): DsResult<T> = policy.read(context, ProjectScope.COMPONENT_VARIATIONS_WRITE) {
    transactions.required {
        try {
            block()?.let { DsResult.Success(it) } ?: DsResult.Failure(DsFailure.NotFound)
        } catch (conflict: AxisRoleConflictException) {
            DsResult.Failure(DsFailure.Conflict(conflict.message.orEmpty()))
        }
    }
}

internal suspend fun modelDelete(
    policy: DsAccessPolicy,
    transactions: TransactionRunner,
    context: DsRequestContext,
    block: suspend () -> Boolean,
): DsResult<Unit> = policy.read(context, ProjectScope.COMPONENT_VARIATIONS_DELETE) {
    transactions.required {
        if (block()) DsResult.Success(Unit) else DsResult.Failure(DsFailure.NotFound)
    }
}

internal suspend fun <T : Any> systemAdminMutate(
    policy: DsAccessPolicy,
    transactions: TransactionRunner,
    context: DsRequestContext,
    permission: String = ProjectScope.COMPONENT_VARIATIONS_WRITE,
    block: suspend () -> T?,
): DsResult<T> = when {
    !context.principal.systemAdmin -> DsResult.Failure(DsFailure.Forbidden)
    else -> modelMutate(policy, transactions, context, permission, block)
}

internal suspend fun systemAdminDelete(
    policy: DsAccessPolicy,
    transactions: TransactionRunner,
    context: DsRequestContext,
    block: suspend () -> Boolean,
): DsResult<Unit> = when {
    !context.principal.systemAdmin -> DsResult.Failure(DsFailure.Forbidden)
    else -> policy.read(context, ProjectScope.COMPONENT_VARIATIONS_DELETE) {
        transactions.required {
            if (block()) DsResult.Success(Unit) else DsResult.Failure(DsFailure.NotFound)
        }
    }
}
