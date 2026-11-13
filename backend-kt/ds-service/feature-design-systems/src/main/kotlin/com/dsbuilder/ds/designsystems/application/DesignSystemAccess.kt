package com.dsbuilder.ds.designsystems.application

import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult

/** Проверяет доступность дизайн-системы без публикации её внутренней модели. */
fun interface DesignSystemAccess {
    /** Возвращает результат существующего сценария чтения с проверкой прав. */
    suspend fun check(context: DsRequestContext, id: String): DsResult<Unit>
}
