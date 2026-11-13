package com.dsbuilder.ds.core.application

import java.util.UUID

/** Предметный адрес, по которому определяется DS чтения.
 * @property kind Тип ресурса.
 * @property id Идентификатор ресурса.
 */
data class ModelReadTarget(val kind: Kind, val id: UUID) {
    /** Тип устойчивого ресурса; глобальный компонент не определяет единственную DS. */
    enum class Kind { DESIGN_SYSTEM, TOKEN, TENANT, APPEARANCE, VERSION_HISTORY }
}
