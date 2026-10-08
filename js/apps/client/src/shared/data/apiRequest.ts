import axios from 'axios';

export class ApiError extends Error {
    readonly status: number | null;
    readonly code?: string;

    constructor(status: number | null, code?: string) {
        super(status === null ? 'Сервис недоступен' : `Ошибка API (${status})`);
        this.status = status;
        this.code = code;
    }
}

export const apiRequest = async <T>(operation: () => Promise<{ data: T }>): Promise<T> => {
    try {
        return (await operation()).data;
    } catch (error) {
        if (axios.isAxiosError<{ code?: string }>(error)) {
            throw new ApiError(error.response?.status ?? null, error.response?.data?.code);
        }
        throw new ApiError(null);
    }
};
