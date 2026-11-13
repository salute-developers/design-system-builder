package com.dsbuilder.ds.core.domain

import java.util.UUID

/** Происхождение API, использованного для чтения или сохранённого экспорта. */
data class CoreReleaseSnapshot(
    /** Идентификатор неизменяемого серверного снимка. */
    val releaseId: UUID,
    /** Координаты библиотеки, платформы и версии. */
    val ref: CoreReleaseRef,
    /** SHA-256 исходных байтов; неизвестен у технического снимка миграции. */
    val metaSha256: String?,
    /** imported либо migration-snapshot; последнее не доказывает историческую версию. */
    val provenance: String,
)
