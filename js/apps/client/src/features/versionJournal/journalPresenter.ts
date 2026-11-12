import type { Meta } from '../../controllers/componentBuilder/type';
import type { VariationType } from '../../controllers/themeBuilder/types/token';
import type { DraftChangeDto, EditorContextKey, PaletteDto, TokenDefinitionDto } from '../../api/editorContracts';
import { presentChangedFields, tokenValueHasStructuralChanges, type JournalChangedField } from './journalFields';
import { presentPaletteChange, type JournalPaletteStep } from './paletteJournalPresentation';
import { humanizeName } from '../../utils/text';
import type { JournalComponentMetadata } from '../../api/journalComponentMetadata';
export type JournalSection = 'themes' | 'tokens' | 'components';
export type JournalSource = 'themes' | 'palette' | 'colors' | 'typography' | 'sizes' | 'components';
export const journalSources: Array<{
    id: JournalSource;
    label: string;
}> = [
    {
        id: 'themes',
        label: 'Темы',
    },
    {
        id: 'palette',
        label: 'Палитра',
    },
    {
        id: 'colors',
        label: 'Цветовые токены',
    },
    {
        id: 'typography',
        label: 'Типографика',
    },
    {
        id: 'sizes',
        label: 'Отступы, радиусы и тени',
    },
    {
        id: 'components',
        label: 'Компоненты',
    },
];
export type JournalNavigationTarget =
    | {
          kind: 'entity';
          pathname: string;
          search: string;
      }
    | {
          kind: 'section';
          pathname: string;
          search: string;
      }
    | {
          kind: 'unavailable';
      };
export interface JournalActionViewModel {
    key: string;
    section: JournalSection;
    source: JournalSource;
    title: string;
    platformLabel?: string;
    groupLabel?: string;
    paletteSteps?: JournalPaletteStep[];
    revertPaths?: string[];
    structural?: boolean;
    operation: DraftChangeDto['operation'];
    actorId: string | null;
    actorLabel: string;
    changedAt: string;
    changedFields: JournalChangedField[];
    changes: DraftChangeDto[];
    navigation: JournalNavigationTarget;
    canRevert: boolean;
}
export interface JournalPresenterInput {
    componentMetadata?: Pick<JournalComponentMetadata, 'componentNames' | 'referenceNames'> &
        Partial<Pick<JournalComponentMetadata, 'styleVariations' | 'stateSetStates'>>;
    changes: DraftChangeDto[];
    tokens: TokenDefinitionDto[];
    components: Meta[];
    actorLabels: Record<string, string>;
    context: EditorContextKey;
    readOnly?: boolean;
    /** Ступени палитры для значений цветовых токенов, записанных ссылкой `palette_id`. */
    palette?: PaletteDto[];
}
const operationLabels: Record<DraftChangeDto['operation'], string> = {
    created: 'Создание',
    updated: 'Изменение',
    deleted: 'Удаление',
};
const tokenPresentation = new Map<
    string,
    {
        label: string;
        section: string;
        source: JournalSource;
    }
