import { gradientLabel, parseWebLayer, webLayers } from '../../../modules/colorTokens';

/** HEX для сравнения тем: верхний регистр, непрозрачная альфа отбрасывается. */
const comparableHex = (value: unknown) => {
    const text = (Array.isArray(value) ? value[0] : value) as unknown;
    if (typeof text !== 'string') return '';
    const hex = text.toUpperCase();
    return /^#[0-9A-F]{8}$/.test(hex) && hex.endsWith('FF') ? hex.slice(0, 7) : hex;
};

/**
 * Ячейка значения в блоке «В других темах»: образец и HEX цвета или образец и тип градиента. Полная подпись — в
 * подсказке: CSS-запись градиента в узкую колонку не помещается.
 */
export const otherThemeColorCell = (value: unknown) => {
    const layers = webLayers(value);
    const gradient = parseWebLayer(layers[0] ?? '');
    const hex = comparableHex(value);
    const label = gradient ? gradientLabel(gradient, layers.length) : hex.replace('#', '') || '—';
    return (
        <span className="other-themes-color" title={label}>
            <i style={{ background: gradient ? layers.join(', ') : hex || 'transparent' }} />
            <span>{label}</span>
        </span>
    );
};
