import { Fragment, MouseEvent, useMemo, useState } from 'react';
import styled, { CSSObject } from 'styled-components';
import { getRestoredColorFromPalette, upperFirstLetter } from '@salutejs/plasma-tokens-utils';
import { bodyXXS, outlineTransparentPrimary, textTertiary } from '@salutejs/plasma-themes/tokens/plasma_infra';
import { IconDotsHorizontalOutline, IconPlus } from '@salutejs/plasma-icons';

import { h6 } from '../../utils';
import { useForceRerender } from '../../hooks';
import { DesignSystem, Theme, ComponentAPI, ComponentVariation, Config, PropType, PropUnion } from '../../controllers';
import { SelectButton, SelectButtonItem, TextField, IconButton, Dropdown } from '../../components';

const Root = styled.div`
    min-width: 0;
    flex: 1;

    display: flex;
    flex-direction: column;
    gap: 0.25rem;
`;

const StyledPropsGroupName = styled.div`
    position: relative;

    box-sizing: border-box;
    min-height: 2rem;

    color: ${textTertiary};

    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: space-between;

    ${h6 as CSSObject};

    &:hover > div:first-child {
        display: flex;
    }
`;

const StyledPropList = styled.div`
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
`;

const StyledProp = styled.div`
    position: relative;

    display: flex;
    flex-direction: row;
    gap: 0.25rem;

    color: ${textTertiary};
    ${h6 as CSSObject};

    &:hover > div:nth-child(2) {
        display: flex;
    }
`;

const StyledPropContentRight = styled.div<{ canShow?: boolean }>`
    // TODO: Убрать, когда будут нормальные отступы
    margin-left: 0.25rem;

    position: relative;

    display: ${({ canShow }) => (canShow ? 'flex' : 'none')};
    align-items: center;
    align-self: stretch;
    gap: 0.5rem;
`;

const ListItemPreviewWrapper = styled.div`
    visibility: hidden;

    display: flex;
    align-items: center;
    gap: 0.25rem;
`;

const ListItemColorPreview = styled.div<{ color: string }>`
    background: ${({ color }) => color};
    box-shadow: 0 0 0 0.0625rem ${outlineTransparentPrimary} inset;

    min-height: 0.75rem;
    min-width: 0.75rem;
    border-radius: 50%;
`;

const ListItemTypographyPreview = styled.div`
    color: ${textTertiary};

    ${bodyXXS as CSSObject};
`;

const ListItemShapePreview = styled.div`
    color: ${textTertiary};

    ${bodyXXS as CSSObject};

    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
`;

const StyledSelectButton = styled(SelectButton)`
    top: 0;
    // TODO: Убрать, когда будут нормальные отступы
    margin-right: -0.25rem;
`;

const StyledDropdown = styled(Dropdown)`
    top: 0;
    left: calc(100% - 1rem);
`;

const StyledPropLabel = styled.div`
    width: 8.75rem;
    overflow: hidden;
    text-overflow: ellipsis;
    whitespace: nowrap;
`;

const getPropsByVariation = (api: ComponentAPI[], variations: ComponentVariation[], variationID?: string) => {
    if (!variationID) {
        return api.filter((item) => !item.variations || item.variations.length === 0);
    }

    const id = variations.find((variation) => variation.id === variationID)?.id || '';

    return api.filter((item) => item.variations?.find((item) => item === id));
};

// TODO: пока выводит все токены
const getAllowedProps = (
    config?: Config,
    api?: ComponentAPI[],
    variations?: ComponentVariation[],
    variationID?: string,
    styleID?: string,
) => {
    if (!config || !api || !variations) {
        return [];
    }

    const props = getPropsByVariation(api, variations, variationID);

    return props.filter((item) => {
        const isVariationToken = variationID && styleID;

        const props = isVariationToken
            ? config.getStyleByVariation(variationID, styleID)?.getProps()
            : config.getInvariants();
        const prop = props?.getProp(item.id);

        return !prop;
    });
};

const getPropList = (
    config: Config,
    api: ComponentAPI[],
    variations: ComponentVariation[],
    selectedVariation?: string,
    selectedStyle?: string,
) => {
    // TODO: хранить это в бд?
    const propTypeMap: Record<string, string> = {
        typography: 'Типографика',
        color: 'Цвет',
        shape: 'Форма',
        float: 'Число',
        dimension: 'Размер',
    };

    const allProps = getPropsByVariation(api, variations, selectedVariation);

    const groupingProps = (props: PropUnion[]) => {
        const result = {} as Record<PropType, PropUnion[]>;

        allProps.forEach(({ type }) => {
            if (!result[type]) {
                result[type] = [];
            }
        });

        props.forEach((item) => {
            const type = item.getType();

            if (!type) {
                return;
            }

            result[type].push(item);
        });

        return Object.entries(result).map(([key, props]) => ({
            type: propTypeMap[key],
            props,
        }));
    };

    if (selectedVariation === undefined) {
        return groupingProps(config.getInvariants().getList());
    }

    if (!selectedStyle) {
        return [];
    }

    const style = config.getStyleByVariation(selectedVariation, selectedStyle);

    if (!style) {
        return [];
    }

    return groupingProps(style.getProps().getList());
};

