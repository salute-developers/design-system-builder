import { useState, useEffect, MouseEvent } from 'react';
import { getRestoredColorFromPalette } from '@salutejs/plasma-tokens-utils';

import { DesignSystem, ColorToken, GradientToken, Theme } from '../../../../controllers';
import {
    getColorAndOpacity,
    isDraftAddedToken,
    isValidColorValue,
    kebabToCamel,
    updateDraftToken,
} from '../../../../utils';
import { SubgroupNode, TokenNode } from '../../../../types';
import { SelectButtonItem } from '../../../../components';
import { colorTokenActions, gradientTokenActions } from '../../../../actions';
import { TokenColorPreview } from '../TokenColorPreview';
import { ColorPicker } from '../../../../features';

import { Root, StyledSetup } from './TokenColorEditor.styles';
import {
    captureLinkedSnapshot,
    getExpectedValue,
    isContextSubgroup,
    isSubgroupLinked,
    propagateFromDefault,
    typeList,
} from './TokenColorEditor.utils';
import { ContextSection, DeleteTokenDialog, ModesSection, TokenHeader } from './ui';

interface TokenColorEditorProps {
    designSystem: DesignSystem;
    theme: Theme;
    tokenNode?: TokenNode;
    rerender: () => void;
}

export const TokenColorEditor = (props: TokenColorEditorProps) => {
    const { designSystem, theme, tokenNode, rerender } = props;

    const [type, setType] = useState<SelectButtonItem>(typeList[0]);
    const [currentColor, setColor] = useState<string>('#FFFFFF');
    const [currentOpacity, setOpacity] = useState<number>(1);
    const [opened, setOpened] = useState(false);
    const [colorPickerAnchor, setColorPickerAnchor] = useState<HTMLElement | undefined>(undefined);
    const [deleteTokenAnchor, setDeleteTokenAnchor] = useState<HTMLElement | undefined>(undefined);
    const [pickerInitialType, setPickerInitialType] = useState<'custom' | 'library'>('custom');
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [activeToken, setActiveToken] = useState<ColorToken | GradientToken | undefined>(undefined);
    const [colorValueStatus, setColorValueStatus] = useState<'default' | 'negative'>('default');

    const subgroupNodes = tokenNode?.data ?? [];
    const defaultSubgroupNode = subgroupNodes.find((node) => node.subgroup === 'default') ?? subgroupNodes[0];
    const defaultToken = defaultSubgroupNode?.data[0]?.data.item;
    const [description, setDescription] = useState<string | undefined>(defaultToken?.getDescription());

    const token = activeToken ?? defaultToken;
    const dsName = designSystem.getName() || '';
    const dsVersion = designSystem.getVersion() || '';

    const groupCamel = defaultToken ? kebabToCamel(defaultToken.getTags()[1]) : '';

    const defaultDisplayName = defaultToken?.getDisplayName() ?? '';
    const defaultTokenSuffix = defaultDisplayName.startsWith(groupCamel)
        ? defaultDisplayName.slice(groupCamel.length)
        : defaultDisplayName;

    const modeNodes = subgroupNodes.filter((node) => !isContextSubgroup(node.subgroup));
    const contextNodes = subgroupNodes.filter((node) => isContextSubgroup(node.subgroup));

    const canEditName = Boolean(defaultToken && isDraftAddedToken(defaultToken.getName()));

    const onSubgroupRelink = (node: SubgroupNode) => {
        node.data.forEach(({ mode, data: { item } }) => {
            const expected = getExpectedValue(subgroupNodes, node.subgroup, mode);
            if (!expected) {
                return;
            }

            if (item instanceof ColorToken) {
                colorTokenActions.updateToken({
                    color: expected.value,
                    opacity: expected.opacity,
                    token: item,
                    theme,
                    designSystem,
                });
            }

            if (item instanceof GradientToken) {
                gradientTokenActions.updateToken({
                    gradient: expected.value.split(', '),
                    token: item,
                    theme,
                    designSystem,
                });
            }
        });
        rerender();
    };

    const onInputValueChange = () => {
        setColorValueStatus('default');
    };

    const onPaletteUnlink = (item: ColorToken | GradientToken) => () => {
        if (!(item instanceof ColorToken)) {
            return;
        }

        const rawValue = item.getValue('web') as string;
        if (!rawValue.startsWith('[')) {
            return;
        }

        const [, leafOpacity] = getColorAndOpacity(rawValue);
        const hex = getRestoredColorFromPalette(`[${rawValue.slice(1).split(']')[0]}]`, -1) ?? rawValue;

        const wasLinkedBefore = captureLinkedSnapshot(subgroupNodes);

        colorTokenActions.updateToken({
            color: hex,
            opacity: leafOpacity,
            token: item,
            theme,
            designSystem,
        });

        propagateFromDefault(subgroupNodes, item.getTags(), wasLinkedBefore, (linkedToken) => {
            if (!(linkedToken instanceof ColorToken)) {
                return;
            }

            colorTokenActions.updateToken({
                color: hex,
                opacity: leafOpacity,
                token: linkedToken,
                theme,
                designSystem,
            });
        });

        setColorValueStatus('default');
        rerender();
    };

    const onInputValueBlur =
        (targetToken: ColorToken | GradientToken) => (event: React.FocusEvent<HTMLInputElement>) => {
            const value = event.target.value;

            if (targetToken instanceof GradientToken || targetToken.getValue('web').startsWith('[')) {
                return;
            }

            if (!value.startsWith('#')) {
                return;
            }

            if (isValidColorValue(value, ['hex'])) {
                onColorChange(targetToken)(value);
                return;
            }

            setColorValueStatus('negative');
        };

    const onColorChange = (targetToken: ColorToken | GradientToken) => (newValue: string | string[]) => {
        const wasLinkedBefore = captureLinkedSnapshot(subgroupNodes);

        const applyValue = (token: ColorToken | GradientToken) => {
            if (token instanceof ColorToken && typeof newValue === 'string') {
                colorTokenActions.updateToken({
                    color: newValue,
                    opacity: currentOpacity,
                    token,
                    theme,
                    designSystem,
                });
            }

            if (token instanceof GradientToken) {
                const gradientValue = Array.isArray(newValue) ? newValue : [newValue];

                gradientTokenActions.updateToken({
                    gradient: gradientValue,
                    token,
                    theme,
                    designSystem,
                });
            }
        };

        if (targetToken instanceof ColorToken) {
            setColor(newValue as string);
        }

        if (targetToken instanceof GradientToken) {
            const gradientValue = Array.isArray(newValue) ? newValue : [newValue];
            setColor(gradientValue.join(', '));
        }

        applyValue(targetToken);

        propagateFromDefault(subgroupNodes, targetToken.getTags(), wasLinkedBefore, applyValue);

        rerender();
    };

    const onOpacityChange = (targetToken: ColorToken | GradientToken | undefined) => (newOpacity: number) => {
        if (targetToken === token) {
            setOpacity(newOpacity);
        }

        if (!(targetToken instanceof ColorToken)) {
            rerender();
            return;
        }

        const wasLinkedBefore = captureLinkedSnapshot(subgroupNodes);

        const applyOpacity = (colorToken: ColorToken) => {
            const [colorValue] = getColorAndOpacity(colorToken.getValue('web') as string);

            colorTokenActions.updateToken({
                color: colorValue,
                opacity: newOpacity,
                token: colorToken,
                theme,
                designSystem,
            });
        };

        applyOpacity(targetToken);

        propagateFromDefault(subgroupNodes, targetToken.getTags(), wasLinkedBefore, (linkedToken) => {
            if (linkedToken instanceof ColorToken) {
                applyOpacity(linkedToken);
            }
        });

        rerender();
    };

    const onDisplayNameSuffixCommit = (newSuffix: string) => {
        if (!defaultToken || !newSuffix || newSuffix === defaultTokenSuffix) {
            return;
        }

        const normalizedSuffix = newSuffix.charAt(0).toUpperCase() + newSuffix.slice(1);
        const newDisplayName = `${groupCamel}${normalizedSuffix}`;

        if (newDisplayName === defaultDisplayName) {
            return;
        }

        if (defaultToken instanceof ColorToken) {
            colorTokenActions.renameTokenGroup({
                defaultToken,
                newDisplayName,
                theme,
                designSystem,
            });
        }

        if (defaultToken instanceof GradientToken) {
            gradientTokenActions.renameTokenGroup({
                defaultToken,
                newDisplayName,
                theme,
                designSystem,
            });
        }

        rerender();
    };

    const onDescriptionChange = (newDescription: string) => {
        if (!defaultToken) {
            return;
        }

        setDescription(newDescription);

        // TODO: Перенести в экшены?
        defaultToken.setDescription(newDescription);
        updateDraftToken(dsName, dsVersion, defaultToken, 'save');

        rerender();
    };

    const onTokenReset = () => {
        if (defaultToken instanceof ColorToken) {
            const { color, opacity, description } = colorTokenActions.resetTokenGroup({
                defaultToken,
                theme,
                designSystem,
            });

            setColor(color);
            setOpacity(opacity);
            setDescription(description);
        }

        if (defaultToken instanceof GradientToken) {
            const { color, opacity, description } = gradientTokenActions.resetTokenGroup({
                defaultToken,
                theme,
                designSystem,
            });

            setColor(color);
            setOpacity(opacity);
            setDescription(description);
        }

        rerender();
    };

    const onDeleteClick = (event: MouseEvent<HTMLDivElement>) => {
        event.stopPropagation();

        setDeleteDialogOpen(true);
        const node = event.currentTarget.parentElement?.parentElement as HTMLElement;
        setDeleteTokenAnchor(node);
    };

    const onDeleteCancel = () => {
        setDeleteDialogOpen(false);
        setDeleteTokenAnchor(undefined);
    };

    const onDeleteConfirm = () => {
        if (defaultToken instanceof ColorToken) {
            colorTokenActions.deleteTokenGroup({
                defaultToken,
                theme,
                designSystem,
            });
        }

        if (defaultToken instanceof GradientToken) {
            gradientTokenActions.deleteTokenGroup({
                defaultToken,
                theme,
                designSystem,
            });
        }

        setDeleteDialogOpen(false);
        rerender();
    };

    const onColorPickerClose = () => {
        setOpened(false);
        setColorPickerAnchor(undefined);
    };

    const onCurrentColorClick = (event: React.MouseEvent, item: ColorToken | GradientToken) => {
        event.stopPropagation();

        setActiveToken(item);
        const node = event.currentTarget.parentElement?.parentElement?.parentElement?.parentElement as HTMLElement;
        setColorPickerAnchor(node);

        if (item instanceof ColorToken) {
            const rawValue = item.getValue('web') as string;
            const [colorValue, opacityValue] = getColorAndOpacity(rawValue);

            setColor(colorValue);
            setOpacity(opacityValue);
            setPickerInitialType(/^(general|additional)\./.test(colorValue) ? 'library' : 'custom');
        } else {
            setPickerInitialType('custom');
        }

        setOpened(true);
    };

    useEffect(() => {
        if (!token) {
            return;
        }

        const [colorValue, opacityValue] = getColorAndOpacity(token.getValue('web'));
        setType(token instanceof GradientToken ? typeList[1] : typeList[0]);
        setColor(token instanceof GradientToken ? token.getValue('web').join(', ') : colorValue);
        setOpacity(opacityValue);
    }, [token]);

    useEffect(() => {
        setDescription(defaultToken?.getDescription());
    }, [defaultToken]);

    const sectionHandlers = {
        activeToken,
        currentOpacity,
        colorValueStatus,
        onRelink: onSubgroupRelink,
        onPreviewClick: onCurrentColorClick,
        onPaletteUnlink,
        onInputValueBlur,
        onInputValueChange,
        onOpacityCommit: onOpacityChange,
    };

    return (
        <Root>
            <StyledSetup>
                <TokenHeader
                    groupCamel={groupCamel}
                    defaultTokenSuffix={defaultTokenSuffix}
                    description={description}
                    canEditName={canEditName}
                    canDelete={canEditName}
                    onDisplayNameSuffixCommit={onDisplayNameSuffixCommit}
                    onDescriptionChange={onDescriptionChange}
                    onReset={onTokenReset}
                    onDeleteClick={onDeleteClick}
                />
                <ModesSection nodes={modeNodes} {...sectionHandlers} />
                <ContextSection nodes={contextNodes} isLinked={isSubgroupLinked(subgroupNodes)} {...sectionHandlers} />
                <ColorPicker
                    tokenType={token?.getType()}
                    color={currentColor}
                    opacity={currentOpacity}
                    opened={opened}
                    anchor={colorPickerAnchor}
                    initialType={pickerInitialType}
                    onColorChange={onColorChange(token)}
                    onOpacityChange={onOpacityChange(token)}
                    onClose={onColorPickerClose}
                />
                <DeleteTokenDialog
                    opened={deleteDialogOpen}
                    anchor={deleteTokenAnchor}
                    tokenDisplayName={defaultToken?.getDisplayName()}
                    onCancel={onDeleteCancel}
                    onConfirm={onDeleteConfirm}
                />
            </StyledSetup>
            <TokenColorPreview color={currentColor} opacity={currentOpacity} theme={theme} type={type.value} />
        </Root>
    );
};
