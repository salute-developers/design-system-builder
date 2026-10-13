package com.dsbuilder.ds.themes.application.colortokens

import com.dsbuilder.ds.core.domain.ProjectId
import com.dsbuilder.ds.themes.domain.ThemeTokenType
import com.dsbuilder.ds.themes.domain.colortokens.ColorTokenFamily
import java.util.UUID

/** Хранилище определений и значений цветовых токенов; вызывается внутри транзакции use case. */
interface ColorTokenRepository {
    /**
     * Блокирует текущую тему проекта, а при [allThemes] — все темы её дизайн-системы в порядке `id`, и сверяет
     * ревизию текущей темы.
     */
    suspend fun lock(projectId: ProjectId, tenantId: UUID, editRevision: Int, allThemes: Boolean): ColorTokenLock

    /** Семейство токена [tokenId] дизайн-системы [designSystemId]. */
    suspend fun family(designSystemId: UUID, tokenId: UUID): ColorTokenLookup

    /** Имена из [names], уже занятые определениями дизайн-системы. */
    suspend fun takenNames(designSystemId: UUID, names: Collection<String>): Set<String>

    /** Типы токенов [tokenIds]; токенов без типа в ответе нет. */
    suspend fun tokenTypes(tokenIds: Collection<UUID>): Map<UUID, ThemeTokenType>

    /** Вставляет определения [names] семейства и возвращает полное имя → идентификатор. */
    suspend fun insertDefinitions(
        designSystemId: UUID,
        family: ColorTokenFamily,
        names: List<String>,
        displayName: String?,
        description: String?,
    ): Map<String, UUID>

    /** Записывает значения [values] токенов в каждую из тем [tenantIds]. */
    suspend fun insertValues(tenantIds: Collection<UUID>, values: Map<UUID, List<ColorTokenValue>>)

    /** Заменяет платформенные значения токенов из [values] в теме [tenantId]. */
    suspend fun replaceValues(tenantId: UUID, values: Map<UUID, List<ColorTokenValue>>)

    /** Удаляет определения [tokenIds] вместе с их значениями и привязками к группам палитры. */
    suspend fun deleteDefinitions(tokenIds: Collection<UUID>)

    /** Увеличивает ревизии тем [tenantIds] и возвращает новые значения. */
    suspend fun bumpRevisions(tenantIds: Collection<UUID>): Map<UUID, Int>
}
