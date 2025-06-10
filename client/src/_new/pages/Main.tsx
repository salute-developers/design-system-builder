import styled, { createGlobalStyle } from 'styled-components';
import { useNavigate } from 'react-router-dom';
import { Button, DsplL, Link, Select, TextField, H2, Badge } from '@salutejs/plasma-b2c';

import { buildDefaultTheme, type Theme } from '../../themeBuilder';
import { useMemo, useState, useEffect } from 'react';
import { getGrayscale } from '../utils';
import type { ThemeData } from '../types';
import { FormField, getAccentColors, getSaturations } from '../components';

// Import design system functionality
import { useDesignSystems } from '../../hooks/useDesignSystems';
import { 
  ErrorBoundary, 
  ErrorMessage, 
  useToast, 
  ToastContainer,
  LoadingSpinner 
} from '../../components';

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

const StyledActions = styled.div`
    display: flex;
    gap: 1rem;
    justify-content: flex-end;
`;

const StyledThemeContent = styled.div`
    padding: 1rem;
    height: 100%;

    display: flex;
    flex-direction: column;
    gap: 2rem;

    margin-bottom: 0.5rem;
    border-radius: 0.5rem;
    background: #0c0c0c;
`;

const StyledThemeContentRow = styled.div`
    display: flex;
    flex-direction: row;
    gap: 3rem;
    flex: 1;
`;

const StyledThemeContentItem = styled.div`
    flex: 1;
`;

const StyledDesignSystemSection = styled.div`
    padding: 1.5rem;
    background: #1a1a1a;
    border-radius: 0.75rem;
    border: 1px solid #333;
`;

const StyledCurrentDesignSystem = styled.div`
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-bottom: 1rem;
    padding: 1rem;
    background: #2a2a2a;
    border-radius: 0.5rem;
`;

const StyledDesignSystemActions = styled.div`
    display: flex;
    gap: 1rem;
    align-items: center;
    flex-wrap: wrap;
`;

const StyledServiceName = styled(DsplL)`
    margin-top: -2rem;

    line-height: 10rem;
    letter-spacing: 1rem;
`;

interface MainProps {
    createTheme: (value: Theme) => void;
}

