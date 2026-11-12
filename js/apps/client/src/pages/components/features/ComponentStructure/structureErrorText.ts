import axios from 'axios';

interface ErrorBody {
    code?: string;
    error?: string;
    message?: string;
}

const CYRILLIC = /[а-яё]/i;

/** Тексты по статусу ответа: сервер отвечает и по-английски, а пользователь видит только русский текст. */
const STATUS_TEXT: Array<[(status: number) => boolean, string]> = [
    [(status) => status === 401, 'Сессия истекла. Войдите снова и повторите'],
    [(status) => status === 403, 'Недостаточно прав для изменения компонента'],
    [(status) => status === 404, 'Компонент или его часть не найдены. Обновите страницу'],
    [(status) => status === 409, 'Данные уже изменились. Обновите страницу и повторите'],
    [(status) => status === 413, 'Слишком большой запрос'],
    [(status) => status === 429, 'Слишком много запросов. Повторите чуть позже'],
    [(status) => status >= 500, 'Ошибка сервера. Повторите позже'],
    [(status) => status >= 400, 'Сервер отклонил операцию'],
];

/**
 * Текст ошибки операции редактора компонента на русском: известный код ответа, затем русское сообщение сервера,
 * затем сетевая ошибка или статус ответа. Английские тексты (`Network Error`, сообщения сервера) не показываются.
 */
export const structureErrorText = (error: unknown, codes: Record<string, string> = {}): string => {
    if (!axios.isAxiosError<ErrorBody>(error)) {
        const message = error instanceof Error ? error.message : '';
        return CYRILLIC.test(message) ? message : 'Операция не выполнена';
    }
    const data = error.response?.data;
    const code = data?.code ?? data?.error;
    if (code && codes[code]) return codes[code];
    if (data?.message && CYRILLIC.test(data.message)) return data.message;
    if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT')
        return 'Сервер не ответил вовремя. Повторите попытку';
    if (!error.response) return 'Нет связи с сервером. Проверьте подключение и повторите';
    const status = error.response.status;
    return STATUS_TEXT.find(([matches]) => matches(status))?.[1] ?? 'Операция не выполнена';
};
