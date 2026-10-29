package com.dsbuilder.ds.components.domain

/** Parent and child dependency projections returned by the nested component route. */
data class ComponentDependencyGraph(
    /** As parent carried by this contract. */
    val asParent: List<WithChild>,
    /** As child carried by this contract. */
    val asChild: List<WithParent>,
) {
    /** Dependency decorated with its child component. */
    data class WithChild(
        /** Dependency carried by this contract. */
        val dependency: ComponentDependency,
        /** Child carried by this contract. */
        val child: Component,
    )

    /** Dependency decorated with its parent component. */
    data class WithParent(
        /** Dependency carried by this contract. */
        val dependency: ComponentDependency,
        /** Parent carried by this contract. */
        val parent: Component,
    )
}
