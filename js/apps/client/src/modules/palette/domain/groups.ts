import type { SystemGroupKey } from './types';

export interface SystemGroupDefinition {
    key: SystemGroupKey;
    label: string;
    helper: string;
}

/** Системные группы в порядке отображения; подписи и пояснения — из прототипа. */
export const SYSTEM_GROUPS: readonly SystemGroupDefinition[] = [
    { key: 'neutral', label: 'Neutral', helper: 'Текст, поверхности, контуры и фоны.' },
    { key: 'accent', label: 'Accent', helper: 'Акцентные действия и бренд.' },
    { key: 'status', label: 'Статус', helper: 'Успех, предупреждения, ошибки и информация.' },
    { key: 'data', label: 'Data', helper: 'Цвета данных и визуализаций.' },
    { key: 'syntax', label: 'Syntax', helper: 'Подсветка кода.' },
];

const MODE_PREFIX = /^(light|dark)\./;

/**
 * Группа токена по умолчанию — для токенов без явной привязки. Никогда не выбирает
 * пользовательскую группу.
 */
export const defaultGroupForToken = (tokenName: string): SystemGroupKey => {
    const name = tokenName.replace(MODE_PREFIX, '');
    if (name.startsWith('data.')) return 'data';
    const last = name.split('.').pop() ?? '';
    if (/accent|promo/.test(last)) return 'accent';
    if (/positive|negative|warning|info/.test(last)) return 'status';
    return 'neutral';
};

export const stripModePrefix = (tokenName: string) => tokenName.replace(MODE_PREFIX, '');

export const modeOfTokenName = (tokenName: string) => MODE_PREFIX.exec(tokenName)?.[1] ?? null;

/** Префикс id токена, который есть только в черновике темы и ещё не сохранён на сервере. */
export const DRAFT_TOKEN_ID_PREFIX = 'draft:';

export const isDraftTokenId = (tokenId: string) => tokenId.startsWith(DRAFT_TOKEN_ID_PREFIX);
