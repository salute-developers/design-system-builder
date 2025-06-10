import styled, { createGlobalStyle } from 'styled-components';
import { useNavigate } from 'react-router-dom';
import { IconHomeAltOutline } from '@salutejs/plasma-icons';
import { Button, H3, IconButton, Select } from '@salutejs/plasma-b2c';

import type { Theme } from '../../../themeBuilder';
import { Config } from '../../../componentBuilder';
import { getComponentMeta } from '../../../componentBuilder/api';
import { createMetaTokens } from '../../../themeBuilder/themes/createMetaTokens';
import { createVariationTokens } from '../../../themeBuilder/themes/createVariationTokens';
import { useState } from 'react';

const NoScroll = createGlobalStyle`
    html, body {
        overscroll-behavior: none;
    }
`;

const StyledContainer = styled.div`
    position: relative;

    width: 100%;
    height: 100vh;
    box-sizing: border-box;
    background-color: #000;
`;

const StyledWrapper = styled.div`
    position: relative;
    inset: 3rem;
    top: 4.5rem;
    border-radius: 0.5rem;
    height: calc(100vh - 7rem);
    width: calc(100% - 6rem);

    overflow: hidden;

    display: flex;
    flex-direction: column;

    ::-webkit-scrollbar {
        display: none;
    }
    scrollbar-width: none;
`;

const StyledThemeInfo = styled.div`
    position: absolute;
    right: 3rem;
    top: 1.875rem;
    display: flex;

    justify-content: center;
    align-items: center;

    gap: 1rem;
`;

const StyledThemeName = styled.div``;

const StyledThemeVersion = styled.div`
    opacity: 0.5;
`;

const StyledActions = styled.div`
    display: flex;
    gap: 1rem;
    justify-content: flex-end;
`;

const StyledComponentList = styled.div`
    padding: 1rem;
    overflow-y: scroll;
    overflow-x: hidden;

    display: grid;
    gap: 1rem;
    grid-template-columns: repeat(6, 1fr);

    margin-bottom: 0.5rem;
    border-radius: 0.5rem;
    background: #0c0c0c;
`;

const StyledComponent = styled.div<{ disabled: boolean }>`
    cursor: pointer;

    height: 6.5rem;

    border: 1px solid transparent;
    border-radius: 1rem;

    display: flex;
    justify-content: center;
    align-items: center;

    &:hover {
        border: 1px solid white;
    }

    transition: border 0.2s ease-in-out;

    opacity: ${({ disabled }) => (disabled ? 0.4 : 1)};
    pointer-events: ${({ disabled }) => (disabled ? 'none' : 'auto')};
`;

const componentRoutes = [
    { name: 'IconButton', routeParam: 'icon-button', disabled: false },
    { name: 'Link', routeParam: 'link', disabled: false },
    { name: 'Button', routeParam: 'button', disabled: false },
    { name: 'Checkbox', routeParam: 'checkbox', disabled: true },
    { name: 'Radiobox', routeParam: 'radiobox', disabled: true },
    { name: 'ButtonGroup', routeParam: 'button-group', disabled: true },
    { name: 'Breadcrumbs', routeParam: 'breadcrumbs', disabled: true },
    { name: 'Chip', routeParam: 'chip', disabled: true },
    { name: 'ChipGroup', routeParam: 'chip-group', disabled: true },
    { name: 'Cell', routeParam: 'cell', disabled: true },
    { name: 'Card', routeParam: 'card', disabled: true },
    { name: 'Flow', routeParam: 'flow', disabled: true },
    { name: 'Spinner', routeParam: 'spinner', disabled: true },
    { name: 'Popover', routeParam: 'popover', disabled: true },
    { name: 'TextArea', routeParam: 'text-area', disabled: true },
    { name: 'TextField', routeParam: 'text-field', disabled: true },
    { name: 'TextFieldGroup', routeParam: 'text-field-group', disabled: true },
    { name: 'Switch', routeParam: 'switch', disabled: true },
    { name: 'Tabs', routeParam: 'tabs', disabled: true },
    { name: 'Calendar', routeParam: 'calendar', disabled: true },
    { name: 'Typography', routeParam: 'typography', disabled: true },
    { name: 'Popup', routeParam: 'popup', disabled: true },
    { name: 'Modal', routeParam: 'modal', disabled: true },
    { name: 'Notification', routeParam: 'notification', disabled: true },
    { name: 'Drawer', routeParam: 'drawer', disabled: true },
    { name: 'Dropdown', routeParam: 'dropdown', disabled: true },
    { name: 'Tooltip', routeParam: 'tooltip', disabled: true },
    { name: 'Segment', routeParam: 'segment', disabled: true },
    { name: 'Skeleton', routeParam: 'skeleton', disabled: true },
    { name: 'Image', routeParam: 'image', disabled: true },
    { name: 'Badge', routeParam: 'badge', disabled: true },
    { name: 'Counter', routeParam: 'counter', disabled: true },
    { name: 'Avatar', routeParam: 'avatar', disabled: true },
    { name: 'AvatarGroup', routeParam: 'avatar-group', disabled: true },
    { name: 'Pagination', routeParam: 'pagination', disabled: true },
    { name: 'Toast', routeParam: 'toast', disabled: true },
    { name: 'Overlay', routeParam: 'overlay', disabled: true },
    { name: 'SSRProvider', routeParam: 'ssr-provider', disabled: true },
    { name: 'Combobox', routeParam: 'combobox', disabled: true },
    { name: 'Indicator', routeParam: 'indicator', disabled: true },
    { name: 'ButtonBase', routeParam: 'button-base', disabled: true },
    { name: 'Grid', routeParam: 'grid', disabled: true },
    { name: 'Progress', routeParam: 'progress', disabled: true },
    { name: 'Select', routeParam: 'select', disabled: true },
    { name: 'Divider', routeParam: 'divider', disabled: true },
    { name: 'Toolbar', routeParam: 'toolbar', disabled: true },
    { name: 'Sheet', routeParam: 'sheet', disabled: true },
    { name: 'Slider', routeParam: 'slider', disabled: true },
    { name: 'Steps', routeParam: 'steps', disabled: true },
    { name: 'Range', routeParam: 'range', disabled: true },
    { name: 'Accordion', routeParam: 'accordion', disabled: true },
    { name: 'DatePicker', routeParam: 'date-picker', disabled: true },
    { name: 'Portal', routeParam: 'portal', disabled: true },
    { name: 'Price', routeParam: 'price', disabled: true },
    { name: 'Autocomplete', routeParam: 'autocomplete', disabled: true },
    { name: 'EmptyState', routeParam: 'empty-state', disabled: true },
    { name: 'Editable', routeParam: 'editable', disabled: true },
    { name: 'Mask', routeParam: 'mask', disabled: true },
    { name: 'Attach', routeParam: 'attach', disabled: true },
    { name: 'ViewContainer', routeParam: 'view-container', disabled: true },
    { name: 'NumberInput', routeParam: 'number-input', disabled: true },
    { name: 'Dropzone', routeParam: 'dropzone', disabled: true },
    { name: 'Tree', routeParam: 'tree', disabled: true },
    { name: 'Rating', routeParam: 'rating', disabled: true },
    { name: 'Note', routeParam: 'note', disabled: true },
    { name: 'Table', routeParam: 'table', disabled: true },
    { name: 'LinkButton', routeParam: 'link-button', disabled: true },
    { name: 'NumberFormat', routeParam: 'number-format', disabled: true },
    { name: 'ToastNew', routeParam: 'toast-new', disabled: true },
    { name: 'Carousel', routeParam: 'carousel', disabled: true },
    { name: 'PaginationDots', routeParam: 'pagination-dots', disabled: true },
    { name: 'CodeField', routeParam: 'code-field', disabled: true },
    { name: 'List', routeParam: 'list', disabled: true },
];

