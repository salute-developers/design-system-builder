import type {
    ExportCounts,
    ExportPlan,
    ExportReport,
    PlanCollection,
    PlanColor,
    PlanPaint,
    PlanSkip,
    PlanTextStyle,
    PlanValue,
    TextBinding,
} from '../shared/exportPlan';

/** Общие данные плагина: их читают и обновляют все инструменты DS Builder. */
const NAMESPACE = 'dsbuilder';
const KEY = 'key';
/** Дизайн-система переменной: ключ переходит только к переменной своей системы, а не чужой из того же файла. */
const DESIGN_SYSTEM = 'designSystem';
const MODES = 'modes';

/** Часть Plugin API, которая нужна записи; тесты подставляют поддельную реализацию. */
export type ExportFigmaApi = Pick<
    PluginAPI,
    | 'variables'
    | 'getLocalTextStylesAsync'
    | 'getLocalEffectStylesAsync'
    | 'getLocalPaintStylesAsync'
    | 'createTextStyle'
    | 'createEffectStyle'
    | 'createPaintStyle'
    | 'listAvailableFontsAsync'
    | 'loadFontAsync'
>;

type Keyed = { getSharedPluginData(namespace: string, key: string): string };

const keyOf = (item: Keyed) => item.getSharedPluginData(NAMESPACE, KEY);

const byKey = <T extends Keyed>(items: T[]) => {
    const map = new Map<string, T>();
    items.forEach((item) => {
        const key = keyOf(item);
        if (key) map.set(key, item);
    });
    return map;
};

const counts = (): ExportCounts => ({ collections: 0, variables: 0, textStyles: 0, effectStyles: 0, paintStyles: 0 });

/** Запись прекращается с причиной для отчёта. */
class ExportStopped extends Error {}

const rgb = ({ r, g, b }: PlanColor): RGB => ({ r, g, b });
const rgba = ({ r, g, b, a }: PlanColor): RGBA => ({ r, g, b, a });

/**
 * Матрица градиента Figma по углу CSS: ось градиента проходит через центр, а длина равна длине линии градиента CSS
 * в квадрате, поэтому крайние стопы ложатся в углы при 45°.
 */
export const gradientTransform = (angle: number): Transform => {
    const radians = (angle * Math.PI) / 180;
    const sin = Math.sin(radians);
    const cos = Math.cos(radians);
    const length = Math.abs(sin) + Math.abs(cos);
    return [
        [sin / length, -cos / length, 0.5 - (sin - cos) / (2 * length)],
        [cos, sin, 0.5 - (cos + sin) / 2],
    ];
};

type Lookup = (key: string) => Variable | undefined;

/**
 * Слой стиля; цвет сплошного слоя и стопов привязывается к переменной по ключу плана, поэтому один стиль меняется
 * вместе с режимом `01. Theme`. Ключ без переменной оставляет цвет из плана и попадает в [unbound].
 */
const figmaPaint = (paint: PlanPaint, lookup: Lookup, figma: ExportFigmaApi, unbound: Set<string>): Paint => {
    const variable = (key: string | undefined) => {
        const found = key ? lookup(key) : undefined;
        if (key && !found) unbound.add(key);
        return found;
    };
    if (paint.kind === 'solid') {
        const bound = variable(paint.key);
        // Альфа привязанного цвета живёт в переменной: прозрачность слоя умножилась бы на неё ещё раз.
        if (bound) {
            const solid: SolidPaint = { type: 'SOLID', color: rgb(paint.color), opacity: 1 };
            return figma.variables.setBoundVariableForPaint(solid, 'color', bound);
        }
        return { type: 'SOLID', color: rgb(paint.color), opacity: paint.color.a };
    }
    return {
        type: 'GRADIENT_LINEAR',
        gradientTransform: gradientTransform(paint.angle),
        gradientStops: paint.stops.map(({ position, color, key }) => {
            const bound = variable(key);
            const stop: ColorStop = { position, color: rgba(color) };
            return bound ? { ...stop, boundVariables: { color: figma.variables.createVariableAlias(bound) } } : stop;
        }),
    };
};

