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
} from '../components/panels';
import type { DesignSystem, Variation, Token, VariationValue } from '../types';

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
  const [variationSearchTerm, setVariationSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'id'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [newVariationValue, setNewVariationValue] = useState({
    componentId: '',
    variationId: '',
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

  const filterVariations = (variations: Variation[]) => {
    return variations.filter(variation =>
      variation.name.toLowerCase().includes(variationSearchTerm.toLowerCase())
    );
  };

  // Handle variation selection in the third panel
  const handleVariationSelect = (variation: Variation) => {
    setSelectedVariation(variation);
  };

  // Handle component selection in the second panel
  const handleComponentSelect = (component: any) => {
    setSelectedComponent(component);
    setSelectedVariation(null); // Reset variation when component changes
  };

  // Reset selections when design system changes
  const handleDesignSystemSelect = async (id: number) => {
    setSelectedComponent(null);
    setSelectedVariation(null);
    await handleSelect(id);
  };

  const handleAddVariationValue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDesignSystem) return;

    try {
      const response = await fetch(getApiUrl('variationValues'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newVariationValue,
          designSystemId: selectedDesignSystem.id,
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
      setNewVariationValue({
        componentId: '',
        variationId: '',
        name: '',
        description: '',
        tokenValues: [],
      });
    } catch (error) {
      console.error('Error adding variation value:', error);
      alert(error instanceof Error ? error.message : 'Failed to add variation value');
    }
  };

  const handleUpdateVariationValue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingVariationValue) return;

    try {
      const response = await fetch(getApiUrl('variationValues') + `/${editingVariationValue.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newVariationValue.name,
          description: newVariationValue.description,
          tokenValues: newVariationValue.tokenValues
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

      // Reset the form
      setEditingVariationValue(null);
      setNewVariationValue({
        componentId: '',
        variationId: '',
        name: '',
        description: '',
        tokenValues: []
      });
    } catch (error) {
      console.error('Error updating variation value:', error);
      alert(error instanceof Error ? error.message : 'Failed to update variation value');
    }
  };

  // Dialog handler functions
  const handleOpenEditVariationValueDialog = (variationValue: VariationValue) => {
    setEditingVariationValue(variationValue);
    setNewVariationValue({
      componentId: variationValue.componentId.toString(),
      variationId: variationValue.variationId.toString(),
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
      componentId: selectedComponent?.component.id.toString() || '',
      variationId: selectedVariation?.id.toString() || '',
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
      componentId: variationValue.componentId.toString(),
      variationId: variationValue.variationId.toString(),
      name: variationValue.name,
      description: variationValue.description || '',
      tokenValues: allTokenValues
    });
    setShowEditTokenValuesDialog(true);
  };

  const handleUpdateVariationValueFromDialog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingVariationValue) return;

    try {
      const response = await fetch(getApiUrl('variationValues') + `/${editingVariationValue.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newVariationValue.name,
          description: newVariationValue.description,
          tokenValues: newVariationValue.tokenValues
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
        componentId: '',
        variationId: '',
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

    try {
      const response = await fetch(getApiUrl('variationValues') + `/${editingTokenValues.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editingTokenValues.name,
          description: editingTokenValues.description,
          tokenValues: newVariationValue.tokenValues
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
        componentId: '',
        variationId: '',
        name: '',
        description: '',
        tokenValues: []
      });
    } catch (error) {
      console.error('Error updating token values:', error);
      alert(error instanceof Error ? error.message : 'Failed to update token values');
    }
  };

  return (
    <div className="flex h-screen bg-gray-100">
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
          filterComponents={filterComponents}
        />
      )}

      {/* Panel 3: Variations */}
      {selectedComponent && (
        <VariationsPanel
          selectedComponent={selectedComponent}
          selectedVariation={selectedVariation}
          selectedDesignSystem={selectedDesignSystem}
          variationSearchTerm={variationSearchTerm}
          setVariationSearchTerm={setVariationSearchTerm}
          onVariationSelect={handleVariationSelect}
          filterVariations={filterVariations}
        />
      )}

      {/* Panel 4: Variation Values */}
      {selectedVariation && selectedDesignSystem && (
        <VariationValuesPanel
          selectedVariation={selectedVariation}
          selectedDesignSystem={selectedDesignSystem}
          selectedComponent={selectedComponent}
          editingVariationValue={editingVariationValue}
          newVariationValue={newVariationValue}
          setNewVariationValue={setNewVariationValue}
          setEditingVariationValue={setEditingVariationValue}  
          onOpenEditVariationValueDialog={handleOpenEditVariationValueDialog}
          onOpenAddVariationValueDialog={handleOpenAddVariationValueDialog}
          onOpenEditTokenValuesDialog={handleOpenEditTokenValuesDialog}
          onUpdateVariationValue={handleUpdateVariationValue}
          onAddVariationValue={handleAddVariationValue}
        />
      )}

      {/* Add Components Dialog */}
      <Dialog open={showAddComponentsDialog} onOpenChange={setShowAddComponentsDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add Components to Design System</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <form onSubmit={handleAddComponent} className="space-y-4">
              <div className="flex gap-1">
                <div className="flex justify-between items-center mb-3">
                  <Label>Select Components</Label>
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
                
                {getAvailableComponentsForSelection().length === 0 ? (
                  <p className="text-sm text-gray-500 py-4">
                    All available components have been added to this design system.
                  </p>
                ) : (
                  <div className="space-y-3 max-h-48 overflow-y-auto border rounded-md p-3">
                    {getAvailableComponentsForSelection().map((component) => (
                      <div key={component.id} className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id={`component-${component.id}`}
                          checked={selectedComponentIds.includes(component.id)}
                          onChange={(e) => handleComponentToggle(component.id, e.target.checked)}
                          className="h-4 w-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
                        />
                        <Label
                          htmlFor={`component-${component.id}`}
                          className="flex-1 cursor-pointer"
                        >
                          <div className="flex gap-1">
                            <div className="font-medium">{component.name}</div>
                            {component.description && (
                              <div className="text-sm text-gray-500">{component.description}</div>
                            )}
                          </div>
                        </Label>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              
              {selectedComponentIds.length > 0 && (
                <div className="text-sm text-gray-600">
                  {selectedComponentIds.length} component(s) selected
                </div>
              )}
              
              <div className="flex gap-2">
                <Button 
                  type="submit" 
                  disabled={selectedComponentIds.length === 0}
                  onClick={() => {
                    // The form submission will handle the addition
                    // and we'll close the dialog after success
                  }}
                >
                  Add {selectedComponentIds.length > 0 ? `${selectedComponentIds.length} ` : ''}Component{selectedComponentIds.length !== 1 ? 's' : ''}
                </Button>
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
              <div>
                <Label htmlFor="dialogVariationValueName">Value Name</Label>
                <Input
                  id="dialogVariationValueName"
                  value={newVariationValue.name}
                  onChange={(e) => setNewVariationValue({ ...newVariationValue, name: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="dialogVariationValueDescription">Description</Label>
                <Textarea
                  id="dialogVariationValueDescription"
                  value={newVariationValue.description}
                  onChange={(e) => setNewVariationValue({ ...newVariationValue, description: e.target.value })}
                />
              </div>
              <div className="flex gap-2">
                <Button type="submit">{editingVariationValue ? 'Update' : 'Add'} Value</Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowEditVariationValueDialog(false);
                    setEditingVariationValue(null);
                    setNewVariationValue({
                      componentId: '',
                      variationId: '',
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Token Values</DialogTitle>
            {editingTokenValues && (
              <p className="text-sm text-gray-600">
                Editing tokens for: {editingTokenValues.name}
              </p>
            )}
          </DialogHeader>
          <div className="py-4">
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
                  // Find the current value for this token from the editingTokenValues
                  const currentTokenValue = editingTokenValues.tokenValues.find(tv => tv.tokenId === token.id);
                  const currentValue = currentTokenValue?.value || '';
                  
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
                        value={newVariationValue.tokenValues.find(tv => tv.tokenId === token.id)?.value || currentValue}
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
                        required
                      />
                    </div>
                  );
                });
              })()}
              <div className="flex gap-2">
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
                      componentId: '',
                      variationId: '',
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
    </div>
  );
};

export default Index;