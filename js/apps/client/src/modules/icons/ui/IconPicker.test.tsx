import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { catalogFixture } from '../__fixtures__/catalog';
import { setIconFailed } from '../application/iconLoadFailures';
import { iconAssetUrl } from '../domain/iconCatalog';
import { FILE_FAILED_MESSAGE, IconPicker } from './IconPicker';

const setup = (value: string | undefined, catalog = catalogFixture) => {
    const onChange = vi.fn();
    const onClear = vi.fn();
    render(<IconPicker label="ClosedIcon" value={value} catalog={catalog} onChange={onChange} onClear={onClear} />);
    return { onChange, onClear };
};

const downFill16 = iconAssetUrl(catalogFixture, 'DisclosureDownFill', 16);
const addOutline24 = iconAssetUrl(catalogFixture, 'AddOutline', 24);

interface FakeImage {
    url: string;
    onerror: (() => void) | null;
    onload: (() => void) | null;
}

/** В jsdom `Image` ничего не загружает: подменяем его и вызываем `onerror`/`onload` вручную, как браузер. */
const installFakeImage = () => {
    const created: FakeImage[] = [];
    const Original = globalThis.Image;
    globalThis.Image = class {
        url = '';
        onerror: (() => void) | null = null;
        onload: (() => void) | null = null;
        set src(value: string) {
            this.url = value;
            created.push(this);
        }
    } as unknown as typeof Image;
    const fire = (event: 'onerror' | 'onload', match: (url: string) => boolean) =>
        act(() => created.filter((image) => match(image.url)).forEach((image) => image[event]?.()));
    return {
        created,
        restore: () => {
            fire('onload', () => true);
            globalThis.Image = Original;
        },
        fail: (match: (url: string) => boolean) => fire('onerror', match),
        load: (match: (url: string) => boolean) => fire('onload', match),
    };
};

/** Пикер с хранимым значением: как в инспекторе, где выбор сразу попадает в значение поля. */
const Controlled = ({ initial, onChange }: { initial?: string; onChange: (value: string) => void }) => {
    const [value, setValue] = useState(initial);
    return (
        <IconPicker
            label="ClosedIcon"
            value={value}
            catalog={catalogFixture}
            onChange={(next) => {
                onChange(next);
                setValue(next);
            }}
            onClear={() => setValue(undefined)}
        />
    );
};

