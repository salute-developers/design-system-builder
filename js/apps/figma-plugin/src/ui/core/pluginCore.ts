import type {
    DesignSystemDto,
    DesignSystemVersionDto,
    ProjectDto,
    SizeTokensDto,
    TenantDto,
    TokenDefinitionDto,
    TokenValueDto,
    TypographyStylesDto,
} from '../api/types';
import type { ExportPlan } from '../../shared/exportPlan';
import { buildSnapshot, type TokenSnapshot } from '../tokens/snapshot';

export type ApiErrorKind = 'unauthorized' | 'forbidden' | 'not-found' | 'network' | 'server';

const MESSAGES: Record<ApiErrorKind, string> = {
    unauthorized: 'Нужно войти снова',
    forbidden: 'Нет доступа',
    'not-found': 'Данные не найдены',
    network: 'Сервер DS Builder недоступен',
    server: 'Сервер DS Builder ответил ошибкой',
};

/** Отказ API в терминах экрана. */
export class ApiError extends Error {
    constructor(
        readonly kind: ApiErrorKind,
        message: string = MESSAGES[kind],
    ) {
        super(message);
    }
}

/** Отказ OAuth с кодом ошибки из ответа, например `access_denied`. */
export class OAuthError extends Error {
    constructor(readonly code: string) {
        super(code);
    }
}

/** Хранилище основного потока не ответило. */
export class StorageError extends Error {}

/** Модуль не смог построить план экспорта из ответа сервера. */
export class ExportPlanError extends Error {}

export interface DesignSystemContext {
    projectId: string;
    designSystemId: string;
}

export interface TenantContext extends DesignSystemContext {
    tenantId: string;
}

/** Код устройства для подтверждения входа в браузере. */
export interface LoginCode {
    userCode: string;
    verificationUri: string;
}

/** Чтения DS Builder для экранов. Записей в DS Builder нет. */
export interface DsBuilderApi {
    projects(signal?: AbortSignal): Promise<ProjectDto[]>;
    designSystems(projectId: string, signal?: AbortSignal): Promise<DesignSystemDto[]>;
    tenants(context: DesignSystemContext, signal?: AbortSignal): Promise<Array<TenantDto & { name: string }>>;
    versions(context: DesignSystemContext, signal?: AbortSignal): Promise<DesignSystemVersionDto[]>;
    /** Токены темы на одной границе: опубликованная версия или, без `versionId`, активный черновик. */
    snapshot(context: TenantContext, versionId: string | null, signal?: AbortSignal): Promise<TokenSnapshot>;
    /** План экспорта темы в Figma на той же границе версии. */
    exportPlan(
        context: TenantContext,
        versionId: string | null,
        themeName: string,
        signal?: AbortSignal,
    ): Promise<ExportPlan>;
    /** Байты файла по публичной ссылке `https` без токена, например файла шрифта с CDN. */
    fontFile(url: string, signal?: AbortSignal): Promise<Uint8Array>;
}

/** Всё, что окну нужно от бэкенда. */
export interface PluginCore {
    api: DsBuilderApi;
    restore(): Promise<boolean>;
    startLogin(): Promise<LoginCode>;
    completeLogin(signal: AbortSignal): Promise<void>;
    signOut(): Promise<void>;
    /** Подписка на потерю сессии: экран возвращается ко входу. */
    onExpired(listener: () => void): () => void;
}

/** Методы `DsBuilderCore` из Kotlin: данные приходят строками JSON. */
export interface KotlinCore {
    onSessionExpired(listener: () => void): void;
    restore(): Promise<boolean>;
    startLogin(): Promise<string>;
    completeLogin(signal?: AbortSignal): Promise<void>;
    signOut(): Promise<void>;
    projects(signal?: AbortSignal): Promise<string>;
    designSystems(projectId: string, signal?: AbortSignal): Promise<string>;
    tenants(projectId: string, designSystemId: string, signal?: AbortSignal): Promise<string>;
    versions(projectId: string, designSystemId: string, signal?: AbortSignal): Promise<string>;
    themeTokens(
        projectId: string,
        designSystemId: string,
        tenantId: string,
        versionId: string | null,
        signal?: AbortSignal,
    ): Promise<string>;
    exportPlan(
        projectId: string,
        designSystemId: string,
        tenantId: string,
        versionId: string | null,
        themeName: string,
        signal?: AbortSignal,
    ): Promise<string>;
    fontFile(url: string, signal?: AbortSignal): Promise<Int8Array>;
}

