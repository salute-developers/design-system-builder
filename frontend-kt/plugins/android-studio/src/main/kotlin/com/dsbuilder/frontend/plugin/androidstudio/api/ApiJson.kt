package com.dsbuilder.frontend.plugin.androidstudio.api

import kotlinx.serialization.json.Json

/**
 * `Json`, используемый для разбора ответов REST API DS Builder. `ignoreUnknownKeys = true`
 * обязателен: ответы backend'а содержат больше полей, чем нужно клиенту (например
 * `status`/`ownerUserId`/`createdAt` у проекта) — без этого флага разбор падает на первом же
 * реальном ответе, хотя ровно совпадающие с DTO тестовые фикстуры этого не показывают.
 */
internal val ApiJson: Json = Json { ignoreUnknownKeys = true }