/** Начертания по насыщенности: имена стилей шрифтов в Figma не стандартизованы. */
const WEIGHT_STYLES: Record<number, string[]> = {
    100: ['Thin', 'Hairline'],
    200: ['ExtraLight', 'Extra Light', 'UltraLight', 'Ultra Light'],
    300: ['Light'],
    400: ['Regular', 'Normal', 'Book', 'Roman'],
    500: ['Medium'],
    600: ['SemiBold', 'Semi Bold', 'Semibold', 'DemiBold', 'Demi Bold'],
    700: ['Bold'],
    800: ['ExtraBold', 'Extra Bold', 'UltraBold', 'Heavy'],
    900: ['Black', 'Heavy'],
};

const fontFor = (fonts: Font[], family: string, weight: number): FontName | null => {
    const styles = fonts.filter((font) => font.fontName.family === family).map((font) => font.fontName.style);
    const wanted = WEIGHT_STYLES[weight] ?? [];
    const style = wanted.find((name) => styles.some((item) => item.toLowerCase() === name.toLowerCase()));
    const exact = styles.find((item) => item.toLowerCase() === style?.toLowerCase());
    return exact ? { family, style: exact } : null;
};

/** Применяет план к документу: находит объекты по общему ключу DS Builder и обновляет их, остальное создаёт. */
export const applyExportPlan = async (plan: ExportPlan, figma: ExportFigmaApi): Promise<ExportReport> => {
    const report: ExportReport = {
        source: plan.source,
        created: counts(),
        updated: counts(),
        stale: counts(),
        skipped: [...plan.skipped],
        notes: [...(plan.notes ?? [])],
        omitted: plan.omitted,
        missingFonts: [],
        fontFiles: [],
    };
    const touch = (created: boolean, kind: keyof ExportCounts) => {
        (created ? report.created : report.updated)[kind] += 1;
    };
    const skip = (entry: PlanSkip) => report.skipped.push(entry);

    if (!figma.variables) {
        report.failure = 'Редактор не поддерживает переменные Figma.';
        return report;
    }
    try {
        const variables = await writeVariables(plan, figma, touch, skip, report);
        await writeEffectStyles(plan, variables, figma, touch, report);
        await writePaintStyles(plan, variables, figma, touch, report);
        await writeTextStyles(plan.textStyles, variables, figma, touch, skip, report);
    } catch (error) {
        report.failure = error instanceof ExportStopped ? error.message : `Figma отказала: ${String(error)}`;
    }
    report.fontFiles = (plan.fontFiles ?? []).filter((family) => report.missingFonts.includes(family.family));
    return report;
};

type Touch = (created: boolean, kind: keyof ExportCounts) => void;

/** Временное имя на время переименований: имена в коллекции уникальны, и обмен именами иначе невозможен. */
const temporaryName = (key: string) => `dsbuilder-tmp/${key}`;

/** Имя, которое устаревшая переменная DS Builder получает, когда её прежнее имя нужно плану. */
const staleName = (name: string, taken: Map<string, Variable>) => {
    let candidate = `${name} (устарело)`;
    for (let index = 2; taken.has(candidate); index += 1) candidate = `${name} (устарело ${index})`;
    return candidate;
};

