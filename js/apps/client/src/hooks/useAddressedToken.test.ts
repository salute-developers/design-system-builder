import { createElement, type PropsWithChildren } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { MemoryRouter, useSearchParams } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { locateColorToken, locateLegacyToken, useAddressedToken } from './useAddressedToken';

vi.mock('../api/tokenRepository', () => ({
    tokenRepository: {
        async listDefinitions() {
            return [
                { id: 'first', name: 'surface.first' },
                { id: 'second', name: 'surface.second' },
            ];
        },
    },
}));

it('обновляет tokenId при выборе редакторского имени с режимом', async () => {
    const context = { projectId: 'project', designSystemId: 'ds', tenantId: 'theme' };
    const wrapper = ({ children }: PropsWithChildren) =>
        createElement(
            MemoryRouter,
            {
                initialEntries: ['/?tokenId=first&versionId=published'],
            },
            children,
        );
    const { result } = renderHook(
        () => {
            const addressed = useAddressedToken(context);
            const [params] = useSearchParams();
            return { ...addressed, query: params.toString() };
        },
        { wrapper },
    );
    await waitFor(() => expect(result.current.requestedTokenName).toBe('surface.first'));
    act(() => result.current.selectTokenName('dark.surface.second'));
    await waitFor(() => expect(result.current.tokenId).toBe('second'));
    expect(result.current.query).toContain('versionId=published');
});

describe('locateLegacyToken', () => {
    it('показывает недоступность существующего определения, отсутствующего в меню редактора', async () => {
        const context = { projectId: 'project', designSystemId: 'ds', tenantId: 'theme' };
        const wrapper = ({ children }: PropsWithChildren) =>
            createElement(
                MemoryRouter,
                {
                    initialEntries: ['/?tokenId=first'],
                },
                children,
            );
        const { result, rerender } = renderHook(({ available }) => useAddressedToken(context, () => available), {
            initialProps: { available: false },
            wrapper,
        });
        await waitFor(() => expect(result.current.requestedTokenName).toBe('surface.first'));
        expect(result.current.unavailable).toBe(true);
        rerender({ available: true });
        expect(result.current.unavailable).toBe(false);
    });

    it('находит токен во вложенной группе по устойчивому имени', () => {
        const token = { getName: () => 'light.text.body.fontSize' };
        const data = {
            groups: [
                { data: [{ name: 'Первая', type: 'typography', items: [] }] },
                {
                    data: [
                        {
                            name: 'Текст',
                            type: 'typography',
                            items: [{ name: 'Размер', disabled: false, previewValues: [], data: [token] }],
                        },
                    ],
                },
            ],
        };

        expect(locateLegacyToken(data as never, 'text.body.fontSize')).toEqual({
            tabIndex: 1,
            groupIndex: 0,
            itemIndex: 0,
        });
    });

    it('не падает на частично загруженном меню', () => {
        expect(locateLegacyToken({} as never, 'text.body.fontSize')).toBeUndefined();
    });
});

describe('locateColorToken', () => {
    it('находит устойчивое имя среди всех вложенных цветов и режимов', () => {
        const leaf = (name: string) => ({ mode: 'dark', data: { item: { getName: () => name } } });
        const data = [
            {
                group: 'Цвета',
                data: [
                    {
                        name: 'Группа',
                        data: [
                            { subgroup: 'Первый', data: [leaf('light.other')] },
                            { subgroup: 'Второй', data: [leaf('dark.surface.default')] },
                        ],
                    },
                ],
            },
        ];
        expect(locateColorToken(data as never, 'surface.default')).toEqual({ groupIndex: 0, itemIndex: 0 });
        expect(locateColorToken(data as never, 'missing')).toBeUndefined();
    });
});
