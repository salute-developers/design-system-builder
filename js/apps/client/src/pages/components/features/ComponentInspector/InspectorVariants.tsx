import { useState } from 'react';

import type { ComponentAPI, Config, Variation } from '../../../../controllers';

import { WorkbenchMenu, type WorkbenchMenuItem } from '../../ui/WorkbenchMenu';
import type { StoryArgs } from '../ComponentEditorPreview/storyArgs';
import { InspectorGroup } from './InspectorGroup';
import { InspectorStoryArgs } from './InspectorStoryArgs';
import { fallbackStyle, humanizeName, isDefaultStyle, orderedVariations, type Selection } from './inspectorModel';

interface InspectorVariantsProps {
    config: Config;
    api: ComponentAPI[];
    selection: Selection;
    onSelectionChange: (variationName: string, styleID: string | undefined) => void;
    onConfigUpdate: () => void;
    /** Аргументы story превью: строками после вариаций. */
    storyArgs?: StoryArgs;
}

/** Секция «Variants»: сочетание вариаций, которое рисует превью и редактирует инспектор, и аргументы story. */
export const InspectorVariants = ({
    config,
    api,
    selection,
    onSelectionChange,
    onConfigUpdate,
    storyArgs,
}: InspectorVariantsProps) => {
    // Вариация, у которой вместо списка стилей открыто поле нового стиля.
    const [creating, setCreating] = useState<{ variationID: string; name: string }>();

    const commitStyle = (variation: Variation) => {
        const name = creating?.name;
        setCreating(undefined);
        if (!name) return;
        config.addVariationStyle(api, variation.getID(), name);
        onConfigUpdate();
        // Новый стиль — последний в вариации: сразу показываем его в превью и инспекторе.
        const styles = variation.getStyles() ?? [];
        const created = styles[styles.length - 1];
        if (created?.getName() === name) onSelectionChange(variation.getName(), created.getID());
    };

    // Временное меню стилей: эти действия переедут на вкладку «Структура».
    const styleMenu = (variation: Variation, styleID: string | undefined): WorkbenchMenuItem[] => {
        const variationID = variation.getID();
        const isDefault = isDefaultStyle(config, variationID, styleID);
        return [
            isDefault
                ? {
                      key: 'unset-default',
                      label: 'Снять по умолчанию',
                      onSelect: () => {
                          config.removeDefault(variationID);
                          onConfigUpdate();
                      },
                  }
                : {
                      key: 'set-default',
                      label: 'Сделать по умолчанию',
                      disabled: !styleID,
                      onSelect: () => {
                          if (!styleID) return;
                          config.updateDefaults(variationID, styleID);
                          onConfigUpdate();
                      },
                  },
            { key: 'add-style', label: 'Добавить стиль', onSelect: () => setCreating({ variationID, name: '' }) },
            {
                key: 'delete-style',
                label: 'Удалить стиль',
                disabled: !styleID,
                onSelect: () => {
                    config.removeVariationStyle(variationID, styleID);
                    onConfigUpdate();
                    onSelectionChange(variation.getName(), fallbackStyle(config, variationID));
                },
            },
        ];
    };

    return (
        <InspectorGroup title="Variants">
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

                    const isCreating = creating?.variationID === variation.getID();
                    return (
                        <div
                            key={variation.getID()}
                            className={`component-variation-picker ${['size', 'view'].includes(name) ? 'is-primary-axis' : ''}`}
                        >
                            <span>{label}</span>
                            <span className="component-variation-picker-value">
                                {isCreating ? (
                                    <input
                                        autoFocus
                                        className="component-inline-create"
                                        aria-label={`Новый стиль ${name}`}
                                        placeholder="Название стиля…"
                                        value={creating.name}
                                        onChange={(event) =>
                                            setCreating({
                                                variationID: variation.getID(),
                                                name: event.target.value.replace(/[^a-zA-Z0-9]/g, ''),
                                            })
                                        }
                                        onKeyDown={(event) => {
                                            if (event.key === 'Enter') commitStyle(variation);
                                            if (event.key === 'Escape') setCreating(undefined);
                                        }}
                                        onBlur={() => setCreating(undefined)}
                                    />
                                ) : (
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
                                )}
                            </span>
                            <WorkbenchMenu
                                className="component-variation-style-menu"
                                label={`Стили ${name}`}
                                items={styleMenu(variation, styleID)}
                            />
                        </div>
                    );
                })}
                <InspectorStoryArgs storyArgs={storyArgs} />
            </div>
        </InspectorGroup>
    );
};