>([
    ['color', { label: 'Цвет', section: 'colors', source: 'colors' }],
    ['gradient', { label: 'Градиент', section: 'colors', source: 'colors' }],
    ['typography', { label: 'Типографика', section: 'typography', source: 'typography' }],
    ['fontFamily', { label: 'Семейство шрифтов', section: 'typography', source: 'typography' }],
    ['spacing', { label: 'Размер', section: 'shapes', source: 'sizes' }],
    ['shape', { label: 'Радиус', section: 'shapes', source: 'sizes' }],
    ['shadow', { label: 'Тень', section: 'shapes', source: 'sizes' }],
]);
const componentEntityTypes = new Set([
    'design-system-component',
    'appearance',
    'appearance-combination',
    'appearance-combination-member',
    'appearance-variation',
    'appearance-variation-value',
    'component-reuse-config',
    'component-style-reference',
    'component-style-reference-style',
    'configuration',
    'invariant-platform-param-adjustment',
    'invariant-property-value',
    'style',
    'style-combination',
    'style-combination-member',
    'variation',
    'variation-platform-param-adjustment',
    'variation-property-value',
]);
export const isComponentJournalChange = (change: DraftChangeDto) => componentEntityTypes.has(change.entityType);
const field = (change: DraftChangeDto, ...names: string[]) => {
    for (const name of names) {
        const value = change.currentValue?.[name] ?? change.previousValue?.[name];
        if (value !== undefined && value !== null) return value;
    }
    return undefined;
};
const query = (tokenId: string | undefined, versionId: string | undefined) => {
    const params = new URLSearchParams();
    if (tokenId) params.set('tokenId', tokenId);
    if (versionId) params.set('versionId', versionId);
    const value = params.toString();
    return value ? `?${value}` : '';
};
const themeRoot = (context: EditorContextKey, tenantId = context.tenantId) =>
    `/projects/${context.projectId}/design-systems/${context.designSystemId}/themes/${tenantId}`;
