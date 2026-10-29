package com.dsbuilder.ds.themes.domain.colortokens

import com.dsbuilder.ds.themes.domain.ThemeTokenType

/**
 * Цветовой токен экрана редактора — семейство определений одного типа с общими группой и именем:
 * `<group>.<subgroup>.<name>` и `<group>.<subgroup>.<name>-<state>`.
 */
data class ColorTokenFamily(
    /** Тип определений: `color` или `gradient`. */
    val type: ThemeTokenType,
    /** Группа, например `text` или `surface`. */
    val group: String,
    /** Имя без подгруппы и состояния, например `accent-minor`. */
    val name: String,
) {
    /** Полное имя обязательного члена семейства `<group>.default.<name>`. */
    fun defaultMember(): String = "$group.$DEFAULT_SUBGROUP.$name"

    /**
     * Входит ли определение типа [definitionType] с полным именем [fullName] в семейство. Членство определяется
     * правилом имени независимо от текущего типа: тип производный, и после отката одного определения члены
     * семейства могут временно иметь разные типы из [TYPES].
     */
    fun memberOf(definitionType: ThemeTokenType, fullName: String): Boolean =
        of(definitionType, fullName)?.let { it.group == group && it.name == name } == true

    companion object {
        /** Суффиксы состояний членов семейства. */
        val STATES: List<String> = listOf("hover", "active", "brightness")

        /** Подгруппа значений Light и Dark. */
        const val DEFAULT_SUBGROUP = "default"

        private val CONTEXT_SUBGROUPS = setOf(DEFAULT_SUBGROUP, "on-dark", "on-light", "inverse")
        private val BACKGROUND_SUBGROUPS = setOf(DEFAULT_SUBGROUP, "dark", "light", "inverse")
        private const val BACKGROUND_GROUP = "background"
        private const val SEGMENTS = 3

        /** Типы токенов, которые образуют семейства. */
        val TYPES: Set<ThemeTokenType> = setOf(ThemeTokenType.COLOR, ThemeTokenType.GRADIENT)

        /** Семейство определения [fullName] типа [type] или `null`, если имя не соответствует правилу. */
        fun of(type: ThemeTokenType, fullName: String): ColorTokenFamily? {
            val segments = fullName.split('.')
            if (type !in TYPES || segments.size != SEGMENTS || TokenNameRule.validate(fullName) != null) return null
            val (group, subgroup, member) = segments
            val subgroups = if (group == BACKGROUND_GROUP) BACKGROUND_SUBGROUPS else CONTEXT_SUBGROUPS
            if (subgroup !in subgroups) return null
            val name = STATES.firstNotNullOfOrNull { state -> member.removeSuffix("-$state").takeIf { it != member } }
                ?: member
            return ColorTokenFamily(type, group, name)
        }
    }
}
