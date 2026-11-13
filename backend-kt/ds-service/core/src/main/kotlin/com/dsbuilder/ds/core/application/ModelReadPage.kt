package com.dsbuilder.ds.core.application

/** Метаданные ограниченного ответа; полный ответ не получает заголовков страницы.
 * @property limit Применённый размер страницы.
 * @property nextCursor Продолжение, если остались элементы.
 */
data class ModelReadPage(val limit: Int, val nextCursor: String? = null)
