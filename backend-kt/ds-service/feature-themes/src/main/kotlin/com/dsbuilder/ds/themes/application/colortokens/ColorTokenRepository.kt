package com.dsbuilder.ds.themes.application.colortokens

import com.dsbuilder.ds.core.domain.ProjectId
import com.dsbuilder.ds.themes.domain.ThemeTokenType
import com.dsbuilder.ds.themes.domain.colortokens.ColorTokenFamily
import com.dsbuilder.ds.themes.domain.colortokens.FamilyValue
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

    /** Текущие значения только выбранного семейства и темы, включая полные технические редакции. */
    fun confirmedValues(designSystemId: UUID, tenantId: UUID, tokenIds: Collection<UUID>):
        List<com.dsbuilder.ds.themes.domain.TenantTokenValue>? = null

    /** Подтверждение структуры семейства и порядка только затронутых групп. */
    suspend fun confirmedStructure(
        designSystemId: UUID,
        tokenIds: Collection<UUID>,
        removed: Collection<UUID> = emptyList(),
        groupIds: Collection<UUID> = emptyList(),
    ): ColorTokenStructure? = null

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

    /**
     * Семейство токена [tokenId] дизайн-системы [designSystemId] на границе активного черновика или `null`, если
     * токена нет или он вне семейств. Вызывается внутри текущей транзакции, в том числе из отката журнала.
     */
    fun familyInDraft(designSystemId: UUID, tokenId: UUID): StoredColorTokenFamily?

    /**
     * Семейства токенов [tokenIds] дизайн-системы [designSystemId] на границе активного черновика по одному чтению
     * определений: идентификатор → семейство. Токенов вне семейств и отсутствующих в ответе нет.
     */
    fun familiesInDraft(designSystemId: UUID, tokenIds: Collection<UUID>): Map<UUID, StoredColorTokenFamily>

    /**
     * Блокирует технические состояния определений [tokenIds] в устойчивом порядке до вычисления типа семейства.
     * `false` — дизайн-система недоступна проекту запроса или у неё нет активного черновика; ошибки SQL не
     * перехватываются.
     */
    fun lockFamilyDefinitions(designSystemId: UUID, tokenIds: Collection<UUID>): Boolean

    /** Действующие на границе черновика значения определений [tokenIds] во всех темах дизайн-системы. */
    fun familyValuesInDraft(designSystemId: UUID, tokenIds: Collection<UUID>): List<FamilyValue>

    /** Записывает тип [type] определениям [tokenIds] редакциями черновика с путём `/type`. */
    fun reviseFamilyType(tokenIds: Collection<UUID>, type: ThemeTokenType)

    /** Дизайн-система действующего определения [tokenId] или `null`, если определения нет. */
    fun designSystemOf(tokenId: UUID): UUID?

    /**
     * Семейства дизайн-системы, тип которых мог измениться вместе с набором тем: семейства определений типа
     * `gradient` и определений с градиентным значением в теме [tenantId] на границе черновика. Определения
     * читаются один раз, каждое семейство входит в ответ один раз.
     */
    fun familyTypeCandidates(designSystemId: UUID, tenantId: UUID): List<StoredColorTokenFamily>
}

/**
 * Слоты группы — семейства цветовых токенов в порядке позиций: определения семейства всегда стоят вместе.
 * Определение вне семейства занимает свой слот. Семейство определяется именем без учёта производного типа членов.
 */
internal fun List<PlacedToken>.slots(): List<List<UUID>> =
    groupBy { token ->
        token.type?.let { ColorTokenFamily.of(it, token.name) }?.let { it.group to it.name } ?: token.id
    }
        .values
        .sortedWith(compareBy({ members -> members.minOf { it.position } }, { members -> members.minOf { it.name } }))
        .map { members -> members.map { it.id } }
