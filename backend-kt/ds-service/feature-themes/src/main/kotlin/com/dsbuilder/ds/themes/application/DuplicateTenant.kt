package com.dsbuilder.ds.themes.application

import java.util.UUID

/** Нормализованная команда копирования темы внутри её дизайн-системы. */
data class DuplicateTenant(
    /** Дизайн-система из маршрута: исходная тема должна ей принадлежать. */
    val designSystemId: UUID,
    /** Исходная тема. */
    val sourceTenantId: UUID,
    /** Название копии после нормализации пробелов. */
    val name: String,
)
