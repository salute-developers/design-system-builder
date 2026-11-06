package com.dsbuilder.identity.auth.application.port

/** Проверка персонального токена без зависимости шлюза от хранения. */
fun interface PersonalAccessTokenVerifier {
    /** Проверяет секрет и актуальную личность владельца. */
    suspend fun verify(token: String): PersonalAccessTokenResult
}

/** Результат проверки не раскрывает секрет и хеш. */
sealed interface PersonalAccessTokenResult {
    /** Действительный токен и текущие права владельца. */
    data class Valid(
        /** Идентификатор PAT. */
        val tokenId: String,
        /** Идентификатор владельца. */
        val userId: String,
        /** Выбранные scopes. */
        val scopes: Set<String>,
        /** Актуальная глобальная роль. */
        val systemAdmin: Boolean,
    ) : PersonalAccessTokenResult

    /** Неверный токен. */
    data object Invalid : PersonalAccessTokenResult

    /** Временная недоступность проверки. */
    data object Unavailable : PersonalAccessTokenResult
}