interface ThemeTokens {
    tokens: TokenDefinitionDto[];
    values: TokenValueDto[];
    typography: TypographyStylesDto;
    sizes: SizeTokensDto;
}

/** Переводит `CoreFailure` из Kotlin в ошибки экранов. */
const screenError = (error: unknown) => {
    const { kind, code } = error as { kind?: string; code?: string | null };
    if (kind === 'oauth') return new OAuthError(code ?? '');
    if (kind === 'storage') return new StorageError(code ?? 'Хранилище плагина недоступно');
    if (kind === 'export')
        return new ExportPlanError(`Не удалось построить план экспорта: ${code ?? 'неизвестная причина'}`);
    if (kind && kind in MESSAGES) return new ApiError(kind as ApiErrorKind);
    return error;
};

const translated = async <T>(call: Promise<T>) => {
    try {
        return await call;
    } catch (error) {
        throw screenError(error);
    }
};

const parsed = async <T>(call: Promise<string>) => JSON.parse(await translated(call)) as T;

/** Отказ скачивания файла: CDN, а не DS Builder, поэтому без сообщений о сервере DS Builder. */
const fileError = (error: unknown) => {
    const { kind, code } = error as { kind?: string; code?: string | null };
    if (kind === 'file') return new Error(code === 'not-https' ? 'ссылка не https' : `ответ ${code ?? 'с ошибкой'}`);
    if (kind === 'network') return new Error('файл недоступен');
    return error;
};

/** Связывает экраны с общими Kotlin-модулями: адресов и токенов здесь нет. */
export const createPluginCore = (core: KotlinCore): PluginCore => {
    const listeners = new Set<() => void>();
    core.onSessionExpired(() => listeners.forEach((listener) => listener()));

    return {
        restore: () => translated(core.restore()),
        startLogin: () => parsed<LoginCode>(core.startLogin()),
        completeLogin: (signal) => translated(core.completeLogin(signal)),
        signOut: () => translated(core.signOut()),
        onExpired: (listener) => {
            listeners.add(listener);
            return () => void listeners.delete(listener);
        },
        api: {
            projects: (signal) => parsed<ProjectDto[]>(core.projects(signal)),
            designSystems: (projectId, signal) => parsed<DesignSystemDto[]>(core.designSystems(projectId, signal)),
            tenants: async ({ projectId, designSystemId }, signal) => {
                const tenants = await parsed<TenantDto[]>(core.tenants(projectId, designSystemId, signal));
                return tenants.map((tenant) => ({ ...tenant, name: tenant.name || 'Тема без названия' }));
            },
            versions: ({ projectId, designSystemId }, signal) =>
                parsed<DesignSystemVersionDto[]>(core.versions(projectId, designSystemId, signal)),
            snapshot: async ({ projectId, designSystemId, tenantId }, versionId, signal) =>
                buildSnapshot(
                    await parsed<ThemeTokens>(core.themeTokens(projectId, designSystemId, tenantId, versionId, signal)),
                ),
            exportPlan: ({ projectId, designSystemId, tenantId }, versionId, themeName, signal) =>
                parsed<ExportPlan>(core.exportPlan(projectId, designSystemId, tenantId, versionId, themeName, signal)),
            fontFile: async (url, signal) => {
                try {
                    const bytes = await core.fontFile(url, signal);
                    return new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength);
                } catch (error) {
                    throw fileError(error);
                }
            },
        },
    };
};
