import { useState, useEffect } from 'react';
import styled from 'styled-components';
import { useNavigate, useParams } from 'react-router-dom';
import { Button, H3 } from '@salutejs/plasma-b2c';

import { DesignSystem } from '../../../designSystem';
import { PageWrapper } from '../PageWrapper';

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

    margin-bottom: 1rem;
    border-radius: 0.5rem;
    background: #0c0c0c;
    border: solid 1px #313131;
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
        border: 1px solid var(--text-accent);
    }

    transition: border 0.2s ease-in-out;

    opacity: ${({ disabled }) => (disabled ? 0.4 : 1)};
    pointer-events: ${({ disabled }) => (disabled ? 'none' : 'auto')};
`;

const componentRoutes = [
    { name: 'IconButton', routeParam: 'icon-button', disabled: false },
    { name: 'Link', routeParam: 'link', disabled: false },
    { name: 'Button', routeParam: 'button', disabled: false },
    { name: 'Checkbox', routeParam: 'checkbox', disabled: false },
    { name: 'Radiobox', routeParam: 'radiobox', disabled: false },
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

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
interface ComponentSelectorProps {
    // designSystem: DesignSystem;
}

export const ComponentSelector = (props: ComponentSelectorProps) => {
    const navigate = useNavigate();

    const { designSystemName, designSystemVersion } = useParams();
    const [designSystem, setDesignSystem] = useState<DesignSystem | null>(null);

    useEffect(() => {
        const initializeDesignSystem = async () => {
            if (designSystemName && designSystemVersion) {
                const ds = await DesignSystem.create({ name: designSystemName, version: designSystemVersion });
                setDesignSystem(ds);
            }
        };
        initializeDesignSystem();
    }, [designSystemName, designSystemVersion]);

    if (!designSystem) {
        return <div>Loading...</div>;
    }

    const currentLocation = `${designSystem.getName()}/${designSystem.getVersion()}`;

    const onEditComponent = (routeParam: string) => {
        navigate(`/${currentLocation}/components/${routeParam}`);
    };

    const onComponentsCancel = () => {
        navigate(`/${currentLocation}/theme`);
    };

    const onComponentsSave = async () => {
        navigate(`/${currentLocation}/generate`);
    };

    return (
        <PageWrapper designSystem={designSystem}>
            <StyledComponentList>
                {componentRoutes.map(({ disabled, name, routeParam }) => (
                    <StyledComponent key={name} disabled={disabled} onClick={() => onEditComponent(routeParam)}>
                        <H3>{name}</H3>
                    </StyledComponent>
                ))}
            </StyledComponentList>
            <StyledActions>
                <Button view="clear" onClick={onComponentsCancel} text="Назад" />
                <Button view="primary" onClick={onComponentsSave} text="Сгенерировать" />
            </StyledActions>
        </PageWrapper>
    );
};
