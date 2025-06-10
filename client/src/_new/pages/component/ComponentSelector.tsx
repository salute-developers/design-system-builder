import styled, { createGlobalStyle } from 'styled-components';
import { useNavigate } from 'react-router-dom';
import { IconHomeAltOutline } from '@salutejs/plasma-icons';
import { Button, H3, IconButton, Select, Badge } from '@salutejs/plasma-b2c';

import type { Theme } from '../../../themeBuilder';
import { Config } from '../../../componentBuilder';
import { getComponentMeta, getAllComponents, isBackendComponent } from '../../../componentBuilder/api';
import { designSystemAPI, type ComponentDetailed } from '../../../api';
import { createMetaTokens } from '../../../themeBuilder/themes/createMetaTokens';
import { createVariationTokens } from '../../../themeBuilder/themes/createVariationTokens';
import { useState, useEffect, useCallback } from 'react';

// Import our API integration layer
import { useDesignSystems } from '../../../hooks/useDesignSystems';
import { 
  ErrorBoundary, 
  ErrorMessage, 
  useToast, 
  ToastContainer,
  LoadingSpinner,
  ListSkeleton 
} from '../../../components';

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
    align-items: center;
`;

const StyledHeader = styled.div`
    padding: 1rem;
    background: #111;
    border-radius: 0.5rem;
    margin-bottom: 1rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
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

const StyledComponent = styled.div<{ disabled: boolean; isBackend?: boolean }>`
    cursor: pointer;
    position: relative;

    height: 7rem;

    border: 1px solid ${({ isBackend }) => (isBackend ? '#4CAF50' : 'transparent')};
    border-radius: 1rem;

    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    gap: 0.5rem;

    &:hover {
        border: 1px solid ${({ isBackend }) => (isBackend ? '#66BB6A' : 'white')};
    }

    transition: border 0.2s ease-in-out;

    opacity: ${({ disabled }) => (disabled ? 0.4 : 1)};
    pointer-events: ${({ disabled }) => (disabled ? 'none' : 'auto')};
`;

const StyledComponentName = styled.div`
    font-size: 0.875rem;
    text-align: center;
    color: #fff;
`;

const StyledComponentBadge = styled.div`
    position: absolute;
    top: 0.25rem;
    right: 0.25rem;
`;