const writeVariables = async (
    plan: ExportPlan,
    figma: ExportFigmaApi,
    touch: Touch,
    skip: (entry: PlanSkip) => void,
    report: ExportReport,
) => {
    const collections = plan.collections;
    const designSystem = plan.source.designSystemId ?? '';
    const all = await figma.variables.getLocalVariablesAsync();
    const existingCollections = byKey(await figma.variables.getLocalVariableCollectionsAsync());
    const existingVariables = byKey(all);
    const targets = new Map<string, VariableCollection>();
    const modeIds = new Map<string, Map<string, string>>();

    // Сначала коллекции и режимы: отказ тарифа не оставляет в файле переменных без значений.
    for (const planned of collections) {
        let collection = existingCollections.get(planned.key);
        touch(!collection, 'collections');
        if (!collection) {
            collection = figma.variables.createVariableCollection(planned.name);
            collection.setSharedPluginData(NAMESPACE, KEY, planned.key);
        }
        collection.name = planned.name;
        modeIds.set(planned.key, ensureModes(collection, planned));
        targets.set(planned.key, collection);
    }

    const plannedKeys = new Set(collections.flatMap((item) => item.variables.map((variable) => variable.key)));
    const originalNames = new Map<Variable, string>();
    const written = new Map<string, Variable>();
    try {
        for (const planned of collections) {
            const collectionId = targets.get(planned.key)!.id;
            for (const variable of planned.variables) {
                const target = existingVariables.get(variable.key);
                if (target && target.variableCollectionId === collectionId && target.name !== variable.name) {
                    originalNames.set(target, target.name);
                    target.name = temporaryName(variable.key);
                }
            }
        }
        for (const planned of collections) {
            const collection = targets.get(planned.key)!;
            const owners = new Map(
                all
                    .filter((item) => item.variableCollectionId === collection.id)
                    .map((item) => [item.name, item] as const),
            );
            for (const variable of planned.variables) {
                let target = existingVariables.get(variable.key);
                if (target && target.variableCollectionId !== collection.id) {
                    skip({ name: variable.name, reason: 'переменная с этим ключом лежит в другой коллекции' });
                    continue;
                }
                const owner = owners.get(variable.name);
                if (owner && owner !== target) {
                    const ownerKey = keyOf(owner);
                    if (!ownerKey || plannedKeys.has(ownerKey)) {
                        skip({
                            name: variable.name,
                            reason: ownerKey
                                ? 'в плане два объекта с этим именем'
                                : 'имя занято переменной, созданной не DS Builder',
                        });
                        continue;
                    }
                    const sameSystem =
                        designSystem !== '' && owner.getSharedPluginData(NAMESPACE, DESIGN_SYSTEM) === designSystem;
                    if (!target && sameSystem && owner.resolvedType === variable.type) {
                        // Ключ сменился, а имя то же (токен создан заново, у подтемы сменился запасной токен):
                        // переменная переходит к новому ключу, и привязанные слои продолжают обновляться.
                        existingVariables.delete(ownerKey);
                        owner.setSharedPluginData(NAMESPACE, KEY, variable.key);
                        target = owner;
                    } else {
                        // Устаревшая переменная DS Builder уступает имя и остаётся для привязанных слоёв.
                        owner.name = staleName(variable.name, owners);
                        owners.set(owner.name, owner);
                    }
                }
                touch(!target, 'variables');
                if (!target) {
                    target = figma.variables.createVariable(variable.name, collection, variable.type);
                    target.setSharedPluginData(NAMESPACE, KEY, variable.key);
                }
                // Повторный экспорт меняет только то, что отличается: каждая запись в документ стоит времени.
                if (designSystem && target.getSharedPluginData(NAMESPACE, DESIGN_SYSTEM) !== designSystem) {
                    target.setSharedPluginData(NAMESPACE, DESIGN_SYSTEM, designSystem);
                }
                if (target.name !== variable.name) target.name = variable.name;
                originalNames.delete(target);
                owners.set(variable.name, target);
                if (!same(target.scopes, variable.scopes)) target.scopes = variable.scopes as VariableScope[];
                written.set(variable.key, target);
            }
        }
    } finally {
        restoreNames(originalNames);
    }

    const lookup = (key: string) => written.get(key) ?? existingVariables.get(key);
    for (const planned of collections) {
        const modes = modeIds.get(planned.key)!;
        for (const variable of planned.variables) {
            const target = written.get(variable.key);
            if (!target) continue;
            for (const [mode, value] of Object.entries(variable.values)) {
                const modeId = modes.get(mode);
                const resolved = modeId ? figmaValue(value, lookup, figma) : null;
                if (modeId && resolved !== null) {
                    if (!same(target.valuesByMode[modeId], resolved)) target.setValueForMode(modeId, resolved);
                } else if (!modeId) skip({ name: variable.name, reason: `в коллекции нет режима ${mode}` });
                else skip({ name: variable.name, reason: `нет переменной для ссылки в режиме ${mode}` });
            }
        }
    }

    existingVariables.forEach((_, key) => {
        if (!plannedKeys.has(key)) report.stale.variables += 1;
    });
    const plannedCollections = new Set(collections.map((collection) => collection.key));
    existingCollections.forEach((_, key) => {
        if (!plannedCollections.has(key)) report.stale.collections += 1;
    });
    return lookup;
};

