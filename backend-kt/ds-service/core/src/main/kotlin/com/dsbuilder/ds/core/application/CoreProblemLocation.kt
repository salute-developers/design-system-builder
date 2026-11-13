package com.dsbuilder.ds.core.application

import java.util.UUID

/** Адрес сохранённого назначения, одинаковый в сводке и редакторе. */
data class CoreProblemLocation(
    /** Устойчивый ID компонента. */
    val componentId: UUID,
    /** Диагностическое имя, доступное и после удаления из Core. */
    val componentName: String,
    /** Платформа компонента для перехода без загрузки каталога редактора. */
    val platform: String,
    /** ID оформления; отсутствует у проблемы компонента целиком. */
    val appearanceId: UUID?,
    /** Название сохранённого оформления. */
    val appearanceName: String?,
    /** Устойчивый ID свойства, включая исчезнувшее из Core. */
    val propertyId: UUID?,
    /** Диагностическое имя свойства. */
    val propertyName: String?,
    /** Область назначения: invariant, variation или combination. */
    val valueKind: String?,
    /** ID сохранённого назначения для исправления. */
    val valueId: UUID?,
    /** ID значений вариаций, задающих область назначения. */
    val styleIds: List<UUID> = emptyList(),
    /** Подписи осей и значений для точного перехода в редактор. */
    val styleLabels: List<String> = emptyList(),
    /** Названия системных и компонентных состояний назначения. */
    val states: List<String> = emptyList(),
    /** Предметная ревизия для optimistic concurrency; null для исходного значения. */
    val revision: Long? = null,
)