const collectComponentIds = (value: unknown, ids: Map<string, string>, componentName: string) => {
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value)) {
        value.forEach((item) => collectComponentIds(item, ids, componentName));
        return;
    }
    const record = value as Record<string, unknown>;
    if (typeof record.id === 'string') ids.set(record.id, componentName);
    Object.values(record).forEach((item) => collectComponentIds(item, ids, componentName));
};
const collectReferenceNames = (value: unknown, names: Map<string, string>) => {
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value)) {
        value.forEach((item) => collectReferenceNames(item, names));
        return;
    }
    const record = value as Record<string, unknown>;
    const name = record.displayName ?? record.name;
    if (typeof record.id === 'string' && typeof name === 'string') names.set(record.id, name);
    Object.values(record).forEach((item) => collectReferenceNames(item, names));
};
export const buildComponentEntityIndex = (components: Meta[]) => {
    const result = new Map<string, string>();
    components.forEach((component) => {
        if (component.serverBinding) {
            result.set(component.serverBinding.componentId, component.name);
            result.set(component.serverBinding.appearanceId, component.name);
        }
        collectComponentIds(component.sources, result, component.name);
    });
    return result;
};
const sectionFor = (entityType: string): JournalSection => {
    if (entityType === 'tenant') return 'themes';
    if (
        entityType === 'token' ||
        entityType === 'token-value' ||
        entityType === 'token-group' ||
        entityType.startsWith('palette-')
    )
        return 'tokens';
    return 'components';
};
const sourceFor = (change: DraftChangeDto, tokenType?: VariationType): JournalSource => {
    if (change.entityType === 'tenant') return 'themes';
    if (change.entityType === 'palette' || change.entityType.startsWith('palette-')) return 'palette';
    if (change.entityType === 'token-group') return 'colors';
    if (change.entityType !== 'token' && change.entityType !== 'token-value') return 'components';
    return tokenPresentation.get(tokenType ?? '')?.source ?? 'sizes';
};
const componentNameFor = (change: DraftChangeDto, componentIndex: Map<string, string>) => {
    const directName = field(change, 'component_name', 'componentName');
    const candidateIds = [
        change.entityId,
        field(change, 'component_id', 'componentId'),
        field(change, 'appearance_id', 'appearanceId'),
        ...Object.values(change.currentValue ?? {}),
        ...Object.values(change.previousValue ?? {}),
    ];
    for (const candidate of candidateIds) {
        if (candidate && componentIndex.has(String(candidate))) return componentIndex.get(String(candidate));
    }
    return typeof directName === 'string' ? directName : undefined;
};
const navigationFor = (
    change: DraftChangeDto,
    context: EditorContextKey,
    tokensById: Map<string, TokenDefinitionDto>,
    componentIndex: Map<string, string>,
): JournalNavigationTarget => {
    if (change.entityType.startsWith('palette-')) {
        const tenantId = String(field(change, 'tenant_id') ?? context.tenantId);
        const params = new URLSearchParams(query(undefined, context.versionId));
        const groupId = change.entityType === 'palette-group' ? change.entityId : field(change, 'group_id');
        if (groupId) params.set('groupId', String(groupId));
        for (const [fieldName, param] of [
            ['slot_type', 'type'],
            ['slot_shade', 'shade'],
            ['step', 'step'],
        ] as const) {
            const value = field(change, fieldName);
            if (value !== undefined) params.set(param, String(value));
        }
        return {
            kind: 'section',
            pathname: `${themeRoot(context, tenantId)}/palette`,
            search: params.size ? `?${params}` : '',
        };
    }
    if (change.entityType === 'token-group') {
        return {
            kind: 'section',
            pathname: `${themeRoot(context)}/colors`,
            search: query(undefined, context.versionId),
        };
    }
    if (change.entityType === 'tenant') {
        if (change.operation === 'deleted')
            return {
                kind: 'unavailable',
            };
        const tenantId = String(field(change, 'tenant_id', 'tenantId', 'id') ?? change.entityId);
        return {
            kind: 'entity',
            pathname: `${themeRoot(context, tenantId)}/${context.versionId ? 'colors' : 'settings'}`,
            search: query(undefined, context.versionId),
        };
    }
    if (change.entityType === 'token' || change.entityType === 'token-value') {
        const tokenId = String(field(change, 'token_id', 'tokenId') ?? change.entityId);
        const tenantId = String(field(change, 'tenant_id', 'tenantId') ?? context.tenantId);
        const token = tokensById.get(tokenId);
        const type = token?.type ?? String(field(change, 'type') ?? '');
        const section = tokenPresentation.get(type)?.section ?? 'shapes';
        const pathname = `${themeRoot(context, tenantId)}/${section}`;
        return token
            ? {
                  kind: 'entity',
                  pathname,
                  search: query(tokenId, context.versionId),
              }
            : {
                  kind: 'section',
                  pathname,
                  search: query(undefined, context.versionId),
              };
    }
    if (componentEntityTypes.has(change.entityType)) {
        const componentName = componentNameFor(change, componentIndex);
        const pathname = `${themeRoot(context)}/components${componentName ? `/${encodeURIComponent(componentName)}` : ''}`;
        return {
            kind: componentName ? 'entity' : 'section',
            pathname,
            search: query(undefined, context.versionId),
        };
    }
    return {
        kind: 'unavailable',
    };
};
/** Глаголы заголовка записи: подключения и связь с дизайн-системой называются своими словами. */
const structureVerbs: Record<string, Record<DraftChangeDto['operation'], string>> = {
    link: { created: 'Подключение', updated: 'Изменение', deleted: 'Отключение' },
    plain: operationLabels,
};
const quoted = (value: unknown) => (typeof value === 'string' && value ? `«${value}»` : undefined);
const phrase = (...parts: Array<string | false | undefined>) => parts.filter(Boolean).join(' ');

/**
 * Заголовок записи о структурной части компонента: стиль, вариация, конфигурация, их подключения, значения свойств.
 * `undefined` — для остальных сущностей компонента остаётся общий заголовок «<Операция> компонента «<имя>»».
 */