/** Переменные, оставшиеся на временном имени после пропуска или отказа Figma, получают прежнее имя, если оно свободно. */
const restoreNames = (originalNames: Map<Variable, string>) => {
    originalNames.forEach((name, variable) => {
        for (const candidate of [name, `${name} (устарело)`, `${name} (устарело ${variable.id})`]) {
            try {
                variable.name = candidate;
                return;
            } catch {
                // Прежнее имя уже заняла другая переменная плана: пробуем имя с пометкой.
            }
        }
    });
};

/** Режимы коллекции по ключам плана; соответствие ключей и `modeId` хранится в общих данных коллекции. */
const ensureModes = (collection: VariableCollection, planned: PlanCollection) => {
    const saved = parseModes(collection.getSharedPluginData(NAMESPACE, MODES));
    const ids = new Map<string, string>();
    const alive = new Set(collection.modes.map((mode) => mode.modeId));
    // Свободный режим занимается, только пока соответствие не сохранено: режимы дизайнера не переименовываются.
    const free = Object.keys(saved).length ? [] : collection.modes.map((mode) => mode.modeId);
    for (const mode of planned.modes) {
        let id = saved[mode.key];
        if (!id || !alive.has(id)) id = free.shift() ?? addMode(collection, mode.name);
        collection.renameMode(id, mode.name);
        ids.set(mode.key, id);
    }
    collection.setSharedPluginData(NAMESPACE, MODES, JSON.stringify(Object.fromEntries(ids)));
    return ids;
};

const addMode = (collection: VariableCollection, name: string) => {
    try {
        return collection.addMode(name);
    } catch (error) {
        throw new ExportStopped(
            `Figma не разрешила добавить режим «${name}» в коллекцию «${collection.name}»: ${String(error)}. ` +
                'Число режимов ограничено тарифом файла.',
        );
    }
};

const parseModes = (raw: string): Record<string, string> => {
    try {
        const parsed: unknown = raw ? JSON.parse(raw) : {};
        return parsed && typeof parsed === 'object' ? (parsed as Record<string, string>) : {};
    } catch {
        return {};
    }
};

/** Допуск сравнения чисел: Figma хранит каналы цвета во float32, и прочитанное значение чуть отличается. */
const EPSILON = 1e-4;

/** Равенство значений Figma: структурное, числа — с допуском [EPSILON]. */
export const same = (current: unknown, next: unknown): boolean => {
    if (typeof current === 'number' && typeof next === 'number') return Math.abs(current - next) <= EPSILON;
    if (Array.isArray(current) && Array.isArray(next)) {
        return current.length === next.length && current.every((item, index) => same(item, next[index]));
    }
    if (current && next && typeof current === 'object' && typeof next === 'object') {
        const keys = Object.keys(next);
        return (
            keys.length === Object.keys(current).length &&
            keys.every((key) => same((current as Record<string, unknown>)[key], (next as Record<string, unknown>)[key]))
        );
    }
    return current === next;
};

const figmaValue = (
    value: PlanValue,
    lookup: (key: string) => Variable | undefined,
    figma: ExportFigmaApi,
): VariableValue | null => {
    if (value.kind === 'color') return rgba(value);
    if (value.kind === 'number' || value.kind === 'string') return value.value;
    const target = lookup(value.key);
    if (!target) return null;
    const alias = figma.variables.createVariableAlias(target);
    return value.opacity === undefined ? alias : { color: alias, opacity: value.opacity };
};

const writeEffectStyles = async (
    plan: ExportPlan,
    lookup: Lookup,
    figma: ExportFigmaApi,
    touch: Touch,
    report: ExportReport,
) => {
    const existing = byKey(await figma.getLocalEffectStylesAsync());
    for (const planned of plan.effectStyles) {
        let style = existing.get(planned.key);
        touch(!style, 'effectStyles');
        if (!style) {
            style = figma.createEffectStyle();
            style.setSharedPluginData(NAMESPACE, KEY, planned.key);
        }
        style.name = planned.name;
        let unbound = false;
        style.effects = planned.shadows.map((shadow): Effect => {
            const effect: DropShadowEffect = {
                type: 'DROP_SHADOW',
                color: rgba(shadow.color),
                offset: { x: shadow.x, y: shadow.y },
                radius: shadow.blur,
                spread: shadow.spread,
                visible: true,
                blendMode: 'NORMAL',
            };
            if (!shadow.colorKey) return effect;
            // Цвет слоя со ссылкой на палитру берётся из переменной `ShadowColors/…` вместе с прозрачностью.
            const variable = lookup(shadow.colorKey);
            if (!variable) unbound = true;
            return variable ? figma.variables.setBoundVariableForEffect(effect, 'color', variable) : effect;
        });
        if (unbound) {
            report.notes.push({
                name: planned.name,
                reason: 'цвет слоя тени не привязан к переменной: переменной нет',
            });
        }
    }
    report.stale.effectStyles = staleCount(existing, plan.effectStyles);
};

