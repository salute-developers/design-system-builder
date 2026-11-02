import axios from 'axios';

import { http } from '../../../api/http';
import { readRequest } from '../../../api/editorHttp';
import { subjectMutation } from '../../../api/subjectMutation';

const tokenMutation = <T>(context: Parameters<typeof subjectMutation>[0], operation: () => Promise<T>) =>
    subjectMutation(context, operation, undefined, ['shape', 'spacing', 'shadow'], (response) => {
        const data = (response as { data?: UpdateDto }).data;
        return data?.token && data.values?.length ? [{ tokenId: data.token.tokenId, values: data.values }] : undefined;
    });
import { tokenValueBaseRevision } from '../../../api/subjectRevisions';
import {
    SizeTokenOperationError,
    type SizeTokenCommand,
    type SizeTokenContext,
    type SizeTokenOperation,
    type SizeTokenRepository,
    type SizeTokenResult,
} from '../application/sizeTokenRepository';
import {
    requestLayer,
    type ComponentUsage,
    type DerivedRadius,
    type DimensionToken,
    type NativePlatform,
    type ShadowLayer,
    type ShadowToken,
    type SizeToken,
    type SizeTokenKind,
    type SizeTokenValue,
    type WrittenValue,
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
    canEdit: boolean;
    radii?: DimensionTokenDto[];
    spacing?: DimensionTokenDto[];
    shadows?: ShadowTokenDto[];
}

interface ErrorBody {
    error?: unknown;
    message?: string;
    code?: string;
    details?: Record<string, unknown>;
}

const PLATFORMS = ['web', 'ios', 'android'] as const;

/** Слой ответа: `colorRef` есть, только если цвет слоя — ссылка на ступень палитры. */
const layerOf = ({ offsetX, offsetY, blur, spread, color, colorRef }: ShadowLayer): ShadowLayer => ({
    offsetX,
    offsetY,
    blur,
    spread,
    color,
    ...(colorRef ? { colorRef } : {}),
});

const layersOf = (value: { layers: ShadowLayer[] } | null | undefined) =>
    value ? { layers: value.layers.map(layerOf) } : null;

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

const shadow = (dto: ShadowTokenDto): ShadowToken => {
    const platforms: ShadowToken['platforms'] = {};
    (['ios', 'android'] as const).forEach((platform) => {
        const own = layersOf(dto.platforms?.[platform]);
        if (own) platforms[platform] = own;
    });
    return {
        kind: 'shadow',
        tokenId: dto.tokenId,
        name: dto.name,
        layers: (dto.layers ?? []).map(layerOf),
        fallbackElevation: dto.fallbackElevation ?? 0,
        platforms,
        native: { ios: layersOf(dto.native?.ios), android: layersOf(dto.native?.android) },
        platformsDiffer: dto.platformsDiffer ?? false,
        components: dto.components ?? [],
    };
};

/** Токен ответа по разделу операции. */
const fromDto = (kind: SizeTokenKind, dto: TokenDto): SizeToken =>
    kind === 'shadow' ? shadow(dto as ShadowTokenDto) : dimension(kind, dto as DimensionTokenDto);

/**
 * Тело изменения по контракту: значение веба и свои значения платформ; платформа без ключа в `platforms`
 * строится из веба (`overridden: false`). Цвет слоя — ссылка на ступень палитры или HEX.
 */
const valueBody = (value: SizeTokenValue) => {
    if (value.kind === 'dimension') return { valuePx: value.valuePx, platforms: { ...value.platforms } };
    const platforms = Object.fromEntries(
        (['ios', 'android'] as const).flatMap((platform) => {
            const layers = value.platforms[platform];
            return layers ? [[platform, { layers: layers.map(requestLayer) }]] : [];
        }),
    );
    return { layers: value.layers.map(requestLayer), fallbackElevation: value.fallbackElevation, platforms };
};

/** Тело создания: слои тени — с цветом ссылкой или HEX. */
const createBody = (operation: Extract<SizeTokenOperation, { type: 'create' }>) => {
    const { request } = operation;
    if (request.kind !== 'shadow') return request;
    return {
        ...request,
        variants: request.variants.map((variant) => ({ ...variant, layers: variant.layers.map(requestLayer) })),
    };
};

