import { useEffect, useState } from 'react';
import { useOutletContext, useParams } from 'react-router-dom';

import '../../styles/palette.css';

import { PaletteOperationError } from '../../modules/palette';
import { paletteRepository } from '../../palette/paletteSession';
import type { PaletteOutletContext } from './Palette';
import { errorText, paletteRevision } from './usePaletteEditor';
import { TokenGroupSelect } from './TokenGroupSelect';

const isConflict = (error: unknown) => error instanceof PaletteOperationError && error.code === 'TENANT_EDIT_CONFLICT';

const CONFLICT_NOTICE = 'Тема изменена в другом месте и перезагружена. Черновик токенов сохранён.';
/** Конфликт, после которого перечитана тема: поле размонтируется, сообщение показывает новое поле. */
let conflictAfterReload = false;

/** Поле «Группа палитры» в редакторе цветового токена. */
export const TokenPaletteGroupField = ({ tokenName, value }: { tokenName?: string; value: unknown }) => {
    const { projectId, designSystemId, tenantId } = useParams();
    const outlet = useOutletContext<Partial<PaletteOutletContext> | undefined>();
    const [error, setError] = useState<string | null>(null);
    useEffect(() => {
        if (!conflictAfterReload) return;
        conflictAfterReload = false;
        setError(CONFLICT_NOTICE);
    }, []);
    const palette = outlet?.palette;
    if (!palette || !tokenName || !projectId || !designSystemId || !tenantId || !outlet?.setPalette) return null;
    const context = { projectId, designSystemId, tenantId };
    const canEdit = palette.canEdit && outlet.designSystem?.getParameters()?.readOnly !== true;

    const assign = async (tokenId: string, groupId: string | null) => {
        try {
            const result = await paletteRepository.assignTokenGroup(
                context,
                tokenId,
                groupId,
                paletteRevision(palette, outlet.designSystem),
            );
            const parameters = outlet.designSystem?.getParameters();
            if (paletteRepository.source === 'api' && parameters) parameters.editRevision = result.editRevision;
            outlet.setPalette!(await paletteRepository.load(context));
            outlet.rerender?.();
            setError(null);
        } catch (failure) {
            // В режиме api ревизия общая с токенами темы: после конфликта перечитывается вся тема.
            if (isConflict(failure) && paletteRepository.source === 'api' && outlet.reload) {
                conflictAfterReload = true;
                outlet.reload();
                return;
            }
            setError(errorText(failure));
            outlet.setPalette!(await paletteRepository.load(context).catch(() => palette));
        }
    };

    return (
        <div className="source-palette-token-group-field" data-testid="token-palette-group">
            <span>Группа палитры</span>
            <TokenGroupSelect palette={palette} tokenName={tokenName} value={value} disabled={!canEdit} onAssign={assign} />
            {error && (
                <span className="source-palette-hex-error" role="alert">
                    {error}
                </span>
            )}
        </div>
    );
};
