package com.dsbuilder.ds.components.application

import com.dsbuilder.ds.components.domain.ApiMetaImportReport
import com.dsbuilder.ds.core.application.DsFailure
import com.dsbuilder.ds.core.application.DsResult

/** Одинаковые предметные ошибки для отдельного импорта Core и публикации preview с метой. */
internal fun ApiMetaRepository.ImportAttempt.toDsResult(): DsResult<ApiMetaImportReport> = when (this) {
    is ApiMetaRepository.ImportAttempt.Success -> DsResult.Success(value)
    ApiMetaRepository.ImportAttempt.RegistrationForbidden -> DsResult.Failure(DsFailure.Forbidden)
    is ApiMetaRepository.ImportAttempt.Conflict -> DsResult.Failure(DsFailure.Conflict(code))
    is ApiMetaRepository.ImportAttempt.Failed -> DsResult.Failure(DsFailure.Unprocessable("Import failed", reason))
}
