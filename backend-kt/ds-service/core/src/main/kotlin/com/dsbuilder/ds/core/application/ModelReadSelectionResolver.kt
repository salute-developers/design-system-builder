package com.dsbuilder.ds.core.application

/** Разрешает версию внутри доступной DS ресурса в транзакции данных. */
fun interface ModelReadSelectionResolver {
    /** Неизвестная или чужая версия не заменяется черновиком. */
    suspend fun resolve(context: DsRequestContext, target: ModelReadTarget): DsResult<ResolvedModelRead>
}
