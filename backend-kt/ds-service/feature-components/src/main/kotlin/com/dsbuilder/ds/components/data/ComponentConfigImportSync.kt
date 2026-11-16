package com.dsbuilder.ds.components.data

import com.dsbuilder.ds.core.data.SubjectMutationPaths
import org.jetbrains.exposed.v1.core.Column
import org.jetbrains.exposed.v1.core.InternalApi
import org.jetbrains.exposed.v1.core.Op
import org.jetbrains.exposed.v1.core.ResultRow
import org.jetbrains.exposed.v1.core.Table
import org.jetbrains.exposed.v1.core.and
import org.jetbrains.exposed.v1.core.eq
import org.jetbrains.exposed.v1.core.inList
import org.jetbrains.exposed.v1.core.statements.InsertStatement
import org.jetbrains.exposed.v1.jdbc.batchInsert
import org.jetbrains.exposed.v1.jdbc.deleteWhere
import org.jetbrains.exposed.v1.jdbc.insert
import org.jetbrains.exposed.v1.jdbc.selectAll
import java.time.Instant
import java.util.UUID

/** Согласует импорт по предметным адресам, сохраняя UUID и не переписывая одинаковые редакции. */
internal class ComponentConfigImportSync {
    private val retained = mutableMapOf<ComponentRevisionTable, MutableSet<UUID>>()

    /** Граница черновика каждой дизайн-системы импорта: блокировка и чтение выполняются один раз на систему. */
    private val drafts = mutableMapOf<UUID, ResultRow>()

    /** Граница черновика дизайн-системы: блокировка и чтение выполняются один раз на импорт. */
    fun draft(owner: UUID): ResultRow = drafts.getOrPut(owner) { componentDraft(owner) }

    /** Оформление, в которое импорт пишет сейчас: все изменения этого класса относятся к нему. */
    var appearance: UUID? = null

    private val changed = hashSetOf<UUID>()

    private val firstChange = mutableMapOf<UUID, () -> Unit>()

    /** Действие, которое выполняется непосредственно перед первым изменением оформления [id] (его состояние «до»). */
    fun onFirstChange(id: UUID, action: () -> Unit) {
        firstChange[id] = action
    }

    /**
     * Отметить, что импорт изменяет текущее оформление (запись, создание или удаление строки). Вызывается до самого
     * изменения, чтобы [onFirstChange] увидело состояние «до».
     */
    fun markChanged() {
        val id = appearance ?: return
        if (changed.add(id)) firstChange.remove(id)?.invoke()
    }

    /** Изменил ли импорт данные оформления [id]; без изменений оно считается `unchanged`. */
    fun changed(id: UUID): Boolean = id in changed

    /** Пакетные писатели новых строк по дизайн-системе: устойчивые строки пишутся раньше редакций, группами по таблице. */
    private val batches = mutableMapOf<UUID, ComponentSeedBatchWriter>()

    /** Идентификаторы строк, созданных этим импортом через [stable]: у них нет редакции, которую нужно заменять. */
    private val fresh = hashSetOf<UUID>()

    /** Редакции, уже поставленные в очередь пакетной записи: повторная запись той же сущности сбрасывает очередь. */
    private val buffered = hashSetOf<Pair<ComponentRevisionTable, UUID>>()

    private fun batch(owner: UUID) = batches.getOrPut(owner) { ComponentSeedBatchWriter.draft(owner) }

    /**
     * Создаёт устойчивую строку новой сущности пакетно: идентификатор задаётся здесь, строка попадёт в базу при
     * [flush]. Редакция такой сущности тоже пишется пакетно, без поиска и замены прежней.
     */
    fun <T : Table> stable(
        owner: UUID,
        table: T,
        idColumn: Column<UUID>,
        createdAtColumn: Column<java.time.Instant>,
        body: T.(org.jetbrains.exposed.v1.core.statements.BatchInsertStatement) -> Unit,
    ): UUID = batch(owner).stable(table, idColumn, createdAtColumn, body).also {
        fresh += it
        markChanged()
    }

