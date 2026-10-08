package com.dsbuilder.ds.themes.application.palette

import com.dsbuilder.ds.themes.domain.palette.PaletteGroupView
import com.dsbuilder.ds.themes.domain.palette.PaletteRampView
import com.dsbuilder.ds.themes.domain.palette.PaletteTokenAssignment
import com.dsbuilder.ds.themes.domain.palette.ThemePalette

/** Группа палитры после операции. */
internal fun ThemePalette.groupView(groupId: String): PaletteGroupView = groups.single { it.id == groupId }

/** Растяжка группы после операции. */
internal fun ThemePalette.rampView(target: TenantPaletteRampTarget): PaletteRampView =
    checkNotNull(ramp(target.groupId, target.slot)) { "Растяжка ${target.slot.key} не входит в группу" }

/** Принадлежность токена после операции. */
internal fun ThemePalette.assignmentOf(
    tokenId: String,
): PaletteTokenAssignment = tokens.single { it.tokenId == tokenId }
