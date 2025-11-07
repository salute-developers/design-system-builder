import { useLayoutEffect, useState } from 'react';
import styled from 'styled-components';
import { TabItem, Tabs, TextXS } from '@salutejs/plasma-b2c';
import { IconAddOutline, IconTrash } from '@salutejs/plasma-icons';
import { backgroundSecondary } from '@salutejs/plasma-themes/tokens/plasma_infra';

import { type Config, type Theme, type DesignSystem } from '../controllers';
import { ComponentControl } from './ComponentControl';

const StyledRoot = styled.div`
    width: 55%;
    border-radius: 0.5rem;
    padding: 0rem 1rem;
    background: ${backgroundSecondary};
    // border: solid 1px #313131;
`;

const StyledCaption = styled(TextXS)`
    margin-top: 1rem;
`;

const StyledRemoveStyle = styled.div`
    margin-left: 2rem;
`;

const StyledAddStyleTabItem = styled(TabItem)`
    width: 50%;
`;

const StyledTokens = styled.div`
    height: calc(100% - 11rem);
    padding: 0.5rem 0;
    overflow-x: hidden;
    overflow-y: scroll;
`;

const StyledTabsStyle = styled(Tabs)`
    width: 100%;
`;

const getVariations = (config: Config) => {
    const variations = config.getVariations().map((item) => {
        const propValues = (item.getStyles() || []).map((style) => ({
            label: style.getName(),
            value: style.getID(),
        }));

        return {
            label: item.getName(),
            value: item.getID(),
            inner: propValues,
        };
    });
    variations.push({
        label: 'общее',
        value: 'invariants',
        inner: [],
    });
    variations.push({
        label: 'по умолчанию',
        value: 'defaults',
        inner: [],
    });

    return variations;
};

const getTokenList = (config: Config, selectedVariation?: string, selectedStyle?: string) => {
    if (selectedVariation === undefined) {
        return config.getInvariants().getList();
    }

    if (!selectedStyle || selectedVariation === 'defaults') {
        return [];
    }

    const style = config.getStyleByVariation(selectedVariation, selectedStyle);

    if (!style) {
        return [];
    }

    return style.getProps().getList();
};

const getDefaults = (config: Config, args: Record<string, string | boolean>) => {
    const entries = Object.entries(args as Record<string, string>);

    if (entries.length === 0) {
        return { variationID: undefined, styleID: undefined };
    }

    const [variation, value] = entries[0];

    const variationID = config
        .getVariations()
        .find((item) => item.getName() === variation)
        ?.getID();

    return { variationID, styleID: value };
};

const getDefaultList = (config: Config, updateConfig: () => void) => {
    return config.getDefaults().map((item) => {
        const name = item.getVariation();
        const variationID = item.getVariationID();
        const value = item.getStyleID();

        const list = config
            .getVariation(variationID)
            ?.getStyles()
            ?.map((style) => ({
                label: style.getName(),
                value: style.getID(),
            }));

        const onChange = (_name: string, value: unknown) => {
            config.updateDefaults(variationID, value as string);

            updateConfig();
        };

        return {
            name,
            value,
            list,
            onChange,
        };
    });
};

interface ComponentTokensProps {
    args: Record<string, string | boolean>;
    designSystem: DesignSystem;
    config: Config;
    theme: Theme;
    updateConfig: () => void;
    setAddStyleModal: (value: { open: boolean; variationID?: string }) => void;
    onChangeComponentControlValue: (name?: string, value?: unknown) => void;
}

export const ComponentTokens = (props: ComponentTokensProps) => {
    const { args, config, designSystem, theme, updateConfig, setAddStyleModal, onChangeComponentControlValue } = props;
    const { variationID, styleID } = getDefaults(config, args);
    // console.warn(variationID, styleID, 'ids');
    const [selectedVariation, setSelectedVariation] = useState<undefined | string>(variationID);
    const [selectedStyle, setSelectedStyle] = useState<undefined | string>(styleID);

    const [newToken, setNewToken] = useState<string>('');

    useLayoutEffect(() => {
        setSelectedVariation(variationID);
        setSelectedStyle(styleID);
    }, [variationID, styleID]);

    const onChangeVariation = (value: string) => {
        setNewToken('');

        if (value === 'defaults') {
            setSelectedVariation(value);
            return;
        }

        if (value === 'invariants') {
            setSelectedVariation(undefined);
            return;
        }

        const variation = config.getVariation(value)?.getName();
        const style = config.getStyleByVariation(value)?.getID();

        setSelectedVariation(value);
        setSelectedStyle(style);

        onChangeComponentControlValue(variation, style);
    };

    const onChangeStyle = (value: string) => {
        setNewToken('');
        setSelectedStyle(value);

        const variation = config.getVariation(selectedVariation)?.getName();
        onChangeComponentControlValue(variation, value);
    };

    const onRemoveStyle = (value: string, event: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
        event.stopPropagation();

        if (value === selectedStyle) {
            const variation = config.getVariation(selectedVariation)?.getName();
            onChangeComponentControlValue(variation, '');
        }

        config.removeVariationStyle(selectedVariation, value);
        updateConfig();
    };

    const onAddStyle = () => {
        setAddStyleModal({
            open: true,
            variationID: selectedVariation,
        });
    };

    const variations = getVariations(config);
    const styles = variations.find((item) => item.value === selectedVariation)?.inner;
    const tokenList = getTokenList(config, selectedVariation, selectedStyle);
    const defaultList = getDefaultList(config, updateConfig);

    return (
        <StyledRoot>
            <StyledCaption>Вариации</StyledCaption>
            <Tabs view="divider" size="m" stretch>
                {variations.map(({ label, value }) => (
                    <TabItem
                        view="divider"
                        key={`item:${label}`}
                        size="m"
                        selected={
                            value === selectedVariation || (selectedVariation === undefined && value === 'invariants')
                        }
                        onClick={() => onChangeVariation(value)}
                    >
                        {label}
                    </TabItem>
                ))}
            </Tabs>
            {Boolean(styles?.length) && (
                <>
                    <StyledCaption>Стили</StyledCaption>
                    <StyledTabsStyle view="divider" size="m">
                        {styles?.map(({ label, value }) => (
                            <TabItem
                                view="divider"
                                key={`item_inner:${label}`}
                                size="s"
                                selected={value === selectedStyle}
                                contentRight={
                                    <StyledRemoveStyle onClick={(event) => onRemoveStyle(value, event)}>
                                        <IconTrash />
                                    </StyledRemoveStyle>
                                }
                                onClick={() => onChangeStyle(value)}
                            >
                                {label}
                            </TabItem>
                        ))}
                        <StyledAddStyleTabItem view="divider" size="s" onClick={onAddStyle}>
                            <IconAddOutline />
                        </StyledAddStyleTabItem>
                    </StyledTabsStyle>
                </>
            )}
            <StyledTokens>
                {selectedVariation === 'defaults' ? (
                    defaultList.map(({ list, name, value, onChange }) => (
                        <ComponentControl
                            key={`defaults:${name}`}
                            name={name}
                            items={list}
                            value={value}
                            onChangeValue={onChange}
                        />
                    ))
                ) : (
                    <></>
                )}
            </StyledTokens>
        </StyledRoot>
    );
};
