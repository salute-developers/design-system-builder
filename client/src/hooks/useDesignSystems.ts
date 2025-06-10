import { useState, useEffect, useCallback } from 'react';
import { designSystemAPI, type DesignSystem, type DesignSystemDetailed } from '../api/designSystemApi';
import { DataTransformer } from '../api/transformers';

interface UseDesignSystemsState {
  designSystems: DesignSystem[];
  currentDesignSystem: DesignSystemDetailed | null;
  loading: boolean;
  saving: boolean;
  error: string | null;
}

interface UseDesignSystemsActions {
  // Design System CRUD
  loadDesignSystems: () => Promise<void>;
  loadDesignSystem: (id: number) => Promise<void>;
  createDesignSystem: (name: string, description?: string) => Promise<DesignSystem | null>;
  updateDesignSystem: (id: number, name: string, description?: string) => Promise<DesignSystem | null>;
  deleteDesignSystem: (id: number) => Promise<boolean>;
  
  // Component Management
  addComponentToDesignSystem: (designSystemId: number, componentId: number) => Promise<boolean>;
  removeComponentFromDesignSystem: (relationshipId: number) => Promise<boolean>;
  
  // State Management
  clearError: () => void;
  clearCurrentDesignSystem: () => void;
}

export interface UseDesignSystemsReturn extends UseDesignSystemsState, UseDesignSystemsActions {}

