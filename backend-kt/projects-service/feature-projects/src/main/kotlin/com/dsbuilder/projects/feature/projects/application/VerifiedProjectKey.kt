package com.dsbuilder.projects.feature.projects.application

/**
 * Минимальный результат проверки ключа для входного адаптера.
 * @property keyId Проверенный идентификатор ключа.
 * @property projectId Проект, которому принадлежит ключ.
 * @property scopes Действующие области доступа.
 */
data class VerifiedProjectKey(val keyId: String, val projectId: String, val scopes: Set<String>)
