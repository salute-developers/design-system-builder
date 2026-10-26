package com.dsbuilder.ds.core.application

/** Фильтры существующих списков; отсутствие ограничения сохраняет полную выдачу.
 * @property limit Максимальный размер страницы.
 * @property cursor Продолжение предыдущей страницы.
 * @property name Точное имя ресурса.
 * @property query Подстрока имени ресурса.
 * @property platform Платформа компонента.
 * @property groupId Группа токена или палитры.
 * @property parentId Родитель группы токенов.
 * @property type Тип токена или цвета.
 * @property shade Оттенок цвета.
 * @property version Точный номер версии для списка публикаций.
 */
data class ModelReadQuery(
    val limit: Int? = null,
    val cursor: String? = null,
    val name: String? = null,
    val query: String? = null,
    val platform: String? = null,
    val groupId: String? = null,
    val parentId: String? = null,
    val type: String? = null,
    val shade: String? = null,
    val version: String? = null,
    /** Привязка страницы формируется сервером после разрешения фактической границы. */
    val scope: String = "",
)
