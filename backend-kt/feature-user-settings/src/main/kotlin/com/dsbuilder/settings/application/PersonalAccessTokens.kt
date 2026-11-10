package com.dsbuilder.settings.application

/** Результат проверки PAT без секрета и данных хранения.
 * @property tokenId идентификатор токена.
 * @property userId проверенный владелец.
 * @property scopes выбранные разрешения.
 * @property systemAdmin актуальная глобальная роль.
 */
data class VerifiedPersonalAccessToken(
    val tokenId: String,
    val userId: String,
    val scopes: Set<String>,
    val systemAdmin: Boolean,
)

/** Прикладная граница авторизации PAT для монолита. */
interface PersonalAccessTokens {
    /** Проверяет секрет, отзыв, срок и актуальные права владельца. */
    suspend fun verify(secret: String): PersonalAccessTokenVerification
}

/** Проверка отделяет неверные данные от недоступности проверки личности. */
sealed interface PersonalAccessTokenVerification {
    /** Действительный токен. */
    data class Valid(
        /** Проверенный владелец и разрешения. */ val token: VerifiedPersonalAccessToken,
    ) : PersonalAccessTokenVerification

    /** Неверный, отозванный токен либо отключённый владелец. */
    data object Invalid : PersonalAccessTokenVerification

    /** Проверка временно недоступна; доступ запрещён. */
    data object Unavailable : PersonalAccessTokenVerification
}
