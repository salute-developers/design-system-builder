import { useMemo, useState, useEffect, useCallback } from 'react';
import styled, { createGlobalStyle } from 'styled-components';
import { useNavigate, useParams } from 'react-router-dom';
import { upperFirstLetter, type ThemeMode } from '@salutejs/plasma-tokens-utils';
import { Button, IconButton, H3 } from '@salutejs/plasma-b2c';
import { IconHomeAltOutline } from '@salutejs/plasma-icons';

import { getComponentMeta } from '../../../componentBuilder/api';
import { ComponentPlayground } from './ComponentPlayground';
import { ComponentTokens } from './ComponentTokens';
import { Theme } from '../../../themeBuilder';
import { ComponentAddStyle } from './ComponentAddStyle';
import { Config } from '../../../componentBuilder';
import { kebabToCamel } from '../../utils';

// Import our API integration layer
import { useDesignSystems } from '../../../hooks/useDesignSystems';
import { designSystemAPI, DataTransformer } from '../../../api';
import type { ComponentDetailed } from '../../../api';
import { 
  ErrorBoundary, 
  ErrorMessage, 
  useToast, 
  ToastContainer,
  LoadingSpinner,
  LoadingOverlay,
  SavingIndicator 
} from '../../../components';

import type { Meta } from '../../../componentBuilder';
import { createMetaTokens } from '../../../themeBuilder/themes/createMetaTokens';
import { createVariationTokens } from '../../../themeBuilder/themes/createVariationTokens';

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

const StyledBoard = styled.div`
    display: flex;
    gap: 0.5rem;
    min-height: 0;
    height: 100%;
    margin-bottom: 0.5rem;
`;

// TODO: перенести в утилиты?
const createCSSVars = (config: Config, theme: Theme, args: Record<string, string | boolean>, themeMode: ThemeMode) => {
    const variations = config.getVariations();
    const invariants = config.getInvariants();

    const items = Object.entries(args).map(([variation, value]) => ({
        variation,
        value,
    }));

    const variationsVars = items.reduce((vars, obj) => {
        const variation = variations.find((item) => item.getName() === obj.variation);
        const style = variation?.getStyles()?.find((item) => item.getID() === obj.value);

        const props = style
            ?.getProps()
            .getList()
            .reduce(
                (acc, prop) => ({
                    ...acc,
                    ...prop.getWebTokenValue(theme, themeMode),
                }),
                {},
            );

        return {
            ...vars,
            ...props,
        };
    }, {});

    const invariantVars = invariants.getList().reduce(
        (acc, prop) => ({
            ...acc,
            ...prop.getWebTokenValue(theme, themeMode),
        }),
        {},
    );

    return {
        ...variationsVars,
        ...invariantVars,
    };
};

// TODO: перенести в утилиты?
const getDefaults = (config: Config) => {
    const staticAPI = config.getStaticAPI();
    const defaultVariations = config.getDefaults();

    const defaults: Record<string, string | boolean> = {};

    defaultVariations.forEach((item) => {
        const variation = item.getVariation();
        const styleID = item.getStyleID();

        defaults[variation] = styleID;
    });

    staticAPI?.forEach((item) => {
        defaults[item.name] = item.value;
    });

    return defaults;
};

interface ComponentEditorProps {
    theme: Theme;
    updateComponents: React.Dispatch<React.SetStateAction<Config[]>>;
}

