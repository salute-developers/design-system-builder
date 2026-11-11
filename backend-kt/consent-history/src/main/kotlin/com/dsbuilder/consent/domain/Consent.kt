package com.dsbuilder.consent.domain

/**
 * Анонимная область журнала, не связанная с идентификатором Метрики.
 * @property subjectHash SHA-256 отдельного ключа клиента.
 * @property clientGroup Веб или общая установка CLI/MCP.
 */
data class ConsentScope(val subjectHash: String, val clientGroup: String)

/**
 * Неизменяемая редакция показанного уведомления.
 * @property version Неизменяемая редакция уведомления.
 * @property sha256 Хеш точных UTF-8 байтов.
 * @property text Уведомление, целиком показываемое перед выбором.
 */
data class ConsentPolicy(val version: String, val sha256: String, val text: String)

/**
 * Серверная квитанция сохранённого решения.
 * @property revision Последовательный номер решения в области.
 * @property requestId Ключ идемпотентного повтора.
 * @property decision Разрешение, отказ или отзыв.
 * @property policyVersion Редакция показанного уведомления.
 * @property policySha256 Хеш уведомления.
 * @property receivedAt Время БД после сохранения.
 * @property appVersion Необязательная заявленная версия клиента.
 */
data class ConsentReceipt(
    val revision: Long,
    val requestId: String,
    val decision: String,
    val policyVersion: String,
    val policySha256: String,
    val receivedAt: String,
    val appVersion: String?,
)

/**
 * Намерение клиента; ревизия и время новой записи назначаются сервером.
 * @property requestId Идентификатор пользовательского действия.
 * @property decision Запрошенное решение.
 * @property expectedRevision Последняя известная клиенту ревизия.
 * @property policyVersion Показанная редакция для разрешения.
 * @property policySha256 Хеш показанной редакции для разрешения.
 * @property appVersion Необязательная версия клиента.
 */
data class ConsentInput(
    val requestId: String,
    val decision: String,
    val expectedRevision: Long,
    val policyVersion: String?,
    val policySha256: String?,
    val appVersion: String?,
)

/**
 * Результат идемпотентной регистрации вместе с текущим решением.
 * @property receipt Квитанция записанного или повторённого действия.
 * @property current Последнее решение области.
 * @property created Создана ли новая строка.
 */
data class ConsentRecord(val receipt: ConsentReceipt, val current: ConsentReceipt, val created: Boolean)

/** Ожидаемый конфликт решения, не ошибка инфраструктуры. */
class ConsentConflict : IllegalStateException("Consent state conflict")
