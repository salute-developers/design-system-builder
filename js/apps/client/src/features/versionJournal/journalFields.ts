import type { DraftChangeDto } from '../../api/editorContracts';
import type { VariationType } from '../../controllers/themeBuilder/types/token';
import { templateRampName } from '../../modules/palette/domain/names';
import { normalizedColorValue } from '../../api/colorValue';
import {
    journalObject,
    journalPaintChange,
    journalPaintStructureChanged,
    journalTokenValue,
    journalValueStructureChanged,
    type JournalPaintSource,
} from './journalTokenValues';

export { journalColor } from './journalTokenValues';

/** Градиент цветового токена: подпись поля инспектора и CSS свотча. */
export interface JournalPaint {
    text: string;
    swatch: string;
}

export type JournalValue = string | number | boolean | null | undefined | JournalPaint;

export interface JournalChangedField {
    path: string;
    label: string;
    before: JournalValue;
    after: JournalValue;
    /** Пути отмены параметра, если они отличаются от [path]; пустой список — параметр отменяется с записью. */
    revertPaths?: string[];
}

const fieldLabels: Record<string, string> = {
    name: 'Название',
    displayname: 'Отображаемое название',
    description: 'Описание',
    enabled: 'Используется',
    value: 'Значение',
    type: 'Тип',
    colorconfig: 'Цвета темы',
    profile: 'Цветовой профиль',
    preview: 'Предпросмотр темы',
    config: 'Настройки',
    accentlight: 'Акцентный цвет · Светлый режим',
    accentdark: 'Акцентный цвет · Темный режим',
    onaccentlight: 'Цвет на акцентном фоне',
    surfacelight: 'Фон · Светлый режим',
    surfacedark: 'Фон · Темный режим',
    accentcolor: 'Акцентный цвет',
    graytone: 'Оттенок серого',
    color: 'Цвет',
    opacity: 'Непрозрачность',
    fontfamily: 'Font family',
    fontfamilyref: 'Font family',
    fontweight: 'Font weight',
    weight: 'Font weight',
    fontstyle: 'Font style',
    fontsize: 'Font size',
    textsize: 'Font size',
    size: 'Размер',
    lineheight: 'Line height',
    letterspacing: 'Letter spacing',
    kerning: 'Letter spacing',
    offsetx: 'Смещение по горизонтали',
    offsety: 'Смещение по вертикали',
    blurradius: 'Размытие',
    spreadradius: 'Растяжение тени',
    fallbackelevation: 'Высота тени',
    blur: 'Размытие',
    spread: 'Растяжение тени',
    radius: 'Радиус',
    borderradius: 'Радиус скругления',
    borderwidth: 'Толщина границы',
    padding: 'Внутренний отступ',
    margin: 'Внешний отступ',
    width: 'Ширина',
    height: 'Высота',
    position: 'Позиция',
    angle: 'Угол',
    location: 'Положение',
    stops: 'Цвета градиента',
    colors: 'Цвета',
    gradient: 'Градиент',
    fonts: 'Начертания шрифта',
    src: 'Источник шрифта',
    link: 'Источник',
    invariantprops: 'Общие свойства',
    variations: 'Варианты',
    defaultvariations: 'Варианты по умолчанию',
    style: 'Стиль',
    styles: 'Стили',
    properties: 'Свойства',
    property: 'Свойство',
    param: 'Параметр',
    params: 'Параметры',
    adjustment: 'Корректировка',
    multiplier: 'Множитель',
    defaultstyleid: 'Вариант по умолчанию',
    statesetids: 'Наборы состояний',
    custompalette: 'Собственные цвета',
    primary: 'Основной цвет',
    onprimary: 'Цвет на основном фоне',
    background: 'Цвет фона',
    text: 'Цвет текста',
    light: 'Светлый режим',
    dark: 'Темный режим',
    strokesaturation: 'Насыщенность границ',
    fillsaturation: 'Насыщенность заливки',
    overridden: 'Своё значение платформы',
    label: 'Название',
    code: 'Код группы',
    groupid: 'Группа',
    parentid: 'Родительская группа',
    sourcetype: 'Тип исходной палитры',
    sourceshade: 'Исходная растяжка',
    added: 'Добавлена в группу',
    origin: 'Способ построения',
    anchorstep: 'Опорная ступень',
    anchorvalue: 'Опорный цвет',
};

