package com.dsbuilder.app.presentation

import io.ktor.server.routing.PathSegmentConstantRouteSelector
import io.ktor.server.routing.PathSegmentOptionalParameterRouteSelector
import io.ktor.server.routing.PathSegmentParameterRouteSelector
import io.ktor.server.routing.PathSegmentTailcardRouteSelector
import io.ktor.server.routing.Route
import io.ktor.server.routing.RoutingNode

/** Проверяет публичную границу до авторизации и выполнения предметного маршрута. */
internal fun publicGatewayPath(path: String): Boolean =
    path in setOf("/health", "/ready", "/admin", "/api/projects", "/api/projects/") ||
        path in setOf("/api/admin/component-config/import-api-meta", "/api/admin/compose-preview/plugin-builds") ||
        listOf("/api/projects/", "/auth/", "/realms/", "/resources/", "/admin/").any(path::startsWith)

/** Перебирает зарегистрированные конечные маршруты и запрещает случайную публикацию внутренних API. */
internal fun requirePublicRoutes(root: Route) {
    fun visit(node: RoutingNode, segments: List<String>) {
        val pathSegments = when (val selector = node.selector) {
            is PathSegmentConstantRouteSelector, is PathSegmentParameterRouteSelector,
            is PathSegmentOptionalParameterRouteSelector,
            -> segments + selector.toString()
            is PathSegmentTailcardRouteSelector -> segments + "${selector.prefix}{${selector.name}...}"
            else -> segments
        }
        if (node.children.isEmpty()) {
            val path = "/" + pathSegments.filter(String::isNotEmpty).joinToString("/").trim('/')
            // Единственный wildcard принадлежит ограниченному прокси Keycloak; вход проверяет каждый реальный путь.
            require(path == "/{path...}" || publicGatewayPath(path)) { "Non-public backend route: $path" }
        }
        node.children.forEach { visit(it, pathSegments) }
    }
    visit(root as RoutingNode, emptyList())
}