const writePaintStyles = async (
    plan: ExportPlan,
    lookup: Lookup,
    figma: ExportFigmaApi,
    touch: Touch,
    report: ExportReport,
) => {
    const existing = byKey(await figma.getLocalPaintStylesAsync());
    for (const planned of plan.paintStyles) {
        let style = existing.get(planned.key);
        touch(!style, 'paintStyles');
        if (!style) {
            style = figma.createPaintStyle();
            style.setSharedPluginData(NAMESPACE, KEY, planned.key);
        }
        style.name = planned.name;
        // В Figma верхний слой — последний, в CSS — первый.
        const unbound = new Set<string>();
        style.paints = [...planned.paints].reverse().map((paint) => figmaPaint(paint, lookup, figma, unbound));
        if (unbound.size) {
            report.notes.push({
                name: planned.name,
                reason: 'цвет слоя не привязан к переменной: переменной стопа нет',
            });
        }
    }
    report.stale.paintStyles = staleCount(existing, plan.paintStyles);
};

const BINDINGS: TextBinding[] = ['fontFamily', 'fontSize', 'lineHeight', 'letterSpacing', 'fontWeight'];

const writeTextStyles = async (
    styles: PlanTextStyle[],
    lookup: (key: string) => Variable | undefined,
    figma: ExportFigmaApi,
    touch: Touch,
    skip: (entry: PlanSkip) => void,
    report: ExportReport,
) => {
    const existing = byKey(await figma.getLocalTextStylesAsync());
    report.stale.textStyles = staleCount(existing, styles);
    if (!styles.length) return;
    const fonts = await figma.listAvailableFontsAsync();
    // Начертание загружается один раз на экспорт, а не на каждый стиль: у темы десятки стилей одного шрифта.
    const loading = new Map<string, Promise<void>>();
    const load = (font: FontName) => {
        const id = `${font.family}\u0000${font.style}`;
        if (!loading.has(id)) loading.set(id, figma.loadFontAsync(font));
        return loading.get(id)!;
    };
    for (const planned of styles) {
        const font = fontFor(fonts, planned.fontFamily, planned.fontWeight);
        const familyMissing = !fonts.some((item) => item.fontName.family === planned.fontFamily);
        if (familyMissing && !report.missingFonts.includes(planned.fontFamily))
            report.missingFonts.push(planned.fontFamily);
        if (!font) {
            skip({
                name: planned.name,
                reason: `шрифт ${planned.fontFamily} с насыщенностью ${planned.fontWeight} не найден в Figma`,
            });
            continue;
        }
        try {
            await load(font);
        } catch (error) {
            skip({ name: planned.name, reason: `шрифт ${font.family} ${font.style} не загрузился: ${String(error)}` });
            continue;
        }
        let style = existing.get(planned.key);
        touch(!style, 'textStyles');
        if (!style) {
            style = figma.createTextStyle();
            style.setSharedPluginData(NAMESPACE, KEY, planned.key);
        }
        style.name = planned.name;
        style.fontName = font;
        style.fontSize = planned.fontSize;
        style.lineHeight = { unit: 'PIXELS', value: planned.lineHeight };
        style.letterSpacing = { unit: 'PIXELS', value: planned.letterSpacing };
        for (const field of BINDINGS) {
            const key = planned.bindings[field];
            const variable = key ? lookup(key) : undefined;
            style.setBoundVariable(field, variable ?? null);
        }
    }
};

const staleCount = (existing: Map<string, unknown>, planned: Array<{ key: string }>) => {
    const keys = new Set(planned.map((item) => item.key));
    return [...existing.keys()].filter((key) => !keys.has(key)).length;
};