const getColorsTokens = (theme?: Theme) => {
    if (!theme) {
        return [];
    }

    // TODO: подумать, может есть смысл передавать для каждого типа отдельным пропсом
    const colors = theme.getTokens('color');

    const items = colors
        .filter(
            (item) =>
                item.getEnabled() &&
                item.getTags()[0] === 'dark' &&
                !item.getName().includes('hover') &&
                !item.getName().includes('active') &&
                !item.getName().includes('brightness'),
        )
        .map((item) => {
            // TODO: вероятно временное решение
            const [, ...name] = item.getName().split('.');
            const darkValue = item.getValue('web');
            const lightValue = theme.getTokenValue(['light', ...name].join('.'), 'color', 'web') || darkValue;

            return {
                label: name.join('.'),
                value: name.join('.'),
                contentRight: (
                    <ListItemPreviewWrapper>
                        <ListItemColorPreview color={getRestoredColorFromPalette(darkValue)} />
                        <ListItemColorPreview color={getRestoredColorFromPalette(lightValue)} />
                    </ListItemPreviewWrapper>
                ),
            };
        });

    return items;
};

const getShapesTokens = (theme?: Theme) => {
    if (!theme) {
        return [];
    }

    const shapes = theme.getTokens('shape') || [];

    const items = shapes
        .filter((item) => item.getEnabled() && item.getTags()[0] === 'round')
        .map((item) => ({
            label: item.getName(),
            value: item.getName(),
            contentRight: (
                <ListItemPreviewWrapper>
                    <ListItemShapePreview>{parseFloat(item.getValue('web')) * 16}</ListItemShapePreview>
                </ListItemPreviewWrapper>
            ),
        }));

    return items;
};

const getTypographyTokens = (theme?: Theme) => {
    if (!theme) {
        return [];
    }

    const typography = theme.getTokens('typography');

    const items = typography
        .filter((item) => item.getEnabled() && item.getTags()[0] === 'screen-s')
        .map((item) => {
            // TODO: вероятно временное решение
            const [, ...value] = item.getName().split('.');
            const screenS = item.getValue('web');
            const screenM = theme.getTokenValue(['screen-m', ...value].join('.'), 'typography', 'web') || screenS;
            const screenL = theme.getTokenValue(['screen-l', ...value].join('.'), 'typography', 'web') || screenS;

            return {
                label: value.join('.'),
                value: value.join('.'),
                contentRight: (
                    <ListItemPreviewWrapper>
                        <ListItemTypographyPreview>{parseFloat(screenS.fontSize) * 16}</ListItemTypographyPreview>
                        <ListItemTypographyPreview>{parseFloat(screenM.fontSize) * 16}</ListItemTypographyPreview>
                        <ListItemTypographyPreview>{parseFloat(screenL.fontSize) * 16}</ListItemTypographyPreview>
                    </ListItemPreviewWrapper>
                ),
            };
        });

    return items;
};

const renderComponentProp = (prop: PropUnion, onChange: (param: SelectButtonItem | string) => void, theme: Theme) => {
    const propType = prop.getType();
    const propValue = prop.getValue();
    const propName = upperFirstLetter(prop.getName());

    const getItems = (propType: PropType) => {
        if (propType === 'shape') {
            return getShapesTokens(theme);
        }

        if (propType === 'color') {
            return getColorsTokens(theme);
        }

        if (propType === 'typography') {
            return getTypographyTokens(theme);
        }

        return [];
    };

    if (propType === 'shape' || propType === 'color' || propType === 'typography') {
        const items = getItems(propType);
        const selectedItem = items.find((item) => item.value === propValue);

        return (
            <StyledSelectButton
                hasSearch
                autoAlign={false}
                label={<StyledPropLabel>{propName}</StyledPropLabel>}
                items={items}
                selected={selectedItem}
                onItemSelect={onChange}
            />
        );
    }

    if (propType === 'float' || propType === 'dimension') {
        return (
            <TextField
                stretched
                hasBackground
                label={<StyledPropLabel>{propName}</StyledPropLabel>}
                value={propValue as string}
                onChange={onChange}
            />
        );
    }

    return null;
};