const toError = (error: unknown) => {
    if (error instanceof SizeTokenOperationError) return error;
    if (!axios.isAxiosError<ErrorBody>(error)) {
        return new SizeTokenOperationError('failed', error instanceof Error ? error.message : String(error));
    }
    if (!error.response) return new SizeTokenOperationError('network', 'Сервис недоступен, изменения не сохранены');
    const { status, data: body = {} } = error.response;
    const message =
        (typeof body.message === 'string' && body.message) ||
        (typeof body.error === 'string' && body.error) ||
        `Ошибка API (${status})`;
    const code = typeof body.code === 'string' ? body.code : typeof body.error === 'string' ? body.error : null;
    // Поле недопустимого значения — в `details.field`, как у цветовых операций.
    const field = typeof body.details?.field === 'string' ? body.details.field : null;
    const kind = status === 403 ? 'forbidden' : status === 404 ? 'not-found' : status >= 500 ? 'network' : 'invalid';
    return new SizeTokenOperationError(kind, message, code, field);
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

/** Базовые редакции значений токена по платформам из последнего чтения значений темы и ответов операций. */
const baseRevisions = (context: SizeTokenContext, tokenId: string) =>
    Object.fromEntries(PLATFORMS.map((platform) => [platform, tokenValueBaseRevision(context, tokenId, platform, '')]));

interface UpdateDto {
    kind: SizeTokenKind;
    token: TokenDto;
    values?: WrittenValue[];
}

interface CreateDto {
    kind?: SizeTokenKind;
    created: TokenDto[];
}

/** Раздел команды создания по её телу. */
const createdKind = (command: SizeTokenCommand): SizeTokenKind =>
    ((command.body as { kind?: SizeTokenKind } | undefined)?.kind ?? 'radius') as SizeTokenKind;

const request = (command: SizeTokenCommand) => {
    const headers = command.idempotencyKey ? { 'Idempotency-Key': command.idempotencyKey } : undefined;
    if (command.method === 'PUT') return http.put(command.path, command.body, { headers });
    if (command.method === 'POST') return http.post(command.path, command.body, { headers });
    return http.delete(command.path, { headers, ...(command.body === undefined ? {} : { data: command.body }) });
};

/** Токены размеров `ds-service` через gateway: чтение на границе версии и операции через предметные мутации. */
export const createHttpSizeTokenRepository = (): SizeTokenRepository => ({
    load: async (context, signal) => {
        const data = await call(() => http.get<SizeTokensDto>(tokensPath(context), readRequest(context, signal)));
        return {
            canEdit: data.canEdit && !context.versionId,
            tokens: [
                ...(data.radii ?? []).map((dto) => dimension('radius', dto)),
                ...(data.spacing ?? []).map((dto) => dimension('spacing', dto)),
                ...(data.shadows ?? []).map(shadow),
            ],
        };
    },
    command: (context, operation) => {
        const id = crypto.randomUUID();
        if (operation.type === 'update')
            return {
                id,
                operation: 'update',
                method: 'PUT',
                path: tokensPath(context, `/${encodeURIComponent(operation.tokenId)}/value`),
                body: { ...valueBody(operation.value), baseRevisions: baseRevisions(context, operation.tokenId) },
                tokenId: operation.tokenId,
            };
        if (operation.type === 'create')
            return {
                id,
                operation: 'create',
                method: 'POST',
                path: tokensPath(context),
                body: createBody(operation),
                idempotencyKey: crypto.randomUUID(),
            };
        return {
            id,
            operation: 'delete',
            method: 'DELETE',
            path: tokensPath(context, `/${encodeURIComponent(operation.tokenId)}`),
            tokenId: operation.tokenId,
        };
    },
    send: async (context, command): Promise<SizeTokenResult> => {
        const data = await call(() => tokenMutation(context, () => request(command)));
        if (command.operation === 'update') {
            const { kind, token, values } = data as UpdateDto;
            return { type: 'update', token: fromDto(kind, token), values: values ?? [] };
        }
        if (command.operation === 'create') {
            const { kind, created } = data as CreateDto;
            return { type: 'create', created: created.map((dto) => fromDto(kind ?? createdKind(command), dto)) };
        }
        return { type: 'delete', deletedTokenIds: (data as { deletedTokenIds?: string[] }).deletedTokenIds ?? [] };
    },
});
