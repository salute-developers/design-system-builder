import { useState, useEffect } from 'react';
import styled from 'styled-components';
import { useNavigate, useParams } from 'react-router-dom';
import { TabItem, Tabs, Button, IconButton } from '@salutejs/plasma-b2c';

import {
    AndroidColor,
    AndroidGradient,
    ColorToken,
    GradientToken,
    IOSColor,
    IOSGradient,
    // ShadowToken,
    ShapeToken,
    SpacingToken,
    Theme,
    WebColor,
    WebGradient,
} from '../../../themeBuilder';
import { useGroupedAllTokens } from '../../hooks';
import { TokenPreview } from './TokenPreview';
import { camelToKebab, type GroupedToken, kebabToCamel } from '../../utils';
import { Token } from '../../../themeBuilder/tokens/token';
import { DesignSystem } from '../../../designSystem';
import { createVariationTokens } from '../../../themeBuilder/themes/createVariationTokens';
import { createMetaTokens } from '../../../themeBuilder/themes/createMetaTokens';
import { extraMetaTokenGetters } from '../../../themeBuilder/themes/metaTokensGetters';
import { extraThemeTokenGetters } from '../../../themeBuilder/themes/variationTokensGetters';
import { PageWrapper } from '../PageWrapper';

const StyledActions = styled.div`
    display: flex;
    gap: 1rem;
    justify-content: flex-end;
`;

const StyledTokenList = styled.div`
    flex: 1;
    overflow-y: scroll;
    overflow-x: hidden;

    margin-bottom: 1rem;
`;

const StyledGroupedTokens = styled.div``;

const StyledTokenGroupNameWrapper = styled.div`
    display: flex;
    justify-content: space-between;
    align-items: center;
`;

const StyledTokenGroupName = styled.div<{ isGroupName: boolean }>`
    margin: 2rem 0;

    font-size: ${({ isGroupName }) => (isGroupName ? '0.875rem' : '1.125rem')};
    opacity: ${({ isGroupName }) => (isGroupName ? 0.75 : 1)};
`;

const StyledThemeContent = styled.div`
    padding: 1rem;

    display: flex;
    flex-direction: column;

    min-height: 0;
    height: 100%;
    margin-bottom: 1rem;

    border-radius: 0.5rem;
    background: #0c0c0c;
    border: solid 1px #313131;
`;

const tokensTypes = [
    {
        label: 'Цвета',
        value: 'color',
        inner: [
            {
                label: 'Темная',
                value: 'dark',
            },
            {
                label: 'Светлая',
                value: 'light',
            },
        ],
        readOnly: false,
    },
    {
        label: 'Градиенты',
        value: 'gradient',
        inner: [
            {
                label: 'Темная',
                value: 'dark',
            },
            {
                label: 'Светлая',
                value: 'light',
            },
        ],
        readOnly: false,
    },
    {
        label: 'Форма',
        value: 'shape',
        inner: [
            {
                label: 'Скругление',
                value: 'round',
            },
        ],
        readOnly: false,
    },
    {
        label: 'Отступы',
        value: 'spacing',
        inner: [
            {
                label: 'Размеры',
                value: 'spacing',
            },
        ],
        readOnly: false,
    },
    {
        label: 'Тени',
        value: 'shadow',
        inner: [
            {
                label: 'Вверх',
                value: 'up',
            },
            {
                label: 'Вниз',
                value: 'down',
            },
        ],
        readOnly: false,
    },
    {
        label: 'Типографика',
        value: 'typography',
        inner: [
            {
                label: 'Размер экрана S',
                value: 'screen-s',
            },
            {
                label: 'Размер экрана M',
                value: 'screen-m',
            },
            {
                label: 'Размер экрана L',
                value: 'screen-l',
            },
        ],
        readOnly: false,
    },
    {
        label: 'Семейство шрифтов',
        value: 'fontFamily',
        inner: [
            {
                label: 'Display',
                value: 'display',
            },
            {
                label: 'Text',
                value: 'text',
            },
            {
                label: 'Body',
                value: 'body',
            },
            {
                label: 'Header',
                value: 'header',
            },
        ],
        readOnly: false,
    },
];

