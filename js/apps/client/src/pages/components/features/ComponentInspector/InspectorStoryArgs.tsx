import { useState } from 'react';

import type { PreviewExamplePropertyDescription } from '../../../../composePreview';
import type { StoryArgs, StoryArgValue } from '../ComponentEditorPreview/storyArgs';

import { humanizeName } from './inspectorModel';

interface StoryArgRowProps {
    property: PreviewExamplePropertyDescription;
    value: StoryArgValue;
    onChange: (name: string, value: StoryArgValue) => void;
}

/** Число из ввода: `int` — только целое; пустой и промежуточный ввод (`-`, `0.`) не применяется. */
const parseArgNumber = (raw: string, type: 'int' | 'float') => {
    const text = raw.trim();
    if (!text) return undefined;
    const number = type === 'int' ? Number.parseInt(text, 10) : Number(text);
    return Number.isFinite(number) ? number : undefined;
};

/** Поле числового аргумента: текст ввода живёт черновиком, пока он не разбирается как число. */
const NumberArg = ({ property, value, onChange }: StoryArgRowProps & { property: { type: 'int' | 'float' } }) => {
    const [draft, setDraft] = useState<string>();
    const label = humanizeName(property.name);
    return (
        <input
            type="text"
            inputMode="decimal"
            className="component-story-arg-input"
            aria-label={label}
            value={draft ?? String(value)}
            onChange={(event) => {
                setDraft(event.target.value);
                const number = parseArgNumber(event.target.value, property.type);
                if (number !== undefined) onChange(property.name, number);
            }}
            onBlur={() => setDraft(undefined)}
        />
    );
};

/** Строка аргумента story (`component-instance-preview-row` прототипа) в разметке строк вариаций. */
const StoryArgRow = (props: StoryArgRowProps) => {
    const { property, value, onChange } = props;
    const label = humanizeName(property.name);

    if (property.type === 'boolean') {
        return (
            <label className="component-variation-picker component-instance-preview-row" title={property.name}>
                <span>{label}</span>
                <span className="component-variation-flag">
                    <input
                        type="checkbox"
                        role="switch"
                        className="inspector-switch"
                        aria-label={label}
                        checked={Boolean(value)}
                        onChange={(event) => onChange(property.name, event.target.checked)}
                    />
                </span>
            </label>
        );
    }

    const control =
        property.type === 'singleChoice' ? (
            <select
                aria-label={label}
                value={String(value)}
                onChange={(event) => onChange(property.name, event.target.value)}
            >
                {property.variants.map((variant) => (
                    <option key={variant} value={variant}>
                        {variant === '' ? '—' : variant}
                    </option>
                ))}
            </select>
        ) : property.type === 'string' ? (
            <input
                type="text"
                className="component-story-arg-input"
                aria-label={label}
                value={String(value)}
                onChange={(event) => onChange(property.name, event.target.value)}
            />
        ) : (
            <NumberArg {...props} property={property} />
        );

    return (
        <label className="component-variation-picker component-instance-preview-row" title={property.name}>
            <span>{label}</span>
            <span className="component-variation-picker-value">{control}</span>
        </label>
    );
};

/**
 * Аргументы story в конце «Variants» (`component-instance-preview-controls` прототипа): действуют только на превью,
 * в сочетание вариаций и модель компонента не попадают.
 */
export const InspectorStoryArgs = ({ storyArgs }: { storyArgs?: StoryArgs }) =>
    storyArgs?.properties.length ? (
        <div key={storyArgs.key} className="component-instance-preview-controls" aria-label="Аргументы story">
            {storyArgs.properties.map((property) => (
                <StoryArgRow
                    key={property.name}
                    property={property}
                    value={storyArgs.values[property.name] ?? property.defaultValue}
                    onChange={storyArgs.onChange}
                />
            ))}
        </div>
    ) : null;
