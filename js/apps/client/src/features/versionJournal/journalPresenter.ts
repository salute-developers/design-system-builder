import type { Meta } from '../../controllers/componentBuilder/type';
import type { VariationType } from '../../controllers/themeBuilder/types/token';
import type { DraftChangeDto, EditorContextKey, PaletteDto, TokenDefinitionDto } from '../../api/editorContracts';
import { presentChangedFields, tokenValueHasStructuralChanges, type JournalChangedField } from './journalFields';
import { presentPaletteChange, type JournalPaletteStep } from './paletteJournalPresentation';
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
        label: 'Размеры и радиусы',
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
    componentMetadata?: { componentNames: Record<string, string>; referenceNames: Record<string, string> };
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
const titleFor = (
    change: DraftChangeDto,
    tokensById: Map<string, TokenDefinitionDto>,
    componentIndex: Map<string, string>,
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
        return `${prefix} компонента «${componentNameFor(change, componentIndex) ?? 'Компонент'}»`;
    }
    return `${prefix} настройки дизайн-системы`;
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
    return changes
        .flatMap((first) => {
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
                title: palette?.title ?? titleFor(first, tokensById, componentIndex),
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
                changedFields: palette?.fields ?? presentChangedFields([first], namesById, tokenType),
                changes: [first],
                navigation: navigationFor(first, context, tokensById, componentIndex),
                canRevert: !context.versionId && !readOnly,
            } satisfies JournalActionViewModel;
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