const createNewTokens = (theme: Theme, context?: (string | undefined)[]) => {
    const [type, mode, ...rest] = (context as string[]) || [];
    const replaceTo = mode === 'dark' ? 'light' : 'dark';

    const createMeta = (mode: string) => ({
        tags: [mode, ...rest, 'initial-name'],
        name: [mode, ...rest, 'initial-name'].join('.'),
        displayName: 'displayName',
        description: 'description',
        enabled: true,
    });

    const createTokens = (type: string) => {
        if (type === 'color') {
            const newToken = new ColorToken(createMeta(mode), {
                web: new WebColor(''),
                ios: new IOSColor(''),
                android: new AndroidColor(''),
            });
            const secondNewToken = new ColorToken(createMeta(replaceTo), {
                web: new WebColor(''),
                ios: new IOSColor(''),
                android: new AndroidColor(''),
            });

            theme.addToken(type, secondNewToken);
            return theme.addToken(type, newToken);
        }

        if (type === 'gradient') {
            const newToken = new GradientToken(createMeta(mode), {
                web: new WebGradient(['']),
                ios: new IOSGradient([]),
                android: new AndroidGradient([]),
            });
            const secondNewToken = new GradientToken(createMeta(replaceTo), {
                web: new WebGradient(['']),
                ios: new IOSGradient([]),
                android: new AndroidGradient([]),
            });

            theme.addToken(type, secondNewToken);
            return theme.addToken(type, newToken);
        }
    };

    return createTokens(type);
};

const updateTokens = (theme: Theme, updatedToken: Token, data: any) => {
    const [, ...rest] = updatedToken.getTags();
    const lightTokenName = theme.getToken(['light', ...rest].join('.'), updatedToken.getType());
    const darkTokenName = theme.getToken(['dark', ...rest].join('.'), updatedToken.getType());

    [lightTokenName, darkTokenName].forEach((token) => {
        if (!token) {
            return;
        }

        const [mode, category, subcategory] = token.getTags();
        const tokenDisplayName = kebabToCamel(
            (subcategory === 'default' ? category : [subcategory, category].join('-')) + '-' + data.editableName,
        );
        const tokenTags = [mode, category, subcategory, camelToKebab(data.editableName)];
        const tokenName = tokenTags.join('.');

        token?.setName(tokenName);
        token?.setTags(tokenTags);
        token?.setDisplayName(tokenDisplayName);

        token?.setEnabled(data.enabled);
        token?.setDescription(data.description);
    });

    // TODO: Добавить генерацию для нативных платформ

    if (updatedToken instanceof GradientToken) {
        updatedToken?.setValue('web', data.value.split('\n'));
    }

    if (updatedToken instanceof ColorToken) {
        updatedToken?.setValue('web', data.value);
    }

    if (updatedToken instanceof ShapeToken) {
        updatedToken?.setValue('web', data.value);
    }

    if (updatedToken instanceof SpacingToken) {
        updatedToken?.setValue('web', data.value);
    }

    // if (updatedToken instanceof ShadowToken) {
    //     console.log('data.value', typeof data.value);

    //     updatedToken?.setValue('web', data.value);
    // }
};

const types = ['color', 'gradient', 'shape', 'spacing', 'shadow', 'typography', 'fontFamily'] as const;

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
interface TokensEditorProps {
    // designSystem: DesignSystem;
    // setDesignSystem: (value: DesignSystem) => void;
}