interface ComponentSelectorProps {
    theme: Theme;
    components: Config[];
}

export const ComponentSelector = (props: ComponentSelectorProps) => {
    const { theme, components } = props;

    const navigate = useNavigate();

    const [isLoading, setIsLoading] = useState(false);
    const [exportType, setExportType] = useState('tgz');

    const exportTypes = [
        {
            value: 'tgz',
            label: 'tgz',
        },
        {
            value: 'zip',
            label: 'zip',
        },
    ];

    const onGoHome = () => {
        navigate('/');
    };

    const onEditComponent = (routeParam: string) => {
        navigate('/components/' + routeParam);
    };

    const onComponentsCancel = () => {
        navigate('/theme');
    };

    const onChangeExportType = (value: string) => {
        setExportType(value);
    };

    const onComponentsSave = async () => {
        // TODO: подумать как можно это оптимзировать (и нужно ли)
        const allowedComponentRoutes = componentRoutes.filter((item) => !item.disabled);
        const initialComponentsRoutes = allowedComponentRoutes.filter(
            (item) => !components.find((cmp) => cmp.getName() === item.name),
        );
        const initialComponents = initialComponentsRoutes.map((item) => {
            const meta = getComponentMeta(item.name);
            return new Config(meta);
        });

        const componentsMeta = [...initialComponents, ...components].map((item) => item.createMeta());

        const metaTokens = createMetaTokens(theme);
        const variationTokens = createVariationTokens(theme, undefined, 'web');

        const data = {
            packageName: theme.getName(),
            packageVersion: theme.getVersion(),
            componentsMeta,
            themeSource: {
                meta: metaTokens,
                variations: variationTokens,
            },
            exportType,
        };

        // console.log('metaTokens', metaTokens);
        // console.log('variationTokens', variationTokens);
        // console.log('new Blob([JSON.stringify(data)]).size', new Blob([JSON.stringify(data)]).size / 1048576);

        setIsLoading(true);

        const result = await fetch('http://localhost:3000/generate', {
            method: 'POST',
            body: JSON.stringify(data),
            headers: {
                'Content-Type': 'application/json',
            },
        });

        const blob = await result.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${theme.getName()}@${theme.getVersion()}.${exportType}`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);

        setIsLoading(false);

        console.log('test', result);
    };

    return (
        <StyledContainer>
            <StyledThemeInfo>
                <StyledThemeName>{theme.getName()}</StyledThemeName>
                <StyledThemeVersion>{theme.getVersion()}</StyledThemeVersion>
                <IconButton view="clear" size="s" onClick={onGoHome}>
                    <IconHomeAltOutline size="s" />
                </IconButton>
            </StyledThemeInfo>
            <StyledWrapper>
                <StyledComponentList>
                    {componentRoutes.map(({ disabled, name, routeParam }) => (
                        <StyledComponent key={name} disabled={disabled} onClick={() => onEditComponent(routeParam)}>
                            <H3>{name}</H3>
                        </StyledComponent>
                    ))}
                </StyledComponentList>
                <StyledActions>
                    <Button view="clear" onClick={onComponentsCancel} text="Отменить" />
                    <Select
                        size="m"
                        listMaxHeight="25"
                        listOverflow="scroll"
                        value={exportType}
                        items={exportTypes}
                        onChange={onChangeExportType}
                    />
                    <Button
                        view="primary"
                        onClick={onComponentsSave}
                        disabled={isLoading}
                        isLoading={isLoading}
                        text="Сгенерировать"
                    />
                </StyledActions>
            </StyledWrapper>
            <NoScroll />
        </StyledContainer>
    );
};
