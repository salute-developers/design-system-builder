package com.dsbuilder.documentation.ingestion.application

import com.dsbuilder.documentation.ingestion.domain.DocumentationBundle
import com.dsbuilder.documentation.ingestion.domain.IngestionJob

/** Репозиторий metadata bundle. */
interface DocumentationBundleRepository {
    /** Создает metadata bundle в текущей транзакции. */
    suspend fun create(bundle: DocumentationBundle)

    /** Проверяет committed metadata отдельным чтением после неопределенного результата commit. */
    suspend fun exists(bundleId: String): Boolean
}

/** Репозиторий ingestion jobs. */
fun interface IngestionJobRepository {
    /** Создает ingestion job в текущей транзакции. */
    suspend fun create(job: IngestionJob)
}

/** Граница атомарной persistence-транзакции. */
interface TransactionManager {
    /** Выполняет блок в атомарной persistence-транзакции. */
    suspend fun <T> transaction(block: suspend () -> T): T
}
