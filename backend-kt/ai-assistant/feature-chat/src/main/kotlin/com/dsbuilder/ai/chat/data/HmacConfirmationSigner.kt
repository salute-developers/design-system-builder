package com.dsbuilder.ai.chat.data

import com.dsbuilder.ai.chat.application.ConfirmationCheck
import com.dsbuilder.ai.chat.application.ConfirmationSigner
import com.dsbuilder.ai.chat.application.PendingOperation
import com.dsbuilder.ai.chat.domain.ChatScope
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put
import java.security.MessageDigest
import java.security.SecureRandom
import java.time.Clock
import java.time.Instant
import java.util.Base64
import java.util.UUID
import javax.crypto.Mac
import javax.crypto.spec.SecretKeySpec

/**
 * Подписывает операцию HMAC-SHA256 случайным ключом процесса.
 *
 * Токен — `base64url(payload).base64url(подпись)`. В payload нет учётных данных пользователя.
 * Неизвестный `kid` означает перезапуск процесса и даёт [ConfirmationCheck.Expired].
 */
internal class HmacConfirmationSigner(
    private val clock: Clock = Clock.systemUTC(),
    private val keyId: String = UUID.randomUUID().toString(),
    private val key: ByteArray = ByteArray(KEY_BYTES).also(SecureRandom()::nextBytes),
) : ConfirmationSigner {
    override fun issue(operation: PendingOperation): String {
        val payload = canonical(
            buildJsonObject {
                put("kid", keyId)
                put("callId", operation.callId)
                put("tool", operation.tool)
                put("arguments", operation.arguments)
                put("idempotencyKey", operation.idempotencyKey)
                put("draftId", operation.draftId)
                put("userId", operation.scope.userId)
                put("projectId", operation.scope.projectId)
                put("designSystemId", operation.scope.designSystemId)
                put("expiresAt", operation.expiresAt.toEpochMilli())
            },
        ).toByteArray()
        return encoder.encodeToString(payload) + "." + encoder.encodeToString(sign(payload))
    }

    @Suppress("ReturnCount")
    override fun verify(token: String, scope: ChatScope): ConfirmationCheck {
        val parts = token.split('.')
        if (parts.size != 2) return ConfirmationCheck.Invalid
        val payloadBytes = runCatching { decoder.decode(parts[0]) }.getOrNull() ?: return ConfirmationCheck.Invalid
        val signature = runCatching { decoder.decode(parts[1]) }.getOrNull() ?: return ConfirmationCheck.Invalid
        // Только каноническое кодирование: иначе тот же подписанный токен получил бы другой хеш и обошёл бы
        // правило «первое решение по подтверждению окончательное».
        if (encoder.encodeToString(payloadBytes) != parts[0] || encoder.encodeToString(signature) != parts[1]) {
            return ConfirmationCheck.Invalid
        }
        val payload = runCatching { Json.parseToJsonElement(payloadBytes.decodeToString()).jsonObject }.getOrNull()
            ?: return ConfirmationCheck.Invalid
        if (payload.text("kid") != keyId) return ConfirmationCheck.Expired
        if (!MessageDigest.isEqual(sign(payloadBytes), signature)) return ConfirmationCheck.Invalid
        val expiresAt = payload["expiresAt"]?.jsonPrimitive?.content?.toLongOrNull()?.let(Instant::ofEpochMilli)
            ?: return ConfirmationCheck.Invalid
        if (!clock.instant().isBefore(expiresAt)) return ConfirmationCheck.Expired
        val tokenScope = ChatScope(payload.text("userId"), payload.text("projectId"), payload.text("designSystemId"))
        if (tokenScope != scope) return ConfirmationCheck.Invalid
        return ConfirmationCheck.Valid(
            PendingOperation(
                callId = payload.text("callId"),
                tool = payload.text("tool"),
                arguments = payload["arguments"] as? JsonObject ?: return ConfirmationCheck.Invalid,
                idempotencyKey = payload.text("idempotencyKey"),
                draftId = payload.text("draftId"),
                scope = tokenScope,
                expiresAt = expiresAt,
            ),
        )
    }

    override fun hash(token: String): String = tokenHash(token)

    private fun sign(payload: ByteArray): ByteArray =
        Mac.getInstance(ALGORITHM).apply { init(SecretKeySpec(key, ALGORITHM)) }.doFinal(payload)

    private fun JsonObject.text(name: String): String = (get(name) as? JsonPrimitive)?.content.orEmpty()

    companion object {
        private const val ALGORITHM = "HmacSHA256"
        private const val KEY_BYTES = 32
        private val encoder = Base64.getUrlEncoder().withoutPadding()
        private val decoder = Base64.getUrlDecoder()

        /** Хеш токена для связи подтверждения с ходом; сам токен в хранилище не попадает. */
        fun tokenHash(token: String): String =
            encoder.encodeToString(MessageDigest.getInstance("SHA-256").digest(token.toByteArray()))

        /** Канонический JSON: ключи объектов отсортированы на всех уровнях. */
        fun canonical(element: JsonElement): String = when (element) {
            is JsonObject -> element.keys.sorted().joinToString(",", "{", "}") { key ->
                JsonPrimitive(key).toString() + ":" + canonical(element.getValue(key))
            }
            is JsonArray -> element.joinToString(",", "[", "]") { canonical(it) }
            else -> element.toString()
        }
    }
}