export function useDesignSystems(): UseDesignSystemsReturn {
  // Initialize state with localStorage persistence
  const [state, setState] = useState<UseDesignSystemsState>(() => {
    // Try to load current design system from localStorage on initialization
    const savedCurrentDS = localStorage.getItem('currentDesignSystem');
    const parsedDS = savedCurrentDS ? JSON.parse(savedCurrentDS) : null;
    
    if (parsedDS) {
      console.log('Restored design system from localStorage:', parsedDS.name);
    }
    
    return {
      designSystems: [],
      currentDesignSystem: parsedDS,
      loading: false,
      saving: false,
      error: null,
    };
  });

  // Track if we've already attempted restoration to prevent infinite loops
  const [restorationAttempted, setRestorationAttempted] = useState(false);

  // Helper function to update state with localStorage persistence
  const updateState = useCallback((updates: Partial<UseDesignSystemsState>) => {
    setState(prev => {
      const newState = { ...prev, ...updates };
      
      // Persist current design system to localStorage
      if ('currentDesignSystem' in updates) {
        if (updates.currentDesignSystem) {
          localStorage.setItem('currentDesignSystem', JSON.stringify(updates.currentDesignSystem));
        } else {
          localStorage.removeItem('currentDesignSystem');
        }
      }
      
      return newState;
    });
  }, []);

  // Helper function to handle errors
  const handleError = useCallback((error: unknown, action: string) => {
    const errorMessage = error instanceof Error ? error.message : `Failed to ${action}`;
    updateState({ error: errorMessage, loading: false, saving: false });
    console.error(`Design Systems Error (${action}):`, error);
  }, [updateState]);

  // Load all design systems
  const loadDesignSystems = useCallback(async () => {
    try {
      updateState({ loading: true, error: null });
      const designSystems = await designSystemAPI.getDesignSystems();
      updateState({ designSystems, loading: false });
    } catch (error) {
      handleError(error, 'load design systems');
    }
  }, [updateState, handleError]);

  // Load specific design system with details
  const loadDesignSystem = useCallback(async (id: number) => {
    try {
      updateState({ loading: true, error: null });
      const designSystem = await designSystemAPI.getDesignSystem(id);
      updateState({ currentDesignSystem: designSystem, loading: false });
    } catch (error) {
      handleError(error, 'load design system');
    }
  }, [updateState, handleError]);

  // Create new design system
  const createDesignSystem = useCallback(async (name: string, description?: string): Promise<DesignSystem | null> => {
    try {
      updateState({ saving: true, error: null });
      
      const createRequest = DataTransformer.clientDesignSystemToBackend(name, description);
      const newDesignSystem = await designSystemAPI.createDesignSystem(createRequest);
      
      // Optimistically update the list
      updateState({ 
        designSystems: [...state.designSystems, newDesignSystem],
        saving: false 
      });
      
      return newDesignSystem;
    } catch (error) {
      handleError(error, 'create design system');
      return null;
    }
  }, [state.designSystems, updateState, handleError]);

  // Update existing design system
  const updateDesignSystem = useCallback(async (id: number, name: string, description?: string): Promise<DesignSystem | null> => {
    try {
      updateState({ saving: true, error: null });
      
      const updateRequest = DataTransformer.clientDesignSystemToBackend(name, description);
      const updatedDesignSystem = await designSystemAPI.updateDesignSystem(id, updateRequest);
      
      // Update the list optimistically
      const updatedList = state.designSystems.map(ds => 
        ds.id === id ? updatedDesignSystem : ds
      );
      
      // Update current design system if it's the one being updated
      const updatedCurrent = state.currentDesignSystem?.id === id 
        ? { ...state.currentDesignSystem, ...updatedDesignSystem }
        : state.currentDesignSystem;
      
      updateState({ 
        designSystems: updatedList,
        currentDesignSystem: updatedCurrent,
        saving: false 
      });
      
      return updatedDesignSystem;
    } catch (error) {
      handleError(error, 'update design system');
      return null;
    }
  }, [state.designSystems, state.currentDesignSystem, updateState, handleError]);

  // Delete design system
  const deleteDesignSystem = useCallback(async (id: number): Promise<boolean> => {
    try {
      updateState({ saving: true, error: null });
      
      await designSystemAPI.deleteDesignSystem(id);
      
      // Remove from list optimistically
      const updatedList = state.designSystems.filter(ds => ds.id !== id);
      
      // Clear current design system if it's the one being deleted
      const updatedCurrent = state.currentDesignSystem?.id === id 
        ? null 
        : state.currentDesignSystem;
      
      updateState({ 
        designSystems: updatedList,
        currentDesignSystem: updatedCurrent,
        saving: false 
      });
      
      return true;
    } catch (error) {
      handleError(error, 'delete design system');
      return false;
    }
  }, [state.designSystems, state.currentDesignSystem, updateState, handleError]);

  // Add component to design system
  const addComponentToDesignSystem = useCallback(async (designSystemId: number, componentId: number): Promise<boolean> => {
    try {
      updateState({ saving: true, error: null });
      
      const relationship = await designSystemAPI.addComponentToDesignSystem({
        designSystemId,
        componentId
      });
      
      // Update current design system if it's loaded
      if (state.currentDesignSystem?.id === designSystemId) {
        const updatedCurrent = {
          ...state.currentDesignSystem,
          components: [...state.currentDesignSystem.components, relationship]
        };
        updateState({ currentDesignSystem: updatedCurrent, saving: false });
      } else {
        updateState({ saving: false });
      }
      
      return true;
    } catch (error) {
      handleError(error, 'add component to design system');
      return false;
    }
  }, [state.currentDesignSystem, updateState, handleError]);

  // Remove component from design system
  const removeComponentFromDesignSystem = useCallback(async (relationshipId: number): Promise<boolean> => {
    try {
      updateState({ saving: true, error: null });
      
      await designSystemAPI.removeComponentFromDesignSystem(relationshipId);
      
      // Update current design system if it's loaded
      if (state.currentDesignSystem) {
        const updatedComponents = state.currentDesignSystem.components.filter(
          comp => comp.id !== relationshipId
        );
        const updatedCurrent = {
          ...state.currentDesignSystem,
          components: updatedComponents
        };
        updateState({ currentDesignSystem: updatedCurrent, saving: false });
      } else {
        updateState({ saving: false });
      }
      
      return true;
    } catch (error) {
      handleError(error, 'remove component from design system');
      return false;
    }
  }, [state.currentDesignSystem, updateState, handleError]);

  // Clear error state
  const clearError = useCallback(() => {
    updateState({ error: null });
  }, [updateState]);

  // Clear current design system
  const clearCurrentDesignSystem = useCallback(() => {
    updateState({ currentDesignSystem: null });
    localStorage.removeItem('currentDesignSystem');
  }, [updateState]);

  // Load design systems on mount
  useEffect(() => {
    loadDesignSystems();
  }, [loadDesignSystems]);

  // Restore current design system from localStorage when design systems are loaded
  useEffect(() => {
    const restoreCurrentDesignSystem = async () => {
      // Only attempt restoration once when design systems are first loaded
      if (state.designSystems.length > 0 && state.currentDesignSystem && !state.loading && !restorationAttempted) {
        // Check if the saved design system still exists
        const savedDSId = state.currentDesignSystem.id;
        const designSystemExists = state.designSystems.some(ds => ds.id === savedDSId);
        
        if (designSystemExists) {
          try {
            // Only reload if we don't have the full details (basic vs detailed)
            // The saved design system from localStorage might not have all the detailed properties
            if (!state.currentDesignSystem.components || !state.currentDesignSystem.variationValues) {
              console.log('Reloading design system details for:', state.currentDesignSystem.name);
              await loadDesignSystem(savedDSId);
            } else {
              console.log('Design system already has full details, skipping reload');
            }
          } catch (error) {
            console.warn('Failed to restore saved design system:', error);
            // Clear invalid saved design system
            updateState({ currentDesignSystem: null });
          }
        } else {
          // Saved design system no longer exists, clear it
          console.warn('Saved design system no longer exists, clearing selection');
          updateState({ currentDesignSystem: null });
        }
        
        setRestorationAttempted(true);
      }
    };

    if (!restorationAttempted) {
      restoreCurrentDesignSystem();
    }
  }, [state.designSystems, loadDesignSystem, state.loading, restorationAttempted]);

  return {
    // State
    designSystems: state.designSystems,
    currentDesignSystem: state.currentDesignSystem,
    loading: state.loading,
    saving: state.saving,
    error: state.error,
    
    // Actions
    loadDesignSystems,
    loadDesignSystem,
    createDesignSystem,
    updateDesignSystem,
    deleteDesignSystem,
    addComponentToDesignSystem,
    removeComponentFromDesignSystem,
    clearError,
    clearCurrentDesignSystem,
  };
} 