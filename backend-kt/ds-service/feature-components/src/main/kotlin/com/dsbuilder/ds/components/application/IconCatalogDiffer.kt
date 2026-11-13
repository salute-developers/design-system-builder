package com.dsbuilder.ds.components.application

import com.dsbuilder.ds.components.domain.IconEntry
import com.dsbuilder.ds.components.domain.LegacyIconValue

/** Различия каталогов, защита используемых иконок и сверка значений. */
internal object IconCatalogDiffer {
    private const val NAMES_LIMIT = 200
    private const val UNRESOLVED_LIMIT = 50

    fun diff(old: List<IconEntry>, new: List<IconEntry>): IconCatalogDiff {
        val before = old.associate { it.name to it.contentHash }
        val after = new.associate { it.name to it.contentHash }
        val added = (after.keys - before.keys).sorted()
        val removed = (before.keys - after.keys).sorted()
        val changed = after.keys.filter { it in before && before[it] != after[it] }.sorted()
        return IconCatalogDiff(
            added = added.size,
            removed = removed.size,
            changed = changed.size,
            unchanged = new.size - added.size - changed.size,
            addedNames = added.take(NAMES_LIMIT),
            removedNames = removed.take(NAMES_LIMIT),
            changedNames = changed.take(NAMES_LIMIT),
            truncated = listOf(added, removed, changed).any { it.size > NAMES_LIMIT },
        )
    }

    /** Иконки и размеры, которые есть в [old], используются значениями и пропадают из [new]. */
    fun removedInUse(old: List<IconEntry>, new: List<IconEntry>, used: Map<String, Int>): List<RemovedIconInUse> {
        val before = old.associateBy { it.legacyKey }
        val after = new.associateBy { it.legacyKey }
        val gone = used.entries.mapNotNull { (value, count) ->
            val (key, size) = LegacyIconValue.parse(value) ?: return@mapNotNull null
            val icon = before.resolve(
                key,
            )?.takeIf { size in it.sizes && after.resolve(key)?.sizes?.contains(size) != true }
            icon?.let { Triple(it.name, size.px, count) }
        }
        return gone.groupBy { it.first }.map { (name, rows) ->
            RemovedIconInUse(name, rows.map { it.second }.distinct().sorted(), rows.sumOf { it.third })
        }.sortedBy { it.name }
    }

    fun reconcile(new: List<IconEntry>, used: Map<String, Int>): IconReconciliation {
        val byKey = new.associateBy { it.legacyKey }
        val unresolved = used.keys.filterNot { value ->
            LegacyIconValue.parse(value)?.let { (key, size) -> byKey.resolve(key)?.sizes?.contains(size) } == true
        }.sorted()
        return IconReconciliation(
            resolved = used.size - unresolved.size,
            unresolved = unresolved.size,
            unresolvedValues = unresolved.take(UNRESOLVED_LIMIT),
        )
    }

    private fun Map<String, IconEntry>.resolve(key: String): IconEntry? =
        LegacyIconValue.candidates(key).firstNotNullOfOrNull(::get)
}
