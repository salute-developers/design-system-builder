import type { ComponentConfig, Meta } from '../controllers/componentBuilder/type';
import type { ThemeSource } from '../controllers/designSystem';
import type { VariationType } from '../controllers/themeBuilder/types/token';
import type { Parameters } from '../types/other';
import type { DesignSystemDto, TenantDto } from './contracts';
import type { TokenChange } from '../utils/designSystemDraft';
import type { ThemePalette } from '../modules/palette';
import type {
    ComponentDependencyDto,
    PropertyPlatformParamDto,
    PropertyVariationDto,
} from './componentModelEnrichment';

export interface EditorContextKey {
    projectId: string;
    designSystemId: string;
    tenantId: string;
    versionId?: string;
}
export interface TokenDefinitionDto {
    id: string;
    designSystemId: string;
    name: string;
    type: VariationType;
    displayName: string | null;
    description: string | null;
    enabled: boolean;
    groupId?: string | null;
    position?: number;
    publishedIn?: string | null;
}
export interface TenantTokenValueDto {
    id: string;
    tokenId: string;
    tenantId: string;
    platform: 'web' | 'ios' | 'android' | null;
    mode: 'light' | 'dark' | null;
    paletteId?: string | null;
    paletteRef?: string | null;
    value: unknown;
    /**
     * Хранимое значение, если `value` отдан в другой форме: ссылки раскрыты в HEX или сплошное значение iOS и
     * Android градиентного токена отдано слоем `color`. Редактор работает с хранимым значением.
     */
    sourceValue?: unknown;
    /** Своё значение iOS или Android, а не построенное из web. */
    overridden?: boolean;
    editRevision: number;
}
export type TenantTokenValueInputDto = Pick<
    TenantTokenValueDto,
    'tokenId' | 'platform' | 'mode' | 'paletteId' | 'value'
> & { baseRevision: number };
export interface PaletteDto {
    id: string;
    type: 'general' | 'additional';
    shade: string;
    saturation: number;
}
export interface ComponentDto {
    id: string;
    name: string;
    description: string | null;
    platform: 'web' | 'compose' | 'xml' | 'ios';
}
export interface DesignSystemComponentDto {
    id: string;
    designSystemId: string;
    componentId: string;
}
export interface AppearanceDto {
    id: string;
    designSystemId: string;
    componentId: string;
    name: string | null;
    /** Конфигурация по умолчанию компонента. */
    isDefault?: boolean;
}
export interface ComponentPropertyDto {
    id: string;
    name: string;
    type: string;
    description: string | null;
}
export interface ComponentVariationDto {
    id: string;
    name: string;
}
export interface ComponentStyleDto {
    id: string;
    variationId: string;
    name: string;
}
export interface AppearanceVariationDto {
    id: string;
    appearanceId: string;
    variationId: string;
    defaultStyleId: string | null;
}
export interface AppearanceVariationValueDto {
    id: string;
    appearanceVariationId: string;
    styleId: string;
    position: number;
}
export interface ComponentStateDto {
    id: string;
    name: string;
}
export interface ComponentStateSetDto {
    id: string;
    stateIds: string[];
}
export interface PropertyValueDto {
    id: string;
    propertyId: string;
    appearanceId: string;
    styleId?: string;
    tokenId: string | null;
    value: string | null;
    adjustment: string | null;
    stateSetId: string;
}
export interface ComponentConfigPropertyDto {
    id?: string;
    type: string;
    default?: unknown;
    value?: unknown;
    adjustment?: unknown;
    states?: Array<{ state: string[]; value: unknown }>;
}
/** Остальные стили пересечения: `id` — ось выгрузки, `value` — имя её значения. */
export interface ComponentConfigTargetDto {
    properties: Array<{ id: string; value: unknown }>;
}
export interface ComponentConfigDto {
    invariants: Record<string, ComponentConfigPropertyDto>;
    defaults: Array<{ id: string; value: unknown }>;
    variations: Array<{
        id: string;
        name: string;
        /** ID вариации оси: есть в выгрузке для редактора (`editorIds`). */
        variationId?: string;
        values: Array<{
            name: string;
            /** ID стиля значения: есть в выгрузке для редактора. */
            styleId?: string;
            /** Есть у значения-пересечения: те же свойства под сочетанием со стилями других вариаций. */
            targets?: ComponentConfigTargetDto[];
            properties: Record<string, ComponentConfigPropertyDto>;
        }>;
    }>;
}
/** Значение оси в модели редактора конфигурации (`GET /appearances/{id}/editor-model`). */
export interface EditorAxisValueDto {
    id: string;
    styleId: string;
    /** Действующее имя: отображаемое, если задано, иначе имя стиля. */
    name: string;
    displayName: string | null;
    position: number;
    revision: number | null;
}
/** Ось конфигурации в модели редактора. */
export interface EditorAxisDto {
    id: string;
    variationId: string;
    /** Действующее имя: отображаемое, если задано, иначе имя вариации. */
    name: string;
    displayName: string | null;
    position: number;
    isColorScheme: boolean;
    locked: boolean;
    defaultStyleId: string | null;
    revision: number | null;
    values: EditorAxisValueDto[];
}
/** Значение свойства в модели редактора: `combination` — значение пересечения стилей `styleIds`. */
export interface EditorPropertyValueDto {
    id: string;
    kind: 'invariant' | 'variation' | 'combination';
    propertyId: string;
    propertyName: string;
    styleIds: string[];
    states: string[];
    tokenId: string | null;
    tokenName: string | null;
    value: string | null;
    adjustment: string | null;
}
export interface AppearanceEditorModelDto {
    appearance: AppearanceDto;
    revision: number | null;
    axes: EditorAxisDto[];
    propertyValues: EditorPropertyValueDto[];
}
export interface ComponentConfigExportDto {
    components: Array<{ componentName: string; styleName: string; config: ComponentConfigDto }>;
}
/**
 * `GET /design-systems/{ds}/components/{id}/editor-bundle?platform=`: данные одного компонента из тех же DTO,
 * что отдают списочные чтения, уже ограниченные этим компонентом.
 */
