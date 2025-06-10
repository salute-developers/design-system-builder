import React from 'react';
import styled from 'styled-components';
import { Spinner, TextS, Card } from '@salutejs/plasma-b2c';

const LoadingContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  gap: 1rem;
`;

const SpinnerContainer = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
`;

const SkeletonContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  width: 100%;
`;

// Simple skeleton component
const SkeletonBar = styled.div<{ height?: string; width?: string }>`
  height: ${props => props.height || '1rem'};
  width: ${props => props.width || '100%'};
  background: linear-gradient(90deg, #333 25%, #444 50%, #333 75%);
  background-size: 200% 100%;
  animation: loading 1.5s infinite;
  border-radius: 4px;

  @keyframes loading {
    0% {
      background-position: 200% 0;
    }
    100% {
      background-position: -200% 0;
    }
  }
`;

// Generic loading spinner with optional message
interface LoadingSpinnerProps {
  message?: string;
  size?: 'small' | 'medium' | 'large';
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ 
  message = 'Loading...', 
  size = 'medium' 
}) => {
  const spinnerSize = size === 'small' ? 's' : size === 'large' ? 'l' : 'm';
  
  return (
    <LoadingContainer>
      <SpinnerContainer>
        <Spinner size={spinnerSize} />
        <TextS>{message}</TextS>
      </SpinnerContainer>
    </LoadingContainer>
  );
};

// Loading overlay for full-screen loading
interface LoadingOverlayProps {
  message?: string;
  children?: React.ReactNode;
}

export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({ 
  message = 'Loading...', 
  children 
}) => {
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      {children}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
        }}
      >
        <Card roundness={16} style={{ padding: '2rem' }}>
          <LoadingSpinner message={message} />
        </Card>
      </div>
    </div>
  );
};

// Inline loading for small actions
interface InlineLoadingProps {
  loading: boolean;
  children: React.ReactNode;
  loadingText?: string;
}

export const InlineLoading: React.FC<InlineLoadingProps> = ({ 
  loading, 
  children, 
  loadingText = 'Loading...' 
}) => {
  if (loading) {
    return (
      <SpinnerContainer>
        <Spinner size="s" />
        <TextS>{loadingText}</TextS>
      </SpinnerContainer>
    );
  }
  
  return <>{children}</>;
};

// Simple skeleton components
export const ListSkeleton: React.FC<{ count?: number }> = ({ count = 3 }) => {
  return (
    <SkeletonContainer>
      {Array.from({ length: count }, (_, index) => (
        <div key={index} style={{ marginBottom: '0.75rem' }}>
          <SkeletonBar height="1.5rem" style={{ marginBottom: '0.25rem' }} />
          <SkeletonBar height="1rem" width="70%" />
        </div>
      ))}
    </SkeletonContainer>
  );
};

export const FormSkeleton: React.FC = () => {
  return (
    <SkeletonContainer>
      <SkeletonBar height="2rem" width="40%" style={{ marginBottom: '1rem' }} />
      
      {/* Form fields */}
      {Array.from({ length: 3 }, (_, index) => (
        <div key={index} style={{ marginBottom: '1.5rem' }}>
          <SkeletonBar height="1rem" width="20%" style={{ marginBottom: '0.5rem' }} />
          <SkeletonBar height="3rem" width="100%" />
        </div>
      ))}
      
      {/* Buttons */}
      <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
        <SkeletonBar height="2.5rem" width="6rem" />
        <SkeletonBar height="2.5rem" width="6rem" />
      </div>
    </SkeletonContainer>
  );
};

// Saving indicator for form actions
interface SavingIndicatorProps {
  saving: boolean;
  saved?: boolean;
  error?: boolean;
  savingText?: string;
  savedText?: string;
  errorText?: string;
}

export const SavingIndicator: React.FC<SavingIndicatorProps> = ({
  saving,
  saved = false,
  error = false,
  savingText = 'Saving...',
  savedText = 'Saved!',
  errorText = 'Error saving'
}) => {
  if (saving) {
    return (
      <SpinnerContainer>
        <Spinner size="s" />
        <TextS style={{ color: '#888' }}>{savingText}</TextS>
      </SpinnerContainer>
    );
  }
  
  if (error) {
    return (
      <TextS style={{ color: '#ff6b6b' }}>{errorText}</TextS>
    );
  }
  
  if (saved) {
    return (
      <TextS style={{ color: '#51cf66' }}>{savedText}</TextS>
    );
  }
  
  return null;
}; 