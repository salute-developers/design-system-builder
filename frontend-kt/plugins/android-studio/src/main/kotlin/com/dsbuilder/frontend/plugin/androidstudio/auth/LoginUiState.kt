package com.dsbuilder.frontend.plugin.androidstudio.auth

/**
 * Состояние экрана логина плагина.
 */
public sealed interface LoginUiState {
    /** Пользователь ещё не начал вход; кнопка "Войти" активна. */
    public data object Idle : LoginUiState

    /** OAuth-флоу выполняется (открыт браузер, ждём redirect и обмен токенов); кнопка отключена. */
    public data object Loading : LoginUiState

    /**
     * Флоу завершился ошибкой.
     *
     * @property message сообщение для пользователя, без секретов.
     */
    public data class Error(
        public val message: String,
    ) : LoginUiState
}