    /** Замена или удаление редакции существующей сущности, отложенные до [flush]. */
    private class PendingRevision(
        val entityColumn: Column<UUID>,
        val entityId: UUID,
        val owner: UUID,
        val values: Map<Column<*>, Any?>,
    )

    private val replacements = linkedMapOf<Pair<ComponentRevisionTable, UUID>, PendingRevision>()
    private val removals = linkedMapOf<Pair<ComponentRevisionTable, UUID>, PendingRevision>()

    /**
     * Записывает накопленное: сначала новые устойчивые строки и редакции (группами по таблице), затем замены и
     * удаления редакций существующих сущностей, тоже группами по таблице.
     */
    fun flush() {
        batches.values.forEach { it.flush() }
        buffered.clear()
        // Записанные строки больше не новые: их редакция уже в базе, и повторная запись должна её заменить.
        fresh.clear()
        flushRevisions(replacements, deleted = false)
        flushRevisions(removals, deleted = true)
    }

    /**
     * Заменяет редакции черновика пакетно: прежние редакции сущностей удаляются списком, новые вставляются пакетами.
     * Удаления выполняются с путём `/deleted`, как и при построчной замене.
     */
    @Suppress("UNCHECKED_CAST")
    private fun flushRevisions(
        pending: MutableMap<Pair<ComponentRevisionTable, UUID>, PendingRevision>,
        deleted: Boolean,
    ) {
        pending.entries.groupBy({ it.key.first }, { it.value }).forEach { (table, group) ->
            group.groupBy { it.owner }.forEach { (owner, rows) ->
                val boundary = draft(owner)
                rows.chunked(REVISION_BATCH).forEach { writeChunk(table, it, owner, boundary, deleted) }
            }
        }
        pending.clear()
    }

    /** Одна пачка: прежние редакции сущностей удаляются списком, затем вставляются новые или редакции-удаления. */
    private fun writeChunk(
        table: ComponentRevisionTable,
        chunk: List<PendingRevision>,
        owner: UUID,
        boundary: ResultRow,
        deleted: Boolean,
    ) {
        table.deleteWhere {
            (chunk.first().entityColumn inList chunk.map { it.entityId }) and
                (table.designSystemVersionId eq boundary[ComponentVersionBoundariesTable.id])
        }
        if (deleted) {
            SubjectMutationPaths.with(setOf("/deleted")) { insertDeleted(table, chunk, owner, boundary) }
        } else {
            replace(table, chunk, owner, boundary)
        }
    }

    /** Вставляет новые редакции замены одним пакетом: у них заполнены все столбцы значения. */
    @Suppress("UNCHECKED_CAST")
    private fun replace(table: ComponentRevisionTable, rows: List<PendingRevision>, owner: UUID, boundary: ResultRow) {
        table.batchInsert(rows, shouldReturnGeneratedValues = false) { row ->
            this[table.id] = UUID.randomUUID()
            this[row.entityColumn] = row.entityId
            this[table.designSystemId] = owner
            this[table.designSystemVersionId] = boundary[ComponentVersionBoundariesTable.id]
            this[table.versionSequenceNumber] = boundary[ComponentVersionBoundariesTable.sequenceNumber]
            this[table.deleted] = false
            this[table.updatedAt] = Instant.now()
            row.values.forEach { (column, value) -> this[column as Column<Any?>] = value }
        }
    }

