package com.dsbuilder.ds.themes.application.sizetokens

import com.dsbuilder.ds.themes.domain.sizetokens.ComponentUsage
import com.dsbuilder.ds.themes.domain.sizetokens.RadiusOffset
import java.util.UUID

/** Использование токенов компонентами по имени токена; [designSystemId] — дизайн-система, к которой оно относится. */
internal class FakeSizeTokenUsageRepository(
    private val designSystemId: UUID,
    private val usage: Map<String, List<ComponentUsage>> = emptyMap(),
    private val offsets: Map<String, List<RadiusOffset>> = emptyMap(),
) : SizeTokenUsageRepository {
    override suspend fun usage(designSystemId: UUID, tokens: Map<UUID, String>): Map<String, List<ComponentUsage>> =
        if (designSystemId == this.designSystemId) usage.filterKeys { it in tokens.values } else emptyMap()

    override suspend fun adjustments(designSystemId: UUID, tokens: Map<UUID, String>): Map<String, List<RadiusOffset>> =
        if (designSystemId == this.designSystemId) offsets.filterKeys { it in tokens.values } else emptyMap()
}
