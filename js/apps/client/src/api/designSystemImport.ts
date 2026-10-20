import { isAxiosError } from 'axios';

import type { ThemeSource } from '../controllers';
import { designSystemsApi } from '../modules/designSystems/data/designSystemsApi';
import { themesApi } from '../modules/themes/data/themesApi';
import { http, PROJECTS_URL } from '.';
import type { TokenDefinitionDto } from './themeEditorRepository';
import {
    splitTokenName,
    themeValuesToTokenValues,
    tokenKey,
    tokenValueKey,
    type TenantTokenValueInput,
} from './themeTokenValues';

/**
 * Импорт дизайн-системы из файла темы через ds-service.
 *
 * Повторяет legacy-`create` db-service нормальными ручками: дизайн-система (черновик, без версии),
 * тема `<имя>_default`, определения токенов из файла, которых в дизайн-системе ещё нет, и
 * значения темы одним пакетом. Определения и значения по умолчанию ds-service заводит сам при
 * создании: пакет собирается из них с приоритетом значений файла, иначе `PUT token-values` стёр бы
 * дефолты токенов, которых в файле нет, и тема перестала бы открываться. Определения, которых в
 * файле нет, выключаются: массовой ручки у ds-service нет, поэтому `PATCH /tokens/{id}` идёт по
 * одному с оглядкой на лимит gateway. Ошибка после создания дизайн-системы откатывается её
 * удалением, чтобы в проекте не осталась система с дефолтной темой под именем импортированной.
 */

/** Параллельных запросов в очереди: лимит gateway 10 запросов в секунду с запасом 20. */
const PATCH_CONCURRENCY = 4;
const RETRY_DELAY_MS = 400;

const isRateLimited = (error: unknown) =>
    isAxiosError(error) && (error.response?.status === 429 || error.response?.status === 503);

/** Выполняет задачи очередью с ограниченной параллельностью, повторяя отбитые лимитом запросы. */
const runQueued = async (tasks: Array<() => Promise<unknown>>) => {
    let next = 0;
    const worker = async () => {
        while (next < tasks.length) {
            const task = tasks[next++];
            for (;;) {
                try {
                    await task();
                    break;
                } catch (error) {
                    if (!isRateLimited(error)) throw error;
                    await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
                }
            }
        }
    };
    await Promise.all(Array.from({ length: Math.min(PATCH_CONCURRENCY, tasks.length) }, worker));
};
export const importDesignSystemToProject = async (projectId: string, name: string, themeData: ThemeSource) => {
    const system = await designSystemsApi.create(projectId, {
        name,
        projectName: name.split('_').join(' ').toUpperCase(),
    });
    try {
        const tenant = await themesApi.create(projectId, { designSystemId: system.id, name: `${name}_default` });
        const root = `${PROJECTS_URL}/${projectId}/ds`;
        const definitions = (await http.get<TokenDefinitionDto[]>(`${root}/design-systems/${system.id}/tokens`)).data;
        const ids = new Map(definitions.map((token) => [tokenKey(token.type, token.name), token.id]));
        // Имена в meta уже с режимом у цвета и градиента: определение одно на оба режима.
        const missing = new Map<
            string,
            { type: string; name: string; displayName: string; description?: string; enabled: boolean }
        >();
        for (const token of themeData.meta.tokens) {
            const { name: tokenName } = splitTokenName(token.name);
            const key = tokenKey(token.type, tokenName);
            if (!ids.has(key) && !missing.has(key)) {
                missing.set(key, {
                    type: token.type,
                    name: tokenName,
                    displayName: token.displayName,
                    description: token.description,
                    enabled: token.enabled,
                });
            }
        }
        for (const [key, token] of missing) {
            const created = (await http.post<{ id: string }>(`${root}/tokens`, { designSystemId: system.id, ...token }))
                .data;
            ids.set(key, created.id);
        }
        // Токены набора, которых в файле нет, выключаются: импортированная система описывает только тему файла.
        const fileKeys = new Set(
            themeData.meta.tokens.map((token) => tokenKey(token.type, splitTokenName(token.name).name)),
        );
        const toDisable = definitions.filter(
            (token) => token.enabled && !fileKeys.has(tokenKey(token.type, token.name)),
        );
        await runQueued(toDisable.map((token) => () => http.patch(`${root}/tokens/${token.id}`, { enabled: false })));
        // ds-service отклоняет неизвестные поля тела: из прочитанных значений берутся только поля пакета.
        const existing = (await http.get<TenantTokenValueInput[]>(`${root}/tenants/${tenant.id}/token-values`)).data;
        const merged = new Map(
            existing
                .filter((value) => value.tokenId && value.platform)
                .map((value) => [
                    tokenValueKey(value),
                    {
                        tokenId: value.tokenId,
                        platform: value.platform,
                        mode: value.mode ?? null,
                        paletteId: value.paletteId ?? null,
                        value: value.value,
                    },
                ]),
        );
        for (const value of themeValuesToTokenValues(themeData.variations, ids)) {
            merged.set(tokenValueKey(value), value);
        }
        await http.put(`${root}/tenants/${tenant.id}/token-values`, {
            editRevision: tenant.editRevision,
            values: [...merged.values()],
        });
        return { designSystemId: system.id, tenantId: tenant.id, disabledTokens: toDisable.length };
    } catch (error) {
        await designSystemsApi
            .remove(projectId, system.id)
            .catch((cleanupError: unknown) =>
                console.error(
                    '[importDesignSystem] Не удалось удалить дизайн-систему после ошибки импорта',
                    cleanupError,
                ),
            );
        throw error;
    }
};
