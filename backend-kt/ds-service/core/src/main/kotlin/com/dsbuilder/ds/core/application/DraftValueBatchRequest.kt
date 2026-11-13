package com.dsbuilder.ds.core.application

import java.util.UUID

/** Контекст пакета без типов хранилища и доверия к предметным адресам клиента. */
data class DraftValueBatchRequest(
    /** Владелец значений. */
    val designSystemId: UUID,
    /** Черновик, указанный адресной командой. */
    val draftId: UUID,
    /** Доверенный проект. */
    val projectId: String,
    /** Права системного администратора. */
    val systemAdmin: Boolean,
    /** Пары устойчивого ID значения и ожидаемой редакции в порядке запроса. */
    val targets: List<Pair<UUID, Long>>,
)
