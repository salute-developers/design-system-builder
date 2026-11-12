package com.dsbuilder.ds.components.application

import com.dsbuilder.ds.components.domain.ComponentTemplate
import com.dsbuilder.ds.core.application.DsAccessPolicy
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.TransactionRunner

/** Список шаблонов компонентов, которые можно добавить в дизайн-систему. */
class ListComponentTemplatesUseCase(
    private val policy: DsAccessPolicy,
    private val transactions: TransactionRunner,
    private val repository: ComponentTemplateRepository,
) {
    /** Возвращает шаблоны web-компонентов. */
    suspend fun execute(context: DsRequestContext): DsResult<List<ComponentTemplate>> =
        modelList(policy, transactions, context) { repository.list() }
}
