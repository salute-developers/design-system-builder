import axios from 'axios';

import { http } from '../../../api/http';
import {
    SizeTokenOperationError,
    type SizeTokenContext,
    type SizeTokenRepository,
} from '../application/sizeTokenRepository';
import type {
    ComponentUsage,
    DerivedRadius,
    DimensionToken,
    NativePlatform,
    ShadowLayer,
    ShadowToken,
    SizeToken,
    SizeTokenKind,
    SizeTokenValue,
} from '../domain';

/** Радиус или отступ в ответе `ds-service`. */
interface DimensionTokenDto {
    tokenId: string;
    name: string;
    valuePx: number | null;
    fullRounding?: boolean;
    platforms?: Partial<Record<NativePlatform, number>>;
    native?: Partial<Record<NativePlatform, number | null>>;
    platformsDiffer?: boolean;
    components?: ComponentUsage[];
    derived?: DerivedRadius[];
}

interface ShadowTokenDto {
    tokenId: string;
    name: string;
    layers: ShadowLayer[];
    fallbackElevation?: number;
    platforms?: Partial<Record<NativePlatform, { layers: ShadowLayer[] }>>;
    native?: Partial<Record<NativePlatform, { layers: ShadowLayer[] } | null>>;
    platformsDiffer?: boolean;
    components?: ComponentUsage[];
}

type TokenDto = DimensionTokenDto | ShadowTokenDto;

interface SizeTokensDto {
    editRevision: number;
    canEdit: boolean;
    radii?: DimensionTokenDto[];
    spacing?: DimensionTokenDto[];
    shadows?: ShadowTokenDto[];
}

interface ErrorBody {
    error?: unknown;
    message?: string;
    code?: string;
    field?: string;
    details?: Record<string, unknown>;
    editRevision?: number;
}

const dimension = (kind: 'radius' | 'spacing', dto: DimensionTokenDto): DimensionToken => ({
    kind,
    tokenId: dto.tokenId,
    name: dto.name,
    valuePx: dto.valuePx ?? null,
    fullRounding: dto.fullRounding ?? false,
    platforms: dto.platforms ?? {},
    native: { ios: dto.native?.ios ?? null, android: dto.native?.android ?? null },
    platformsDiffer: dto.platformsDiffer ?? false,
    components: dto.components ?? [],
    derived: kind === 'radius' ? (dto.derived ?? []) : [],
});

const shadow = (dto: ShadowTokenDto): ShadowToken => ({
    kind: 'shadow',
    tokenId: dto.tokenId,
    name: dto.name,
    layers: dto.layers ?? [],
    fallbackElevation: dto.fallbackElevation ?? 0,
    platforms: dto.platforms ?? {},
    native: { ios: dto.native?.ios ?? null, android: dto.native?.android ?? null },
    platformsDiffer: dto.platformsDiffer ?? false,
    components: dto.components ?? [],
});

/** Токен ответа по разделу операции. */
const fromDto = (kind: SizeTokenKind, dto: TokenDto): SizeToken =>
    kind === 'shadow' ? shadow(dto as ShadowTokenDto) : dimension(kind, dto as DimensionTokenDto);

/** Раздел токена ответа изменения: тень узнаётся по слоям, радиус — по полю `fullRounding`. */
const kindOfDto = (dto: TokenDto, fallback?: SizeTokenKind): SizeTokenKind =>
    'layers' in dto ? 'shadow' : 'fullRounding' in dto || 'derived' in dto ? 'radius' : (fallback ?? 'spacing');

/** Тело изменения: `platforms` передаётся, только если у токена есть свои значения платформ. */
const valueBody = (value: SizeTokenValue) => {
    if (value.kind === 'dimension') {
        const platforms = Object.keys(value.platforms).length ? { platforms: value.platforms } : {};
        return { valuePx: value.valuePx, ...platforms };
    }
    const entries = (Object.keys(value.platforms) as NativePlatform[]).flatMap((platform) => {
        const layers = value.platforms[platform];
        return layers ? [[platform, { layers }] as const] : [];
    });
    return {
        layers: value.layers,
        fallbackElevation: value.fallbackElevation,
        ...(entries.length ? { platforms: Object.fromEntries(entries) } : {}),
    };
};

const toError = (error: unknown) => {
    if (!axios.isAxiosError<ErrorBody>(error) || !error.response) {
        return new SizeTokenOperationError('network', 'Сервис недоступен, изменения не сохранены');
    }
    const { status, data: body = {} } = error.response;
    const message =
        (typeof body.message === 'string' && body.message) ||
        (typeof body.error === 'string' && body.error) ||
        `Ошибка API (${status})`;
    const code = typeof body.code === 'string' ? body.code : typeof body.error === 'string' ? body.error : null;
    // Поле недопустимого значения: в `details`, как адрес у цветового значения, или на верхнем уровне тела.
    const field =
        typeof body.details?.field === 'string'
            ? body.details.field
            : typeof body.field === 'string'
              ? body.field
              : null;
    const kind =
        status === 409 && code === 'TENANT_EDIT_CONFLICT'
            ? 'conflict'
            : status === 403
              ? 'forbidden'
              : status === 404
                ? 'not-found'
                : status >= 500
                  ? 'network'
                  : 'invalid';
    const revision = typeof body.editRevision === 'number' ? body.editRevision : null;
    return new SizeTokenOperationError(kind, message, code, field, revision);
};

const call = async <T>(operation: () => Promise<{ data: T }>): Promise<T> => {
    try {
        return (await operation()).data;
    } catch (error) {
        throw toError(error);
    }
};

const tokensPath = ({ projectId, tenantId }: SizeTokenContext, suffix = '') =>
    `/api/projects/${projectId}/ds/tenants/${tenantId}/size-tokens${suffix}`;

/** Токены размеров `ds-service` через gateway. */
export const createHttpSizeTokenRepository = (): SizeTokenRepository => ({
    load: async (context) => {
        const data = await call(() => http.get<SizeTokensDto>(tokensPath(context)));
        return {
            editRevision: data.editRevision,
            canEdit: data.canEdit,
            tokens: [
                ...(data.radii ?? []).map((dto) => dimension('radius', dto)),
                ...(data.spacing ?? []).map((dto) => dimension('spacing', dto)),
                ...(data.shadows ?? []).map(shadow),
            ],
        };
    },
    updateValue: async (context, tokenId, value, editRevision) => {
        const data = await call(() =>
            http.put<{ editRevision: number; token: TokenDto; values?: unknown[] }>(
                tokensPath(context, `/${encodeURIComponent(tokenId)}/value`),
                { editRevision, ...valueBody(value) },
            ),
        );
        const kind = kindOfDto(data.token, value.kind === 'shadow' ? 'shadow' : undefined);
        return {
            editRevision: data.editRevision,
            token: fromDto(kind, data.token),
            values: (data.values ?? []) as never,
        };
    },
    create: async (context, request, editRevision) => {
        const data = await call(() =>
            http.post<{ editRevision: number; kind?: SizeTokenKind; created: TokenDto[] }>(tokensPath(context), {
                editRevision,
                ...request,
            }),
        );
        const kind = data.kind ?? request.kind;
        return { editRevision: data.editRevision, created: data.created.map((dto) => fromDto(kind, dto)) };
    },
    delete: (context, tokenId, editRevision) =>
        call(() =>
            http.delete<{ editRevision: number; deletedTokenIds: string[] }>(
                tokensPath(context, `/${encodeURIComponent(tokenId)}`),
                { data: { editRevision } },
            ),
        ),
});