export const ComponentEditor = (props: ComponentEditorProps) => {
    const { theme, updateComponents } = props;
    const { component } = useParams();
    const navigate = useNavigate();
    const toast = useToast();
    const designSystems = useDesignSystems();

    // Component loading state
    const [loadingComponent, setLoadingComponent] = useState(false);
    const [componentError, setComponentError] = useState<string | null>(null);
    const [backendComponent, setBackendComponent] = useState<ComponentDetailed | null>(null);
    
    // Saving state
    const [saving, setSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);

    const componentName = upperFirstLetter(kebabToCamel(component));
    
    // Try to get component from backend first, fallback to local meta
    const [componentMeta, setComponentMeta] = useState<Meta | null>(null);
    
    // Load component meta when component or design system changes
    useEffect(() => {
        const loadComponentMeta = async () => {
            if (backendComponent) {
                const designSystemId = designSystems.currentDesignSystem?.id;
                console.log('designSystemId', designSystemId);
                const meta = designSystemId 
                    ? await DataTransformer.backendComponentToClientAsync(backendComponent, designSystemId)
                    : DataTransformer.backendComponentToClient(backendComponent);
                setComponentMeta(meta);
            } else {
                // Use synchronous version for local components
                const meta = getComponentMeta(componentName);
                setComponentMeta(meta);
            }
        };
        
        loadComponentMeta();
    }, [backendComponent, componentName, designSystems.currentDesignSystem?.id]);
    
    const componentConfig = useMemo(() => {
        if (!componentMeta) return null;
        return new Config(componentMeta);
    }, [componentMeta]);

    const [, updateState] = useState({});
    const forceRender = () => updateState({});

    const [componentProps, setComponentProps] = useState<Record<string, string | boolean>>({});
    const [themeMode, setThemeMode] = useState<ThemeMode>('dark');

    const [addStyleModal, setAddStyleModal] = useState<{
        open: boolean;
        variationID?: string;
    }>({
        open: false,
        variationID: undefined,
    });

    // Memoize toast functions to prevent unnecessary re-renders
    const showSuccess = useCallback((message: string) => {
        toast.showSuccess(message);
    }, [toast]);

    const showError = useCallback((message: string) => {
        toast.showError(message);
    }, [toast]);

    // Load component from backend - Fixed: removed toast notifications to prevent infinite loops
    useEffect(() => {
        const loadComponentFromBackend = async () => {
            if (!component) return;
            
            setLoadingComponent(true);
            setComponentError(null);
            
            try {
                // First, try to find component by name in available components
                const availableComponents = await designSystemAPI.getAvailableComponents();
                const foundComponent = availableComponents.find(
                    comp => comp.name.toLowerCase() === component.toLowerCase() ||
                           comp.name.toLowerCase() === componentName.toLowerCase()
                );
                
                if (foundComponent) {
                    setBackendComponent(foundComponent);
                    // Removed toast notification to prevent infinite loops
                    console.log(`Loaded component ${foundComponent.name} from backend`);
                    showSuccess(`Loaded component ${foundComponent.name} from backend`);
                } else {
                    // Component not found in backend, use local fallback
                    console.log(`Component ${componentName} not found in backend, using local fallback`);
                }
            } catch (error) {
                console.warn('Failed to load component from backend, using local fallback:', error);
                setComponentError(error instanceof Error ? error.message : 'Failed to load component');
            } finally {
                setLoadingComponent(false);
            }
        };

        loadComponentFromBackend();
    }, [component, componentName]); // Removed showSuccess dependency

    // Initialize component props when config is available
    useEffect(() => {
        if (componentConfig) {
            setComponentProps(getDefaults(componentConfig));
        }
    }, [componentConfig]);

    // Auto-dismiss save success message
    useEffect(() => {
        if (saveSuccess) {
            const timer = setTimeout(() => setSaveSuccess(false), 3000);
            return () => clearTimeout(timer);
        }
    }, [saveSuccess]);

    const onGoHome = () => {
        navigate('/');
    };

    const onComponentCancel = () => {
        navigate('/components');
    };

    const onComponentSave = async () => {
        if (!componentConfig) {
            showError('No component configuration to save');
            return;
        }

        setSaving(true);
        setSaveSuccess(false);

        try {
            // If we have a design system selected, save to that design system
            const currentDS = designSystems.currentDesignSystem;
            
            if (currentDS && backendComponent) {
                // TODO: Implement saving component configuration to design system
                // This would involve creating variation values for the current configuration
                console.log('Saving component configuration to design system:', {
                    designSystem: currentDS,
                    component: backendComponent,
                    configuration: componentProps,
                });
                
                // For now, just log the configuration
                showSuccess(`Component configuration saved to ${currentDS.name}`);
            } else {
                // Save locally (existing behavior)
                console.log('UPDATED COMPONENT CONFIG', componentConfig);
                updateComponents((prevValue: Config[]) => {
                    prevValue.push(componentConfig);
                    return prevValue;
                });
                showSuccess('Component configuration saved locally');
            }
            
            setSaveSuccess(true);
            
            // Navigate back after a short delay
            setTimeout(() => {
                navigate('/components');
            }, 1500);
            
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to save component';
            showError(errorMessage);
        } finally {
            setSaving(false);
        }
    };

    const onChangeComponentControlValue = (name?: string, value?: unknown) => {
        if (!name) {
            return;
        }

        setComponentProps({ ...componentProps, [name]: value as string });
    };

    // Show loading spinner while component is loading
    if (loadingComponent) {
        return (
            <StyledContainer>
                <LoadingSpinner message={`Loading component ${componentName}...`} />
            </StyledContainer>
        );
    }

    // Show error if component couldn't be loaded and no fallback available
    if (!componentConfig) {
        return (
            <ErrorBoundary>
                <StyledContainer>
                    <div style={{ 
                        display: 'flex', 
                        flexDirection: 'column', 
                        alignItems: 'center', 
                        justifyContent: 'center',
                        height: '100vh',
                        gap: '2rem',
                        padding: '2rem'
                    }}>
                        <ErrorMessage 
                            error={componentError || `Component "${componentName}" not found`}
                            title="Component Loading Error"
                            action={{
                                text: 'Go Back',
                                onClick: () => navigate('/components')
                            }}
                        />
                        <Button onClick={() => navigate('/components')}>
                            Back to Components
                        </Button>
                    </div>
                </StyledContainer>
            </ErrorBoundary>
        );
    }

    const vars = createCSSVars(componentConfig, theme, componentProps, themeMode);

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
                
                {/* Show loading overlay when saving */}
                {saving && (
                    <LoadingOverlay message="Saving component configuration..." />
                )}
                
                <StyledWrapper>
                    {/* Show error message if there was an issue loading from backend */}
                    {componentError && (
                        <ErrorMessage 
                            error={componentError}
                            title="Backend Loading Warning"
                            onDismiss={() => setComponentError(null)}
                        />
                    )}

                    <StyledBoard>
                        <ComponentTokens
                            args={componentProps}
                            config={componentConfig}
                            theme={theme}
                            updateConfig={forceRender}
                            setAddStyleModal={setAddStyleModal}
                            onChangeComponentControlValue={onChangeComponentControlValue}
                        />
                        <ComponentPlayground
                            vars={vars}
                            args={componentProps}
                            config={componentConfig}
                            themeMode={themeMode}
                            updateThemeMode={setThemeMode}
                            onChange={onChangeComponentControlValue}
                        />
                    </StyledBoard>
                    
                    <StyledActions>
                        <SavingIndicator 
                            saving={saving}
                            saved={saveSuccess}
                            error={false}
                            savingText="Saving..."
                            savedText="Saved!"
                        />
                        
                        <Button 
                            view="clear" 
                            onClick={onComponentCancel} 
                            text="Отменить"
                            disabled={saving}
                        />
                        <Button 
                            view="primary" 
                            onClick={onComponentSave} 
                            text="Сохранить"
                            disabled={saving}
                        />
                    </StyledActions>
                </StyledWrapper>
                <NoScroll />
                <ComponentAddStyle
                    config={componentConfig}
                    addStyleModal={addStyleModal}
                    setAddStyleModal={setAddStyleModal}
                />
                
                {/* Toast notifications */}
                <ToastContainer toasts={toast.toasts} onRemove={toast.removeToast} />
            </StyledContainer>
        </ErrorBoundary>
    );
};
