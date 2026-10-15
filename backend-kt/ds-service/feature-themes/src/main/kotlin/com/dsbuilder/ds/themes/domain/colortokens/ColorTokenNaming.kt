package com.dsbuilder.ds.themes.domain.colortokens

/** Имена членов семейства при переносе и переименовании цветового токена. */
object ColorTokenNaming {
    /**
     * Полное имя члена [member] после переноса в группу с кодом [group] и переименования в [name]:
     * контекст и суффикс состояния сохраняются.
     */
    fun rename(member: String, group: String, name: String): String {
        val (_, context, last) = member.split('.')
        val state = ColorTokenFamily.STATES.firstOrNull { last.endsWith("-$it") }?.let { "-$it" }.orEmpty()
        return "$group.$context.$name$state"
    }

    /** Полное имя члена [member] с первым сегментом [group]. */
    fun withGroup(member: String, group: String): String = "$group.${member.substringAfter('.')}"

    /**
     * Отображаемое имя по правилу сида: `<контекст><Группа><Имя><Состояние>` в camelCase, без контекста `default`.
     * `text.default.accent-hover` → `textAccentHover`, `text.on-dark.accent` → `onDarkTextAccent`.
     */
    fun displayName(member: String): String {
        val (group, context, last) = member.split('.')
        val parts = listOfNotNull(context.takeIf { it != ColorTokenFamily.DEFAULT_SUBGROUP }, group, last)
            .flatMap { it.split('-') }
            .filter(String::isNotEmpty)
        return parts.mapIndexed { index, part ->
            if (index == 0) part else part.replaceFirstChar(Char::uppercaseChar)
        }.joinToString("")
    }
}