const componentStructureTitle = (
    change: DraftChangeDto,
    componentName: string | undefined,
    metadata: JournalPresenterInput['componentMetadata'],
): string | undefined => {
    const names = metadata?.referenceNames ?? {};
    const of = quoted(componentName) && `компонента ${quoted(componentName)}`;
    const op = change.operation;
    const styleId = String(field(change, 'style_id') ?? (change.entityType === 'style' ? change.entityId : ''));
    const styleName = quoted(
        change.entityType === 'style' ? (field(change, 'name') ?? names[styleId]) : names[styleId],
    );
    const variationName = quoted(
        names[String(field(change, 'variation_id') ?? '')] ?? metadata?.styleVariations?.[styleId],
    );
    const appearanceName = quoted(
        change.entityType === 'appearance'
            ? field(change, 'name')
            : names[String(field(change, 'appearance_id') ?? '')],
    );
    switch (change.entityType) {
        case 'style':
            return phrase(operationLabels[op], 'стиля', styleName, variationName && `вариации ${variationName}`, of);
        case 'appearance-variation-value':
            // Подключение без пары: стиль переставлен в списке, добавлен в конфигурацию или исключён из неё.
            if (op === 'updated')
                return phrase(
                    change.changedPaths.every((path) => path === '/position') ? 'Перемещение стиля' : 'Изменение стиля',
                    styleName,
                    variationName && `в вариации ${variationName}`,
                    of,
                );
            return phrase(
                op === 'created' ? 'Добавление стиля' : 'Исключение стиля',
                styleName,
                of && `${op === 'created' ? 'в конфигурацию' : 'из конфигурации'} ${of}`,
            );
        case 'variation':
            return phrase(operationLabels[op], 'вариации', quoted(field(change, 'name') ?? names[change.entityId]), of);
        case 'appearance-variation':
            return phrase(
                structureVerbs.link[op],
                'вариации',
                variationName,
                appearanceName &&
                    `${op === 'deleted' ? 'от' : op === 'created' ? 'к' : 'в'} конфигурации ${appearanceName}`,
                of,
            );
        case 'appearance':
            return phrase(operationLabels[op], 'конфигурации', appearanceName, of);
        case 'design-system-component':
            if (op === 'created') return phrase('Добавление компонента', quoted(componentName), 'в дизайн-систему');
            if (op === 'deleted') return phrase('Скрытие компонента', quoted(componentName));
            return undefined;
        case 'variation-property-value':
        case 'invariant-property-value':
            return phrase(operationLabels[op], 'значения свойства', of);
        case 'variation-platform-param-adjustment':
        case 'invariant-platform-param-adjustment':
            return phrase(operationLabels[op], 'платформенного параметра', of);
        default:
            return undefined;
    }
};

/** Подключение стиля или вариации к конфигурации и сущность, которую оно подключает. */
const pairLinks: Record<string, { link: string; ref: string }> = {
    style: { link: 'appearance-variation-value', ref: 'style_id' },
    variation: { link: 'appearance-variation', ref: 'variation_id' },
};

/**
 * Пары записей одного действия: создание (удаление) стиля или вариации и её подключения к конфигурации одним автором.
 * Возвращает подключение для каждой сущности, у которой нашлась пара.
 */
export const pairStructureChanges = (changes: DraftChangeDto[]) => {
    const pairs = new Map<string, DraftChangeDto>();
    const used = new Set<string>();
    changes.forEach((entity) => {
        const rule = pairLinks[entity.entityType];
        if (!rule || entity.operation === 'updated') return;
        const link = changes
            .filter(
                (candidate) =>
                    candidate.entityType === rule.link &&
                    candidate.operation === entity.operation &&
                    candidate.actorId === entity.actorId &&
                    !used.has(candidate.changeId) &&
                    String(field(candidate, rule.ref)) === entity.entityId,
            )
            .sort(
                (a, b) =>
                    Math.abs(Date.parse(a.changedAt) - Date.parse(entity.changedAt)) -
                    Math.abs(Date.parse(b.changedAt) - Date.parse(entity.changedAt)),
            )[0];
        if (!link) return;
        pairs.set(entity.changeId, link);
        used.add(link.changeId);
    });
    return { pairs, used };
};

