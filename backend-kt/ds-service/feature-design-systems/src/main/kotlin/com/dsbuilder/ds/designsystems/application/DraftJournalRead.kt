package com.dsbuilder.ds.designsystems.application

import com.dsbuilder.ds.core.application.ModelReadItems
import com.dsbuilder.ds.designsystems.domain.DraftChange

/** Журнал и точный счётчик одного снимка; для ограниченной страницы счётчик может отсутствовать.
 * @property changes Записи и метаданные страницы.
 * @property total Точное число отображаемых строк.
 */
data class DraftJournalRead(val changes: ModelReadItems<DraftChange>, val total: Int?)
