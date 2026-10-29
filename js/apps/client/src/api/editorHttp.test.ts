import { describe, expect, it } from 'vitest';

import {
    keepaliveRequest,
    parseMutationMetadata,
    readRequest,
    tokenValueKey,
    variationReadRequest,
} from './editorHttp';

const context = { projectId: 'project', designSystemId: 'ds', tenantId: 'theme' };

describe('параметры предметных запросов редактора', () => {
    it('передаёт историческую границу и тот же сигнал отмены', () => {
        const signal = new AbortController().signal;
        expect(readRequest({ ...context, versionId: 'published' }, signal)).toEqual({
            signal,
            params: { versionId: 'published' },
        });
        expect(readRequest(context, signal)).toEqual({ signal, params: undefined });
    });

    it('ограничивает чтение вариаций дизайн-системой контекста и сохраняет границу версии', () => {
        const signal = new AbortController().signal;
        expect(variationReadRequest({ ...context, versionId: 'published' }, signal)).toEqual({
            signal,
            params: { versionId: 'published', designSystemId: 'ds' },
        });
        expect(variationReadRequest(context)).toEqual({ signal: undefined, params: { designSystemId: 'ds' } });
    });

    it('включает fetch keepalive только при явном запросе', () => {
        expect(keepaliveRequest(false)).toEqual({});
        expect(keepaliveRequest(true)).toEqual({ adapter: 'fetch', fetchOptions: { keepalive: true } });
    });

    it('различает редакции платформ и режимов, сохраняя ключ режима по умолчанию', () => {
        expect(tokenValueKey('token', 'web', 'light')).toBe('token:web:light');
        expect(tokenValueKey('token', 'ios', 'dark')).toBe('token:ios:dark');
        expect(tokenValueKey('token', null, null)).toBe('token::');
    });

    it('сохраняет метаданные ответа и допускает их отсутствие или повреждённый JSON', () => {
        const metadata = [{ entityType: 'token', entityId: 'id', revision: 9 }];
        expect(parseMutationMetadata(JSON.stringify(metadata))).toEqual(metadata);
        expect(parseMutationMetadata(undefined)).toEqual([]);
        expect(parseMutationMetadata('{')).toEqual([]);
    });
});
