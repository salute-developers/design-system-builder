package com.dsbuilder.ds.themes.presentation.palette

import com.dsbuilder.ds.themes.domain.palette.PaletteGroupView
import com.dsbuilder.ds.themes.domain.palette.PaletteLink
import com.dsbuilder.ds.themes.domain.palette.PaletteRampRef
import com.dsbuilder.ds.themes.domain.palette.PaletteRampView
import com.dsbuilder.ds.themes.domain.palette.PaletteTokenAssignment
import com.dsbuilder.ds.themes.domain.palette.ThemePalette

/** Ответ чтения палитры темы. */
internal fun ThemePalette.toResponse() = ThemePaletteResponse(
    tenantId = tenantId,
    editRevision = editRevision,
    canEdit = canEdit,
    offBrand = offBrand,
    groups = groups.map { it.toDto() },
    tokens = tokens.map { it.toDto() },
    template = template.map { PaletteTemplateRampDto(it.ramp.type.wireValue, it.ramp.shade, it.steps.toStepValues()) },
)

/** Группа палитры в контракте. */
internal fun PaletteGroupView.toDto() =
    PaletteGroupDto(id, kind.wireValue, systemKey?.wireValue, label, ramps.map { it.toDto() })

/** Растяжка группы в контракте. */
internal fun PaletteRampView.toDto() = PaletteRampDto(
    slot = slot.toDto(),
    source = source.toDto(),
    displayName = displayName,
    origin = origin.wireValue,
    anchor = anchor?.let { PaletteAnchorDto(it.step, it.value) },
    added = added,
    modified = modified,
    linkedCount = linkedCount,
    steps = steps.map { PaletteStepDto(it.step, it.value, it.templateValue, it.overridden, it.linkedCount) },
)

/** Группа токена в контракте. */
internal fun PaletteTokenAssignment.toDto() =
    PaletteTokenAssignmentDto(tokenId, tokenName, groupId, if (explicit) "explicit" else "default")

/** Связь токена в контракте. */
internal fun PaletteLink.toDto() =
    PaletteLinkDto(tokenId, tokenName, displayName, groupId, mode, step, opacity, platforms)

/** Ступени по возрастанию в контракте. */
internal fun List<Pair<Int, String>>.toStepValues() = map { (step, value) -> PaletteStepValueDto(step, value) }

private fun PaletteRampRef.toDto() = PaletteRampRefDto(type.wireValue, shade)
