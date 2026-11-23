package com.dsbuilder.ds.components.application

import java.util.UUID

/** Явное изменение настройки Core; предметный журнал не изменяется. */
data class SelectCoreRelease(
    /** Каноническая платформа настройки. */
    val platform: String,
    /** Явный канал stable или dev. */
    val channel: String,
    /** Идентификатор неизменяемого релиза выбранной платформы и канала. */
    val releaseId: UUID?,
    /** Черновик, настройки которого видел пользователь. */
    val expectedDraftId: UUID,
    /** Ревизия выбора, от которой выполнена команда. */
    val expectedCoreSelectionRevision: Long,
    /** Закреплённая версия либо следование последнему релизу канала. */
    val selectionMode: String = "pinned",
)
