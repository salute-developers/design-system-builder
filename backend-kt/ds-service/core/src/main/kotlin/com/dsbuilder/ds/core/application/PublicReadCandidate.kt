package com.dsbuilder.ds.core.application

import com.dsbuilder.ds.core.domain.ProjectId
import java.util.UUID

/** Проверенный адрес попытки публичного чтения, не являющийся проектными полномочиями. */
data class PublicReadCandidate(
    /** Проект из доверенного публичного префикса маршрута. */
    override val projectId: ProjectId,
    /** Адресная ДС; публичность и принадлежность проверяются внутри транзакции. */
    val designSystemId: UUID,
    /** Описатель из общего allowlist, повторно проверяемый при входе в чтение. */
    val operation: DsReadOperation,
    /** Подтверждённый пользователь вне проекта; отсутствие означает запрос без credentials. */
    val verifiedUserId: String? = null,
) : DsAccessContext
