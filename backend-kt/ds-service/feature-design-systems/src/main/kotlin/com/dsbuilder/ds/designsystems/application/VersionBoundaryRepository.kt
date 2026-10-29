package com.dsbuilder.ds.designsystems.application

import com.dsbuilder.ds.designsystems.domain.DesignSystem
import com.dsbuilder.ds.designsystems.domain.DesignSystemId
import com.dsbuilder.ds.designsystems.domain.DesignSystemVersionId
import com.dsbuilder.ds.designsystems.domain.VersionBoundary

/** Хранилище независимых временных границ дизайн-системы. */
interface VersionBoundaryRepository {
    /** Возвращает активный черновик дизайн-системы. */
    suspend fun activeDraft(designSystemId: DesignSystemId): VersionBoundary?

    /** Возвращает опубликованную границу по идентификатору, только если она принадлежит дизайн-системе. */
    suspend fun published(
        designSystemId: DesignSystemId,
        versionId: DesignSystemVersionId,
    ): VersionBoundary?

    /** Возвращает только опубликованные границы новой временной шкалы; архивные снимки не включаются. */
    suspend fun listPublished(designSystemId: DesignSystemId): List<VersionBoundary>

    /** Возвращает ближайшую опубликованную границу перед указанным порядковым номером. */
    suspend fun previousPublished(
        designSystemId: DesignSystemId,
        beforeSequenceNumber: Long,
    ): VersionBoundary?

    /** Создаёт исходную границу и её редакцию дизайн-системы до первичного наполнения. */
    suspend fun initializeBaseline(designSystem: DesignSystem): VersionBoundary

    /** Создаёт первый активный черновик после завершения первичного наполнения исходной границы. */
    suspend fun initializeDraft(designSystemId: DesignSystemId): VersionBoundary
}
