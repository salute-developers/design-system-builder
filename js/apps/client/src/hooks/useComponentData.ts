import { useEffect, useRef, useState } from 'react';

import { Config } from '../controllers';

// TODO: перенести в утилиты?
export const getDefaultProps = (config: Config) => {
    const defaultVariations = config.getDefaults();
    const defaults: Record<string, string | boolean> = {};

    defaultVariations.forEach((item) => {
        defaults[item.getVariation()] = item.getStyleID();
    });

    // Для web при заданных стилях по умолчанию остальные вариации не выбираются, как и раньше.
    if (defaultVariations.length && config.getPlatform() !== 'compose') {
        return defaults;
    }

    // Вариация без стиля по умолчанию (например, `view` у `TabBar`) получает первый стиль: от него зависят значения
    // сочетаний стилей, и без него вложенные стили айтемов не попадают в превью, пока вкладку вариации не откроют.
    // Флаг без значения по умолчанию остаётся выключенным: его выключенное состояние — отсутствие аргумента.
    config.getVariations().forEach((variation) => {
        if (defaults[variation.getName()] !== undefined || (defaultVariations.length && variation.isFlag())) {
            return;
        }

        const firstStyle = variation.getStyles()?.[0];

        if (firstStyle) {
            defaults[variation.getName()] = firstStyle.getID();
        }
    });

    return defaults;
};

/** Вариации, в которых уже можно что-то выбрать: у заглушки модели, пока компонент грузится, стилей нет. */
export const selectableVariations = (config: Config) =>
    new Set(
        config
            .getVariations()
            .filter((variation) => (variation.getStyles()?.length ?? 0) > 0)
            .map((variation) => variation.getName()),
    );

/** Имена стилей экземпляра модели по ключу `вариация:ID стиля`. */
export const styleNames = (config: Config) =>
    new Map(
        config
            .getVariations()
            .flatMap((variation) =>
                (variation.getStyles() ?? []).map((style) => [
                    `${variation.getName()}:${style.getID()}`,
                    style.getName(),
                ]),
            ),
    );

/**
 * Выбор, сделанный в прежнем экземпляре того же компонента, после перечитывания (например, после автосохранения):
 * сохраняются стили, которые ещё есть в модели; стиль, получивший серверный ID вместо временного, находится по имени
 * в той же вариации; выключенный флаг остаётся выключенным; удалённый стиль заменяется стилем по умолчанию. Вариация, в которой прежде выбрать было нечего (заглушка до загрузки компонента или новая
 * вариация), получает стиль по умолчанию.
 */
export const keepSelection = (
    config: Config,
    current: Record<string, string | boolean>,
    defaults: Record<string, string | boolean>,
    known: ReadonlySet<string>,
    /** Имена стилей прежнего экземпляра ({@link styleNames}). */
    previousNames: ReadonlyMap<string, string> = new Map(),
) => {
    const kept: Record<string, string | boolean> = {};

    config.getVariations().forEach((variation) => {
        const name = variation.getName();
        const value = current[name];

        if (!known.has(name)) {
            if (defaults[name] !== undefined) kept[name] = defaults[name];
            return;
        }

        if (value === undefined) {
            return;
        }

        const renamed = (id: string) => {
            const styleName = previousNames.get(`${name}:${id}`);
            return styleName
                ? variation
                      .getStyles()
                      ?.find((style) => style.getName() === styleName)
                      ?.getID()
                : undefined;
        };
        const next =
            typeof value === 'string'
                ? variation.getStyle(value)
                    ? value
                    : (renamed(value) ?? defaults[name])
                : defaults[name];

        if (next !== undefined) {
            kept[name] = next;
        }
    });

    return kept;
};

/** Выбор вариаций редактора: стили по умолчанию при открытии компонента. Аргументы story описывает плагин превью. */
export const useComponentData = (config?: Config) => {
    const [componentProps, setComponentProps] = useState<Record<string, string | boolean>>({});
    // Компонент, которому принадлежит выбор, и его вариации со стилями: при перечитывании того же компонента выбор
    // не сбрасывается, а вариации, которые только что получили стили, встают на стили по умолчанию.
    // Прежний экземпляр хранится целиком: стиль, добавленный редактором, попадает в него уже после эффекта.
    const owner = useRef<{ key: string; known: ReadonlySet<string>; config: Config }>();

    useEffect(() => {
        if (!config) {
            return;
        }

        const key = `${config.getPlatform()}:${config.getName()}`;
        const defaults = getDefaultProps(config);
        const previous = owner.current?.key === key ? owner.current : undefined;
        const previousNames = previous ? styleNames(previous.config) : undefined;
        owner.current = { key, known: selectableVariations(config), config };

        setComponentProps((current) =>
            previous ? keepSelection(config, current, defaults, previous.known, previousNames) : defaults,
        );
    }, [config]);

    return [componentProps, setComponentProps] as const;
};
