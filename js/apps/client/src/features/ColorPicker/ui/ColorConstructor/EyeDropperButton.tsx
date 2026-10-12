import { Root } from './EyeDropperButton.styles';

interface EyeDropperResult {
    sRGBHex: string;
}

interface EyeDropperConstructor {
    new (): { open: () => Promise<EyeDropperResult> };
}

/** EyeDropper API браузера: есть только в Chromium (Chrome, Edge, Яндекс Браузер). */
const eyeDropperApi = () => (window as Window & { EyeDropper?: EyeDropperConstructor }).EyeDropper;

interface EyeDropperButtonProps {
    onPick: (color: string) => void;
}

/** Пипетка: берёт цвет с любого места экрана. Без поддержки EyeDropper API кнопка не показывается. */
export const EyeDropperButton = ({ onPick }: EyeDropperButtonProps) => {
    const EyeDropper = eyeDropperApi();
    if (!EyeDropper) return null;

    const pick = async () => {
        try {
            const { sRGBHex } = await new EyeDropper().open();
            onPick(sRGBHex.toUpperCase());
        } catch {
            // Esc или клик вне экрана: пользователь отменил выбор, цвет не меняется.
        }
    };

    return (
        <Root type="button" aria-label="Взять цвет с экрана" title="Пипетка" onClick={pick}>
            {/* Контур пипетки по мотивам Lucide «pipette» (ISC). */}
            <svg
                viewBox="0 0 24 24"
                width="16"
                height="16"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
            >
                <path d="m2 22 1-1h3l9-9" />
                <path d="M3 21v-3l9-9" />
                <path d="m15 6 3.4-3.4a2.1 2.1 0 1 1 3 3L18 9l.4.4a2.1 2.1 0 1 1-3 3l-3.8-3.8a2.1 2.1 0 1 1 3-3l.4.4Z" />
            </svg>
        </Root>
    );
};
