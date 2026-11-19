import type { Config } from '../../../../controllers';

import { InspectorGroup } from './InspectorGroup';
import { humanizeName, orderedVariations, type Selection } from './inspectorModel';

interface InspectorVariantsProps {
    config: Config;
    selection: Selection;
    onSelectionChange: (variationName: string, styleID: string | undefined) => void;
}

/**
 * Блок «Вариации» (`Variants` в требованиях): выбранные стили задают источник правки инспектора (ничего — инвариант, один стиль — стиль, несколько —
 * пересечение) и сочетание превью. Аргументы story — в отдельном блоке «Предпросмотр», выбор конфигурации — в блоке «Конфигурация».
 */
export const InspectorVariants = ({ config, selection, onSelectionChange }: InspectorVariantsProps) => {
    return (
        <InspectorGroup title="Вариации">
            <div className="component-variation-targets">
                {orderedVariations(config).map((variation) => {
                    const name = variation.getName();
                    const label = humanizeName(name);
                    const value = selection[name];
                    const styleID = typeof value === 'string' ? value : undefined;

                    if (variation.isFlag()) {
                        const flagID = variation.getStyles()?.[0]?.getID();
                        return (
                            <label key={variation.getID()} className="component-variation-picker">
                                <span>{label}</span>
                                <span className="component-variation-flag">
                                    <input
                                        type="checkbox"
                                        role="switch"
                                        className="inspector-switch"
                                        aria-label={label}
                                        checked={Boolean(flagID) && styleID === flagID}
                                        onChange={(event) =>
                                            onSelectionChange(name, event.target.checked ? flagID : undefined)
                                        }
                                    />
                                </span>
                            </label>
                        );
                    }

                    return (
                        <div
                            key={variation.getID()}
                            className={`component-variation-picker ${['size', 'view'].includes(name) ? 'is-primary-axis' : ''}`}
                        >
                            <span>{label}</span>
                            <span className="component-variation-picker-value">
                                <select
                                    aria-label={label}
                                    value={styleID ?? ''}
                                    onChange={(event) => onSelectionChange(name, event.target.value || undefined)}
                                >
                                    {/* «Все варианты» — вариация не выбрана: она не входит в источник правки. */}
                                    <option value="">Все варианты</option>
                                    {variation.getStyles()?.map((style) => (
                                        <option key={style.getID()} value={style.getID()}>
                                            {style.getName()}
                                        </option>
                                    ))}
                                </select>
                            </span>
                        </div>
                    );
                })}
            </div>
        </InspectorGroup>
    );
};
