package com.dsbuilder.ds.themes.application.colortokens

import com.dsbuilder.ds.core.domain.ProjectId
import com.dsbuilder.ds.themes.domain.ThemeTokenType
import com.dsbuilder.ds.themes.domain.colortokens.ColorTokenFamily
import com.dsbuilder.ds.themes.domain.colortokens.ColorTokenNaming
import com.dsbuilder.ds.themes.domain.colortokens.ColorValueKind
import com.dsbuilder.ds.themes.domain.colortokens.ColorValueShape
import com.dsbuilder.ds.themes.domain.colortokens.FamilyValue
import java.util.UUID

/**
 * Определения и значения токенов в памяти: темы одной дизайн-системы проекта [projectId], ревизии тем и значения по
 * теме и токену. [onInsert] сообщает о новых определениях (поддельная палитра добавляет их в снимок).
 */
internal class FakeColorTokenRepository(
    val designSystemId: UUID = UUID.randomUUID(),
    private val projectId: String = "project-1",
    tenantIds: List<UUID> = listOf(UUID.randomUUID()),
    private val onInsert: (Map<String, UUID>) -> Unit = {},
) : ColorTokenRepository {
    /** Определение токена. */
    data class Definition(
        val id: UUID,
        val name: String,
        val type: ThemeTokenType,
        val groupId: UUID? = null,
        val position: Int = 0,
        val displayName: String? = null,
    )

    val revisions: MutableMap<UUID, Int> = tenantIds.associateWith { 0 }.toMutableMap()

    /** Заблокированные определения в порядке блокировки. */
    val lockedDefinitions = mutableListOf<List<UUID>>()

    /** Блокировка определений отклоняется, как при чужой дизайн-системе или без черновика. */
    var lockRefused = false

    /** Определения, получившие редакцию `/type`. */
    val revisedTypes = mutableListOf<Pair<UUID, ThemeTokenType>>()
    val definitions = mutableListOf<Definition>()
    val values = mutableMapOf<Pair<UUID, UUID>, List<ColorTokenValue>>()
    var lockedAllThemes: Boolean? = null

    /** Добавляет существующее определение и возвращает его идентификатор. */
    fun define(
        name: String,
        type: ThemeTokenType = ThemeTokenType.COLOR,
        groupId: UUID? = null,
        position: Int = 0,
    ): UUID = UUID.randomUUID().also { definitions += Definition(it, name, type, groupId, position) }

    override suspend fun lock(
        projectId: ProjectId,
        tenantId: UUID,
        editRevision: Int,
        allThemes: Boolean,
    ): ColorTokenLock {
        lockedAllThemes = allThemes
        val current = revisions[tenantId]?.takeIf { projectId.value == this.projectId }
            ?: return ColorTokenLock.NotFound
        if (current != editRevision) return ColorTokenLock.RevisionConflict(current)
        val locked = if (allThemes) revisions.keys.sorted() else listOf(tenantId)
        return ColorTokenLock.Locked(designSystemId, locked, current)
    }

    override suspend fun family(designSystemId: UUID, tokenId: UUID): ColorTokenLookup {
        val token = definitions.firstOrNull { it.id == tokenId }?.takeIf { designSystemId == this.designSystemId }
            ?: return ColorTokenLookup.Missing
        val family = ColorTokenFamily.of(token.type, token.name) ?: return ColorTokenLookup.OutsideFamily
        val members = definitions.filter { family.memberOf(it.type, it.name) }.associate { it.name to it.id }
        return ColorTokenLookup.Found(StoredColorTokenFamily(family, members))
    }

    override suspend fun takenNames(designSystemId: UUID, names: Collection<String>): Set<String> =
        definitions.map { it.name }.filter { it in names }.toSet()

    override suspend fun tokenTypes(tokenIds: Collection<UUID>): Map<UUID, ThemeTokenType> =
        definitions.filter { it.id in tokenIds }.associate { it.id to it.type }

    override suspend fun insertDefinitions(
        designSystemId: UUID,
        family: ColorTokenFamily,
        names: List<String>,
        displayName: String?,
        description: String?,
        groupId: UUID?,
        position: Int,
    ): Map<String, UUID> = names.associateWith { define(it, family.type, groupId, position) }.also(onInsert)

    override suspend fun placedIn(designSystemId: UUID, groupIds: Collection<UUID>): List<PlacedToken> =
        definitions.filter { it.groupId != null && it.groupId in groupIds }.map(::placed)

    override suspend fun placedById(tokenIds: Collection<UUID>): List<PlacedToken> =
        definitions.filter { it.id in tokenIds }.map(::placed)

    override suspend fun arrange(groupId: UUID?, slots: List<Collection<UUID>>) {
        slots.forEachIndexed { index, ids -> update(ids) { it.copy(groupId = groupId, position = index) } }
    }

    override suspend fun rename(names: Map<UUID, String>) {
        names.forEach { (id, name) ->
            update(listOf(id)) { it.copy(name = name, displayName = ColorTokenNaming.displayName(name)) }
        }
    }

    /** Меняет имя определения [id] без пересчёта типа, как откат записи журнала. */
    fun rename(id: UUID, name: String) = update(listOf(id)) { it.copy(name = name) }

    /** Определение по полному имени. */
    fun named(name: String): Definition = definitions.single { it.name == name }

    private fun update(ids: Collection<UUID>, change: (Definition) -> Definition) {
        definitions.replaceAll { if (it.id in ids) change(it) else it }
    }

    private fun placed(definition: Definition) =
        PlacedToken(definition.id, definition.name, definition.type, definition.groupId, definition.position)

    override suspend fun insertValues(tenantIds: Collection<UUID>, values: Map<UUID, List<ColorTokenValue>>) {
        tenantIds.forEach { tenant -> values.forEach { (token, items) -> this.values[tenant to token] = items } }
    }

    override suspend fun replaceValues(tenantId: UUID, values: Map<UUID, List<ColorTokenValue>>) {
        values.forEach { (token, items) ->
            val changed = items.map { it.platform to it.mode }.toSet()
            this.values[tenantId to token] = this.values[tenantId to token].orEmpty()
                .filter { (it.platform to it.mode) !in changed } + items
        }
    }

    override suspend fun deleteDefinitions(tokenIds: Collection<UUID>, primaryTokenId: UUID?) {
        definitions.removeAll { it.id in tokenIds }
        values.keys.removeAll { it.second in tokenIds }
    }

    override suspend fun bumpRevisions(tenantIds: Collection<UUID>): Map<UUID, Int> =
        tenantIds.associateWith { tenant -> revisions.getValue(tenant).plus(1).also { revisions[tenant] = it } }

    override fun familyInDraft(designSystemId: UUID, tokenId: UUID): StoredColorTokenFamily? {
        val token = definitions.firstOrNull { it.id == tokenId } ?: return null
        val family = ColorTokenFamily.of(token.type, token.name) ?: return null
        val members = definitions.filter { family.memberOf(it.type, it.name) }
        return StoredColorTokenFamily(
            family,
            members.associate { it.name to it.id },
            members.associate { it.id to it.type },
        )
    }

    override fun familiesInDraft(designSystemId: UUID, tokenIds: Collection<UUID>): Map<UUID, StoredColorTokenFamily> =
        tokenIds.distinct().mapNotNull { id -> familyInDraft(designSystemId, id)?.let { id to it } }.toMap()

    override fun lockFamilyDefinitions(designSystemId: UUID, tokenIds: Collection<UUID>): Boolean {
        if (lockRefused) return false
        lockedDefinitions += tokenIds.sorted()
        return true
    }

    override fun familyValuesInDraft(designSystemId: UUID, tokenIds: Collection<UUID>): List<FamilyValue> =
        values.filterKeys { (_, token) -> token in tokenIds }.values.flatten().map {
            FamilyValue(
                it.platform,
                it.value,
            )
        }

    override fun designSystemOf(tokenId: UUID): UUID? = designSystemId.takeIf { definitions.any { it.id == tokenId } }

    override fun familyTypeCandidates(designSystemId: UUID, tenantId: UUID): List<StoredColorTokenFamily> {
        val withGradient = values.filterKeys { (tenant, _) -> tenant == tenantId }
            .filterValues { items ->
                items.any { ColorValueShape.kind(it.platform, it.value) == ColorValueKind.GRADIENT }
            }
            .keys.map { it.second }
        val gradients = definitions.filter { it.type == ThemeTokenType.GRADIENT }.map { it.id }
        return (gradients + withGradient).distinct().sorted()
            .mapNotNull { familyInDraft(designSystemId, it) }
            .distinctBy { it.members.values.toSet() }
    }

    override fun reviseFamilyType(tokenIds: Collection<UUID>, type: ThemeTokenType) {
        // Как в хранилище: редакция пишется только определению, у которого тип отличается.
        tokenIds.sorted().filter { id -> definitions.single { it.id == id }.type != type }
            .forEach { id -> revisedTypes += id to type }
        update(tokenIds) { it.copy(type = type) }
    }
}
