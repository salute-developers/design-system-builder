import { useEffect, useMemo, useRef, useState } from 'react';

import {
    buildStyleReferenceValue,
    listStyleReferenceTargets,
    parseStyleReference,
    resolveStyleReference,
    type Config,
    type StyleReferenceTarget,
} from '../../../../controllers';
import { toComponentRoute } from '../../../../composePreview/composeComponents';
import { TokenField, type TokenOption } from '../../../../features/InspectorControls';

import { useStyleReferenceAccess } from './StyleReferenceContext';

interface InspectorStyleReferenceProps {
    config: Config;
    label: string;
    /** Текущее значение: `оформление.стиль1.стиль2`. */
    value: string;
    onChange: (value: string) => void;
}

const targetKey = (target: Pick<StyleReferenceTarget, 'componentName' | 'appearanceName'>) =>
    `${target.componentName}/${target.appearanceName}`;

/**
 * Выбор стиля вложенного Compose-компонента: оформление цели, затем стиль каждой её вариации. Конфигурацию цели,
 * которой ещё нет в редакторе, догружает по выбору; пока она грузится, показывается состояние загрузки.
 */
export const InspectorStyleReference = ({ config, label, value, onChange }: InspectorStyleReferenceProps) => {
    const access = useStyleReferenceAccess();
    const [pending, setPending] = useState<StyleReferenceTarget>();
    const [error, setError] = useState<string>();
    const components = access?.designSystem.getComposeComponentsData();
    const targets = useMemo(
        () => listStyleReferenceTargets(components ?? [], config.getConfigurationId()),
        [components, config],
    );
    const resolved = useMemo(
        () => (value && components ? resolveStyleReference(components, value) : undefined),
        [components, value],
    );
    const selected = resolved && targets.find((item) => item.appearanceId === resolved.config.getConfigurationId());
    const options: TokenOption[] = targets.map((item) => ({
        value: targetKey(item),
        label: item.appearanceName,
        hint: item.componentName,
    }));

    const onChangeRef = useRef(onChange);
    onChangeRef.current = onChange;
    // Цель, чья загрузка завершилась: если конфигураций у неё так и нет, это ошибка, а не бесконечное ожидание.
    const [requested, setRequested] = useState<StyleReferenceTarget>();

    // Цель догрузилась: выбираются стили по умолчанию её вариаций.
    useEffect(() => {
        if (!pending || !components) return;
        const meta = components.find((item) => item.name === pending.componentName);
        if (!meta || meta.sources.configs.length === 0) {
            if (requested === pending) {
                setPending(undefined);
                setError('Не удалось загрузить вложенный компонент');
            }
            return;
        }
        setPending(undefined);
        const loaded = resolveStyleReference(components, pending.appearanceName);
        if (loaded) onChangeRef.current(buildStyleReferenceValue(loaded.config, loaded.selections));
        else setError('Не удалось найти оформление вложенного компонента');
    }, [pending, components, requested]);

    if (!access) return null;

    const selectTarget = (key: string) => {
        const target = targets.find((item) => targetKey(item) === key);
        if (!target) return;
        setError(undefined);
        if (target.loaded && components) {
            const loaded = resolveStyleReference(components, target.appearanceName);
            if (loaded) onChange(buildStyleReferenceValue(loaded.config, loaded.selections));
            return;
        }
        setPending(target);
        setRequested(undefined);
        access
            .loadComponent?.(toComponentRoute('compose', target.componentName))
            .then(() => setRequested((current) => current ?? target))
            .catch(() => {
                // Ошибка устаревшего выбора не должна сбрасывать загрузку более нового.
                setPending((current) => {
                    if (current !== target) return current;
                    setError('Не удалось загрузить вложенный компонент');
                    return undefined;
                });
            });
    };

    const selectStyle = (variationID: string, styleID: string) => {
        if (!resolved) return;
        onChange(buildStyleReferenceValue(resolved.config, { ...resolved.selections, [variationID]: styleID }));
    };

    const current = pending ? targetKey(pending) : selected ? targetKey(selected) : undefined;

    return (
        <div className="component-style-reference" data-testid="style-reference">
            <TokenField
                label={label}
                value={current ?? (value ? parseStyleReference(value).appearanceName : undefined)}
                options={options}
                searchPlaceholder="Найти конфигурацию"
                emptyText="Конфигурации не найдены"
                onChange={selectTarget}
            />
            {pending && !error && (
                <p className="component-property-hint" role="status">
                    Загружаем стили вложенного компонента…
                </p>
            )}
            {error && (
                <p className="component-property-error" role="alert">
                    {error}
                </p>
            )}
            {!pending &&
                resolved?.config.getVariations().map((variation) => (
                    <div key={variation.getID()} className="component-variation-state-row">
                        <span>{variation.getName()}</span>
                        <TokenField
                            label={`${label}: ${variation.getName()}`}
                            value={resolved.selections[variation.getID()]}
                            options={(variation.getStyles() ?? []).map((style) => ({
                                value: style.getID(),
                                label: style.getName(),
                            }))}
                            searchPlaceholder="Найти стиль"
                            emptyText="Стили не найдены"
                            onChange={(styleID) => selectStyle(variation.getID(), styleID)}
                        />
                    </div>
                ))}
        </div>
    );
};