const propMenuList = [
    {
        label: 'Корректировка',
        value: 'set_adjustment',
        disabled: true,
    },
    {
        label: 'Сбросить',
        value: 'reset_prop',
        disabled: false,
    },
    {
        label: 'Удалить',
        value: 'delete_prop',
        disabled: false,
    },
] as const;

type PropMenuItem = (typeof propMenuList)[number];

interface ComponentEditorPropertiesProps {
    config: Config;
    updated: object;
    rerender: () => void;
    designSystem: DesignSystem;
    theme: Theme;
    variationID?: string;
    styleID?: string;
}

export const ComponentEditorProperties = (props: ComponentEditorPropertiesProps) => {
    const { config, designSystem, theme, variationID, styleID, updated, rerender } = props;

    const [propTypeWithDropdown, setPropTypeWithDropdown] = useState<string | undefined>();
    const [propNameWithDropdown, setPropNameWithDropdown] = useState<string | undefined>();

    const { api, variations } = useMemo(
        () => designSystem.getComponentDataByName(config?.getName() || '').sources,
        [config, designSystem],
    );

    const propList = useMemo(
        () => getPropList(config, api, variations, variationID, styleID),
        [updated, config, variationID, styleID],
    );

    const allowedProps = useMemo(
        () =>
            getAllowedProps(config, api, variations, variationID, styleID).map((item) => ({
                label: item.name,
                value: item.id,
                type: item.type,
            })),
        [updated, config, variationID, styleID],
    );

    const onPropValueChange = (prop: PropUnion) => (param: SelectButtonItem | string) => {
        const propID = prop.getID();
        const value = typeof param === 'string' ? param : param.value;

        config.updateToken(propID, value, variationID, styleID);

        rerender();
    };

    const onPropTypeMenuSelect = (item: (typeof allowedProps)[number]) => {
        config.addToken(item.value, undefined as any, api, variationID, styleID);

        rerender();
    };

    const onPropTypeMenuOpen = (value: string) => (event: MouseEvent<HTMLDivElement>) => {
        event.stopPropagation();

        setPropTypeWithDropdown(value);
    };

    const onPropTypeMenuClose = () => {
        setPropTypeWithDropdown(undefined);
    };

    const onPropMenuSelect = (item: PropMenuItem, prop: PropUnion) => {
        const propID = prop.getID();
        const propDefaultValue = prop.getDefault();

        if (item.value === 'reset_prop' && variationID && propDefaultValue) {
            config.updateToken(propID, propDefaultValue, variationID, styleID);
        }

        if (item.value === 'delete_prop') {
            config.removeToken(propID, variationID, styleID);
        }

        rerender();
    };

    const onPropMenuOpen = (value: string) => (event: MouseEvent<HTMLDivElement>) => {
        event.stopPropagation();

        setPropNameWithDropdown(value);
    };

    const onPropMenuClose = () => {
        setPropNameWithDropdown(undefined);
    };

    return (
        <Root>
            {propList.map((item) => (
                <Fragment key={`type_${item.type}`}>
                    <StyledPropsGroupName>
                        {item.type}
                        <StyledPropContentRight>
                            <IconButton onClick={onPropTypeMenuOpen(item.type)}>
                                <IconPlus size="xs" color="inherit" />
                            </IconButton>
                        </StyledPropContentRight>
                        {propTypeWithDropdown === item.type && (
                            <StyledDropdown
                                autoAlign={false}
                                items={allowedProps}
                                onItemSelect={(value) => onPropTypeMenuSelect(value as (typeof allowedProps)[number])}
                                onClose={onPropTypeMenuClose}
                            />
                        )}
                    </StyledPropsGroupName>
                    <StyledPropList>
                        {item.props.map((prop) => (
                            <StyledProp key={`prop_${prop.getName()}`}>
                                {renderComponentProp(prop, onPropValueChange(prop), theme)}
                                <StyledPropContentRight canShow={propNameWithDropdown === prop.getName()}>
                                    <IconButton onClick={onPropMenuOpen(prop.getName())}>
                                        <IconDotsHorizontalOutline size="xs" color="inherit" />
                                    </IconButton>
                                    {propNameWithDropdown === prop.getName() && (
                                        <StyledDropdown
                                            autoAlign={false}
                                            items={propMenuList}
                                            onItemSelect={(value) => onPropMenuSelect(value as PropMenuItem, prop)}
                                            onClose={onPropMenuClose}
                                        />
                                    )}
                                </StyledPropContentRight>
                            </StyledProp>
                        ))}
                    </StyledPropList>
                </Fragment>
            ))}
        </Root>
    );
};
