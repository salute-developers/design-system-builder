import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import golden from '../../modules/palette/fixtures/palette-golden.json';
import {
    createLocalPaletteRepository,
    type PaletteTokenRef,
    type PaletteTokenValue,
    type ThemePalette,
} from '../../modules/palette';
import { TokenGroupSelect } from './TokenGroupSelect';

const loadPalette = () => {
    const items = new Map<string, string>();
    let id = 0;
    return createLocalPaletteRepository({
        storage: { getItem: (key) => items.get(key) ?? null, setItem: (key, value) => void items.set(key, value) },
        newId: () => `id-${++id}`,
        template: () => golden.template,
        theme: () => ({
            tokens: golden.scenario.tokens as PaletteTokenRef[],
            values: golden.scenario.values as PaletteTokenValue[],
            canEdit: true,
        }),
        applyRewrite: () => undefined,
    }).load({ projectId: 'p', designSystemId: 'd', tenantId: 't' });
};

const renderSelect = (palette: ThemePalette, onAssign: (tokenId: string, groupId: string | null) => Promise<unknown>) =>
    render(
        <TokenGroupSelect palette={palette} tokenName="light.text.default.primary" value="[general.green.500]" onAssign={onAssign} />,
    );

afterEach(cleanup);

describe('TokenGroupSelect', () => {
    it('показывает группу по умолчанию и сравнение цвета до подтверждения', async () => {
        const palette = await loadPalette();
        renderSelect(palette, vi.fn());
        expect(screen.getByText('Группа по умолчанию')).toBeInTheDocument();
        const accent = palette.groups.find((group) => group.systemKey === 'accent')!;
        fireEvent.change(screen.getByRole('combobox'), { target: { value: accent.id } });
        expect(screen.getByRole('status')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Отмена' }));
        expect(screen.queryByRole('status')).toBeNull();
    });

    it('«Применить» отправляет привязку один раз и блокируется до ответа', async () => {
        const palette = await loadPalette();
        let resolve!: () => void;
        const onAssign = vi.fn(() => new Promise<void>((done) => (resolve = done)));
        renderSelect(palette, onAssign);
        const accent = palette.groups.find((group) => group.systemKey === 'accent')!;
        fireEvent.change(screen.getByRole('combobox'), { target: { value: accent.id } });
        const apply = screen.getByRole('button', { name: 'Применить' });
        fireEvent.click(apply);
        fireEvent.click(apply);
        expect(onAssign).toHaveBeenCalledTimes(1);
        expect(onAssign).toHaveBeenCalledWith('t2', accent.id);
        expect(apply).toBeDisabled();
        resolve();
        await vi.waitFor(() => expect(screen.queryByRole('status')).toBeNull());
    });
});
