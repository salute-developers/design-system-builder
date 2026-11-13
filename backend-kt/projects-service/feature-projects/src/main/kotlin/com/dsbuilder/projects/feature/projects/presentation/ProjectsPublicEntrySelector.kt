package com.dsbuilder.projects.feature.projects.presentation

import io.ktor.server.routing.RouteSelector
import io.ktor.server.routing.RouteSelectorEvaluation
import io.ktor.server.routing.RoutingResolveContext

internal class ProjectsPublicEntrySelector : RouteSelector() {
    override suspend fun evaluate(context: RoutingResolveContext, segmentIndex: Int): RouteSelectorEvaluation =
        RouteSelectorEvaluation.Success(RouteSelectorEvaluation.qualityTransparent)
}
