import type { TokenGroupDto, TokenPlacement } from '../domain';
import type { ColorTokenContext } from './colorTokenRepository';

export interface CreateTokenGroupInput {
    kind: 'color';
    /** Группа для подгруппы; `null` — группа верхнего уровня. */
    parentId: string | null;
    label: string;
    /** Позиция среди соседей; без неё — в конец. */
    position?: number | null;
}

export interface UpdateTokenGroupInput {
    label?: string;
    /** Новая группа подгруппы. */
    parentId?: string;
    position?: number;
}

/** Определение дизайн-системы с местом в группах. */
export interface PlacedDefinition extends TokenPlacement {
    id: string;
    name: string;
    type: string;
}

/** Порт групп токенов дизайн-системы; операции сверяют и увеличивают ревизию тем. */
export interface TokenGroupRepository {
    list(context: ColorTokenContext): Promise<TokenGroupDto[]>;
    /** Определения дизайн-системы с группой, позицией и признаком публикации. */
    definitions(context: ColorTokenContext): Promise<PlacedDefinition[]>;
    create(
        context: ColorTokenContext,
        input: CreateTokenGroupInput,
        editRevision: number,
    ): Promise<{ editRevision: number; value: TokenGroupDto }>;
    update(
        context: ColorTokenContext,
        groupId: string,
        input: UpdateTokenGroupInput,
        editRevision: number,
    ): Promise<{ editRevision: number; value: TokenGroupDto }>;
    remove(context: ColorTokenContext, groupId: string, editRevision: number): Promise<{ editRevision: number }>;
}
