package com.dsbuilder.ds.components.application

import com.dsbuilder.ds.components.domain.ComponentDependencyGraph
import com.dsbuilder.ds.components.domain.ComponentReuseConfig
import java.util.UUID

/** Граф и настройки переиспользования в одном снимке. */
data class ComponentDependenciesWithReuseConfig(
    /** Граф зависимостей компонента. */ val graph: ComponentDependencyGraph,
    /** Настройки переиспользования по ID зависимости. */ val reuseConfigs: Map<UUID, List<ComponentReuseConfig>>,
)
