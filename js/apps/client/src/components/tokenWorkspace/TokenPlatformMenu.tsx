import { useEffect, useState } from 'react';

import { TyGlyph } from '../TyGlyph';
import { WorkbenchMenu } from '../../pages/components/ui/WorkbenchMenu';

export type TokenPlatform = 'web' | 'ios' | 'android';

const PLATFORMS: ReadonlyArray<{ id: TokenPlatform; label: string; glyph: 'web' | 'ios' | 'compose' }> = [
    { id: 'web', label: 'Web', glyph: 'web' },
    { id: 'ios', label: 'iOS', glyph: 'ios' },
    { id: 'android', label: 'Android', glyph: 'compose' },
];

const STORAGE_KEY = 'dsb.tokens.platform';

const readPlatform = (): TokenPlatform => {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        return PLATFORMS.some(({ id }) => id === stored) ? (stored as TokenPlatform) : 'web';
    } catch {
        return 'web';
    }
};

/**
 * Платформа редактора токенов: одна на «Цвета», «Размеры» и «Типографику», как в редакторе компонентов, и
 * сохраняется при переходе между ними и после перезагрузки.
 */
export const useTokenPlatform = () => {
    const [platform, setPlatform] = useState<TokenPlatform>(readPlatform);
    useEffect(() => {
        try {
            localStorage.setItem(STORAGE_KEY, platform);
        } catch {
            // Выбор платформы — удобство: без хранилища он не запоминается.
        }
    }, [platform]);
    return [platform, setPlatform] as const;
};

export const tokenPlatformLabel = (platform: TokenPlatform) =>
    PLATFORMS.find(({ id }) => id === platform)?.label ?? platform;

/** Переключатель платформы в шапке панели «Предпросмотр», как меню платформы редактора компонентов. */
export const TokenPlatformMenu = ({
    platform,
    onSelect,
}: {
    platform: TokenPlatform;
    onSelect: (platform: TokenPlatform) => void;
}) => {
    const current = PLATFORMS.find(({ id }) => id === platform) ?? PLATFORMS[0];
    return (
        <WorkbenchMenu
            className="token-platform-menu"
            label={`Платформа: ${current.label}`}
            title="Платформа"
            trigger={<TyGlyph name={current.glyph} />}
            items={PLATFORMS.map((item) => ({
                key: item.id,
                label: item.label,
                icon: <TyGlyph name={item.glyph} />,
                checked: item.id === platform,
                onSelect: () => onSelect(item.id),
            }))}
        />
    );
};
