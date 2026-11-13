package com.dsbuilder.frontend.core.domain

/**
 * Происхождение сохранённых данных; не является требованием обновления перед генерацией.
 * @property releaseId идентификатор серверного снимка.
 * @property ref координаты Core, с которым получены данные.
 * @property metaSha256 SHA-256 исходной меты; null у технического снимка.
 * @property provenance imported либо migration-snapshot.
 */
public data class CoreReleaseSnapshot(
    public val releaseId: String,
    public val ref: CoreReleaseRef,
    public val metaSha256: String?,
    public val provenance: String,
)