export interface ComponentEditorBundleDto {
    component: ComponentDto;
    appearances: AppearanceDto[];
    export: ComponentConfigExportDto;
    properties: ComponentPropertyDto[];
    platformParams: PropertyPlatformParamDto[];
    propertyVariations: PropertyVariationDto[];
    variations: ComponentVariationDto[];
    styles: ComponentStyleDto[];
    dependencies: ComponentDependencyDto[];
    dependencyComponents: ComponentDto[];
}
export interface ThemeEditorTokenSnapshot {
    tenant: TenantDto;
    themeData: ThemeSource;
    editRevision: number;
    incompleteTokenIds: string[];
    tokenIdsByName: Record<string, string>;
    tokenDefinitionsByName?: Record<string, TokenDefinitionDto>;
    tokenValueRevisionsByKey: Record<string, number>;
    tokenValueEntityIdsByKey?: Record<string, string>;
    /** Признак своего значения платформы по ключу `tokenValueKey`; отсутствующий ключ — `false`. */
    tokenValueOverriddenByKey?: Record<string, boolean>;
    publicationVersion: string;
    palette?: ThemePalette;
    paletteError?: Error;
}

export interface ThemeEditorSnapshot extends ThemeEditorTokenSnapshot {
    colorTokenGroups?: import('../modules/colorTokens/domain/types').TokenGroupDto[];
    hasComponents?: boolean;
    designSystem: DesignSystemDto;
    componentsData: Meta[];
    composeComponentsData?: Meta[];
    parameters: Partial<Parameters>;
}

export interface DesignSystemVersionDto {
    id: string;
    designSystemId: string;
    sequenceNumber: number;
    revision: number;
    version: string;
    changelog: string;
    publishedAt: string;
}

export interface DraftChangeDto {
    changeId: string;
    versionId: string;
    entityType: string;
    entityId: string;
    operation: 'created' | 'updated' | 'deleted';
    changedPaths: string[];
    previousValue: Record<string, unknown> | null;
    currentValue: Record<string, unknown> | null;
    actorId: string | null;
    changedAt: string;
    editRevision: number;
    parameterRevertSupported?: boolean;
}

/** Минимальный адрес данных, которые нужно обновить после отмены. */
export type DraftRefreshChange = Pick<DraftChangeDto, 'entityType' | 'entityId'>;

export interface DraftAddressTarget extends DraftRefreshChange {
    expectedRevision: number;
}

export interface DraftTokenTarget extends DraftAddressTarget {
    operation: 'created' | 'updated' | 'deleted';
}

export interface DraftTokenTargetsPage {
    draftId: string;
    scopeRevision: string;
    targets: DraftTokenTarget[];
    nextCursor: string | null;
}

export interface PendingTokenMutation {
    tokenName: string;
    previousTokenName?: string;
    change: TokenChange;
    kind: 'create' | 'update' | 'rename' | 'delete';
    definitionPatch?: Partial<Pick<TokenDefinitionDto, 'name' | 'displayName' | 'description' | 'enabled'>>;
}

export interface PendingComponentMutation {
    componentName: string;
    /** Конфигурация (`appearance`), в которую пишется правка: открытая в редакторе. */
    appearanceId?: string;
    before: ComponentConfig;
    after: ComponentConfig;
    idempotencyKeys: Record<string, string>;
    /** Тела шагов, вычисляемые по серверному состоянию, сохраняются до первой отправки. */
    requestBodies?: Record<string, { appearanceVariationId: string; styleId: string; position: number }>;
    /** Соответствия локальных идентификаторов стилей серверным, в том числе после восстановления. */
    styleAliases?: Record<string, string>;
    prepared?: boolean;
}