    /**
     * Вставляет редакции-удаления по одной: у них нет значений, а пакетная вставка требует заполнить все столбцы без
     * значения по умолчанию. Удаление и контекст пути общие на пачку.
     */
    @Suppress("UNCHECKED_CAST")
    private fun insertDeleted(
        table: ComponentRevisionTable,
        rows: List<PendingRevision>,
        owner: UUID,
        boundary: ResultRow,
    ) {
        rows.forEach { row ->
            table.insert { statement ->
                statement[row.entityColumn] = row.entityId
                statement[table.designSystemId] = owner
                statement[table.designSystemVersionId] = boundary[ComponentVersionBoundariesTable.id]
                statement[table.versionSequenceNumber] = boundary[ComponentVersionBoundariesTable.sequenceNumber]
                statement[table.deleted] = true
                row.values.forEach { (column, value) -> statement[column as Column<Any?>] = value }
            }
        }
    }

    fun retained(table: ComponentRevisionTable, id: UUID): Boolean = id in retained[table].orEmpty()

    /**
     * Строки представлений значений одного оформления, прочитанные один раз: поиск по адресу и сравнение с текущей
     * редакцией идут в памяти, а не запросом на каждое значение. Строки, созданные этим импортом, регистрируются по
     * адресу, чтобы повторный поиск того же адреса нашёл их, как нашёл бы запрос.
     */
    private class Scope(val rows: List<ResultRow>, val byId: MutableMap<UUID, ResultRow>) {
        val created = mutableMapOf<List<Any?>, UUID>()
    }

    private val scopes = mutableMapOf<Pair<Table, UUID>, Scope>()

    /**
     * Адреса строк, созданных этим импортом в представлениях без снимка: их редакция может ещё ждать записи, и запрос
     * к базе её не увидит.
     */
    private val unscoped = mutableMapOf<Table, Scope>()

    /** Адрес, по которому последний поиск ничего не нашёл: следующая запись создаёт именно эту строку. */
    private var lastMiss: Triple<Table, Scope, List<Any?>>? = null

    @Suppress("UNCHECKED_CAST")
    private fun scopeOf(view: Table, address: Array<out Pair<Column<*>, Any?>>): Scope? {
        val column = SNAPSHOT_SCOPES[view] ?: return null
        val scopeId = address.firstOrNull { it.first === column }?.second as? UUID ?: return null
        return scopes.getOrPut(view to scopeId) {
            val rows = view.selectAll().where { (column as Column<UUID>) eq scopeId }.toList()
            val idColumn = view.columns.single { it.name == "id" } as Column<UUID>
            Scope(rows, rows.associateByTo(mutableMapOf()) { it[idColumn] })
        }
    }

    @Suppress("UNCHECKED_CAST")
    fun id(view: Table, id: Column<UUID>, vararg address: Pair<Column<*>, Any?>): UUID? {
        lastMiss = null
        val snapshot = scopeOf(view, address)
        val scope = snapshot ?: unscoped.getOrPut(view) { Scope(emptyList(), mutableMapOf()) }
        val key = address.map { it.second }
        val found = scope.created[key] ?: if (snapshot != null) {
            snapshot.rows.filter { row ->
                address.all { (column, value) -> row[column as Column<Any?>] == value }
            }.singleOrNull()?.get(id)
        } else {
            stored(view, id, address)
        }
        if (found == null) lastMiss = Triple(view, scope, key)
        return found
    }

    /** Строка представления без снимка по адресу: запрос к базе. */
    @Suppress("UNCHECKED_CAST")
    private fun stored(view: Table, id: Column<UUID>, address: Array<out Pair<Column<*>, Any?>>): UUID? {
        val predicate = address.fold<_, Op<Boolean>>(Op.TRUE) { predicate, (column, value) ->
            predicate and ((column as Column<Any?>) eq value)
        }
        return view.selectAll().where { predicate }.singleOrNull()?.get(id)
    }

