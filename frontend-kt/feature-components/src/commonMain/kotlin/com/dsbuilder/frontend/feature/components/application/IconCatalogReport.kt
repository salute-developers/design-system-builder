package com.dsbuilder.frontend.feature.components.application

/**
 * Число иконок по группам различий с каталогом бэкенда.
 *
 * @property added добавленные иконки.
 * @property removed удалённые иконки.
 * @property changed изменённые иконки (SVG, размеры, категория или синонимы).
 * @property unchanged иконки без изменений.
 */
public data class IconCatalogCounts(
    public val added: Int = 0,
    public val removed: Int = 0,
    public val changed: Int = 0,
    public val unchanged: Int = 0,
)

/**
 * Используемая иконка, которую удаляет загрузка.
 *
 * @property name каноническое имя.
 * @property sizes удаляемые размеры.
 * @property references число ссылок в конфигурациях компонентов.
 */
public data class IconInUse(
    public val name: String,
    public val sizes: List<Int>,
    public val references: Int,
)

/**
 * Сверка значений `icon` в конфигурациях с каталогом.
 *
 * @property resolved число значений, найденных в каталоге.
 * @property unresolved число значений, которых в каталоге нет.
 * @property unresolvedValues значения, которых в каталоге нет.
 */
public data class IconReconciliation(
    public val resolved: Int = 0,
    public val unresolved: Int = 0,
    public val unresolvedValues: List<String> = emptyList(),
)

/**
 * Отчёт бэкенда о загрузке каталога иконок.
 *
 * @property outcome `published`, `activated` или `unchanged`; при пробной отправке — прогноз.
 * @property loadId идентификатор загрузки (содержимое каталога).
 * @property counts числа различий.
 * @property added имена добавленных иконок (список может быть усечён).
 * @property removed имена удалённых иконок (список может быть усечён).
 * @property changed имена изменённых иконок (список может быть усечён).
 * @property truncated усечены ли списки имён.
 * @property removedInUse используемые иконки, которые удаляет загрузка.
 * @property reconciliation сверка значений `icon`.
 */
public data class IconCatalogReport(
    public val outcome: String,
    public val loadId: String? = null,
    public val counts: IconCatalogCounts = IconCatalogCounts(),
    public val added: List<String> = emptyList(),
    public val removed: List<String> = emptyList(),
    public val changed: List<String> = emptyList(),
    public val truncated: Boolean = false,
    public val removedInUse: List<IconInUse> = emptyList(),
    public val reconciliation: IconReconciliation = IconReconciliation(),
)