export const Main = (props: MainProps) => {
    const { createTheme } = props;

    const navigate = useNavigate();
    const toast = useToast();
    const designSystems = useDesignSystems();

    const [data, setData] = useState<ThemeData>({
        themeName: '',
        accentColors: getAccentColors()[11].value,
        lightSaturations: getSaturations()[7].value,
        darkSaturations: getSaturations()[7].value,
        lightGrayscale: getGrayscale()[0].value,
        darkGrayscale: getGrayscale()[0].value,
    });

    // Design system creation state
    const [showCreateDS, setShowCreateDS] = useState(false);
    const [newDSName, setNewDSName] = useState('');
    const [newDSDescription, setNewDSDescription] = useState('');
    const [selectedDSId, setSelectedDSId] = useState<number | null>(() => {
        // Initialize from persisted current design system
        return designSystems.currentDesignSystem?.id || null;
    });

    // Update selectedDSId when current design system changes (from localStorage or other pages)
    useEffect(() => {
        setSelectedDSId(designSystems.currentDesignSystem?.id || null);
    }, [designSystems.currentDesignSystem]);

    const onChangeData = (name: string) => (param: React.ChangeEvent<HTMLInputElement> | unknown) => {
        const value = (param as React.ChangeEvent<HTMLInputElement>).target?.value ?? param;

        setData((prevState) => ({
            ...prevState,
            [name]: value,
        }));
    };

    // Design system handlers
    const onSelectDesignSystem = async (value: string | number | string[]) => {
        console.log('Design system selected:', value);
        const dsId = Number(value);
        setSelectedDSId(dsId);
        
        try {
            await designSystems.loadDesignSystem(dsId);
            toast.showSuccess(`Design system loaded successfully`);
        } catch (error) {
            console.error('Error loading design system:', error);
            toast.showError('Failed to load design system');
        }
    };

    const onCreateDesignSystem = async () => {
        if (!newDSName.trim()) {
            toast.showError('Design system name is required');
            return;
        }

        try {
            const newDS = await designSystems.createDesignSystem(newDSName.trim(), newDSDescription.trim() || undefined);
            if (newDS) {
                setSelectedDSId(newDS.id);
                await designSystems.loadDesignSystem(newDS.id);
                setShowCreateDS(false);
                setNewDSName('');
                setNewDSDescription('');
                toast.showSuccess(`Design system "${newDS.name}" created successfully`);
            }
        } catch (error) {
            toast.showError('Failed to create design system');
        }
    };

    const onCancelCreateDS = () => {
        setShowCreateDS(false);
        setNewDSName('');
        setNewDSDescription('');
    };

    const accentColors = useMemo(() => getAccentColors(), []);

    const saturations = useMemo(() => getSaturations(data.accentColors), [data.accentColors]);

    const grayscale = useMemo(() => getGrayscale(), []);

    // Create design system options for select
    const designSystemOptions = useMemo(() => {
        return designSystems.designSystems.map(ds => ({
            value: ds.id.toString(),
            label: ds.name || 'No name',
        }));
    }, [designSystems.designSystems]);

    // Debug: log design system options when they change
    useEffect(() => {
        console.log('Design System Options:', designSystemOptions);
        console.log('Selected DS ID:', selectedDSId);
        console.log('Available design systems:', designSystems.designSystems);
    }, [designSystemOptions, selectedDSId, designSystems.designSystems]);

    const onGoDemo = () => {
        navigate('/demo');
    };

    const onTestAPI = () => {
        navigate('/test-api');
    };

    const onGoComponents = () => {
        if (!designSystems.currentDesignSystem) {
            toast.showError('Please select a design system first');
            return;
        }
        navigate('/components');
    };

    const onThemeSave = () => {
        const { themeName, accentColors, lightSaturations, darkSaturations, lightGrayscale, darkGrayscale } = data;

        const userConfig = {
            name: themeName,
            accentColor: {
                dark: `[general.${accentColors}.${darkSaturations}]`,
                light: `[general.${accentColors}.${lightSaturations}]`,
            },
            grayscale: {
                dark: lightGrayscale,
                light: darkGrayscale,
            },
        };

        createTheme(buildDefaultTheme(userConfig));
        navigate('/theme');
    };

    return (
        <ErrorBoundary>
            <StyledContainer>
                <StyledWrapper>
                    <StyledThemeContent>
                        {/* Design System Selection Section */}
                        <StyledDesignSystemSection>
                            <H2 style={{ margin: '0 0 1rem 0', color: '#fff' }}>Design System</H2>
                            
                            {/* Current Design System Status */}
                            {designSystems.currentDesignSystem ? (
                                <StyledCurrentDesignSystem>
                                    <Badge text="Active" size="s" style={{ backgroundColor: '#4CAF50' }} />
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontWeight: 'bold', color: '#fff' }}>
                                            {designSystems.currentDesignSystem.name}
                                        </div>
                                        {designSystems.currentDesignSystem.description && (
                                            <div style={{ fontSize: '0.875rem', color: '#aaa', marginTop: '0.25rem' }}>
                                                {designSystems.currentDesignSystem.description}
                                            </div>
                                        )}
                                        <div style={{ fontSize: '0.75rem', color: '#666', marginTop: '0.25rem' }}>
                                            {designSystems.currentDesignSystem.components?.length || 0} components
                                        </div>
                                    </div>
                                    <Button 
                                        view="secondary" 
                                        size="s" 
                                        onClick={onGoComponents}
                                        text="Manage Components"
                                    />
                                </StyledCurrentDesignSystem>
                            ) : (
                                <div style={{ 
                                    padding: '1rem', 
                                    background: '#2a2a2a', 
                                    borderRadius: '0.5rem',
                                    textAlign: 'center',
                                    color: '#aaa',
                                    marginBottom: '1rem'
                                }}>
                                    No design system selected
                                </div>
                            )}

                            {/* Design System Actions */}
                            {!showCreateDS ? (
                                <StyledDesignSystemActions>
                                    <div style={{ flex: 1, minWidth: '300px' }}>
                                        <div style={{ marginBottom: '0.5rem', color: '#fff' }}>Select Design System</div>
                                        <Select
                                            size="m"
                                            value={selectedDSId ?? undefined}
                                            items={designSystemOptions}
                                            onChange={onSelectDesignSystem}
                                            placeholder="Choose a design system..."
                                            disabled={designSystems.loading}
                                        />
                                    </div>
                                    <Button 
                                        view="accent" 
                                        onClick={() => setShowCreateDS(true)}
                                        text="Create New"
                                        disabled={designSystems.saving}
                                    />
                                </StyledDesignSystemActions>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                    <FormField label="Design System Name">
                                        <TextField 
                                            size="m" 
                                            value={newDSName} 
                                            onChange={(e) => setNewDSName(e.target.value)}
                                            placeholder="Enter design system name..."
                                        />
                                    </FormField>
                                    <FormField label="Description (Optional)">
                                        <TextField 
                                            size="m" 
                                            value={newDSDescription} 
                                            onChange={(e) => setNewDSDescription(e.target.value)}
                                            placeholder="Enter description..."
                                        />
                                    </FormField>
                                    <StyledDesignSystemActions>
                                        <Button 
                                            view="secondary" 
                                            onClick={onCancelCreateDS}
                                            text="Cancel"
                                            disabled={designSystems.saving}
                                        />
                                        <Button 
                                            view="primary" 
                                            onClick={onCreateDesignSystem}
                                            text={designSystems.saving ? "Creating..." : "Create"}
                                            disabled={designSystems.saving || !newDSName.trim()}
                                        />
                                    </StyledDesignSystemActions>
                                </div>
                            )}

                            {/* Loading indicator */}
                            {designSystems.loading && (
                                <div style={{ marginTop: '1rem' }}>
                                    <LoadingSpinner message="Loading design systems..." />
                                </div>
                            )}

                            {/* Error message */}
                            {designSystems.error && (
                                <ErrorMessage 
                                    error={designSystems.error}
                                    title="Design System Error"
                                    onDismiss={designSystems.clearError}
                                />
                            )}
                        </StyledDesignSystemSection>

                        {/* Theme Creation Section */}
                        <StyledThemeContentRow>
                            <StyledThemeContentItem>
                                <StyledServiceName>DESIGN SYSTEM BUILDER</StyledServiceName>
                                <Link href="https://plasma.sberdevices.ru/" target="_blank">
                                    by plasma team
                                </Link>
                            </StyledThemeContentItem>
                            <StyledThemeContentItem>
                                <FormField label="Название дизайн системы">
                                    <TextField size="m" value={data.themeName} onChange={onChangeData('themeName')} />
                                </FormField>
                                <FormField label="Акцентный цвет из основной палитры">
                                    <Select
                                        size="m"
                                        listMaxHeight="25"
                                        listOverflow="scroll"
                                        value={data.accentColors}
                                        items={accentColors}
                                        onChange={onChangeData('accentColors')}
                                    />
                                </FormField>
                                <FormField label="Светлость акцентного цвета для светлой темы">
                                    <Select
                                        size="m"
                                        listMaxHeight="25"
                                        listOverflow="scroll"
                                        value={data.lightSaturations}
                                        items={saturations}
                                        onChange={onChangeData('lightSaturations')}
                                    />
                                </FormField>
                                <FormField label="Светлость акцентного цвета для темной темы">
                                    <Select
                                        size="m"
                                        listMaxHeight="25"
                                        listOverflow="scroll"
                                        value={data.darkSaturations}
                                        items={saturations}
                                        onChange={onChangeData('darkSaturations')}
                                    />
                                </FormField>
                                <FormField label="Оттенок серого для светлой темы">
                                    <Select
                                        size="m"
                                        listMaxHeight="25"
                                        listOverflow="scroll"
                                        value={data.lightGrayscale}
                                        items={grayscale}
                                        onChange={onChangeData('lightGrayscale')}
                                    />
                                </FormField>
                                <FormField label="Оттенок серого для темной темы">
                                    <Select
                                        size="m"
                                        listMaxHeight="25"
                                        listOverflow="scroll"
                                        value={data.darkGrayscale}
                                        items={grayscale}
                                        onChange={onChangeData('darkGrayscale')}
                                    />
                                </FormField>
                            </StyledThemeContentItem>
                        </StyledThemeContentRow>
                    </StyledThemeContent>
                    <StyledActions>
                        <Button view="secondary" onClick={onTestAPI} text="Test API" />
                        <Button 
                            view="accent" 
                            onClick={onGoComponents} 
                            text="Components"
                            disabled={!designSystems.currentDesignSystem}
                        />
                        <Button view="accent" onClick={onGoDemo} text="Демо" />
                        <Button view="primary" onClick={onThemeSave} text="Подтвердить" />
                    </StyledActions>
                </StyledWrapper>
                <NoScroll />
                
                {/* Toast notifications */}
                <ToastContainer toasts={toast.toasts} onRemove={toast.removeToast} />
            </StyledContainer>
        </ErrorBoundary>
    );
};
