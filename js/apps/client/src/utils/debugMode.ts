const DEBUG_MODE_KEY = 'debug_mode';

// Дебаг-меню скрыто во всех окружениях, включается вручную: localStorage.setItem('debug_mode', 'true')
export const isDebugMode = () => {
    try {
        return localStorage.getItem(DEBUG_MODE_KEY) === 'true';
    } catch {
        return false;
    }
};
