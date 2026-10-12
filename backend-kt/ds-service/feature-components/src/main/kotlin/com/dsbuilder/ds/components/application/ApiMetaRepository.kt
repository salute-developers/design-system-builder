package com.dsbuilder.ds.components.application

import com.dsbuilder.ds.components.domain.ApiMetaImportReport

/** Persistence port for the global-layer API-meta import. */
interface ApiMetaRepository {
    /** Imports [command] additively and journals the run on behalf of [actorId]. */
    suspend fun import(actorId: String, command: ImportApiMeta): ImportAttempt

    /** Outcome of one import attempt. */
    sealed interface ImportAttempt {
        /** The manifest was written; [value] is the report. */
        data class Success(/** Report of the run. */ val value: ApiMetaImportReport) : ImportAttempt

        /** The manifest could not be written; the whole run must be rolled back. */
        data class Failed(/** Reason carried by this contract. */ val reason: String) : ImportAttempt
    }
}
