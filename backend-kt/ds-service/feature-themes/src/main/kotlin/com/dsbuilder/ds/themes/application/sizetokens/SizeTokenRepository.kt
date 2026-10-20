package com.dsbuilder.ds.themes.application.sizetokens

import com.dsbuilder.ds.core.domain.ProjectId
import com.dsbuilder.ds.themes.domain.ThemeTokenType
import com.dsbuilder.ds.themes.domain.sizetokens.SizeWrittenValue
import java.util.UUID

/** Хранилище токенов размеров темы; вызывается внутри транзакции use case. */
interface SizeTokenRepository {
    /** Тема [tenantId], доступная проекту: своя или общей дизайн-системы. */
    suspend fun tenant(projectId: ProjectId, tenantId: UUID): SizeTokenTenant?

    /**
     * Блокирует текущую тему проекта, а при [allThemes] — все темы её дизайн-системы в порядке `id`, и сверяет
     * ревизию текущей темы.
     */
    suspend fun lock(projectId: ProjectId, tenantId: UUID, editRevision: Int, allThemes: Boolean): SizeTokenLock

    /** Токены типов `shape`, `spacing` и `shadow` дизайн-системы [designSystemId] со значениями темы [tenantId]. */
    suspend fun tokens(designSystemId: UUID, tenantId: UUID): List<StoredSizeToken>

    /** Токен [tokenId] дизайн-системы [designSystemId] любого типа со значениями темы [tenantId]. */
    suspend fun token(designSystemId: UUID, tenantId: UUID, tokenId: UUID): StoredSizeToken?

    /** Имена из [names], уже занятые токенами дизайн-системы. */
    suspend fun takenNames(designSystemId: UUID, names: Collection<String>): Set<String>

    /** Создаёт определения [names] типа [type] и возвращает полное имя → идентификатор. */
    suspend fun insert(designSystemId: UUID, type: ThemeTokenType, names: List<String>): Map<String, UUID>

    /** Заменяет значения токена [tokenId] во всех темах [tenantIds] значениями [values]. */
    suspend fun replaceValues(tenantIds: Collection<UUID>, tokenId: UUID, values: List<SizeWrittenValue>)

    /** Удаляет определения [tokenIds] вместе со значениями; ссылки компонентов сбрасывает `ON DELETE SET NULL`. */
    suspend fun delete(tokenIds: Collection<UUID>)

    /** Увеличивает ревизии тем [tenantIds] и возвращает новые значения. */
    suspend fun bumpRevisions(tenantIds: Collection<UUID>): Map<UUID, Int>
}