describe('IconPicker', () => {
    afterEach(() => {
        cleanup();
        act(() => setIconFailed(downFill16, false));
        act(() => setIconFailed(addOutline24, false));
    });

    it('shows the selected catalog icon', () => {
        setup('disclosure.down.fill.16');
        expect(screen.getByText('DisclosureDownFill · 16')).toBeInTheDocument();
    });

    it('stores the legacy-format value on selection', () => {
        const { onChange } = setup(undefined);
        fireEvent.click(screen.getByLabelText('ClosedIcon: выбрать иконку'));
        fireEvent.click(screen.getByRole('button', { name: '16' }));
        fireEvent.click(screen.getByLabelText('DisclosureDownFill'));
        expect(onChange).toHaveBeenCalledWith('disclosure.down.fill.16');
    });

    it('clears the value', () => {
        const { onClear } = setup('disclosure.down.fill.16');
        fireEvent.click(screen.getByRole('button', { name: 'Очистить' }));
        expect(onClear).toHaveBeenCalled();
    });

    it('shows a value missing from the catalog as a string with a note', () => {
        setup('chevron.left.24');
        expect(screen.getByText('chevron.left.24')).toBeInTheDocument();
        expect(screen.getByTitle('Иконки нет в каталоге')).toBeInTheDocument();
    });

    it('has no label above the field and no clear cross for an unset value', () => {
        const onChange = vi.fn();
        render(<IconPicker label="ClosedIcon" catalog={catalogFixture} onChange={onChange} />);
        expect(screen.queryByText('ClosedIcon')).not.toBeInTheDocument();
        expect(screen.getByText('Не задано')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Очистить' })).not.toBeInTheDocument();
    });

    it('opens a context window instead of a modal', () => {
        setup(undefined);
        fireEvent.click(screen.getByLabelText('ClosedIcon: выбрать иконку'));
        expect(screen.getByRole('dialog', { name: 'Выбор иконки' })).toBeInTheDocument();
        expect(screen.queryByText('Выбор иконки', { selector: 'h2' })).not.toBeInTheDocument();
    });

    it('shows the value as a string when there is no catalog', () => {
        setup('chevron.left.24', { source: null, assetsBaseUrl: '', icons: [] });
        expect(screen.getByText('chevron.left.24')).toBeInTheDocument();
        expect(screen.queryByTitle('Иконки нет в каталоге')).not.toBeInTheDocument();
        expect(screen.getByLabelText('ClosedIcon: выбрать иконку')).toBeDisabled();
    });

    describe('file load failure', () => {
        it('shows no notice while the file loads', () => {
            setup('disclosure.down.fill.16');
            expect(screen.queryByRole('alert')).not.toBeInTheDocument();
        });

        it('shows the notice for a stored value whose file failed to load', () => {
            setIconFailed(downFill16, true);
            setup('disclosure.down.fill.16');
            expect(screen.getByRole('alert')).toHaveTextContent(FILE_FAILED_MESSAGE);
        });

        it('keeps the selection and shows the notice when the chosen icon has no file', () => {
            const onChange = vi.fn();
            render(<Controlled onChange={onChange} />);
            act(() => setIconFailed(downFill16, true));
            expect(screen.queryByRole('alert')).not.toBeInTheDocument();

            fireEvent.click(screen.getByLabelText('ClosedIcon: выбрать иконку'));
            fireEvent.click(screen.getByRole('button', { name: '16' }));
            fireEvent.click(screen.getByRole('button', { name: /^DisclosureDownFill/ }));

            expect(onChange).toHaveBeenCalledWith('disclosure.down.fill.16');
            expect(screen.getByRole('alert')).toHaveTextContent(FILE_FAILED_MESSAGE);
        });

        it('removes the notice when another icon is chosen', () => {
            setIconFailed(downFill16, true);
            const onChange = vi.fn();
            render(<Controlled initial="disclosure.down.fill.16" onChange={onChange} />);
            expect(screen.getByRole('alert')).toBeInTheDocument();

            fireEvent.click(screen.getByLabelText('ClosedIcon: выбрать иконку'));
            fireEvent.click(screen.getByLabelText('AddOutline'));
            expect(onChange).toHaveBeenCalledWith('add.outline.16');
            expect(screen.queryByRole('alert')).not.toBeInTheDocument();
        });

        it('removes the notice when the value is cleared', () => {
            setIconFailed(downFill16, true);
            render(<Controlled initial="disclosure.down.fill.16" onChange={vi.fn()} />);
            fireEvent.click(screen.getByRole('button', { name: 'Очистить' }));
            expect(screen.queryByRole('alert')).not.toBeInTheDocument();
        });

        it('shows the notice when the thumbnail file errors and hides it after a successful load', () => {
            const fake = installFakeImage();
            try {
                setup('disclosure.down.fill.16');
                expect(screen.queryByRole('alert')).not.toBeInTheDocument();

                fake.fail((url) => url === downFill16);
                expect(screen.getByRole('alert')).toHaveTextContent(FILE_FAILED_MESSAGE);

                fake.load((url) => url === downFill16);
                expect(screen.queryByRole('alert')).not.toBeInTheDocument();
            } finally {
                fake.restore();
            }
        });

        it('names a failed tile in the popover so a screen reader can tell it apart', () => {
            setIconFailed(addOutline24, true);
            setup(undefined);
            fireEvent.click(screen.getByLabelText('ClosedIcon: выбрать иконку'));
            expect(screen.getByLabelText('AddOutline: не удалось загрузить иконку')).toBeInTheDocument();
            expect(screen.getByLabelText('DisclosureDownFill')).toBeInTheDocument();
        });

        it('shows no notice for a value missing from the catalog', () => {
            setIconFailed(downFill16, true);
            setup('chevron.left.24');
            expect(screen.queryByRole('alert')).not.toBeInTheDocument();
        });
    });
});
