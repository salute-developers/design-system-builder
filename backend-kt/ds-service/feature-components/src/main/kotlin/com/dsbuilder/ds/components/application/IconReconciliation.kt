package com.dsbuilder.ds.components.application

/** Отчёт сверки значений `icon` с загружаемым каталогом. */
data class IconReconciliation(
    /** Число различных разрешаемых значений. */
    val resolved: Int,
    /** Число различных неразрешаемых значений. */
    val unresolved: Int,
    /** Неразрешаемые значения, не более 50. */
    val unresolvedValues: List<String>,
)
