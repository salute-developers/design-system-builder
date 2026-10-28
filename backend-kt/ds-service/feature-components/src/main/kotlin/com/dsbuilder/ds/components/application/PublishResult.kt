package com.dsbuilder.ds.components.application

import com.dsbuilder.ds.components.domain.ApiMetaImportReport
import com.dsbuilder.ds.components.domain.PluginBuild

/** Итог публикации. */
data class PublishResult(
    /** Что произошло с билдом. */
    val kind: PublishKind,
    /** Билд (при пробной отправке: предполагаемый). */
    val build: PluginBuild,
    /** Публичный адрес каталога билда. */
    val pluginUrl: String,
    /** Отчёт импорта меты. */
    val report: ApiMetaImportReport,
)
