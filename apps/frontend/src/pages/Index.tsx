import { useState, useEffect } from 'react';
import { getApiUrl } from '../config/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Label } from '../components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../components/ui/dialog';
import {
  DesignSystemsPanel,
  ComponentsPanel,
  VariationsPanel,
  VariationValuesPanel,
  InvariantsPanel,
} from '../components/panels';
import type { DesignSystem, Variation, Token, VariationValue, InvariantTokenValue } from '../types';

interface FormData {
  name: string;
  description: string;
}

interface AvailableComponent {
  id: number;
  name: string;
  description: string | null;
}

const Index = () => {
  const [designSystems, setDesignSystems] = useState<DesignSystem[]>([]);
  const [selectedDesignSystem, setSelectedDesignSystem] = useState<DesignSystem | null>(null);
  const [selectedComponent, setSelectedComponent] = useState<any>(null);
  const [selectedVariation, setSelectedVariation] = useState<Variation | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    name: '',
    description: '',
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [componentSearchTerm, setComponentSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'id'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [newVariationValue, setNewVariationValue] = useState({
    componentId: -1,
    variationId: -1,
    name: '',
    description: '',
    tokenValues: [] as { tokenId: number; value: string }[],
  });
  const [availableComponents, setAvailableComponents] = useState<AvailableComponent[]>([]);
  const [selectedComponentIds, setSelectedComponentIds] = useState<number[]>([]);
  const [showAddComponentsDialog, setShowAddComponentsDialog] = useState(false);
  const [editingVariationValue, setEditingVariationValue] = useState<VariationValue | null>(null);
  const [showEditVariationValueDialog, setShowEditVariationValueDialog] = useState(false);
  const [showEditTokenValuesDialog, setShowEditTokenValuesDialog] = useState(false);
  const [editingTokenValues, setEditingTokenValues] = useState<VariationValue | null>(null);
  const [showInvariants, setShowInvariants] = useState(false);
  const [invariantTokenValues, setInvariantTokenValues] = useState<InvariantTokenValue[]>([]);
  const [showEditInvariantsDialog, setShowEditInvariantsDialog] = useState(false);
  const [editingInvariantTokenValues, setEditingInvariantTokenValues] = useState<{ tokenId: number; value: string }[]>([]);
  const [newVariationValueIsDefault, setNewVariationValueIsDefault] = useState(false);

  useEffect(() => {
    fetchDesignSystems();
    fetchAvailableComponents();
  }, []);

  const fetchDesignSystems = async () => {
    try {
      const response = await fetch(getApiUrl('designSystems'));
      const data = await response.json();
      setDesignSystems(data);
    } catch (error) {
      console.error('Error fetching design systems:', error);
    }
  };

  const fetchAvailableComponents = async () => {
    try {
      const response = await fetch(getApiUrl('components') + '/available');
      const data = await response.json();
      setAvailableComponents(data);
    } catch (error) {
      console.error('Error fetching available components:', error);
    }
  };

  const fetchInvariantTokenValues = async (componentId: number) => {
    if (!selectedDesignSystem) {
      setInvariantTokenValues([]);
      return;
    }
    
    try {
      const response = await fetch(getApiUrl('components') + `/${componentId}/invariants?designSystemId=${selectedDesignSystem.id}`);
      if (response.ok) {
        const data = await response.json();
        setInvariantTokenValues(data);
      } else {
        setInvariantTokenValues([]);
      }
    } catch (error) {
      console.error('Error fetching invariant token values:', error);
      setInvariantTokenValues([]);
    }
  };

  const handleAdd = () => {
    setIsEditMode(false);
    setFormData({
      name: '',
      description: '',
    });
    setIsDialogOpen(true);
  };

  const handleEdit = (designSystem: DesignSystem) => {
    setIsEditMode(true);
    setFormData({
      name: designSystem.name,
      description: designSystem.description || '',
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = async () => {
    try {
      let response;
      if (isEditMode && selectedDesignSystem) {
        response = await fetch(getApiUrl('designSystems') + `/${selectedDesignSystem.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        });
        const updatedDesignSystem = await response.json();
        setDesignSystems(designSystems.map(ds => ds.id === updatedDesignSystem.id ? updatedDesignSystem : ds));
      } else {
        response = await fetch(getApiUrl('designSystems'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        });
        const newDesignSystem = await response.json();
        setDesignSystems([...designSystems, newDesignSystem]);
      }
      setIsDialogOpen(false);
      setIsEditMode(false);
      setSelectedDesignSystem(null);
    } catch (error) {
      console.error('Error saving design system:', error);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this design system?')) return;

    try {
      await fetch(getApiUrl('designSystems') + `/${id}`, { method: 'DELETE' });
      setDesignSystems(designSystems.filter(ds => ds.id !== id));
      if (selectedDesignSystem?.id === id) {
        setSelectedDesignSystem(null);
      }
    } catch (error) {
      console.error('Error deleting design system:', error);
    }
  };

  const handleSelect = async (id: number) => {
    try {
      const response = await fetch(getApiUrl('designSystems') + `/${id}`);
      const designSystem: DesignSystem = await response.json();
      setSelectedDesignSystem(designSystem);
    } catch (error) {
      console.error('Error fetching design system:', error);
    }
  };

  const handleSort = (type: 'name' | 'id') => {
    if (sortBy === type) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(type);
      setSortOrder('asc');
    }
  };

  const sortItems = <T extends DesignSystem>(items: T[]) => {
    return [...items].sort((a, b) => {
      if (sortBy === 'name') {
        return sortOrder === 'asc'
          ? a.name.localeCompare(b.name)
          : b.name.localeCompare(a.name);
      }
      return sortOrder === 'asc' ? a.id - b.id : b.id - a.id;
    });
  };

  const handleAddComponent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDesignSystem || selectedComponentIds.length === 0) return;

    try {
      // Add components one by one (could be optimized with a batch endpoint later)
      const promises = selectedComponentIds.map(componentId =>
        fetch(getApiUrl('designSystems') + '/components', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            designSystemId: selectedDesignSystem.id,
            componentId: componentId,
          }),
        })
      );

      const responses = await Promise.all(promises);
      
      // Check if any failed
      const failedResponses = responses.filter(response => !response.ok);
      if (failedResponses.length > 0) {
        throw new Error(`Failed to add ${failedResponses.length} component(s) to design system`);
      }

      // Refresh the design system data to show the new components
      await handleSelect(selectedDesignSystem.id);
      
      // Reset the form and close dialog
      setSelectedComponentIds([]);
      setShowAddComponentsDialog(false);
    } catch (error) {
      console.error('Error adding components to design system:', error);
    }
  };

  // Helper function to get components not already in the design system
  const getAvailableComponentsForSelection = () => {
    if (!selectedDesignSystem) return availableComponents;
    
    const existingComponentIds = selectedDesignSystem.components.map(
      dsComponent => dsComponent.component.id
    );
    
    return availableComponents.filter(
      component => !existingComponentIds.includes(component.id)
    );
  };

  // Handle individual component selection
  const handleComponentToggle = (componentId: number, checked: boolean) => {
    if (checked) {
      setSelectedComponentIds([...selectedComponentIds, componentId]);
    } else {
      setSelectedComponentIds(selectedComponentIds.filter(id => id !== componentId));
    }
  };

  // Handle select all components
  const handleSelectAllComponents = () => {
    const availableForSelection = getAvailableComponentsForSelection();
    setSelectedComponentIds(availableForSelection.map(component => component.id));
  };

  // Handle deselect all components
  const handleDeselectAllComponents = () => {
    setSelectedComponentIds([]);
  };

  // Helper functions for four-panel filtering
  const filterDesignSystems = (items: DesignSystem[]) => {
    return items.filter(item =>
      item.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  };

  const filterComponents = (components: any[]) => {
    return components.filter((component: any) =>
      component.component.name.toLowerCase().includes(componentSearchTerm.toLowerCase())
    );
  };

  // Handle variation selection in the third panel
  const handleVariationSelect = (variation: Variation) => {
    setSelectedVariation(variation);
    setShowInvariants(false); // Reset invariants view when variation is selected
  };

  // Handle component selection in the second panel
  const handleComponentSelect = (component: any) => {
    setSelectedComponent(component);
    setSelectedVariation(null); // Reset variation when component changes
    setShowInvariants(false); // Reset invariants view when component changes
  };

  // Handle invariants selection
  const handleInvariantsSelect = () => {
    setShowInvariants(true);
    setSelectedVariation(null); // Clear variation selection
    if (selectedComponent) {
      fetchInvariantTokenValues(selectedComponent.component.id);
    }
  };

  // Reset selections when design system changes
  const handleDesignSystemSelect = async (id: number) => {
    setSelectedComponent(null);
    setSelectedVariation(null);
    setShowInvariants(false);
    setInvariantTokenValues([]);
    await handleSelect(id);
  };

  const handleAddVariationValue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDesignSystem) return;
    
    // Validate that we have valid IDs
    if (newVariationValue.componentId <= 0 || newVariationValue.variationId <= 0) {
      alert('Please select a valid component and variation');
      return;
    }

    try {
      const response = await fetch(getApiUrl('variationValues'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newVariationValue,
          designSystemId: selectedDesignSystem.id,
          isDefaultValue: newVariationValueIsDefault,
          tokenValues: newVariationValue.tokenValues.filter(tv => tv.value.trim() !== '')
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        if (errorData.missingFields) {
          throw new Error(`Missing required fields: ${errorData.missingFields.join(', ')}`);
        }
        throw new Error('Failed to add variation value');
      }
      
      await handleSelect(selectedDesignSystem.id);
      
      // Close dialog and reset form
      setShowEditVariationValueDialog(false);
      setEditingVariationValue(null);
      setNewVariationValueIsDefault(false);
      setNewVariationValue({
        componentId: -1,
        variationId: -1,
        name: '',
        description: '',
        tokenValues: [],
      });
    } catch (error) {
      console.error('Error adding variation value:', error);
      alert(error instanceof Error ? error.message : 'Failed to add variation value');
    }
  };

  // Dialog handler functions
  const handleOpenEditVariationValueDialog = (variationValue: VariationValue) => {
    setEditingVariationValue(variationValue);
          setNewVariationValue({
        componentId: variationValue.componentId,
        variationId: variationValue.variationId,
        name: variationValue.name,
        description: variationValue.description || '',
        tokenValues: variationValue.tokenValues.map(tv => ({
          tokenId: tv.tokenId,
          value: tv.value
        }))
      });
    setShowEditVariationValueDialog(true);
  };

  const handleOpenAddVariationValueDialog = () => {
    setEditingVariationValue(null);
    
    // Get all tokens connected to the current variation and initialize with empty values
    const availableTokens = selectedVariation?.tokens || 
      (selectedVariation?.tokenVariations?.map(tv => tv.token).filter(Boolean) as Token[]) || [];
    
    const emptyTokenValues = availableTokens.map(token => ({
      tokenId: token.id,
      value: ''
    }));
    
    setNewVariationValue({
      componentId: selectedComponent?.component.id || -1,
      variationId: selectedVariation?.id || -1,
      name: '',
      description: '',
      tokenValues: emptyTokenValues
    });
    setShowEditVariationValueDialog(true);
  };

  const handleOpenEditTokenValuesDialog = (variationValue: VariationValue) => {
    setEditingTokenValues(variationValue);
    
    // Get all tokens connected to the current variation
    const availableTokens = selectedVariation?.tokens || 
      (selectedVariation?.tokenVariations?.map(tv => tv.token).filter(Boolean) as Token[]) || [];
    
    // Create token values array including current values and placeholders for tokens without values
    const allTokenValues = availableTokens.map(token => {
      const existingValue = variationValue.tokenValues.find(tv => tv.tokenId === token.id);
      return {
        tokenId: token.id,
        value: existingValue?.value || ''
      };
    });
    
    setNewVariationValue({
      componentId: variationValue.componentId,
      variationId: variationValue.variationId,
      name: variationValue.name,
      description: variationValue.description || '',
      tokenValues: allTokenValues
    });
    setShowEditTokenValuesDialog(true);
  };

  const handleUpdateVariationValueFromDialog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingVariationValue) return;
    
    // Validate that we have valid IDs
    if (newVariationValue.componentId <= 0 || newVariationValue.variationId <= 0) {
      alert('Please select a valid component and variation');
      return;
    }

    try {
      const response = await fetch(getApiUrl('variationValues') + `/${editingVariationValue.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newVariationValue.name,
          description: newVariationValue.description,
          tokenValues: newVariationValue.tokenValues.filter(tv => tv.value.trim() !== '')
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        if (errorData.missingFields) {
          throw new Error(`Missing required fields: ${errorData.missingFields.join(', ')}`);
        }
        throw new Error('Failed to update variation value');
      }

      // Refresh the design system data
      if (selectedDesignSystem) {
        await handleSelect(selectedDesignSystem.id);
      }

      // Close dialog and reset form
      setShowEditVariationValueDialog(false);
      setEditingVariationValue(null);
      setNewVariationValue({
        componentId: -1,
        variationId: -1,
        name: '',
        description: '',
        tokenValues: []
      });
    } catch (error) {
      console.error('Error updating variation value:', error);
      alert(error instanceof Error ? error.message : 'Failed to update variation value');
    }
  };

  const handleUpdateTokenValuesFromDialog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTokenValues) return;
    
    // Validate that we have valid IDs
    if (newVariationValue.componentId <= 0 || newVariationValue.variationId <= 0) {
      alert('Please select a valid component and variation');
      return;
    }

    try {
      const response = await fetch(getApiUrl('variationValues') + `/${editingTokenValues.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editingTokenValues.name,
          description: editingTokenValues.description,
          tokenValues: newVariationValue.tokenValues.filter(tv => tv.value.trim() !== '')
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        if (errorData.missingFields) {
          throw new Error(`Missing required fields: ${errorData.missingFields.join(', ')}`);
        }
        throw new Error('Failed to update token values');
      }

      // Refresh the design system data
      if (selectedDesignSystem) {
        await handleSelect(selectedDesignSystem.id);
      }

      // Close dialog and reset form
      setShowEditTokenValuesDialog(false);
      setEditingTokenValues(null);
      setNewVariationValue({
        componentId: -1,
        variationId: -1,
        name: '',
        description: '',
        tokenValues: []
      });
    } catch (error) {
      console.error('Error updating token values:', error);
      alert(error instanceof Error ? error.message : 'Failed to update token values');
    }
  };

  const handleDeleteVariationValue = async (variationValue: VariationValue) => {
    if (!confirm(`Are you sure you want to delete the variation value "${variationValue.name}"?`)) {
      return;
    }

    try {
      const response = await fetch(getApiUrl('variationValues') + `/${variationValue.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete variation value');
      }

      // Refresh the design system data
      if (selectedDesignSystem) {
        await handleSelect(selectedDesignSystem.id);
      }
    } catch (error) {
      console.error('Error deleting variation value:', error);
      alert(error instanceof Error ? error.message : 'Failed to delete variation value');
    }
  };

  const handleRemoveComponent = async (designSystemComponent: any) => {
    if (!confirm(`Are you sure you want to remove "${designSystemComponent.component.name}" from this design system?`)) {
      return;
    }

    try {
      const response = await fetch(getApiUrl('designSystems') + `/components/${designSystemComponent.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to remove component from design system');
      }

      // If the removed component was selected, clear the selection
      if (selectedComponent?.id === designSystemComponent.id) {
        setSelectedComponent(null);
        setSelectedVariation(null);
        setShowInvariants(false);
        setInvariantTokenValues([]);
      }

      // Refresh the design system data
      if (selectedDesignSystem) {
        await handleSelect(selectedDesignSystem.id);
      }
    } catch (error) {
      console.error('Error removing component from design system:', error);
      alert(error instanceof Error ? error.message : 'Failed to remove component from design system');
    }
  };

  // Handle opening edit invariants dialog
  const handleOpenEditInvariantsDialog = () => {
    if (!selectedComponent) return;
    
    // Get only unassigned tokens (tokens not assigned to any variation)
    const componentTokens = selectedComponent.component.tokens || [];
    const unassignedTokens = componentTokens.filter((token: Token) => {
      // Check if token is assigned to any variation
      return !selectedComponent.component.variations?.some((variation: any) =>
        variation.tokenVariations?.some((tv: any) => tv.token.id === token.id)
      );
    });
    
    // Initialize with existing invariant values or empty values
    const tokenValues = unassignedTokens.map((token: Token) => {
      const existingValue = invariantTokenValues.find(tv => tv.tokenId === token.id);
      return {
        tokenId: token.id,
        value: existingValue?.value || ''
      };
    });
    
    setEditingInvariantTokenValues(tokenValues);
    setShowEditInvariantsDialog(true);
  };

  // Handle updating invariant token values
  const handleUpdateInvariantTokenValues = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedComponent || !selectedDesignSystem) return;

    try {
      const response = await fetch(getApiUrl('components') + `/${selectedComponent.component.id}/invariants?designSystemId=${selectedDesignSystem.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tokenValues: editingInvariantTokenValues.filter(tv => tv.value.trim() !== '')
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update invariant token values');
      }

      // Refresh the invariant token values
      await fetchInvariantTokenValues(selectedComponent.component.id);
      
      // Close dialog and reset form
      setShowEditInvariantsDialog(false);
      setEditingInvariantTokenValues([]);
    } catch (error) {
      console.error('Error updating invariant token values:', error);
      alert(error instanceof Error ? error.message : 'Failed to update invariant token values');
    }
  };

  // Handle deleting invariant token value
  const handleDeleteInvariantTokenValue = async (tokenValueId: number) => {
    if (!selectedComponent || !selectedDesignSystem) return;

    try {
      const response = await fetch(getApiUrl('components') + `/${selectedComponent.component.id}/invariants/${tokenValueId}?designSystemId=${selectedDesignSystem.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete invariant token value');
      }

      // Refresh the invariant token values
      await fetchInvariantTokenValues(selectedComponent.component.id);
    } catch (error) {
      console.error('Error deleting invariant token value:', error);
      alert(error instanceof Error ? error.message : 'Failed to delete invariant token value');
    }
  };

  // Handle setting default variation value
  const handleSetDefaultVariationValue = async (variationValue: VariationValue) => {
    if (!selectedDesignSystem) return;

    try {
      const response = await fetch(getApiUrl('variationValues') + `/${variationValue.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: variationValue.name,
          description: variationValue.description,
          isDefaultValue: true,
          tokenValues: variationValue.tokenValues.map(tv => ({
            tokenId: tv.tokenId,
            value: tv.value
          }))
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to set default variation value');
      }

      // Refresh the design system data
      await handleSelect(selectedDesignSystem.id);
    } catch (error) {
      console.error('Error setting default variation value:', error);
      alert(error instanceof Error ? error.message : 'Failed to set default variation value');
    }
  };

  return (
    <div className="flex h-screen bg-gray-100 overflow-y-hidden">
      {/* Panel 1: Design Systems */}
      <DesignSystemsPanel
        designSystems={designSystems}
        selectedDesignSystem={selectedDesignSystem}
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        sortBy={sortBy}
        sortOrder={sortOrder}
        onAdd={handleAdd}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onSelect={handleDesignSystemSelect}
        onSort={handleSort}
        filterDesignSystems={filterDesignSystems}
        sortItems={sortItems}
      />

      {/* Panel 2: Components */}
      {selectedDesignSystem && (
        <ComponentsPanel
          selectedDesignSystem={selectedDesignSystem}
          selectedComponent={selectedComponent}
          componentSearchTerm={componentSearchTerm}
          setComponentSearchTerm={setComponentSearchTerm}
          onShowAddComponentsDialog={() => setShowAddComponentsDialog(true)}
          onComponentSelect={handleComponentSelect}
          onRemoveComponent={handleRemoveComponent}
          filterComponents={filterComponents}
        />
      )}

      {/* Panel 3: Variations */}
      {selectedComponent && (
        <VariationsPanel
          selectedComponent={selectedComponent}
          selectedVariation={selectedVariation}
          selectedDesignSystem={selectedDesignSystem}
          onVariationSelect={handleVariationSelect}
          onInvariantsSelect={handleInvariantsSelect}
          showInvariants={showInvariants}
        />
      )}

      {/* Panel 4: Variation Values or Invariants */}
      {selectedVariation && selectedDesignSystem && !showInvariants && (
        <VariationValuesPanel
          selectedVariation={selectedVariation}
          selectedDesignSystem={selectedDesignSystem}
          onOpenEditVariationValueDialog={handleOpenEditVariationValueDialog}
          onOpenAddVariationValueDialog={handleOpenAddVariationValueDialog}
          onOpenEditTokenValuesDialog={handleOpenEditTokenValuesDialog}
          onDeleteVariationValue={handleDeleteVariationValue}
          onSetDefaultVariationValue={handleSetDefaultVariationValue}
        />
      )}
      
      {/* Panel 4: Invariants */}
      {showInvariants && selectedComponent && (
        <InvariantsPanel
          selectedComponent={selectedComponent.component}
          invariantTokenValues={invariantTokenValues}
          onOpenEditInvariantsDialog={handleOpenEditInvariantsDialog}
          onDeleteInvariantTokenValue={handleDeleteInvariantTokenValue}
        />
      )}

      {/* Add Components Dialog */}
      <Dialog open={showAddComponentsDialog} onOpenChange={setShowAddComponentsDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add Components to Design System</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <form onSubmit={handleAddComponent} className="space-y-6">
              {/* Header with Select/Deselect buttons */}
              <div className="flex justify-between items-center">
                <Label className="text-base font-medium">Select Components</Label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleSelectAllComponents}
                    disabled={getAvailableComponentsForSelection().length === 0}
                  >
                    Select All
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleDeselectAllComponents}
                    disabled={selectedComponentIds.length === 0}
                  >
                    Deselect All
                  </Button>
                </div>
              </div>
              
              {/* Component list or empty state */}
              <div className="min-h-[200px]">
                {getAvailableComponentsForSelection().length === 0 ? (
                  <div className="flex items-center justify-center h-[200px] text-center">
                    <div>
                      <div className="text-gray-400 mb-2">
                        <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                      <p className="text-gray-500 font-medium">All components added</p>
                      <p className="text-sm text-gray-400 mt-1">
                        All available components have been added to this design system.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="border rounded-lg p-4 bg-gray-50 max-h-[300px] overflow-y-auto">
                    <div className="space-y-3">
                      {getAvailableComponentsForSelection().map((component) => (
                        <div 
                          key={component.id} 
                          className="flex items-start space-x-3 p-3 bg-white rounded-md border border-gray-200 hover:border-gray-300 transition-colors"
                        >
                          <input
                            type="checkbox"
                            id={`component-${component.id}`}
                            checked={selectedComponentIds.includes(component.id)}
                            onChange={(e) => handleComponentToggle(component.id, e.target.checked)}
                            className="mt-1 h-4 w-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
                          />
                          <Label
                            htmlFor={`component-${component.id}`}
                            className="flex-1 cursor-pointer"
                          >
                            <div className="space-y-1">
                              <div className="font-medium text-gray-900">{component.name}</div>
                              {component.description && (
                                <div className="text-sm text-gray-500">{component.description}</div>
                              )}
                            </div>
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              
              {/* Selection summary */}
              {selectedComponentIds.length > 0 && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <svg className="w-5 h-5 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="ml-3">
                      <p className="text-sm font-medium text-blue-800">
                        {selectedComponentIds.length} component{selectedComponentIds.length !== 1 ? 's' : ''} selected
                      </p>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Action buttons */}
              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowAddComponentsDialog(false);
                    setSelectedComponentIds([]);
                  }}
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={selectedComponentIds.length === 0}
                  className="min-w-[120px]"
                >
                  Add {selectedComponentIds.length > 0 ? `${selectedComponentIds.length} ` : ''}Component{selectedComponentIds.length !== 1 ? 's' : ''}
                </Button>
              </div>
            </form>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add/Edit Design System Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {isEditMode ? 'Edit' : 'Add New'} Design System
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Name</label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Enter name"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Description</label>
              <Input
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Enter description"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setIsDialogOpen(false);
              setIsEditMode(false);
              setSelectedDesignSystem(null);
            }}>
              Cancel
            </Button>
            <Button onClick={handleSubmit}>{isEditMode ? 'Save' : 'Create'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit/Add Variation Value Dialog */}
      <Dialog open={showEditVariationValueDialog} onOpenChange={setShowEditVariationValueDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingVariationValue ? 'Edit' : 'Add'} Variation Value</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <form onSubmit={editingVariationValue ? handleUpdateVariationValueFromDialog : handleAddVariationValue} className="space-y-4">
              {(newVariationValue.componentId <= 0 || newVariationValue.variationId <= 0) && (
                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                  <p className="text-sm text-yellow-800">
                    ⚠️ Please select a component and variation first
                  </p>
                </div>
              )}
              <div>
                <Label htmlFor="dialogVariationValueName">Value Name</Label>
                <Input
                  id="dialogVariationValueName"
                  value={newVariationValue.name}
                  onChange={(e) => setNewVariationValue({ ...newVariationValue, name: e.target.value })}
                  required
                />
                {!newVariationValue.name.trim() && (
                  <p className="text-sm text-red-500 mt-1">Name is required</p>
                )}
              </div>
              <div>
                <Label htmlFor="dialogVariationValueDescription">Description</Label>
                <Textarea
                  id="dialogVariationValueDescription"
                  value={newVariationValue.description}
                  onChange={(e) => setNewVariationValue({ ...newVariationValue, description: e.target.value })}
                />
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="dialogVariationValueIsDefault"
                  checked={newVariationValueIsDefault}
                  onChange={(e) => setNewVariationValueIsDefault(e.target.checked)}
                  className="h-4 w-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
                />
                <Label htmlFor="dialogVariationValueIsDefault" className="text-sm font-medium">
                  Set as default variation value
                </Label>
              </div>
              <div className="flex gap-2">
                <Button 
                  type="submit" 
                  disabled={newVariationValue.componentId <= 0 || newVariationValue.variationId <= 0 || !newVariationValue.name.trim()}
                >
                  {editingVariationValue ? 'Update' : 'Add'} Value
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowEditVariationValueDialog(false);
                    setEditingVariationValue(null);
                    setNewVariationValueIsDefault(false);
                    setNewVariationValue({
                      componentId: -1,
                      variationId: -1,
                      name: '',
                      description: '',
                      tokenValues: []
                    });
                  }}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Token Values Dialog */}
      <Dialog open={showEditTokenValuesDialog} onOpenChange={setShowEditTokenValuesDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Edit Token Values</DialogTitle>
            {editingTokenValues && (
              <p className="text-sm text-gray-600">
                Editing tokens for: {editingTokenValues.name}
              </p>
            )}
          </DialogHeader>
          <div className="py-4 overflow-y-auto flex-1">
            <form onSubmit={handleUpdateTokenValuesFromDialog} className="space-y-4">
              {selectedVariation && editingTokenValues && (() => {
                // Get tokens from the selected variation
                const availableTokens = selectedVariation.tokens || 
                  (selectedVariation.tokenVariations?.map(tv => tv.token).filter(Boolean) as Token[]) || [];
                
                if (availableTokens.length === 0) {
                  return (
                    <div className="text-sm text-gray-500 py-4">
                      No tokens are connected to this variation.
                    </div>
                  );
                }
                
                return availableTokens.map((token: Token) => {                  
                  return (
                    <div key={token.id} className="space-y-2">
                      <Label htmlFor={`dialog-token-${token.id}`}>
                        <div className="flex flex-col">
                          <span className="font-medium">{token.name}</span>
                          {token.description && (
                            <span className="text-xs text-gray-500">{token.description}</span>
                          )}
                          {token.defaultValue && (
                            <span className="text-xs text-gray-400">Default: {token.defaultValue}</span>
                          )}
                        </div>
                      </Label>
                      <Input
                        id={`dialog-token-${token.id}`}
                        value={newVariationValue.tokenValues.find(tv => tv.tokenId === token.id)?.value || ''}
                        onChange={(e) => {
                          const tokenValues = [...newVariationValue.tokenValues];
                          const existingIndex = tokenValues.findIndex(tv => tv.tokenId === token.id);
                          if (existingIndex >= 0) {
                            tokenValues[existingIndex] = { tokenId: token.id, value: e.target.value };
                          } else {
                            tokenValues.push({ tokenId: token.id, value: e.target.value });
                          }
                          setNewVariationValue({ ...newVariationValue, tokenValues });
                        }}
                        placeholder={token.defaultValue || `Enter ${token.name} value`}
                      />
                    </div>
                  );
                });
              })()}
              <div className="flex gap-2 pt-4">
                <Button type="submit" disabled={!selectedVariation || !editingTokenValues}>
                  Update Token Values
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowEditTokenValuesDialog(false);
                    setEditingTokenValues(null);
                    setNewVariationValue({
                      componentId: -1,
                      variationId: -1,
                      name: '',
                      description: '',
                      tokenValues: []
                    });
                  }}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Invariants Dialog */}
      <Dialog open={showEditInvariantsDialog} onOpenChange={setShowEditInvariantsDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Edit Invariant Token Values</DialogTitle>
            <p className="text-sm text-gray-600">
              Set invariant values for unassigned tokens. These values apply to the entire component and are not part of any variation.
            </p>
          </DialogHeader>
          <div className="py-4 overflow-y-auto flex-1">
            <form onSubmit={handleUpdateInvariantTokenValues} className="space-y-4">
              {selectedComponent && (() => {
                // Get only unassigned tokens (tokens not assigned to any variation)
                const componentTokens = selectedComponent.component.tokens || [];
                const unassignedTokens = componentTokens.filter((token: Token) => {
                  // Check if token is assigned to any variation
                  return !selectedComponent.component.variations?.some((variation: any) =>
                    variation.tokenVariations?.some((tv: any) => tv.token.id === token.id)
                  );
                });
                
                if (unassignedTokens.length === 0) {
                  return (
                    <div className="text-sm text-gray-500 py-4">
                      No tokens are available for invariants. All tokens are assigned to variations.
                    </div>
                  );
                }
                
                return unassignedTokens.map((token: Token) => {                  
                  return (
                    <div key={token.id} className="space-y-2">
                      <Label htmlFor={`invariant-token-${token.id}`}>
                        <div className="flex flex-col">
                          <span className="font-medium">{token.name}</span>
                          {token.description && (
                            <span className="text-xs text-gray-500">{token.description}</span>
                          )}
                          {token.defaultValue && (
                            <span className="text-xs text-gray-400">Default: {token.defaultValue}</span>
                          )}
                        </div>
                      </Label>
                      <Input
                        id={`invariant-token-${token.id}`}
                        value={editingInvariantTokenValues.find(tv => tv.tokenId === token.id)?.value || ''}
                        onChange={(e) => {
                          const tokenValues = [...editingInvariantTokenValues];
                          const existingIndex = tokenValues.findIndex(tv => tv.tokenId === token.id);
                          if (existingIndex >= 0) {
                            tokenValues[existingIndex] = { tokenId: token.id, value: e.target.value };
                          } else {
                            tokenValues.push({ tokenId: token.id, value: e.target.value });
                          }
                          setEditingInvariantTokenValues(tokenValues);
                        }}
                        placeholder={token.defaultValue || `Enter ${token.name} value`}
                      />
                    </div>
                  );
                });
              })()}
              <div className="flex gap-2 pt-4">
                <Button type="submit" disabled={!selectedComponent}>
                  Save Invariant Values
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowEditInvariantsDialog(false);
                    setEditingInvariantTokenValues([]);
                  }}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Index;