    @OptIn(InternalApi::class)
    @Suppress("UNCHECKED_CAST")
    fun <T : ComponentRevisionTable> write(
        table: T,
        view: Table,
        entityColumn: Column<UUID>,
        entityId: UUID,
        owner: UUID,
        body: T.(InsertStatement<Number>) -> Unit,
    ) {
        retained.getOrPut(table) { hashSetOf() } += entityId
        val desired = InsertStatement<Number>(table).also { table.body(it) }.values.toMap()
        if (entityId in fresh) {
            markChanged()
            // Адрес новой строки регистрируется до раннего выхода: тот же адрес в этом оформлении (например, состояния,
            // совпавшие после нормализации) должен найти её, а не создать вторую.
            registerMiss(view, entityId)
            if (buffered.add(table to entityId)) {
                batch(owner).revision(table, entityColumn, entityId) { statement ->
                    desired.forEach { (column, value) -> statement[column as Column<Any?>] = value }
                }
                return
            }
            // Повторная запись новой сущности: сначала записать очередь, затем заменить редакцию обычным путём.
            flush()
        }
        if ((table to entityId) in replacements) {
            // Повторная запись сущности, замена которой уже ждёт записи: побеждает последнее значение.
            replacements[table to entityId] = PendingRevision(entityColumn, entityId, owner, desired)
            return
        }
        val idColumn = view.columns.single { it.name == "id" } as Column<UUID>
        val current = currentRow(view, idColumn, entityId)
        val columns = view.columns.associateBy { it.name }
        if (current != null && desired.all { (column, value) ->
                current[requireNotNull(columns[column.name]) as Column<Any?>] == value
            }
        ) {
            return
        }
        markChanged()
        replacements[table to entityId] = PendingRevision(entityColumn, entityId, owner, desired)
    }

    /** Запоминает адрес последнего пустого поиска за только что созданной сущностью [entityId]. */
    private fun registerMiss(view: Table, entityId: UUID): Boolean {
        val miss = lastMiss
        lastMiss = null
        if (miss == null || miss.first !== view) return false
        miss.second.created[miss.third] = entityId
        return true
    }

    /** Текущая строка сущности: из снимка оформления, а для сущности, найденной поиском впустую, — отсутствующая. */
    private fun currentRow(view: Table, idColumn: Column<UUID>, entityId: UUID): ResultRow? {
        // Строку только что создал вызывающий по результату пустого поиска: редакции у неё ещё нет.
        if (registerMiss(view, entityId)) return null
        scopes.entries.firstOrNull { it.key.first === view && entityId in it.value.byId }?.let { entry ->
            val row = entry.value.byId[entityId]
            // После записи строка снимка устарела; повторная запись той же сущности прочитает её из базы.
            entry.value.byId.remove(entityId)
            return row
        }
        return view.selectAll().where { idColumn eq entityId }.singleOrNull()
    }

    @OptIn(InternalApi::class)
    fun <T : ComponentRevisionTable> remove(
        table: T,
        entityColumn: Column<UUID>,
        id: UUID,
        owner: UUID,
        body: T.(InsertStatement<Number>) -> Unit = {},
    ) {
        if (!retained(table, id)) {
            markChanged()
            val values = InsertStatement<Number>(table).also { table.body(it) }.values.toMap()
            removals[table to id] = PendingRevision(entityColumn, id, owner, values)
        }
    }

    private companion object {
        /** Размер пакета замены редакций: как в остальной пакетной записи. */
        const val REVISION_BATCH = 250

        /** Представления значений, в которых адрес всегда содержит оформление: их строки читаются по оформлению. */
        val SNAPSHOT_SCOPES: Map<Table, Column<*>> = mapOf(
            VariationPropertyValuesTable to VariationPropertyValuesTable.appearanceId,
            InvariantPropertyValuesTable to InvariantPropertyValuesTable.appearanceId,
            StyleCombinationsTable to StyleCombinationsTable.appearanceId,
            AppearanceCombinationsTable to AppearanceCombinationsTable.appearanceId,
            // Значения оси: адрес содержит ось оформления, поэтому строки читаются по оси, а не по значению.
            AppearanceVariationValuesTable to AppearanceVariationValuesTable.appearanceVariationId,
        )
    }
}
