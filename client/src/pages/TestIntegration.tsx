import React, { useState } from 'react';
import styled from 'styled-components';
import { Button, Card, TextS, DsplM, TextField } from '@salutejs/plasma-b2c';

import { useDesignSystems } from '../hooks/useDesignSystems';
import { ErrorBoundary, ErrorMessage, SuccessMessage, useToast, ToastContainer } from '../components/ErrorBoundary';
import { LoadingSpinner, InlineLoading, SavingIndicator } from '../components/Loading';
import { designSystemAPI } from '../api/designSystemApi';

const PageContainer = styled.div`
  padding: 2rem;
  max-width: 1200px;
  margin: 0 auto;
`;

const Section = styled.div`
  margin-bottom: 2rem;
`;

const SectionTitle = styled(DsplM)`
  margin-bottom: 1rem;
  color: #fff;
`;

const TestCard = styled(Card)`
  padding: 1.5rem;
  margin-bottom: 1rem;
`;

const ButtonGroup = styled.div`
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
  margin-bottom: 1rem;
`;

const StatusGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
  margin-bottom: 1rem;
`;

const StatusItem = styled.div`
  padding: 1rem;
  background: #1a1a1a;
  border-radius: 8px;
  border: 1px solid #333;
`;

export const TestIntegration: React.FC = () => {
  const designSystems = useDesignSystems();
  const toast = useToast();
  const [testResults, setTestResults] = useState<Record<string, 'success' | 'error' | 'pending'>>({});
  const [newDSName, setNewDSName] = useState('Test Design System');

  // Test functions
  const testHealthCheck = async () => {
    setTestResults(prev => ({ ...prev, health: 'pending' }));
    try {
      const response = await designSystemAPI.checkHealth();
      setTestResults(prev => ({ ...prev, health: 'success' }));
      toast.showSuccess(`Health check passed: ${response.status}`);
    } catch (error) {
      setTestResults(prev => ({ ...prev, health: 'error' }));
      toast.showError('Health check failed');
    }
  };

  const testLoadDesignSystems = async () => {
    setTestResults(prev => ({ ...prev, load: 'pending' }));
    try {
      await designSystems.loadDesignSystems();
      setTestResults(prev => ({ ...prev, load: 'success' }));
      toast.showSuccess(`Loaded ${designSystems.designSystems.length} design systems`);
    } catch (error) {
      setTestResults(prev => ({ ...prev, load: 'error' }));
      toast.showError('Failed to load design systems');
    }
  };

  const testCreateDesignSystem = async () => {
    setTestResults(prev => ({ ...prev, create: 'pending' }));
    try {
      const result = await designSystems.createDesignSystem(newDSName, 'Test description');
      if (result) {
        setTestResults(prev => ({ ...prev, create: 'success' }));
        toast.showSuccess(`Created design system: ${result.name}`);
      } else {
        setTestResults(prev => ({ ...prev, create: 'error' }));
        toast.showError('Failed to create design system');
      }
    } catch (error) {
      setTestResults(prev => ({ ...prev, create: 'error' }));
      toast.showError('Failed to create design system');
    }
  };

  const testLoadComponents = async () => {
    setTestResults(prev => ({ ...prev, components: 'pending' }));
    try {
      const components = await designSystemAPI.getAvailableComponents();
      setTestResults(prev => ({ ...prev, components: 'success' }));
      toast.showSuccess(`Loaded ${components.length} available components`);
    } catch (error) {
      setTestResults(prev => ({ ...prev, components: 'error' }));
      toast.showError('Failed to load components');
    }
  };

  const testErrorHandling = () => {
    toast.showError('This is a test error message');
  };

  const testSuccessMessage = () => {
    toast.showSuccess('This is a test success message');
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success': return '#51cf66';
      case 'error': return '#ff6b6b';
      case 'pending': return '#ffd43b';
      default: return '#666';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'success': return 'Passed';
      case 'error': return 'Failed';
      case 'pending': return 'Running...';
      default: return 'Not started';
    }
  };

  return (
    <ErrorBoundary>
      <PageContainer>
        <SectionTitle>Backend Integration Test Page</SectionTitle>
        
        {/* API Connection Status */}
        <Section>
          <TestCard roundness={16}>
            <TextS style={{ marginBottom: '1rem', fontWeight: 'bold' }}>API Connection Status</TextS>
            <StatusGrid>
              <StatusItem>
                <TextS style={{ color: '#ccc', marginBottom: '0.5rem' }}>Backend URL</TextS>
                <TextS style={{ color: '#fff', fontFamily: 'monospace' }}>
                  {import.meta.env.VITE_API_URL || 'http://localhost:3001/api'}
                </TextS>
              </StatusItem>
              <StatusItem>
                <TextS style={{ color: '#ccc', marginBottom: '0.5rem' }}>Environment</TextS>
                <TextS style={{ color: '#fff' }}>
                  {import.meta.env.MODE}
                </TextS>
              </StatusItem>
            </StatusGrid>
          </TestCard>
        </Section>

        {/* Test Results */}
        <Section>
          <TestCard roundness={16}>
            <TextS style={{ marginBottom: '1rem', fontWeight: 'bold' }}>Test Results</TextS>
            <StatusGrid>
              {Object.entries(testResults).map(([test, status]) => (
                <StatusItem key={test}>
                  <TextS style={{ color: '#ccc', marginBottom: '0.5rem' }}>
                    {test.charAt(0).toUpperCase() + test.slice(1)}
                  </TextS>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div 
                      style={{ 
                        width: '8px', 
                        height: '8px', 
                        borderRadius: '50%',
                        backgroundColor: getStatusColor(status)
                      }} 
                    />
                    <TextS style={{ color: getStatusColor(status) }}>
                      {getStatusText(status)}
                    </TextS>
                  </div>
                </StatusItem>
              ))}
            </StatusGrid>
          </TestCard>
        </Section>

        {/* API Tests */}
        <Section>
          <TestCard roundness={16}>
            <TextS style={{ marginBottom: '1rem', fontWeight: 'bold' }}>API Tests</TextS>
            <ButtonGroup>
              <InlineLoading loading={testResults.health === 'pending'} loadingText="Testing...">
                <Button onClick={testHealthCheck}>Test Health Check</Button>
              </InlineLoading>
              
              <InlineLoading loading={testResults.load === 'pending'} loadingText="Loading...">
                <Button onClick={testLoadDesignSystems}>Load Design Systems</Button>
              </InlineLoading>
              
              <InlineLoading loading={testResults.components === 'pending'} loadingText="Loading...">
                <Button onClick={testLoadComponents}>Load Components</Button>
              </InlineLoading>
            </ButtonGroup>
            
            <div style={{ marginTop: '1rem' }}>
              <TextS style={{ marginBottom: '0.5rem' }}>Create Test Design System:</TextS>
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end' }}>
                <TextField 
                  value={newDSName}
                  onChange={(e) => setNewDSName((e.target as HTMLInputElement).value)}
                  placeholder="Design System Name"
                  style={{ flex: 1 }}
                />
                <InlineLoading loading={testResults.create === 'pending'} loadingText="Creating...">
                  <Button onClick={testCreateDesignSystem}>Create</Button>
                </InlineLoading>
              </div>
            </div>
          </TestCard>
        </Section>

        {/* Design Systems Data */}
        <Section>
          <TestCard roundness={16}>
            <TextS style={{ marginBottom: '1rem', fontWeight: 'bold' }}>Current Data</TextS>
            
            {designSystems.loading && <LoadingSpinner message="Loading design systems..." />}
            
            <ErrorMessage 
              error={designSystems.error} 
              action={{
                text: 'Retry',
                onClick: designSystems.loadDesignSystems
              }}
              onDismiss={designSystems.clearError}
            />

            <div style={{ marginBottom: '1rem' }}>
              <TextS style={{ color: '#ccc', marginBottom: '0.5rem' }}>
                Design Systems ({designSystems.designSystems.length})
              </TextS>
              {designSystems.designSystems.length > 0 ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.5rem' }}>
                  {designSystems.designSystems.map(ds => (
                    <div key={ds.id} style={{ 
                      padding: '0.75rem', 
                      background: '#1a1a1a', 
                      borderRadius: '4px',
                      border: '1px solid #333'
                    }}>
                      <TextS style={{ color: '#fff', fontWeight: 'bold' }}>{ds.name}</TextS>
                      <TextS style={{ color: '#888', fontSize: '0.75rem' }}>ID: {ds.id}</TextS>
                    </div>
                  ))}
                </div>
              ) : (
                <TextS style={{ color: '#888' }}>No design systems loaded</TextS>
              )}
            </div>

            <SavingIndicator 
              saving={designSystems.saving}
              saved={false}
              error={!!designSystems.error}
            />
          </TestCard>
        </Section>

        {/* UI Component Tests */}
        <Section>
          <TestCard roundness={16}>
            <TextS style={{ marginBottom: '1rem', fontWeight: 'bold' }}>UI Component Tests</TextS>
            <ButtonGroup>
              <Button onClick={testErrorHandling}>Test Error Toast</Button>
              <Button onClick={testSuccessMessage}>Test Success Toast</Button>
            </ButtonGroup>
          </TestCard>
        </Section>

        {/* Toast Container */}
        <ToastContainer toasts={toast.toasts} onRemove={toast.removeToast} />
      </PageContainer>
    </ErrorBoundary>
  );
}; 