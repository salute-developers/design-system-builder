const toolLabels: Record<string, string> = {
    design_system_get_context: 'Читаю дизайн-систему',
    tenants_list: 'Смотрю темы',
    tokens_list: 'Ищу токены',
    token_get: 'Читаю токен',
    token_values_get: 'Читаю значения токена',
    token_groups_list: 'Смотрю группы токенов',
    palette_get: 'Читаю палитру',
    token_edit_data_get: 'Читаю данные токена',
    components_list: 'Ищу компоненты',
    component_configurations_list: 'Смотрю конфигурации компонента',
    component_variations_get: 'Читаю вариации',
    component_properties_get: 'Читаю свойства компонента',
    component_editor_get: 'Открываю конфигурацию компонента',
    component_config_get: 'Читаю значения свойств',
    component_tokens_get: 'Читаю токены компонента',
    token_value_update: 'Меняю значение токена',
    color_token_values_update: 'Меняю цвет',
    size_token_value_update: 'Меняю размер',
    typography_style_update: 'Меняю типографику',
    component_property_set: 'Меняю свойство компонента',
    component_axis_value_create: 'Добавляю значение вариации',
    component_configuration_duplicate: 'Копирую конфигурацию',
    component_property_reset: 'Сбрасываю свойство компонента',
};

/** Понятное название шага по имени инструмента. */
export const toolLabel = (tool: string) => toolLabels[tool] ?? tool;

/** Сообщение об ошибке инструмента: сначала код ds-service, затем код ядра. */
export const toolErrorText = (code?: string | null, backendCode?: string | null): string => {
    if (backendCode === 'draft_changed') return 'Дизайн-систему опубликовали. Запросите операцию заново.';
    switch (code) {
        case 'OUTCOME_UNKNOWN':
            return 'Исход записи неизвестен. Проверьте значение в редакторе.';
        case 'FORBIDDEN':
            return 'Недостаточно прав.';
        case 'CONFLICT':
            return 'Данные изменились, агент перечитает их.';
        case 'BACKEND_UNAVAILABLE':
            return 'Сервис недоступен.';
        case 'user_rejected':
            return 'Операция отклонена.';
        case 'not_confirmed':
            return 'Операция не подтверждена.';
        case 'tool_not_allowed':
            return 'Операция недоступна.';
        default:
            return 'Не получилось.';
    }
};

const GENERIC_FAILURE = 'Не удалось выполнить запрос.';

/** Минуты до повтора с округлением вверх, не меньше одной. */
const minutes = (seconds?: number) => Math.max(1, Math.ceil((seconds ?? 60) / 60));

/** Сообщение об отказе в запуске хода по коду и статусу ответа. */
export const rejectionText = (status: number, code: string, retryAfterSeconds?: number): string => {
    if (status === 413) return 'История разговора слишком длинная. Начните новый чат.';
    switch (code) {
        case 'ai_turn_limit':
            return `Лимит запросов к ассистенту исчерпан. Повторить можно через ${minutes(retryAfterSeconds)} мин.`;
        case 'ai_overloaded':
            return 'Ассистент перегружен. Попробуйте через минуту.';
        case 'ai_unavailable':
            return 'Ассистент недоступен.';
        case 'dependency_unavailable':
            return 'Сервис дизайн-систем недоступен. Попробуйте позже.';
        case 'ai_pat_forbidden':
            return 'Чат недоступен при входе по персональному токену.';
        case 'forbidden':
        case 'design_system_forbidden':
            return 'Нет доступа к дизайн-системе.';
        case 'design_system_not_found':
            return 'Дизайн-система не найдена.';
        case 'message_too_long':
            return 'Сообщение слишком длинное.';
        case 'invalid_request':
            return 'Запрос не принят. Начните новый чат.';
        case 'IDEMPOTENCY_KEY_REUSED':
            return 'Запрос уже отправлялся с другими данными. Отправьте сообщение ещё раз.';
        case 'confirmation_expired':
        case 'confirmation_invalid':
            return 'Подтверждение устарело. Запросите операцию заново.';
        default:
            return GENERIC_FAILURE;
    }
};

/** Сообщение об ошибке хода из события `error`. */
export const turnErrorText = (code: string, message: string): string => {
    switch (code) {
        case 'turn_limit_reached':
            return 'Лимит запросов к ассистенту исчерпан. Продолжить разговор можно позже.';
        case 'access_revoked':
            return 'Доступ к проекту отозван.';
        case 'llm_rate_limited':
            return 'Модель перегружена. Попробуйте позже.';
        case 'llm_unavailable':
            return 'Модель недоступна. Попробуйте позже.';
        case 'step_limit_reached':
            return 'Агент сделал слишком много шагов. Уточните запрос.';
        case 'turn_timeout':
            return 'Ответ занял слишком много времени.';
        case 'context_overflow':
            return 'Разговор слишком длинный. Начните новый чат.';
        case 'stopped':
            return 'Запрос остановлен.';
        case 'internal_error':
            return 'Внутренняя ошибка ассистента.';
        default:
            return message || GENERIC_FAILURE;
    }
};