export const TokensEditor = (props: TokensEditorProps) => {
    const navigate = useNavigate();
    const { designSystemName, designSystemVersion } = useParams();
    const [designSystem, setDesignSystem] = useState<DesignSystem | null>(null);

    const [theme, setTheme] = useState<any>(null);

    useEffect(() => {
        const initializeDesignSystem = async () => {
            if (designSystemName && designSystemVersion) {
                const ds = await DesignSystem.create({ name: designSystemName, version: designSystemVersion });
                setDesignSystem(ds);
                setTheme(ds.createThemeInstance());
            }
        };
        initializeDesignSystem();
    }, [designSystemName, designSystemVersion]);

    const [tokenType, setTokenType] = useState(0);
    const [tokenEditorIndex, setTokenEditorIndex] = useState<string | undefined>(undefined);
    const [isOpenAdd, setIsOpenAdd] = useState<string | undefined>(undefined);

    const tokens = useGroupedAllTokens(theme);

    if (!designSystem || !theme) {
        return <div>Loading...</div>;
    }

    const onClickTokenPreview = (index: string) => {
        setTokenEditorIndex((prevIndex) => (prevIndex === index ? undefined : index));
    };

    const onChangeTokenType = (index: number) => {
        setTokenEditorIndex(undefined);
        setTokenType(index);
    };

    const onTokenUpdate = (token?: Token, data?: any, context?: string[]) => {
        if (!data) {
            setTokenEditorIndex(undefined);
            setIsOpenAdd(undefined);
            return;
        }

        if (!token) {
            token = createNewTokens(theme, context);
        }

        if (!token) {
            return;
        }

        updateTokens(theme, token, data);

        setTheme(theme.cloneInstance());

        setTokenEditorIndex(undefined);
        setIsOpenAdd(undefined);
    };

    const onTokenDelete = (token?: Token) => {
        console.log('token', token);

        if (!token) {
            return;
        }

        const [mode, ...rest] = token.getTags();
        const replaceTo = mode === 'dark' ? 'light' : 'dark';

        const tokenName = token.getName();
        const secondTokenName = [replaceTo, ...rest].join('.');

        theme?.removeToken(tokenName, token.getType());
        theme?.removeToken(secondTokenName, token.getType());

        setTheme(theme.cloneInstance());
    };

    const onThemeCancel = () => {
        navigate('/');
    };

    const onThemeSave = () => {
        const metaTokens = createMetaTokens(theme, extraMetaTokenGetters);
        const variationTokens = createVariationTokens(theme, extraThemeTokenGetters);

        designSystem.saveThemeData({ meta: metaTokens, variations: variationTokens });

        navigate(`/${designSystem.getName()}/${designSystem.getVersion()}/components`);
    };

    const renderTokens = (item: GroupedToken, context: string[]) => {
        const isSubGroupName = context?.length > 2;

        let subGroupName = item.group;
        if (isSubGroupName) {
            const [, , category, subcategory, ..._] = context;
            subGroupName = [subcategory, category].join(' / ');
        }

        const getContext = (tokenGroup: string = '', itemGroup: string = '') => {
            // TODO: Очень не нравится это
            const normalizedGroupName = camelToKebab(
                tokenGroup === 'background' ? itemGroup.replace('on', '') : itemGroup,
            );

            return [...context, tokenGroup, normalizedGroupName];
        };

        return (
            <StyledGroupedTokens key={`grouped:${item.group}`}>
                {'group' in item && item.group && (
                    <>
                        <StyledTokenGroupNameWrapper>
                            <StyledTokenGroupName isGroupName={isSubGroupName}>{subGroupName}</StyledTokenGroupName>
                            {isSubGroupName && (
                                <IconButton size="xs" onClick={() => setIsOpenAdd(subGroupName)}>
                                    +
                                </IconButton>
                            )}
                        </StyledTokenGroupNameWrapper>

                        {subGroupName === isOpenAdd && (
                            <TokenPreview
                                isOpenEditor={subGroupName === isOpenAdd}
                                context={context}
                                onTokenUpdate={onTokenUpdate}
                            />
                        )}
                    </>
                )}
                {item.data.map((token, index) =>
                    'data' in token ? (
                        renderTokens(token, getContext(token.group, item.group))
                    ) : (
                        <TokenPreview
                            key={`${context}_${index}`}
                            token={token}
                            readOnly={tokensTypes[tokenType].readOnly}
                            isOpenEditor={tokenEditorIndex === `${context}_${index}`}
                            context={context}
                            onClick={() => onClickTokenPreview(`${context}_${index}`)}
                            onTokenDelete={onTokenDelete}
                            onTokenUpdate={onTokenUpdate}
                        />
                    ),
                )}
            </StyledGroupedTokens>
        );
    };

    console.log('theme', theme);

    return (
        <PageWrapper designSystem={designSystem}>
            <StyledThemeContent>
                <Tabs view="divider" size="m" stretch>
                    {tokensTypes.map(({ label }, i) => (
                        <TabItem
                            view="divider"
                            key={`item:${label}`}
                            size="m"
                            selected={i === tokenType}
                            onClick={() => onChangeTokenType(i)}
                        >
                            {label}
                        </TabItem>
                    ))}
                </Tabs>
                <Tabs view="divider" size="m">
                    {tokensTypes[tokenType].inner?.map(({ label, value }) => (
                        <TabItem
                            view="divider"
                            key={`item_inner:${label}`}
                            size="m"
                            selected={tokens[tokenType].mode === value}
                            onClick={() => tokens[tokenType].set(value)}
                        >
                            {label}
                        </TabItem>
                    ))}
                </Tabs>
                <StyledTokenList>
                    {tokens[tokenType].group.map((item) =>
                        renderTokens(item, [types[tokenType], tokens[tokenType].mode]),
                    )}
                </StyledTokenList>
            </StyledThemeContent>
            <StyledActions>
                <Button view="clear" onClick={onThemeCancel} text="Назад" />
                <Button view="primary" onClick={onThemeSave} text="Сохранить" />
            </StyledActions>
        </PageWrapper>
    );
};
