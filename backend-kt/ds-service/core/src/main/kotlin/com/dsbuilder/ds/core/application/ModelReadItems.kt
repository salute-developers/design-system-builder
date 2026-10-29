package com.dsbuilder.ds.core.application

/** Страница предметных значений до преобразования в HTTP DTO.
 * @property items Элементы текущей страницы.
 * @property page Метаданные ограниченного ответа.
 */
data class ModelReadItems<T>(val items: List<T>, val page: ModelReadPage? = null)
