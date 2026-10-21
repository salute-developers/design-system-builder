package com.dsbuilder.ds.themes.application.sizetokens

import com.dsbuilder.ds.core.domain.ProjectId
import com.dsbuilder.ds.themes.application.palette.TenantPaletteRepository
import com.dsbuilder.ds.themes.application.palette.hasSystemGroups
import com.dsbuilder.ds.themes.domain.palette.PaletteReference
import com.dsbuilder.ds.themes.domain.palette.ThemePaletteBuilder
import com.dsbuilder.ds.themes.domain.palette.ThemePaletteResolver
import java.util.UUID

/**
 * Палитра темы для цветов слоёв тени: проверка ссылок на ступени при записи и раскрытие их в HEX при чтении, как у
 * стопов градиента в `add-color-token-gradients`.
 */
internal class ShadowColorPalette(private val palette: TenantPaletteRepository) {
    /**
     * Поле первой ссылки из [references], ступени которой нет в копии шаблона палитры темы [tenantId], или `null`.
     * Тема, созданная в обход `ds-service`, получает копию шаблона здесь же; вызывается только в записи.
     */
    suspend fun missingStep(tenantId: UUID, references: List<Pair<String, PaletteReference>>): String? {
        if (references.isEmpty()) return null
        val template = palette.template(tenantId).ifEmpty {
            palette.initialize(tenantId)
            palette.template(tenantId)
        }
        return references.firstOrNull { (_, reference) ->
            template[reference.ramp]?.containsKey(reference.step) != true
        }?.first
    }

    /**
     * Раскрытие ссылок по палитре темы [tenantId] на границе транзакции: экземпляр растяжки группы токена, иначе копия
     * шаблона. Без системных групп палитры ссылки не раскрываются.
     */
    suspend fun resolver(projectId: ProjectId, tenantId: UUID): ShadowColorResolver {
        val snapshot = palette.snapshot(projectId, tenantId)?.takeIf { it.hasSystemGroups() }
            ?: return { _, _ -> null }
        val built = ThemePaletteBuilder.build(
            tenantId.toString(),
            false,
            snapshot.state,
            snapshot.tokens,
            snapshot.values,
        )
        return { tokenName, reference -> ThemePaletteResolver.resolve(built, tokenName, reference) }
    }
}
