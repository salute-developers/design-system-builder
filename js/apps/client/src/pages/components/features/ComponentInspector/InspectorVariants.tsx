import type { Config } from '../../../../controllers';

import type { StoryArgs } from '../ComponentEditorPreview/storyArgs';
import { InspectorGroup } from './InspectorGroup';
import { InspectorStoryArgs } from './InspectorStoryArgs';
import { humanizeName, orderedVariations, type Selection } from './inspectorModel';

interface InspectorVariantsProps {
    config: Config;
    selection: Selection;
    onSelectionChange: (variationName: string, styleID: string | undefined) => void;
    /** Выбор открытой конфигурации; список показывается, когда конфигураций больше одной. */
    onConfigurationSelect?: (configurationId: string | undefined) => void;
    /** Аргументы story превью: строками после вариаций. */
    storyArgs?: StoryArgs;
}

/** Секция «Variants»: сочетание вариаций, которое рисует превью и редактирует инспектор, и аргументы story. */
export const InspectorVariants = ({
    config,
    selection,
    onSelectionChange,
    onConfigurationSelect,
    storyArgs,
}: InspectorVariantsProps) => {
    const configurations = config.getConfigurations();
    return (
        <InspectorGroup title="Variants">
            <div className="component-variation-targets">
                {configurations.length > 1 && onConfigurationSelect && (
                    <label className="component-variation-picker component-configuration-picker">
                        <span>Конфигурация</span>
                        <span className="component-variation-picker-value">
                            <select
                                aria-label="Конфигурация"
                                value={config.getConfigurationId() ?? ''}
                                onChange={(event) =>
                                    onConfigurationSelect(
                                        event.target.value === configurations[0]?.id ? undefined : event.target.value,
                                    )
                                }
                            >
                                {configurations.map((item) => (
                                    <option key={item.id} value={item.id}>
                                        {item.name}
                                    </option>
                                ))}
                            </select>
                        </span>
                    </label>
                )}
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
                                    {!styleID && <option value="">—</option>}
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
                <InspectorStoryArgs storyArgs={storyArgs} />
            </div>
        </InspectorGroup>
    );
};
