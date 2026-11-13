import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Config, DesignSystem, type Meta } from '../../../../controllers';
import { buttonMeta, groupMeta } from '../../../../composePreview/nestedStyleFixture';

import { InspectorStyleReference } from './InspectorStyleReference';
import { StyleReferenceContext } from './StyleReferenceContext';

const withStyles = (meta: Meta): Meta => {
    const copy = structuredClone(meta);
    const size = copy.sources.configs[0].config.variations.find((item) => item.id === 'size')!;
    size.styles!.push({ id: 'size-xs', name: 'xs', intersections: null, props: [] });
    return copy;
};
const chipMeta = (loaded: boolean): Meta => {
    const copy = structuredClone(buttonMeta());
    copy.name = 'Chip';
    copy.serverBinding = { componentId: 'chip', appearanceId: '', appearanceNames: ['chip'] };
    if (!loaded) copy.sources = { api: [], variations: [], configs: [] };
    else copy.sources.configs[0] = { ...copy.sources.configs[0], id: 'chip-config', name: 'chip' };
    return copy;
};
const system = (compose: Meta[]) => DesignSystem.fromSnapshot({ name: 'ds', componentsData: [], composeComponentsData: compose });

const renderControl = (compose: Meta[], value: string, onChange = vi.fn(), loadComponent = vi.fn(async () => undefined)) => {
    const config = new Config(groupMeta());
    const ui = (designSystem: DesignSystem) => (
        <StyleReferenceContext.Provider value={{ designSystem, loadComponent }}>
            <InspectorStyleReference config={config} label="Button style" value={value} onChange={onChange} />
        </StyleReferenceContext.Provider>
    );
    const view = render(ui(system(compose)));
    return { onChange, loadComponent, rerender: (compose: Meta[]) => view.rerender(ui(system(compose))) };
};
const open = (name: string) => fireEvent.click(screen.getByRole('button', { name }));
const pick = (name: string) => fireEvent.click(screen.getByRole('option', { name: new RegExp(`^${name}`) }));

describe('InspectorStyleReference', () => {
    afterEach(cleanup);

    it('показывает оформление и стили текущего значения', () => {
        renderControl([groupMeta(), buttonMeta()], 'basic-button.xxs.default');

        expect(screen.getByRole('button', { name: 'Button style' }).textContent).toContain('basic-button');
        expect(screen.getByRole('button', { name: 'Button style: size' }).textContent).toContain('xxs');
        expect(screen.getByRole('button', { name: 'Button style: view' }).textContent).toContain('default');
    });

    it('собирает значение при смене стиля вариации в порядке вариаций', () => {
        const { onChange } = renderControl([groupMeta(), withStyles(buttonMeta())], 'basic-button.xxs.default');

        open('Button style: size');
        pick('xs');

        expect(onChange).toHaveBeenCalledWith('basic-button.xs.default');
    });

    it('подписывает поиск как поиск конфигураций и стилей', () => {
        renderControl([groupMeta(), buttonMeta()], 'basic-button.xxs.default');

        open('Button style');
        expect(screen.getByRole('textbox', { name: 'Найти конфигурацию' })).toBeTruthy();
        open('Button style: size');
        expect(screen.getByRole('textbox', { name: 'Найти стиль' })).toBeTruthy();
    });

    it('не предлагает собственное оформление', () => {
        renderControl([groupMeta(), buttonMeta()], 'basic-button.xxs.default');

        open('Button style');

        expect(screen.queryByRole('option', { name: /basic-button-group/ })).toBeNull();
        expect(screen.getByRole('option', { name: /^basic-button/ })).toBeTruthy();
    });

    it('выбирает стили по умолчанию, когда оформление загружено', () => {
        const { onChange } = renderControl([groupMeta(), buttonMeta(), chipMeta(true)], 'basic-button.xxs.default');

        open('Button style');
        pick('chip');

        expect(onChange).toHaveBeenCalledWith('chip.xxs.default');
    });

    it('догружает ранее не загруженную цель и затем выбирает стили по умолчанию', async () => {
        const { onChange, loadComponent, rerender } = renderControl(
            [groupMeta(), buttonMeta(), chipMeta(false)],
            'basic-button.xxs.default',
        );

        open('Button style');
        pick('chip');

        expect(loadComponent).toHaveBeenCalledWith('compose-Chip');
        expect(screen.getByRole('status').textContent).toContain('Загружаем');
        expect(onChange).not.toHaveBeenCalled();

        await act(async () => rerender([groupMeta(), buttonMeta(), chipMeta(true)]));

        expect(onChange).toHaveBeenCalledWith('chip.xxs.default');
        expect(screen.queryByRole('status')).toBeNull();
    });

    it('показывает ошибку загрузки цели и не меняет значение', async () => {
        const loadComponent = vi.fn(async () => {
            throw new Error('offline');
        });
        const { onChange } = renderControl(
            [groupMeta(), buttonMeta(), chipMeta(false)],
            'basic-button.xxs.default',
            vi.fn(),
            loadComponent,
        );

        open('Button style');
        await act(async () => pick('chip'));

        expect(screen.getByRole('alert').textContent).toContain('Не удалось загрузить');
        expect(onChange).not.toHaveBeenCalled();
        expect(screen.getByRole('button', { name: 'Button style' }).textContent).toContain('basic-button');
    });

    it('показывает ошибку, если загрузка завершилась, а конфигураций у цели нет', async () => {
        renderControl([groupMeta(), buttonMeta(), chipMeta(false)], 'basic-button.xxs.default');

        open('Button style');
        await act(async () => pick('chip'));

        expect(screen.getByRole('alert').textContent).toContain('Не удалось загрузить');
        expect(screen.queryByRole('status')).toBeNull();
    });

    it('ошибка устаревшего выбора не сбрасывает загрузку нового', async () => {
        const other = { ...chipMeta(false), name: 'Tag', serverBinding: { componentId: 'tag', appearanceId: '', appearanceNames: ['tag'] } } as Meta;
        let failFirst: (error: Error) => void = () => undefined;
        const loadComponent = vi
            .fn<(route: string) => Promise<void>>()
            .mockImplementationOnce(() => new Promise<void>((_, reject) => (failFirst = reject)))
            .mockImplementationOnce(() => new Promise<void>(() => undefined));
        renderControl([groupMeta(), buttonMeta(), chipMeta(false), other], 'basic-button.xxs.default', vi.fn(), loadComponent);

        open('Button style');
        pick('chip');
        open('Button style');
        pick('tag');
        await act(async () => failFirst(new Error('offline')));

        expect(screen.getByRole('status').textContent).toContain('Загружаем');
        expect(screen.queryByRole('alert')).toBeNull();
    });
});
