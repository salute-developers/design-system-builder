package com.dsbuilder.app.presentation

import io.ktor.http.HttpMethod

/**
 * Что разрешено origin плагинов: у iframe Figma-плагина origin `null`, такой же у любого sandbox-iframe, поэтому
 * доступны только вход и чтение. Авторизация запроса от origin не зависит.
 */
internal class PluginCorsPolicy(private val origins: Set<String>, realm: String) {
    private val authenticationPaths = setOf(
        "/realms/$realm/protocol/openid-connect/auth/device",
        "/auth/token",
        "/auth/logout",
    )

    /** Разрешён ли запрос метода [method] на [path]; для preflight — метод фактического запроса. */
    fun allows(origin: String, method: String?, path: String): Boolean = origin in origins && when (method) {
        HttpMethod.Post.value -> path in authenticationPaths
        HttpMethod.Get.value -> path == PROJECTS_PATH || path.startsWith("$PROJECTS_PATH/")
        else -> false
    }

    /**
     * Методы для ответа origin плагина: только разрешённый, иначе браузер закэширует весь список на адрес и отправит
     * запись без нового preflight.
     */
    fun allowedMethods(path: String): String =
        if (path in authenticationPaths) "POST, OPTIONS" else "GET, OPTIONS"

    private companion object {
        const val PROJECTS_PATH = "/api/projects"
    }
}
