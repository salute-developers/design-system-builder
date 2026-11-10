import { PIXSO_EDITOR } from '../shared/editor';
import type { ExportPlan, ExportReport } from '../shared/exportPlan';
import { applyExportPlan, type ExportFigmaApi } from './applyExportPlan';

/** Часть API Pixso для записи плана: стили читаются синхронно, остальное совпадает с Figma. */
export interface PixsoDocumentApi {
    variables: ExportFigmaApi['variables'];
    root: PluginDataHolder;
    getLocalTextStyles(): TextStyle[];
    getLocalEffectStyles(): EffectStyle[];
    getLocalPaintStyles(): PaintStyle[];
    createTextStyle(): TextStyle;
    createEffectStyle(): EffectStyle;
    createPaintStyle(): PaintStyle;
    listAvailableFontsAsync(): Promise<Font[]>;
    loadFontAsync(font: FontName): Promise<void>;
}

interface PluginDataHolder {
    getSharedPluginData(namespace: string, key: string): string;
    setSharedPluginData(namespace: string, key: string, value: string): void;
}

type Identified = PluginDataHolder & { readonly id: string };

/** Переходник с таблицей данных: её нужно записать в документ после экспорта. */
export type PixsoExportApi = ExportFigmaApi & { flush(): Promise<void> };

type Table = Record<string, Record<string, string>>;

const NAMESPACE = 'dsbuilder';
/** Указатель на текущее поколение таблицы: `<поколение>:<число частей>`. Пишется последним. */
const HEAD = 'objects.head';
/** Запас до неизвестного предела Pixso на одно значение: таблица делится на части. */
const CHUNK = 60_000;

const part = (generation: string, index: number) => `objects.${generation}.${index}`;

const parseHead = (head: string) => {
    const [generation, count] = head.split(':');
    return { generation, count: Number(count) || 0 };
};

/** Повреждённая таблица останавливает экспорт: с пустой таблицей он создал бы дубликаты всех объектов. */
const readTable = (root: PluginDataHolder): Table => {
    const head = root.getSharedPluginData(NAMESPACE, HEAD);
    if (!head) return {};
    const { generation, count } = parseHead(head);
    const raw = Array.from({ length: count }, (_, index) =>
        root.getSharedPluginData(NAMESPACE, part(generation, index)),
    );
    try {
        const parsed: unknown = JSON.parse(raw.join(''));
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed as Table;
    } catch {
        // Ниже общий отказ.
    }
    throw new Error('Таблица ключей DS Builder в файле повреждена: повторный экспорт создал бы дубликаты.');
};

/** Новое поколение пишется рядом со старым, указатель переключается последним: сбой посередине не портит таблицу. */
const writeTable = (root: PluginDataHolder, table: Table) => {
    const previous = parseHead(root.getSharedPluginData(NAMESPACE, HEAD));
    const generation = previous.generation === 'a' ? 'b' : 'a';
    const json = JSON.stringify(table);
    const count = Math.ceil(json.length / CHUNK);
    for (let index = 0; index < count; index += 1) {
        root.setSharedPluginData(NAMESPACE, part(generation, index), json.slice(index * CHUNK, (index + 1) * CHUNK));
    }
    root.setSharedPluginData(NAMESPACE, HEAD, `${generation}:${count}`);
    if (previous.generation && previous.generation !== generation) {
        for (let index = 0; index < previous.count; index += 1) {
            root.setSharedPluginData(NAMESPACE, part(previous.generation, index), '');
        }
    }
};

/**
 * Переходник к API записи плана. Pixso не сохраняет данные плагина у переменных, коллекций и стилей, а у документа
 * сохраняет, и `id` объектов стабильны. Поэтому данные объектов живут в таблице документа по `id`: запись плана
 * читает и пишет их как обычно, а таблица сохраняется одним вызовом [flush].
 */
