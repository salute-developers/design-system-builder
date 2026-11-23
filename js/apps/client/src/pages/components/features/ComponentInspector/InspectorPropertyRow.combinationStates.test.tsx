import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Config, resolveSelectedProps, type Meta } from '../../../../controllers';
import { chipMeta } from '../__fixtures__/chipMeta';
import { InspectorPropertyRow } from './InspectorPropertyRow';

const setup = (own: boolean, alpha?: number) => {
    const meta = structuredClone(chipMeta) as Meta;
    meta.sources.api.find((x) => x.id === 'height')!.stateSupport = {
        states: ['pressed', 'hovered'],
        combinations: true,
    };
    const sourceConfig = meta.sources.configs[0].config;
    sourceConfig.variations
        .find((x) => x.id === 'v-size')!
        .styles!.find((x) => x.id === 's-m')!
        .props!.find((x) => x.id === 'height')!.states = [{ state: ['pressed'], value: '31', alpha }];
    if (own)
        sourceConfig.combinations = [
            {
                styleIDs: ['s-m', 'v-default'],
                props: [{ id: 'height', states: [{ state: ['pressed'], value: '55', alpha }] }],
            },
        ];
    const config = new Config(meta);
    const onChange = vi.fn();
    render(
        <InspectorPropertyRow
            config={config}
            api={meta.sources.api}
            prop={resolveSelectedProps(config, ['s-m', 'v-default']).get('height')!.prop}
            source={{ kind: 'combination', styleIDs: ['s-m', 'v-default'], label: 'size:m + view:default' }}
            isSet={false}
            tokens={{ colors: [], shapes: [], shadows: [], typography: [], resolveColor: () => undefined }}
            onConfigUpdate={vi.fn()}
            onCombinationChange={onChange}
        />,
    );
    return onChange;
};

describe('состояния размера пересечения', () => {
    afterEach(cleanup);
    it('добавляет состояние через серверный callback пересечения', () => {
        const change = setup(false);
        fireEvent.click(screen.getByRole('button', { name: 'Добавить состояние: Height' }));
        fireEvent.click(screen.getByRole('menuitemcheckbox', { name: 'hovered' }));
        fireEvent.click(screen.getByRole('button', { name: 'Добавить', exact: true }));
        expect(change).toHaveBeenCalledWith('height', expect.any(String), ['hovered'], undefined);
    });
    it('позволяет переопределить унаследованное состояние без удаления оригинала', () => {
        const change = setup(false);
        const input = screen.getByLabelText('Height pressed');
        fireEvent.change(input, { target: { value: '60' } });
        fireEvent.blur(input);
        expect(change).toHaveBeenCalledWith('height', '60', ['pressed'], undefined);
        expect(screen.queryByRole('button', { name: /Удалить состояние/ })).toBeNull();
    });
    it('сохраняет прозрачность при переопределении унаследованного состояния', () => {
        const change = setup(false, 0.5);
        const input = screen.getByLabelText('Height pressed');
        fireEvent.change(input, { target: { value: '60' } });
        fireEvent.blur(input);
        expect(change).toHaveBeenCalledWith('height', '60', ['pressed'], 0.5);
    });
    it('удаляет собственное состояние независимо от базы', () => {
        const change = setup(true);
        fireEvent.click(screen.getByRole('button', { name: /Удалить состояние/ }));
        expect(change).toHaveBeenCalledWith('height', null, ['pressed']);
    });
});
