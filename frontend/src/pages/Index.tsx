import { useState, useEffect } from 'react';
import { cn } from '../lib/utils';
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
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
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
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    name: '',
    description: '',
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'id'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [newVariation, setNewVariation] = useState({
    componentId: '',
    name: '',
    description: '',
    tokens: [{ name: '', type: 'color', defaultValue: '' }],
  });
  const [newVariationValue, setNewVariationValue] = useState({
    componentId: '',
    variationId: '',
    name: '',
    description: '',
    tokenValues: [] as { tokenId: number; value: string }[],
  });
  const [availableComponents, setAvailableComponents] = useState<AvailableComponent[]>([]);
  const [selectedComponentId, setSelectedComponentId] = useState<string>('');
  const [editingVariationValue, setEditingVariationValue] = useState<VariationValue | null>(null);

  useEffect(() => {
    fetchDesignSystems();
    fetchAvailableComponents();
  }, []);

  const fetchDesignSystems = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/design-systems');
      const data = await response.json();
      setDesignSystems(data);
    } catch (error) {
      console.error('Error fetching design systems:', error);
    }
  };

  const fetchAvailableComponents = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/components/available');
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
        response = await fetch(`http://localhost:3001/api/design-systems/${selectedDesignSystem.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        });
        const updatedDesignSystem = await response.json();
        setDesignSystems(designSystems.map(ds => ds.id === updatedDesignSystem.id ? updatedDesignSystem : ds));
      } else {
        response = await fetch('http://localhost:3001/api/design-systems', {
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
      await fetch(`http://localhost:3001/api/design-systems/${id}`, { method: 'DELETE' });
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
      const response = await fetch(`http://localhost:3001/api/design-systems/${id}`);
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

  const filterItems = <T extends { name: string }>(items: T[]) => {
    return items.filter(item =>
      item.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  };

  const handleAddComponent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDesignSystem || !selectedComponentId) return;

    try {
      const response = await fetch('http://localhost:3001/api/design-systems/components', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          designSystemId: selectedDesignSystem.id,
          componentId: parseInt(selectedComponentId),
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to add component to design system');
      }

      // Refresh the design system data to show the new component
      await handleSelect(selectedDesignSystem.id);
      
      // Reset the form
      setSelectedComponentId('');
    } catch (error) {
      console.error('Error adding component to design system:', error);
    }
  };

  const handleAddVariation = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch('http://localhost:3001/api/variations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newVariation),
      });
      if (!response.ok) throw new Error('Failed to add variation');
      if (selectedDesignSystem) {
        await handleSelect(selectedDesignSystem.id);
      }
      setNewVariation({
        componentId: '',
        name: '',
        description: '',
        tokens: [{ name: '', type: 'color', defaultValue: '' }],
      });
    } catch (error) {
      console.error('Error adding variation:', error);
    }
  };

  const handleAddVariationValue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDesignSystem) return;

    try {
      const response = await fetch('http://localhost:3001/api/variation-values', {
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

  const handleEditVariationValue = (variationValue: VariationValue) => {
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
  };

  const handleUpdateVariationValue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingVariationValue) return;

    try {
      const response = await fetch(`http://localhost:3001/api/variation-values/${editingVariationValue.id}`, {
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

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Design Systems Panel */}
      <div className="w-1/3 p-4 border-r border-gray-200 bg-white">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">Design Systems</h2>
          <Button onClick={handleAdd}>Add</Button>
        </div>
        <div className="mb-4">
          <Input
            placeholder="Search design systems..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="mb-2"
          />
          <div className="flex gap-2">
            <Button
              variant={sortBy === 'name' ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleSort('name')}
            >
              Sort by Name {sortBy === 'name' && (sortOrder === 'asc' ? '↑' : '↓')}
            </Button>
            <Button
              variant={sortBy === 'id' ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleSort('id')}
            >
              Sort by ID {sortBy === 'id' && (sortOrder === 'asc' ? '↑' : '↓')}
            </Button>
          </div>
        </div>
        <div className="space-y-2">
          {filterItems(sortItems(designSystems)).map((designSystem) => (
            <div
              key={designSystem.id}
              className={cn(
                'p-3 rounded cursor-pointer hover:bg-gray-50 group',
                selectedDesignSystem?.id === designSystem.id && 'bg-blue-50 border border-blue-200'
              )}
              onClick={() => handleSelect(designSystem.id)}
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <h3 className="font-medium">{designSystem.name}</h3>
                  {designSystem.description && (
                    <p className="text-sm text-gray-500">{designSystem.description}</p>
                  )}
                </div>
                <div className="flex gap-2 opacity-0 group-hover:opacity-100">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEdit(designSystem);
                    }}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(designSystem.id);
                    }}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Selected Design System Details */}
      {selectedDesignSystem && (
        <div className="flex-1 p-4 overflow-y-auto">
          <div className="max-w-4xl mx-auto">
            <h1 className="text-2xl font-bold mb-4">{selectedDesignSystem.name}</h1>
            <p className="mb-6">{selectedDesignSystem.description}</p>

            {/* Add Component Form */}
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>Add Component to Design System</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleAddComponent} className="space-y-4">
                  <div>
                    <Label htmlFor="componentSelect">Select Component</Label>
                    <Select value={selectedComponentId} onValueChange={setSelectedComponentId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a component" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableComponents.map((component) => (
                          <SelectItem key={component.id} value={component.id.toString()}>
                            {component.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button type="submit" disabled={!selectedComponentId}>
                    Add Component
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* Components List */}
            <div className="space-y-6">
              {selectedDesignSystem.components.map((designSystemComponent) => (
                <Card key={designSystemComponent.id}>
                  <CardHeader>
                    <CardTitle>{designSystemComponent.component.name}</CardTitle>
                    <p>{designSystemComponent.component.description}</p>
                  </CardHeader>
                  <CardContent>
                    {/* Add Variation Form */}
                    <form onSubmit={handleAddVariation} className="space-y-4 mb-6">
                      <div>
                        <Label htmlFor="variationName">Variation Name</Label>
                        <Input
                          id="variationName"
                          value={newVariation.name}
                          onChange={(e) => setNewVariation({ ...newVariation, name: e.target.value })}
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="variationDescription">Description</Label>
                        <Textarea
                          id="variationDescription"
                          value={newVariation.description}
                          onChange={(e) => setNewVariation({ ...newVariation, description: e.target.value })}
                        />
                      </div>
                      <Button
                        type="submit"
                        onClick={() => setNewVariation({ ...newVariation, componentId: designSystemComponent.component.id.toString() })}
                      >
                        Add Variation
                      </Button>
                    </form>

                    {/* Variations List */}
                    <div className="space-y-4">
                      {designSystemComponent.component.variations.map((variation: Variation) => (
                        <Card key={variation.id}>
                          <CardHeader>
                            <CardTitle>{variation.name}</CardTitle>
                            <p>{variation.description}</p>
                          </CardHeader>
                          <CardContent>
                            {/* Add Variation Value Form */}
                            <form onSubmit={editingVariationValue ? handleUpdateVariationValue : handleAddVariationValue} className="space-y-4">
                              <div>
                                <Label htmlFor="variationValueName">Value Name</Label>
                                <Input
                                  id="variationValueName"
                                  value={newVariationValue.name}
                                  onChange={(e) => setNewVariationValue({ ...newVariationValue, name: e.target.value })}
                                  required
                                />
                              </div>
                              <div>
                                <Label htmlFor="variationValueDescription">Description</Label>
                                <Textarea
                                  id="variationValueDescription"
                                  value={newVariationValue.description}
                                  onChange={(e) => setNewVariationValue({ ...newVariationValue, description: e.target.value })}
                                />
                              </div>
                              {variation.tokens.map((token: Token) => (
                                <div key={token.id}>
                                  <Label htmlFor={`token-${token.id}`}>{token.name}</Label>
                                  <Input
                                    id={`token-${token.id}`}
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
                                    required
                                  />
                                </div>
                              ))}
                              <div className="flex gap-2">
                                <Button 
                                  type="submit"
                                  onClick={() => {
                                    if (!editingVariationValue) {
                                      setNewVariationValue({
                                        ...newVariationValue,
                                        componentId: designSystemComponent.component.id.toString(),
                                        variationId: variation.id.toString()
                                      });
                                    }
                                  }}
                                >
                                  {editingVariationValue ? 'Update' : 'Add'} Variation Value
                                </Button>
                                {editingVariationValue && (
                                  <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => {
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
                                )}
                              </div>
                            </form>

                            {/* Variation Values List */}
                            <div className="mt-4">
                              <h4 className="font-semibold mb-2">Variation Values</h4>
                              {selectedDesignSystem.variationValues
                                .filter(vv => vv.variationId === variation.id)
                                .map((variationValue) => (
                                  <Card key={variationValue.id} className="mb-2">
                                    <CardHeader>
                                      <div className="flex justify-between items-start">
                                        <div>
                                          <CardTitle>{variationValue.name}</CardTitle>
                                          <p>{variationValue.description}</p>
                                        </div>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => handleEditVariationValue(variationValue)}
                                        >
                                          Edit
                                        </Button>
                                      </div>
                                    </CardHeader>
                                    <CardContent>
                                      <div className="space-y-2">
                                        {variationValue.tokenValues.map((tokenValue) => (
                                          <div key={tokenValue.id} className="flex items-center gap-2">
                                            <span className="font-medium">{tokenValue.token.name}:</span>
                                            <span>{tokenValue.value}</span>
                                          </div>
                                        ))}
                                      </div>
                                    </CardContent>
                                  </Card>
                                ))}
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Dialog */}
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
    </div>
  );
};

export default Index; 