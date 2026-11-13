package com.dsbuilder.ds.components.application

import java.time.Instant

/** Загрузка каталога, найденная в хранилище. */
data class StoredIconLoad(
    /** Идентификатор загрузки. */
    val loadId: String,
    /** Время последнего изменения файлов загрузки. */
    val lastModified: Instant,
)
