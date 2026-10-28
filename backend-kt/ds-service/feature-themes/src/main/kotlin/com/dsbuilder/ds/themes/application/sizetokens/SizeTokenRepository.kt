package com.dsbuilder.ds.themes.application.sizetokens

import com.dsbuilder.ds.core.domain.ProjectId
import com.dsbuilder.ds.themes.domain.ThemeTokenPlatform
import com.dsbuilder.ds.themes.domain.ThemeTokenType
import com.dsbuilder.ds.themes.domain.sizetokens.SizeWrittenValue
import java.util.UUID

/**
 * Хранилище токенов размеров темы поверх предметных редакций; вызывается внутри транзакции use case. Чтение идёт
 * на границе транзакции — активном черновике или опубликованной версии `versionId`.
 */
interface SizeTokenRepository {
    /** Тема [tenantId] на границе, доступная проекту: своя или общей дизайн-системы. */
    suspend fun tenant(projectId: ProjectId, tenantId: UUID): SizeTokenTenant?

    /**
     * Разделяемая блокировка мутации дизайн-системы своей темы [tenantId]; результат — дизайн-система или `null`,
     * если темы нет или дизайн-система не принадлежит проекту.
     */
    suspend fun lock(projectId: ProjectId, tenantId: UUID): UUID?

    /** Действующие токены дизайн-системы [designSystemId] со значениями темы [tenantId]. */
    suspend fun tokens(designSystemId: UUID, tenantId: UUID): List<StoredSizeToken>

    /** Действующий токен [tokenId] дизайн-системы [designSystemId] любого типа со значениями темы [tenantId]. */
    suspend fun token(designSystemId: UUID, tenantId: UUID, tokenId: UUID): StoredSizeToken?

    /** Имена из [names], занятые действующими токенами дизайн-системы. */
    suspend fun takenNames(designSystemId: UUID, names: Collection<String>): Set<String>

    /**
     * Блокирует значения токена [tokenId] в теме [tenantId], перечитывает их и записывает черновые редакции только
     * изменившихся значений [values] с путями `/value` и `/overridden`. Базовая редакция значения — из
     * [baseRevisions] по платформе, иначе из контекста запроса.
     */
    suspend fun writeValues(
        designSystemId: UUID,
        tenantId: UUID,
        tokenId: UUID,
        values: List<SizeWrittenValue>,
        baseRevisions: Map<ThemeTokenPlatform, Long>,
    )

    /**
     * Создаёт определения типа [type] с полными именами из [values] и их значения во всех темах дизайн-системы;
     * результат — полное имя → идентификатор.
     */
    suspend fun create(
        designSystemId: UUID,
        type: ThemeTokenType,
        values: Map<String, List<SizeWrittenValue>>,
    ): Map<String, UUID>

    /**
     * Логически удаляет определения [tokenIds] и их значения во всех темах дизайн-системы и очищает ссылки
     * компонентов на них в активном черновике.
     */
    suspend fun delete(designSystemId: UUID, tokenIds: List<UUID>)
}
