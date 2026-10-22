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

    /**
     * Вставляет определения [names] семейства в группу [groupId] на позицию [position] и возвращает полное имя →
     * идентификатор.
     */
    @Suppress("LongParameterList")
    suspend fun insertDefinitions(
        designSystemId: UUID,
        family: ColorTokenFamily,
        names: List<String>,
        displayName: String?,
        description: String?,
        groupId: UUID?,
        position: Int,
    ): Map<String, UUID>

    /** Определения дизайн-системы [designSystemId], лежащие в группах [groupIds]. */
    suspend fun placedIn(designSystemId: UUID, groupIds: Collection<UUID>): List<PlacedToken>

    /** Определения [tokenIds] с их местом. */
    suspend fun placedById(tokenIds: Collection<UUID>): List<PlacedToken>

    /** Кладёт определения каждого слота [slots] в группу [groupId] на позицию, равную индексу слота. */
    suspend fun arrange(groupId: UUID?, slots: List<Collection<UUID>>)

    /** Переименовывает определения: идентификатор → новое полное имя; отображаемое имя пересчитывается. */
    suspend fun rename(names: Map<UUID, String>)

    /** Записывает значения [values] токенов в каждую из тем [tenantIds]. */
    suspend fun insertValues(tenantIds: Collection<UUID>, values: Map<UUID, List<ColorTokenValue>>)

    /** Заменяет платформенные значения токенов из [values] в теме [tenantId]. */
    suspend fun replaceValues(tenantId: UUID, values: Map<UUID, List<ColorTokenValue>>)

    /** Удаляет определения [tokenIds] вместе с их значениями и привязками к группам палитры. */
    suspend fun deleteDefinitions(tokenIds: Collection<UUID>, primaryTokenId: UUID? = null)

    /** Увеличивает ревизии тем [tenantIds] и возвращает новые значения. */
    suspend fun bumpRevisions(tenantIds: Collection<UUID>): Map<UUID, Int>
}

/**
 * Слоты группы — семейства цветовых токенов в порядке позиций: определения семейства всегда стоят вместе.
 * Определение вне семейства занимает свой слот.
 */
internal fun List<PlacedToken>.slots(): List<List<UUID>> =
    groupBy { token -> token.type?.let { ColorTokenFamily.of(it, token.name) } ?: token.id }
        .values
        .sortedWith(compareBy({ members -> members.minOf { it.position } }, { members -> members.minOf { it.name } }))
        .map { members -> members.map { it.id } }