/** Строка пары: заголовок, поля и записи в порядке отмены (созданное — сначала подключение, удалённое — сначала сущность). */
const pairedAction = (
    action: JournalActionViewModel,
    entity: DraftChangeDto,
    link: DraftChangeDto,
    componentName: string | undefined,
    metadata: JournalPresenterInput['componentMetadata'],
): JournalActionViewModel => {
    const names = metadata?.referenceNames ?? {};
    const created = entity.operation === 'created';
    const of = quoted(componentName);
    const name = String(field(entity, 'name') ?? names[entity.entityId] ?? '');
    const value = (text: string | undefined) => ({
        before: created ? undefined : text,
        after: created ? text : undefined,
    });
    if (entity.entityType === 'style') {
        const variation = quoted(names[String(field(entity, 'variation_id') ?? '')]);
        return {
            ...action,
            key: `${entity.changeId}+${link.changeId}`,
            title: phrase(
                created ? 'Добавление стиля' : 'Удаление стиля',
                quoted(name),
                variation && `${created ? 'в вариацию' : 'из вариации'} ${variation}`,
                of && `компонента ${of}`,
            ),
            changedFields: [{ path: '/name', label: 'Стиль', ...value(name || undefined) }],
            changes: created ? [link, entity] : [entity, link],
        };
    }
    const defaultStyle = names[String(field(link, 'default_style_id') ?? '')];
    return {
        ...action,
        key: `${entity.changeId}+${link.changeId}`,
        title: phrase(
            created ? 'Добавление вариации' : 'Удаление вариации',
            quoted(name),
            of && `${created ? 'в компонент' : 'из компонента'} ${of}`,
        ),
        changedFields: [
            { path: '/name', label: 'Вариация', ...value(name || undefined) },
            ...(defaultStyle
                ? [{ path: '/default_style_id', label: 'Стиль по умолчанию', ...value(defaultStyle) }]
                : []),
        ],
        changes: created ? [link, entity] : [entity, link],
    };
};

const titleFor = (
    change: DraftChangeDto,
    tokensById: Map<string, TokenDefinitionDto>,
    componentIndex: Map<string, string>,
    metadata?: JournalPresenterInput['componentMetadata'],
) => {
    const prefix = operationLabels[change.operation];
    if (change.entityType === 'palette-group')
        return `Группа палитры: ${String(field(change, 'label') ?? 'Без названия')}`;
    if (change.entityType === 'token-group')
        return `Группа токенов: ${String(field(change, 'label') ?? 'Без названия')}`;
    if (change.entityType === 'palette-ramp' || change.entityType === 'palette-step') {
        const slot = [field(change, 'slot_type'), field(change, 'slot_shade'), field(change, 'step')]
            .filter((value) => value !== undefined)
            .join('.');
        return `${change.entityType === 'palette-step' ? 'Ступень палитры' : 'Растяжка палитры'}: ${slot || 'Без названия'}`;
    }
    if (change.entityType === 'palette-token-group') {
        const token = tokensById.get(String(field(change, 'token_id')));
        return `Группа палитры токена: ${token?.displayName ?? token?.name ?? 'Без названия'}`;
    }
    if (change.entityType === 'tenant') {
        return `${prefix} темы «${String(field(change, 'name') ?? 'Без названия')}»`;
    }
    if (change.entityType === 'token' || change.entityType === 'token-value') {
        const tokenId = String(field(change, 'token_id', 'tokenId') ?? change.entityId);
        const name =
            tokensById.get(tokenId)?.displayName ??
            tokensById.get(tokenId)?.name ??
            field(change, 'display_name', 'displayName', 'name') ??
            'Без названия';
        const type = tokensById.get(tokenId)?.type ?? (field(change, 'type') as VariationType | undefined);
        return `${tokenPresentation.get(type ?? '')?.label ?? 'Токен'}: ${name}`;
    }
    if (componentEntityTypes.has(change.entityType)) {
        const componentName = componentNameFor(change, componentIndex);
        return (
            componentStructureTitle(change, componentName, metadata) ??
            `${prefix} компонента «${componentName ?? 'Компонент'}»`
        );
    }
    return `${prefix} настройки дизайн-системы`;
};
const propertyValueTypes = new Set(['variation-property-value', 'invariant-property-value']);
/** Порядок состояний в подписи — как в инспекторе компонента. */
const stateOrder = ['focused', 'pressed', 'hovered'];