export const pixsoExportApi = (pixso: PixsoDocumentApi): PixsoExportApi => {
    const table = readTable(pixso.root);
    const tracked = <T extends Identified>(item: T): T => {
        // Методы подменяются на самом объекте: Pixso принимает в API только свои объекты, обёртка не подойдёт.
        item.getSharedPluginData = (namespace, key) => table[item.id]?.[`${namespace}:${key}`] ?? '';
        item.setSharedPluginData = (namespace, key, value) => {
            table[item.id] = { ...table[item.id], [`${namespace}:${key}`]: value };
        };
        return item;
    };
    const variables = pixso.variables;
    return {
        // Без переменных запись плана сама сообщает, что редактор их не поддерживает.
        // Методы перечислены явно: у API Pixso они могут лежать в прототипе, и копирование объекта их потеряет.
        variables: (variables && {
            getLocalVariablesAsync: async () => (await variables.getLocalVariablesAsync()).map(tracked),
            getLocalVariableCollectionsAsync: async () =>
                (await variables.getLocalVariableCollectionsAsync()).map(tracked),
            createVariableCollection: (name: string) => tracked(variables.createVariableCollection(name)),
            createVariable: (name: string, collection: VariableCollection, type: VariableResolvedDataType) =>
                tracked(variables.createVariable(name, collection, type)),
            createVariableAlias: (variable: Variable) => variables.createVariableAlias(variable),
            setBoundVariableForPaint: (paint: SolidPaint, field: 'color', variable: Variable | null) =>
                variables.setBoundVariableForPaint(paint, field, variable),
            setBoundVariableForEffect: (
                effect: Effect,
                field: VariableBindableEffectField,
                variable: Variable | null,
            ) => variables.setBoundVariableForEffect(effect, field, variable),
        }) as unknown as ExportFigmaApi['variables'],
        getLocalTextStylesAsync: async () => pixso.getLocalTextStyles().map(tracked),
        getLocalEffectStylesAsync: async () => pixso.getLocalEffectStyles().map(tracked),
        getLocalPaintStylesAsync: async () => pixso.getLocalPaintStyles().map(tracked),
        createTextStyle: () => tracked(pixso.createTextStyle()),
        createEffectStyle: () => tracked(pixso.createEffectStyle()),
        createPaintStyle: () => tracked(pixso.createPaintStyle()),
        listAvailableFontsAsync: () => pixso.listAvailableFontsAsync(),
        // Запись передаёт начертание всегда: `fontFor` возвращает имя целиком.
        loadFontAsync: (font) => pixso.loadFontAsync({ family: font.family, style: font.style ?? 'Regular' }),
        // Записи отбрасываются только для объектов, которых нет в файле: прерванный экспорт мог не дойти до стилей.
        flush: async () => {
            if (!variables) return;
            const alive = new Set(
                [
                    ...(await variables.getLocalVariablesAsync()),
                    ...(await variables.getLocalVariableCollectionsAsync()),
                    ...pixso.getLocalTextStyles(),
                    ...pixso.getLocalEffectStyles(),
                    ...pixso.getLocalPaintStyles(),
                ].map((item) => item.id),
            );
            writeTable(pixso.root, Object.fromEntries(Object.entries(table).filter(([id]) => alive.has(id))));
        },
    };
};

/** Экспорт в Pixso: запись плана и сохранение таблицы ключей, в том числе после отказа Pixso. */
export const applyPixsoExport = async (plan: ExportPlan, pixso: PixsoDocumentApi): Promise<ExportReport> => {
    const api = pixsoExportApi(pixso);
    // Запись плана не бросает: отказ Pixso уже в отчёте. Ключи созданного до отказа тоже сохраняются.
    const report = await applyExportPlan(plan, api, PIXSO_EDITOR);
    try {
        await api.flush();
    } catch (error) {
        const reason = `ключи объектов не сохранены, повторный экспорт создаст дубликаты: ${String(error)}`;
        report.failure = report.failure ? `${report.failure} Кроме того, ${reason}` : `Pixso: ${reason}`;
    }
    return report;
};