const normalize = (name: string) => {
    return name.replace(/[-_]/g, '').toLowerCase();
};
const technicalFields = new Set([
    'id',
    'uid',
    'editrevision',
    'revision',
    'versionid',
    'designsystemid',
    'tenantid',
    'tokenid',
    'componentid',
    'appearanceid',
    'configurationid',
    'styleid',
    'propertyid',
    'variationid',
    'createdat',
    'updatedat',
    'deletedat',
    'actorid',
    'changedat',
    'platform',
    'mode',
    'paletteid',
]);
const referenceFields = new Set(['defaultstyleid', 'statesetids', 'groupid', 'parentid']);
const isTechnical = (name: string) => {
    const normalized = normalize(name);
    if (referenceFields.has(normalized)) return false;
    return technicalFields.has(normalized) || /(?:_id|Id|_ids|Ids)$/.test(name);
};

const segments = (path: string) =>
    path.startsWith('/')
        ? path
              .slice(1)
              .split('/')
              .map((part) => part.replace(/~1/g, '/').replace(/~0/g, '~'))
        : path.split('.');

const decoded = (value: unknown): unknown => {
    if (typeof value !== 'string' || !/^[\s]*[\[{]/.test(value)) return value;
    try {
        return JSON.parse(value);
    } catch {
        return value;
    }
};

const atPath = (value: unknown, path: string[]): unknown =>
    path.reduce<unknown>((current, part) => {
        const node = decoded(current);
        return journalObject(node)?.[part];
    }, value);

const fieldLabel = (path: string[], tokenType?: VariationType) => {
    const labels = path
        .filter((part) => normalize(part) !== 'value')
        .map((part) => {
            if (/^\d+$/.test(part)) {
                const noun = tokenType === 'shadow' || tokenType === 'gradient' ? 'Слой' : 'Элемент';
                return `${noun} ${Number(part) + 1}`;
            }
            if (tokenType === 'typography' && part === 'size') return 'Font size';
            return fieldLabels[normalize(part)] ?? (/[а-яё]/i.test(part) ? part : 'Параметр');
        });
    return [...new Set(labels)].join(' · ') || 'Значение';
};

const flattenChange = (
    path: string[],
    before: unknown,
    after: unknown,
    tokenType?: VariationType,
): JournalChangedField[] => {
    if (path.some(isTechnical)) return [];
    const previous = decoded(before);
    const current = decoded(after);
    if (JSON.stringify(previous) === JSON.stringify(current)) return [];
    const previousObject = journalObject(previous);
    const currentObject = journalObject(current);
    if (previousObject || currentObject) {
        const keys = new Set([...Object.keys(previousObject ?? {}), ...Object.keys(currentObject ?? {})]);
        return [...keys].flatMap((key) =>
            flattenChange([...path, key], previousObject?.[key], currentObject?.[key], tokenType),
        );
    }
    return [
        {
            path: `/${path.map((part) => part.replace(/~/g, '~0').replace(/\//g, '~1')).join('/')}`,
            label: fieldLabel(path, tokenType),
            before: previous as JournalValue,
            after: current as JournalValue,
        },
    ];
};

const isIdentifier = (value: string) => {
    return /^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i.test(value);
};

const referenceLabel = (value: JournalValue, namesById: Map<string, string>): JournalValue => {
    if (typeof value !== 'string') return value;
    const name = namesById.get(value);
    if (name !== undefined) return name;
    return isIdentifier(value) ? 'Связанный элемент' : value;
};

/** Тип цветового токена: его значения показываются в терминах выбора цвета. */
const isColorTokenType = (type?: VariationType) => type === 'color' || type === 'gradient';

/** Значение цветового токена из записи: ссылка формы `palette_id` — ступенью палитры с прозрачностью из значения. */
const paintSource = (
    state: Record<string, unknown> | null,
    namesById: Map<string, string>,
): JournalPaintSource | undefined => {
    if (!state) return undefined;
    const reference = namesById.get(String(state.palette_id));
    const opacity = parseFloat(String([state.value].flat()[0]));
    const value = reference ? `${reference}${opacity >= 0 && opacity < 1 ? `[${opacity}]` : ''}` : state.value;
    return { value, platform: (state.platform ?? 'web') as JournalPaintSource['platform'] };
};

/**
 * Определяет структурное изменение значения в тех же понятиях, что и список параметров: у цветового токена —
 * также смену вида значения, типа градиента или числа стопов.
 */
export const tokenValueHasStructuralChanges = (change: DraftChangeDto, tokenType?: VariationType) =>
    journalValueStructureChanged(
        journalTokenValue(decoded(change.previousValue?.value), tokenType),
        journalTokenValue(decoded(change.currentValue?.value), tokenType),
    ) ||
    (isColorTokenType(tokenType) &&
        journalPaintStructureChanged(
            paintSource(change.previousValue, new Map()),
            paintSource(change.currentValue, new Map()),
        ));

/** Превращает предметные состояния в отдельные изменённые значения без JSON и служебных полей. */
export const presentChangedFields = (
    changes: DraftChangeDto[],
    namesById: Map<string, string>,
    tokenType?: VariationType,
): JournalChangedField[] => {
    return changes
        .flatMap((change) => {
            const editorState = (state: Record<string, unknown> | null) =>
                state && change.entityType === 'token-value'
                    ? { ...state, value: journalTokenValue(decoded(state.value), tokenType) }
                    : state;
            const previous = editorState(change.previousValue);
            const current = editorState(change.currentValue);
            const paths = change.changedPaths.length
                ? change.changedPaths
                : [...new Set([...Object.keys(change.previousValue ?? {}), ...Object.keys(change.currentValue ?? {})])];
            const mode = (change.currentValue ?? change.previousValue)?.mode;
            const fields = paths.flatMap((path) => {
                const parts = segments(path);
                return flattenChange(parts, atPath(previous, parts), atPath(current, parts), tokenType);
            });
            // Значение цвета или градиента — строками параметров редактора; пути хранимого значения — для их отмены.
            const valuePaths = fields.map(({ path }) => path).filter((path) => /^\/value(?:\/|$)/.test(path));
            const paint =
                change.entityType === 'token-value' && isColorTokenType(tokenType)
                    ? journalPaintChange(
                          paintSource(change.previousValue, namesById),
                          paintSource(change.currentValue, namesById),
                          // Смена формы ссылки `palette_id` не отменяется путями значения: только записью целиком.
                          change.previousValue?.palette_id === change.currentValue?.palette_id ? valuePaths : [],
                      )
                    : null;
            return [...(paint ?? []), ...fields.filter(({ path }) => !paint || !valuePaths.includes(path))].map(
                (entry) => ({
                    ...entry,
                    label:
                        change.entityType === 'token-value' && (mode === 'light' || mode === 'dark')
                            ? `${entry.label} · ${mode === 'light' ? 'Светлый режим' : 'Темный режим'}`
                            : entry.label,
                }),
            );
        })
        .map((entry) => ({
            ...entry,
            before: referenceLabel(entry.before, namesById),
            after: referenceLabel(entry.after, namesById),
        }));
};

/** Подписи значений соответствуют понятиям редактора, а не сериализации предметной модели. */
export const journalValueText = (value: JournalValue, label = '') => {
    if (value && typeof value === 'object') return value.text;
    value = normalizedColorValue(value);
    if (value === null || value === undefined || value === '') return 'Не задано';
    if (typeof value === 'string') {
        const palette = /^\[(general|additional)\.([a-zA-Z0-9]+)\.(\d+)\](?:\[(\d+(?:\.\d+)?)\])?$/.exec(value);
        if (palette) {
            const type = palette[1] as 'general' | 'additional';
            const name = `${templateRampName({ type, shade: palette[2] })} ${palette[3]}`;
            return [name, palette[4]].filter(Boolean).join(' · ');
        }
    }
    if (typeof value === 'boolean') return value ? 'Да' : 'Нет';
    if (label.includes('Цветовой профиль')) {
        return (
            ({ sber: 'Сбер', malachite: 'Малахит', b2b: 'Бизнес', custom: 'Собственный' } as Record<string, string>)[
                String(value)
            ] ?? String(value)
        );
    }
    if (typeof value === 'string' && /^-?\d+(?:\.\d+)?rem$/.test(value))
        return `${Number((parseFloat(value) * 16).toFixed(4))} px`;
    if (label.includes('Font style'))
        return ({ normal: 'Normal', italic: 'Italic' } as Record<string, string>)[String(value)] ?? String(value);
    if (label.includes('Font weight')) {
        const weight = (
            {
                '100': 'Thin',
                '200': 'Extra Light',
                '300': 'Light',
                '400': 'Regular',
                '500': 'Medium',
                '600': 'Semi Bold',
                '700': 'Bold',
                '800': 'Extra Bold',
                '900': 'Black',
            } as Record<string, string>
        )[String(value)];
        return weight ? `${weight} (${value})` : String(value);
    }
    return String(value);
};
