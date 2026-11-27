package com.dsbuilder.frontend.plugin.androidstudio.components

import com.dsbuilder.frontend.plugin.androidstudio.preview.failAssembly
import com.dsbuilder.frontend.plugin.androidstudio.preview.objects
import com.dsbuilder.frontend.plugin.androidstudio.preview.text
import com.dsbuilder.frontend.plugin.androidstudio.preview.textOrNull
import java.util.Locale

/** Полное покрытие хвоста: имена, затем longest-first authoredId значений и сочетаний. */
internal fun referenceSelections(configuration: ComponentConfiguration, names: List<String>): Map<String, String> {
    val index = ComponentReferenceIndex(configuration)
    val byNames = names.map { index.byName(it) }
    val resolved = if (byNames.all { it != null }) byNames.filterNotNull().flatten() else index.resolve(names)
    val result = linkedMapOf<String, String>()
    resolved?.forEach { (axis, value) ->
        if (result.put(axis, value)?.let { it != value } == true) {
            failAssembly("invalid_reference", names.joinToString("."), "Противоречивые значения вариации в ссылке")
        }
    } ?: failAssembly("invalid_reference", names.joinToString("."), "Не удалось разрешить хвост ссылки")
    configuration.defaultSelections().forEach { (axis, value) -> result.putIfAbsent(axis, value) }
    return result
}

private class ComponentReferenceIndex(configuration: ComponentConfiguration) {
    private val axes = configuration.axes()
    private val declarations = axes.flatMap { axis -> axis.objects("values").map { axis to it } }
    private val names = declarations.associate { (axis, value) ->
        value.text("name").orEmpty().trim().lowercase(Locale.ROOT) to
            listOf(axis.text("name").orEmpty() to value.text("name").orEmpty())
    }
    private val authored = buildMap<String, List<Pair<String, String>>> {
        declarations.filter { (_, value) -> value.objects("targets").isEmpty() }.forEach { (axis, value) ->
            value.text("authoredId")?.takeIf(String::isNotEmpty)?.let {
                putIfAbsent(it, listOf(axis.text("name").orEmpty() to value.text("name").orEmpty()))
            }
        }
        declarations.forEach { (axis, value) ->
            value.objects("targets").forEach { target ->
                val coordinates = target.objects("properties").map { coordinate ->
                    val targetAxis = axes.singleOrNull {
                        coordinate.text("id") in listOf(it.text("id"), it.text("name"), it.text("variationId"))
                    }
                    targetAxis?.text("name")?.let { it to coordinate["value"]?.textOrNull().orEmpty() }
                }
                if (coordinates.all { it != null }) {
                    value.text("authoredId")?.takeIf(String::isNotEmpty)?.let {
                        putIfAbsent(
                            it,
                            listOf(axis.text("name").orEmpty() to value.text("name").orEmpty()) +
                                coordinates.filterNotNull(),
                        )
                    }
                }
            }
        }
    }

    fun byName(name: String): List<Pair<String, String>>? = names[name.trim().lowercase(Locale.ROOT)]

    fun resolve(tail: List<String>): List<Pair<String, String>>? {
        val failed = mutableSetOf<Int>()
        fun from(start: Int): List<Pair<String, String>>? {
            if (start == tail.size || start in failed) return if (start == tail.size) emptyList() else null
            for (end in tail.size downTo start + 1) {
                val group = if (end == start + 1) byName(tail[start]) else null
                val selections = group ?: authored[tail.subList(start, end).joinToString(".")] ?: continue
                from(end)?.let { return selections + it }
            }
            failed += start
            return null
        }
        return from(0)
    }
}