/**
 * Подпись значения свойства компонента: «Accordion gap · size: m», «Disable alpha · Инвариант»,
 * «Background · view: default · pressed + hovered». Неизвестные части пропускаются; `undefined`, если не известно ничего.
 */
export const propertyValueLabel = (
    change: DraftChangeDto,
    metadata: JournalPresenterInput['componentMetadata'],
): string | undefined => {
    if (!propertyValueTypes.has(change.entityType) || !metadata) return undefined;
    const value = change.currentValue ?? change.previousValue ?? {};
    const property = metadata.referenceNames[String(value.property_id)];
    const styleId = String(value.style_id ?? '');
    const style = metadata.referenceNames[styleId];
    const variation = metadata.styleVariations?.[styleId];
    const place =
        change.entityType === 'invariant-property-value'
            ? 'Инвариант'
            : style && variation
              ? `${variation}: ${style}`
              : style;
    const states = [...(metadata.stateSetStates?.[String(value.state_set_id)] ?? [])].sort(
        (a, b) =>
            (stateOrder.includes(a) ? stateOrder.indexOf(a) : stateOrder.length) -
            (stateOrder.includes(b) ? stateOrder.indexOf(b) : stateOrder.length),
    );
    if (!property && !place) return undefined;
    return [property && humanizeName(property), place, states.length ? states.join(' + ') : undefined]
        .filter(Boolean)
        .join(' · ');
};

/**
 * Поля значения свойства подписываются свойством и местом вместо «Значение»; смена токена, которую общий разбор
 * считает техническим полем, показывается именами токенов.
 */
const propertyValueFields = (
    change: DraftChangeDto,
    fields: JournalChangedField[],
    namesById: Map<string, string>,
    metadata: JournalPresenterInput['componentMetadata'],
): JournalChangedField[] => {
    if (change.entityType === 'appearance-variation' || change.entityType === 'appearance-variation-value') {
        // Место в списке стилей или вариаций — с единицы, как его видит пользователь.
        const place = (position: unknown) =>
            (typeof position === 'number' ? position + 1 : position) as JournalChangedField['before'];
        return fields.map((entry) =>
            entry.path === '/position'
                ? { ...entry, label: 'Место в списке', before: place(entry.before), after: place(entry.after) }
                : entry,
        );
    }
    if (!propertyValueTypes.has(change.entityType)) return fields;
    const label = propertyValueLabel(change, metadata);
    const labelled = label
        ? fields.map((entry) =>
              /^\/value(?:\/|$)/.test(entry.path)
                  ? { ...entry, label }
                  : entry.path === '/alpha' || entry.path === '/adjustment'
                    ? { ...entry, label: `${label} · ${entry.label}` }
                    : entry,
          )
        : fields;
    if (!change.changedPaths.includes('/token_id') || labelled.some(({ path }) => path === '/token_id'))
        return labelled;
    const tokenText = (state: Record<string, unknown> | null) => {
        const id = state?.token_id;
        if (id) return namesById.get(String(id)) ?? null;
        return (state?.value as string | null | undefined) ?? null;
    };
    return [
        // Токен отменяется только записью целиком: путь `/token_id` не отменяется отдельно.
        {
            path: '/token_id',
            label: label ?? 'Значение',
            before: tokenText(change.previousValue),
            after: tokenText(change.currentValue),
            revertPaths: [],
        },
        ...labelled.filter(({ path }) => !/^\/value(?:\/|$)/.test(path)),
    ];
};

