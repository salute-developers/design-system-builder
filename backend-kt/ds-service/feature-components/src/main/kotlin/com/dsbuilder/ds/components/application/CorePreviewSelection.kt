package com.dsbuilder.ds.components.application

import com.dsbuilder.ds.core.domain.CoreReleaseSnapshot

/** Preview и его происхождение в выбранной границе ДС. */
data class CorePreviewSelection(
    /** Совместимая preview-сборка выбранного Core. */
    val build: ActivePluginBuild,
    /** Core, которому принадлежит состав API и preview. */
    val coreRelease: CoreReleaseSnapshot,
)
