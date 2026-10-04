import { ApiError } from '../../shared/data/apiRequest';

export const getCreateThemeError = (error: unknown) => {
    if (error instanceof Error && !(error instanceof ApiError)) return error.message;
    if (error instanceof ApiError && error.status === 409 && error.code === 'TENANT_NAME_CONFLICT') {
        return 'Theme с таким названием уже существует.';
    }
    return 'Не удалось создать тему. Введённые данные сохранены.';
};