export const presentJournal = ({
    changes,
    tokens,
    components,
    actorLabels,
    context,
    readOnly = false,
    componentMetadata,
    palette = [],
}: JournalPresenterInput): JournalActionViewModel[] => {
    const tokensById = new Map(tokens.map((token) => [token.id, token]));
    const componentIndex = buildComponentEntityIndex(components);
    Object.entries(componentMetadata?.componentNames ?? {}).forEach(([id, name]) => componentIndex.set(id, name));
    const namesById = new Map(tokens.map((token) => [token.id, token.displayName ?? token.name]));
    Object.entries(componentMetadata?.referenceNames ?? {}).forEach(([id, name]) => namesById.set(id, name));
    changes
        .filter((change) => change.entityType === 'palette-group' || change.entityType === 'token-group')
        .forEach((change) => {
            const label = field(change, 'label');
            if (typeof label === 'string') namesById.set(change.entityId, label);
        });
    components.forEach((component) => collectReferenceNames(component.sources, namesById));
    // Ступень `palette_id` записывается ссылкой: журнал показывает её как значение, записанное строкой-ссылкой.
    palette.forEach((entry) => namesById.set(entry.id, `[${entry.type}.${entry.shade}.${entry.saturation}]`));
    const { pairs, used } = pairStructureChanges(changes);
    return changes
        .flatMap((first) => {
            // Подключение из пары показывается строкой своей сущности.
            if (used.has(first.changeId)) return [];
            const key = first.changeId;
            const tokenId = String(field(first, 'token_id', 'tokenId') ?? first.entityId);
            const tokenType = tokensById.get(tokenId)?.type ?? (field(first, 'type') as VariationType | undefined);
            const label = first.actorId ? actorLabels[first.actorId] : undefined;
            const palette = presentPaletteChange(first, namesById);
            const actorLabel = first.actorId
                ? label && label !== first.actorId
                    ? label
                    : 'Участник проекта'
                : 'Системное изменение';
            const action: JournalActionViewModel = {
                key,
                section: sectionFor(first.entityType),
                source: sourceFor(first, tokenType),
                title: palette?.title ?? titleFor(first, tokensById, componentIndex, componentMetadata),
                groupLabel: palette?.groupLabel,
                paletteSteps: palette?.paletteSteps,
                platformLabel:
                    first.entityType === 'token-value' && field(first, 'platform')
                        ? ((
                              {
                                  web: 'Web',
                                  ios: 'iOS',
                                  android: 'Android',
                              } as Record<string, string>
                          )[String(field(first, 'platform'))] ?? String(field(first, 'platform')))
                        : undefined,
                operation: first.operation,
                actorId: first.actorId,
                actorLabel,
                changedAt: first.changedAt,
                changedFields:
                    palette?.fields ??
                    propertyValueFields(
                        first,
                        presentChangedFields([first], namesById, tokenType),
                        namesById,
                        componentMetadata,
                    ),
                changes: [first],
                navigation: navigationFor(first, context, tokensById, componentIndex),
                canRevert: !context.versionId && !readOnly,
            } satisfies JournalActionViewModel;
            const link = pairs.get(first.changeId);
            if (link)
                return [pairedAction(action, first, link, componentNameFor(first, componentIndex), componentMetadata)];
            if (
                first.entityType !== 'token-value' ||
                first.operation !== 'updated' ||
                !tokenType ||
                !action.changedFields.length
            ) {
                return [action];
            }
            if (tokenValueHasStructuralChanges(first, tokenType))
                return [
                    {
                        ...action,
                        structural: true,
                    },
                ];
            if (action.changedFields.some(({ path }) => path !== '/value' && !path.startsWith('/value/')))
                return [action];
            // Параметр без своего пути отмены (например, в CSS-строке web-градиента) отменяется вместе с записью.
            return action.changedFields.map((parameter) => {
                const revertPaths = parameter.revertPaths ?? [parameter.path];
                return {
                    ...action,
                    key: `${key}:${parameter.path}`,
                    changedFields: [parameter],
                    revertPaths: revertPaths.length ? revertPaths : undefined,
                    canRevert: action.canRevert && (!revertPaths.length || first.parameterRevertSupported === true),
                };
            });
        })
        .sort((left, right) => right.changedAt.localeCompare(left.changedAt));
};
