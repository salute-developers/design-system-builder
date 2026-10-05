package com.dsbuilder.ds.components.application

import com.dsbuilder.ds.components.domain.ComponentConfig
import com.dsbuilder.ds.components.domain.ComponentConfigImportResult
import com.dsbuilder.ds.components.domain.ComponentConfigPackage
import com.dsbuilder.ds.core.domain.ProjectId

/** Persistence port for single, package export and atomic component-config import scenarios. */
interface ComponentConfigRepository {
    /** Performs the get operation. */
    suspend fun get(
        projectId: ProjectId,
        systemAdmin: Boolean,
        query: ComponentConfigQuery,
    ): ComponentConfig?

    /** Performs the export operation. */
    suspend fun export(
        projectId: ProjectId,
        systemAdmin: Boolean,
        query: ExportComponentConfig,
    ): ExportAttempt

    /** Performs the import operation. */
    suspend fun import(
        projectId: ProjectId,
        systemAdmin: Boolean,
        command: ImportComponentConfig,
    ): ImportAttempt

    /** Public model for import attempt. */
    sealed interface ImportAttempt {
        /** Public model for success. */
        data class Success(
            /** Value carried by this contract. */
            val value: ComponentConfigImportResult,
        ) : ImportAttempt

        /** Public model for not found. */
        data object NotFound : ImportAttempt

        /** Public model for global forbidden. */
        data object GlobalForbidden : ImportAttempt

        /** Public model for failed. */
        data class Failed(/** Reason carried by this contract. */ val reason: String) : ImportAttempt
    }

    /** Public model for export attempt. */
    sealed interface ExportAttempt {
        /** Public model for success. */
        data class Success(/** Value carried by this contract. */ val value: ComponentConfigPackage) : ExportAttempt

        /** Public model for not found. */
        data object NotFound : ExportAttempt

        /** Public model for failed. */
        data class Failed(/** Reason carried by this contract. */ val reason: String) : ExportAttempt
    }
}