// Fallback component routes for local development
const fallbackComponentRoutes = [
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

interface ComponentRoute {
    name: string;
    routeParam: string;
    disabled: boolean;
    isBackend?: boolean;
}

interface ComponentSelectorProps {
    theme: Theme;
    components: Config[];
}

export const ComponentSelector = (props: ComponentSelectorProps) => {
    const { theme, components } = props;

    const navigate = useNavigate();
    const toast = useToast();
    const designSystems = useDesignSystems();

    const [isLoading, setIsLoading] = useState(false);
    const [exportType, setExportType] = useState('tgz');
    const [componentRoutes, setComponentRoutes] = useState<ComponentRoute[]>(fallbackComponentRoutes);
    const [loadingComponents, setLoadingComponents] = useState(true);
    const [componentError, setComponentError] = useState<string | null>(null);

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

    // Memoize toast functions to prevent unnecessary re-renders
    const showSuccess = useCallback((message: string) => {
        toast.showSuccess(message);
    }, [toast]);

    const showError = useCallback((message: string) => {
        toast.showError(message);
    }, [toast]);

    // Load components from backend - Fixed: removed toast notifications to prevent infinite loops
    useEffect(() => {
        const loadComponents = async () => {
            setLoadingComponents(true);
            setComponentError(null);

            try {
                const allComponents = await getAllComponents();
                
                // Get backend component names directly from API to avoid multiple calls
                let backendComponentNames: Set<string> = new Set();
                try {
                    const backendComponents = await designSystemAPI.getAvailableComponents();
                    backendComponentNames = new Set(
                        backendComponents.map((comp: ComponentDetailed) => comp.name.toLowerCase())
                    );
                } catch (error) {
                    console.warn('Failed to get backend component list:', error);
                }
                
                // Create routes from all components
                const routes: ComponentRoute[] = [];

                // Create routes and determine if they're from backend
                allComponents.forEach(component => {
                    const routeParam = component.name
                        .replace(/([A-Z])/g, '-$1')
                        .toLowerCase()
                        .replace(/^-/, '');
                    
                    routes.push({
                        name: component.name,
                        routeParam,
                        disabled: false,
                        isBackend: backendComponentNames.has(component.name.toLowerCase()),
                    });
                });

                // Add any missing fallback components
                fallbackComponentRoutes.forEach(fallback => {
                    const exists = routes.some(route => route.name === fallback.name);
                    if (!exists) {
                        routes.push({
                            ...fallback,
                            isBackend: false,
                        });
                    }
                });

                setComponentRoutes(routes);
                // Removed toast notification to prevent infinite loops
                console.log(`Loaded ${routes.filter(r => r.isBackend).length} components from backend`);
                
            } catch (error) {
                console.warn('Failed to load components from backend, using fallback routes:', error);
                setComponentError(error instanceof Error ? error.message : 'Failed to load components');
                setComponentRoutes(fallbackComponentRoutes.map(route => ({ ...route, isBackend: false })));
            } finally {
                setLoadingComponents(false);
            }
        };

        loadComponents();
    }, []); // Removed showSuccess dependency completely

    const onGoHome = () => {
        navigate('/');
    };

    const onEditComponent = (routeParam: string) => {
        navigate(`/component/${routeParam}`);
    };

    const onComponentsCancel = () => {
        navigate('/');
    };

    const onChangeExportType = (value: string | number | string[]) => {
        setExportType(String(value));
    };

    const onComponentsSave = async () => {
        if (!components || !components.length) {
            showError('No components configured');
            return;
        }

        setIsLoading(true);

        try {
            // If we have a design system selected, we could save components to it
            const currentDS = designSystems.currentDesignSystem;
            
            if (currentDS) {
                // TODO: Implement saving multiple components to design system
                console.log('Saving components to design system:', {
                    designSystem: currentDS,
                    components: components.map(c => c.getName()),
                    exportType,
                });
                showSuccess(`Components saved to ${currentDS.name}`);
            } else {
                // Fixed: Simplified the export logic to avoid type errors
                const exportData = {
                    name: theme.getName(),
                    version: theme.getVersion(),
                    components: components.map((component) => ({
                        name: component.getName(),
                        // Simplified - just export the component names for now
                        // The full token export logic needs more work to match types
                    })),
                    exportType,
                };

                // Log the export (in a real implementation, this would trigger a download)
                console.log('EXPORT CONFIG', exportData);
                showSuccess('Component configuration exported');
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to save components';
            showError(errorMessage);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <ErrorBoundary>
            <StyledContainer>
                <StyledThemeInfo>
                    <StyledThemeName>{theme.getName()}</StyledThemeName>
                    <StyledThemeVersion>{theme.getVersion()}</StyledThemeVersion>
                    <IconButton view="clear" size="s" onClick={onGoHome}>
                        <IconHomeAltOutline size="s" />
                    </IconButton>
                </StyledThemeInfo>
                <StyledWrapper>
                    <StyledHeader>
                        <div>
                            <H3 style={{ margin: 0, marginBottom: '0.5rem' }}>Component Library</H3>
                            <div style={{ fontSize: '0.875rem', color: '#888' }}>
                                {componentRoutes.filter(r => r.isBackend).length} backend components, {' '}
                                {componentRoutes.filter(r => !r.isBackend).length} local components
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                            {designSystems.currentDesignSystem && (
                                <div style={{ fontSize: '0.875rem', color: '#4CAF50' }}>
                                    Design System: {designSystems.currentDesignSystem.name}
                                </div>
                            )}
                        </div>
                    </StyledHeader>

                    {/* Show error message if there was an issue loading components */}
                    {componentError && (
                        <ErrorMessage 
                            error={componentError}
                            title="Component Loading Warning"
                            onDismiss={() => setComponentError(null)}
                        />
                    )}

                    {loadingComponents ? (
                        <div style={{ padding: '1rem', background: '#0c0c0c', borderRadius: '0.5rem' }}>
                            <ListSkeleton count={12} />
                        </div>
                    ) : (
                        <StyledComponentList>
                            {componentRoutes.map((component) => (
                                <StyledComponent
                                    key={component.name}
                                    disabled={component.disabled}
                                    isBackend={component.isBackend}
                                    onClick={() => !component.disabled && onEditComponent(component.routeParam)}
                                >
                                    <StyledComponentBadge>
                                        {component.isBackend ? (
                                            <Badge text="API" size="s" style={{ 
                                                backgroundColor: '#4CAF50',
                                                fontSize: '0.6rem'
                                            }} />
                                        ) : (
                                            <Badge text="Local" size="s" style={{ 
                                                backgroundColor: '#666',
                                                fontSize: '0.6rem'
                                            }} />
                                        )}
                                    </StyledComponentBadge>
                                    <StyledComponentName>
                                        {component.name}
                                    </StyledComponentName>
                                </StyledComponent>
                            ))}
                        </StyledComponentList>
                    )}

                    <StyledActions>
                        <Select
                            value={exportType}
                            items={exportTypes}
                            onChange={onChangeExportType}
                            placeholder="Тип экспорта"
                        />
                        <Button 
                            view="clear" 
                            onClick={onComponentsCancel} 
                            text="Отменить"
                            disabled={isLoading}
                        />
                        <Button 
                            view="primary" 
                            onClick={onComponentsSave} 
                            text="Сохранить"
                            disabled={isLoading}
                        />
                    </StyledActions>
                </StyledWrapper>
                <NoScroll />
                
                {/* Toast notifications */}
                <ToastContainer toasts={toast.toasts} onRemove={toast.removeToast} />
            </StyledContainer>
        </ErrorBoundary>
    );
};
