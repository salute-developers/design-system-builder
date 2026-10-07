import { useState } from 'react';

import {
    defaultGroupForToken,
    parsePaletteReference,
    resolvePaletteTokenGroup,
    type ThemePalette,
} from '../../modules/palette';
import { valueInGroup } from './Palette.utils';

const DEFAULT = '__default__';

interface TokenGroupSelectProps {
    palette: ThemePalette;
    tokenName: string;
    /** Текущее значение токена — для сравнения цвета в текущей и новой группе. */
    value: unknown;
    disabled?: boolean;
    onAssign: (tokenId: string, groupId: string | null) => Promise<unknown>;
}

/**
 * Выбор группы палитры для цветового токена. До подтверждения показывает цвет токена в текущей и в
 * новой группе; «По умолчанию» снимает явную привязку.
 */
export const TokenGroupSelect = ({ palette, tokenName, value, disabled, onAssign }: TokenGroupSelectProps) => {
    const assignment = resolvePaletteTokenGroup(palette, tokenName);
    const [pending, setPending] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    if (!assignment) return null;

    const reference = parsePaletteReference(value);
    const defaultGroup = palette.groups.find((group) => group.systemKey === defaultGroupForToken(tokenName));
    const current = assignment.assignment === 'explicit' ? assignment.groupId : DEFAULT;
    const targetGroupId = pending === DEFAULT ? defaultGroup?.id : pending;
    const currentColor = reference ? valueInGroup(palette, assignment.groupId, reference) : undefined;
    const nextColor = reference && targetGroupId ? valueInGroup(palette, targetGroupId, reference) : undefined;

    const confirm = async () => {
        if (pending === null || saving) return;
        setSaving(true);
        try {
            await onAssign(assignment.tokenId, pending === DEFAULT ? null : pending);
            setPending(null);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="source-palette-token-group">
            <select
                aria-label={`Группа палитры токена ${tokenName}`}
                value={pending ?? current}
                disabled={disabled}
                onChange={(event) => setPending(event.target.value === current ? null : event.target.value)}
            >
                <option value={DEFAULT}>По умолчанию · {defaultGroup?.label}</option>
                {palette.groups.map((group) => (
                    <option key={group.id} value={group.id}>
                        {group.label}
                    </option>
                ))}
            </select>
            {assignment.assignment === 'default' && pending === null && (
                <small className="source-palette-token-group-default">Группа по умолчанию</small>
            )}
            {pending !== null && (
                <div className="source-palette-token-group-compare" role="status">
                    <i style={{ background: currentColor ?? 'transparent' }} title="Сейчас" />
                    <b>→</b>
                    <i style={{ background: nextColor ?? 'transparent' }} title="Станет" />
                    <button type="button" disabled={saving} onClick={confirm}>
                        Применить
                    </button>
                    <button type="button" onClick={() => setPending(null)}>
                        Отмена
                    </button>
                </div>
            )}
        </div>
    );
};
