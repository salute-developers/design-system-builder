import type { ComponentConfig, Meta } from '../controllers/componentBuilder/type';
import type { ThemeSource } from '../controllers/designSystem';
import type { VariationType } from '../controllers/themeBuilder/types/token';
import type { Parameters } from '../types/other';
import type { DesignSystemDto, TenantDto } from './contracts';
import type { TokenChange } from '../utils/designSystemDraft';
import type { ThemePalette } from '../modules/palette';

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
export interface ComponentConfigDto {
    invariants: Record<string, ComponentConfigPropertyDto>;
    defaults: Array<{ id: string; value: unknown }>;
    variations: Array<{
        id: string;
        name: string;
        values: Array<{ name: string; properties: Record<string, ComponentConfigPropertyDto> }>;
    }>;
}
export interface ComponentConfigExportDto {
    components: Array<{ componentName: string; styleName: string; config: ComponentConfigDto }>;
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
    publicationVersion: string;
    palette?: ThemePalette;
    paletteError?: Error;
}

export interface ThemeEditorSnapshot extends ThemeEditorTokenSnapshot {
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

export interface PendingTokenMutation {
    tokenName: string;
    previousTokenName?: string;
    change: TokenChange;
    kind: 'create' | 'update' | 'rename' | 'delete';
    definitionPatch?: Partial<Pick<TokenDefinitionDto, 'name' | 'displayName' | 'description' | 'enabled'>>;
}

export interface PendingComponentMutation {
    componentName: string;
    before: ComponentConfig;
    after: ComponentConfig;
    idempotencyKeys: Record<string, string>;
}
