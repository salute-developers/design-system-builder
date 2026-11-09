import { useLayoutEffect, useRef } from 'react';

import type { ColorFieldValue } from '../../modules/colorTokens';
import { ColorPickerPopover } from '../../pages/colors/ui/ColorPickerPopover';

import { TokenColorLibrary } from './TokenColorLibrary';
import type { ColorTokenOption } from './types';

interface ComponentColorPickerProps {
    label: string;
    /** Токен или сырой цвет свойства. */
    value: string;
    /** Цвет, который видит пользователь: сырой цвет или цвет токена в текущей теме. */
    color: string;
    linked: boolean;
    tokens: ColorTokenOption[];
    /** Поле, у которого открыт пикер: окно встаёт слева от него. */
    anchor: HTMLElement | null;
    /** Селектор поля, клик по которому не закрывает пикер: его собственное поле. */
    dismissExcept: string;
    onChange: (value: string) => void;
    onClose: () => void;
}

const WIDTH = 240;
const GAP = 12;

/** Значение для пикера раздела «Цвета»: только сплошной цвет, поэтому переключатель градиента недоступен. */
const fieldValue = (color: string): ColorFieldValue => {
    const alpha = /^#[0-9a-f]{8}$/i.test(color) ? parseInt(color.slice(7, 9), 16) / 255 : 1;
    return {
        value: color,
        raw: color,
        resolved: color,
        baseColor: color,
        paletteLabel: null,
        opacity: alpha,
        kind: 'color',
        paint: null,
        missing: null,
        platforms: {},
    };
};

/**
 * Пикер цвета инспектора (`colorPickerView` с `componentTarget` прототипа): окно раздела «Цвета» со своей вкладкой
 * «Библиотека» из токенов темы. Встаёт слева от поля и не выходит за окно браузера.
 */
export const ComponentColorPicker = (props: ComponentColorPickerProps) => {
    const { label, value, color, linked, tokens, anchor, dismissExcept, onChange, onClose } = props;
    const layer = useRef<HTMLDivElement>(null);

    useLayoutEffect(() => {
        const node = layer.current;
        if (!node || !anchor) return;
        const place = () => {
            const rect = anchor.getBoundingClientRect();
            const height = node.firstElementChild?.getBoundingClientRect().height ?? 0;
            node.style.left = `${Math.max(8, rect.left - WIDTH - GAP)}px`;
            node.style.top = `${Math.max(8, Math.min(rect.top - 8, window.innerHeight - height - 8))}px`;
        };
        place();
        window.addEventListener('resize', place);
        document.addEventListener('scroll', place, { capture: true, passive: true });
        const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(place);
        if (node.firstElementChild) observer?.observe(node.firstElementChild);
        return () => {
            window.removeEventListener('resize', place);
            document.removeEventListener('scroll', place, { capture: true });
            observer?.disconnect();
        };
    }, [anchor]);

    return (
        <div ref={layer} className="component-color-picker-layer">
            <ColorPickerPopover
                label={label}
                value={fieldValue(color)}
                platform="web"
                palette={null}
                tokenName=""
                resolveColor={(next) => next}
                initialTab={linked ? 'library' : 'custom'}
                dismissExcept={dismissExcept}
                library={
                    <TokenColorLibrary
                        options={tokens}
                        value={linked ? value : undefined}
                        onPick={(option) => onChange(option.value)}
                    />
                }
                onCommit={(paint) => {
                    if (paint.kind === 'color') onChange(paint.color.toUpperCase());
                }}
                onClose={onClose}
            />
        </div>
    );
};
