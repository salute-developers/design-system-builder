import { useEffect, useMemo, useRef, useState } from 'react';
import { IconSearch } from '@salutejs/plasma-icons';

import { TextField, Tooltip } from '../../../../components';
import { resolvePaletteTokenGroup, resolveStepInGroup, type ThemePalette } from '../../../../modules/palette';
import {
    Root,
    SelectColorLabel,
    StyledColorItem,
    StyledColorPreview,
    StyledColorSelector,
    StyledColorsWrapper,
    StyledGroupLabel,
    StyledTools,
} from './PaletteColorSelector.styles';

interface ThemePaletteSelectorProps {
    palette: ThemePalette;
    color: string;
    tokenName?: string;
    onChange?: (color: string) => void;
    onClose?: () => void;
}

/** Вкладка Library: растяжки палитры темы по группам со значениями для группы токена. */
export const ThemePaletteSelector = ({ palette, color, tokenName, onChange, onClose }: ThemePaletteSelectorProps) => {
    const [searchValue, setSearchValue] = useState('');
    const activeColorRef = useRef<HTMLDivElement | null>(null);
    const selected = color.replace(/^\[|\]$/g, '').split('][')[0];

    const groups = useMemo(() => {
        const query = searchValue.trim().toLowerCase();
        return palette.groups
            .map((group) => ({
                ...group,
                ramps: group.ramps
                    .map((ramp) => ({
                        ...ramp,
                        steps: ramp.steps.filter((step) => {
                            if (!query) return true;
                            const haystack = [group.label, ramp.displayName, ramp.slot.shade, String(step.step), step.value]
                                .join(' ')
                                .toLowerCase();
                            return haystack.includes(query);
                        }),
                    }))
                    .filter((ramp) => ramp.steps.length),
            }))
            .filter((group) => group.ramps.length);
    }, [palette, searchValue]);

    useEffect(() => {
        activeColorRef.current?.scrollIntoView({ block: 'center' });
    }, [selected]);

    const hasRamps = palette.groups.some((group) => group.ramps.length);
    const tokenGroupId = tokenName ? resolvePaletteTokenGroup(palette, tokenName)?.groupId : undefined;

    return (
        <Root>
            <StyledTools>
                <TextField
                    stretched
                    placeholder="Найти"
                    value={searchValue}
                    contentLeft={<IconSearch size="xs" color="inherit" />}
                    onChange={setSearchValue}
                />
            </StyledTools>
            <StyledColorSelector>
                {!hasRamps && <SelectColorLabel>В Palette пока нет доступных палитр.</SelectColorLabel>}
                {groups.map((group) => (
                    <StyledColorItem key={group.id}>
                        <StyledGroupLabel>{group.label}</StyledGroupLabel>
                        {group.ramps.map((ramp) => (
                            <StyledColorItem key={`${group.id}-${ramp.slot.type}.${ramp.slot.shade}`}>
                                <SelectColorLabel>{ramp.displayName}</SelectColorLabel>
                                <StyledColorsWrapper>
                                    {ramp.steps.map((step) => {
                                        const value = `${ramp.slot.type}.${ramp.slot.shade}.${step.step}`;
                                        const isActive = value === selected;
                                        // Цвет, который получит именно этот токен: значение слота в его группе.
                                        const background =
                                            (tokenGroupId &&
                                                resolveStepInGroup(palette, tokenGroupId, {
                                                    ...ramp.slot,
                                                    step: step.step,
                                                })) ||
                                            step.value;
                                        return (
                                            <StyledColorPreview
                                                key={value}
                                                ref={isActive ? activeColorRef : undefined}
                                                selected={isActive}
                                                style={{ background }}
                                                onClick={() => {
                                                    onChange?.(value);
                                                    onClose?.();
                                                }}
                                            >
                                                <Tooltip
                                                    offset={[0.25, 0]}
                                                    placement="bottom"
                                                    text={`${ramp.displayName} ${step.step}`}
                                                />
                                            </StyledColorPreview>
                                        );
                                    })}
                                </StyledColorsWrapper>
                            </StyledColorItem>
                        ))}
                    </StyledColorItem>
                ))}
            </StyledColorSelector>
        </Root>
    );
};
