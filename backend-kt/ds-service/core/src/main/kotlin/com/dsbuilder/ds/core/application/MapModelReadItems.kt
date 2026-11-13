package com.dsbuilder.ds.core.application

/** Сохраняет метаданные при преобразовании строки хранилища в предметное значение. */
fun <T, R> ModelReadItems<T>.mapItems(transform: (T) -> R): ModelReadItems<R> =
    ModelReadItems(items.map(transform), page)
