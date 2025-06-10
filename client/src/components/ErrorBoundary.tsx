import React, { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import styled from 'styled-components';
import { Card, Button, TextS, DsplS } from '@salutejs/plasma-b2c';

const ErrorContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  text-align: center;
  min-height: 300px;
`;

const ErrorCard = styled(Card)`
  max-width: 500px;
  padding: 2rem;
  margin: 1rem;
`;

const ErrorTitle = styled(DsplS)`
  color: #ff6b6b;
  margin-bottom: 1rem;
`;

const StyledErrorMessage = styled(TextS)`
  margin-bottom: 1.5rem;
  color: #888;
`;

const ErrorDetails = styled.details`
  margin-top: 1rem;
  text-align: left;
  
  summary {
    cursor: pointer;
    color: #888;
    margin-bottom: 0.5rem;
  }
`;

const ErrorStack = styled.pre`
  background: #222;
  padding: 1rem;
  border-radius: 4px;
  overflow-x: auto;
  font-size: 0.75rem;
  color: #ccc;
  margin-top: 0.5rem;
`;

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ error, errorInfo });
    
    // Log to console for development
    console.error('Error caught by boundary:', error, errorInfo);
    
    // Call optional error handler
    this.props.onError?.(error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI
      return (
        <ErrorContainer>
          <ErrorCard roundness={16}>
            <ErrorTitle>Something went wrong</ErrorTitle>
            <StyledErrorMessage>
              {this.state.error?.message || 'An unexpected error occurred'}
            </StyledErrorMessage>
            <Button onClick={this.handleRetry}>
              Try Again
            </Button>
            
            {this.state.error && (
              <ErrorDetails>
                <summary>Technical Details</summary>
                <ErrorStack>
                  {this.state.error.stack}
                </ErrorStack>
                {this.state.errorInfo && (
                  <ErrorStack>
                    Component Stack: {this.state.errorInfo.componentStack}
                  </ErrorStack>
                )}
              </ErrorDetails>
            )}
          </ErrorCard>
        </ErrorContainer>
      );
    }

    return this.props.children;
  }
}

// Inline error message component
interface ErrorMessageProps {
  error: string | Error | null;
  title?: string;
  action?: {
    text: string;
    onClick: () => void;
  };
  onDismiss?: () => void;
}

export const ErrorMessage: React.FC<ErrorMessageProps> = ({
  error,
  title = 'Error',
  action,
  onDismiss
}) => {
  if (!error) return null;

  const errorMessage = typeof error === 'string' ? error : error.message;

  return (
    <Card roundness={16} style={{ 
      backgroundColor: '#2d1b1b',
      border: '1px solid #ff6b6b',
      padding: '1rem',
      margin: '1rem 0'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ flex: 1 }}>
          <TextS style={{ color: '#ff6b6b', fontWeight: 'bold', marginBottom: '0.5rem' }}>
            {title}
          </TextS>
          <TextS style={{ color: '#ccc' }}>
            {errorMessage}
          </TextS>
        </div>
        
        <div style={{ display: 'flex', gap: '0.5rem', marginLeft: '1rem' }}>
          {action && (
            <Button size="s" onClick={action.onClick}>
              {action.text}
            </Button>
          )}
          {onDismiss && (
            <Button size="s" view="clear" onClick={onDismiss}>
              ✕
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
};

// Success message component
interface SuccessMessageProps {
  message: string;
  onDismiss?: () => void;
}

export const SuccessMessage: React.FC<SuccessMessageProps> = ({
  message,
  onDismiss
}) => {
  return (
    <Card roundness={16} style={{ 
      backgroundColor: '#1b2d1b',
      border: '1px solid #51cf66',
      padding: '1rem',
      margin: '1rem 0'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <TextS style={{ color: '#51cf66' }}>
          {message}
        </TextS>
        
        {onDismiss && (
          <Button size="s" view="clear" onClick={onDismiss}>
            ✕
          </Button>
        )}
      </div>
    </Card>
  );
};

// Toast notification hook
export const useToast = () => {
  const [toasts, setToasts] = React.useState<Array<{
    id: string;
    type: 'success' | 'error';
    message: string;
  }>>([]);

  const addToast = React.useCallback((type: 'success' | 'error', message: string) => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts(prev => [...prev, { id, type, message }]);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
      setToasts(prev => prev.filter(toast => toast.id !== id));
    }, 5000);
  }, []);

  const removeToast = React.useCallback((id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  }, []);

  const showSuccess = React.useCallback((message: string) => {
    addToast('success', message);
  }, [addToast]);

  const showError = React.useCallback((message: string) => {
    addToast('error', message);
  }, [addToast]);

  return {
    toasts,
    showSuccess,
    showError,
    removeToast
  };
};

// Toast container component
interface ToastContainerProps {
  toasts: Array<{
    id: string;
    type: 'success' | 'error';
    message: string;
  }>;
  onRemove: (id: string) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onRemove }) => {
  if (toasts.length === 0) return null;

  return (
    <div style={{
      position: 'fixed',
      top: '1rem',
      right: '1rem',
      zIndex: 1000,
      display: 'flex',
      flexDirection: 'column',
      gap: '0.5rem'
    }}>
      {toasts.map(toast => (
        <div key={toast.id}>
          {toast.type === 'success' ? (
            <SuccessMessage 
              message={toast.message} 
              onDismiss={() => onRemove(toast.id)}
            />
          ) : (
            <ErrorMessage 
              error={toast.message}
              title="Error"
              onDismiss={() => onRemove(toast.id)}
            />
          )}
        </div>
      ))}
    </div>
  );
}; 