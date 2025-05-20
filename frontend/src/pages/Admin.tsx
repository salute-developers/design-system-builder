import React, { useState, useEffect } from 'react';
import { cn } from '../lib/utils';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../components/ui/dialog';

interface Component {
  id: number;
  name: string;
  description: string | null;
  designSystemId: number;
}

interface Variation {
  id: number;
  name: string;
  description: string | null;
  componentId: number;
}

interface Token {
  id: number;
  name: string;
  type: string;
  defaultValue: string | null;
  designSystemId: number;
  value?: string;
}

interface FormData {
  name: string;
  description: string;
  type?: string;
  defaultValue?: string;
  tokenId?: number;
  value?: string;
}

const Admin = () => {
  const [components, setComponents] = useState<Component[]>([]);
  const [variations, setVariations] = useState<Variation[]>([]);
  const [tokens, setTokens] = useState<Token[]>([]);
  const [selectedComponent, setSelectedComponent] = useState<Component | null>(null);
  const [selectedVariation, setSelectedVariation] = useState<Variation | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [dialogType, setDialogType] = useState<'component' | 'variation' | 'token'>('component');
  const [formData, setFormData] = useState<FormData>({
    name: '',
    description: '',
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'id'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  useEffect(() => {
    fetchComponents();
  }, []);

  useEffect(() => {
    if (selectedComponent) {
      fetchVariations(selectedComponent.id);
    } else {
      setVariations([]);
      setSelectedVariation(null);
    }
  }, [selectedComponent]);

  useEffect(() => {
    if (selectedVariation) {
      fetchTokens(selectedVariation.id);
    } else {
      setTokens([]);
    }
  }, [selectedVariation]);

  const fetchComponents = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/components');
      const data = await response.json();
      setComponents(data);
    } catch (error) {
      console.error('Error fetching components:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchTokens = async (variationId: number) => {
    try {
      const response = await fetch(`http://localhost:3001/api/variations/${variationId}/tokens`);
      const data = await response.json();
      setTokens(data);
    } catch (error) {
      console.error('Error fetching tokens:', error);
    }
  };

  const fetchVariations = async (componentId: number) => {
    try {
      const response = await fetch(`http://localhost:3001/api/components/${componentId}`);
      const data = await response.json();
      setVariations(data.variations);
      if (data.variations.length > 0) {
        setSelectedVariation(data.variations[0]);
      } else {
        setSelectedVariation(null);
      }
    } catch (error) {
      console.error('Error fetching variations:', error);
      setSelectedVariation(null);
    }
  };

  const handleAdd = (type: 'component' | 'variation' | 'token') => {
    setDialogType(type);
    setFormData({
      name: '',
      description: '',
      type: '',
      defaultValue: '',
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = async () => {
    try {
      let response;
      switch (dialogType) {
        case 'component':
          response = await fetch('http://localhost:3001/api/components', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: formData.name,
              description: formData.description,
              designSystemId: 1, // TODO: Get from context or props
            }),
          });
          const newComponent = await response.json();
          setComponents([...components, newComponent]);
          break;

        case 'variation':
          if (!selectedComponent) return;
          response = await fetch('http://localhost:3001/api/variations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: formData.name,
              description: formData.description,
              componentId: selectedComponent.id,
            }),
          });
          const newVariation = await response.json();
          setVariations([...variations, newVariation]);
          break;

        case 'token':
          response = await fetch('http://localhost:3001/api/tokens', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: formData.name,
              type: formData.type,
              defaultValue: formData.defaultValue,
              variationId: selectedVariation?.id,
            }),
          });
          const newToken = await response.json();
          setTokens([...tokens, newToken]);
          break;
      }
      setIsDialogOpen(false);
    } catch (error) {
      console.error('Error creating item:', error);
    }
  };

  const handleDelete = async (type: 'component' | 'variation' | 'token', id: number) => {
    if (!confirm('Are you sure you want to delete this item?')) return;

    try {
      switch (type) {
        case 'component':
          await fetch(`http://localhost:3001/api/components/${id}`, { method: 'DELETE' });
          setComponents(components.filter(c => c.id !== id));
          if (selectedComponent?.id === id) {
            setSelectedComponent(null);
          }
          break;

        case 'variation':
          await fetch(`http://localhost:3001/api/variations/${id}`, { method: 'DELETE' });
          setVariations(variations.filter(v => v.id !== id));
          if (selectedVariation?.id === id) {
            setSelectedVariation(null);
          }
          break;

        case 'token':
          await fetch(`http://localhost:3001/api/tokens/${id}`, { method: 'DELETE' });
          setTokens(tokens.filter(t => t.id !== id));
          break;
      }
    } catch (error) {
      console.error('Error deleting item:', error);
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

  const sortItems = <T extends Component | Variation | Token>(items: T[]) => {
    return [...items].sort((a, b) => {
      if (sortBy === 'name') {
        return sortOrder === 'asc'
          ? a.name.localeCompare(b.name)
          : b.name.localeCompare(a.name);
      }
      return sortOrder === 'asc' ? a.id - b.id : b.id - a.id;
    });
  };

  const filterItems = <T extends { name?: string; token?: { name: string } }>(items: T[]) => {
    return items.filter(item => {
      const name = 'name' in item ? item.name : item.token?.name;
      return name?.toLowerCase().includes(searchTerm.toLowerCase());
    });
  };

  const handleComponentSelect = async (componentId: number) => {
    try {
      const response = await fetch(`http://localhost:3001/api/components/${componentId}`);
      const component = await response.json();
      setSelectedComponent(component);
    } catch (error) {
      console.error('Error fetching component:', error);
    }
  };

  const renderDialog = () => {
    return (
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Add New {dialogType.charAt(0).toUpperCase() + dialogType.slice(1)}
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
            {dialogType === 'token' && (
              <>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Type</label>
                  <Input
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    placeholder="Enter type"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Default Value</label>
                  <Input
                    value={formData.defaultValue}
                    onChange={(e) => setFormData({ ...formData, defaultValue: e.target.value })}
                    placeholder="Enter default value"
                  />
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  };

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Components Panel */}
      <div className="w-1/3 p-4 border-r border-gray-200 bg-white">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">Components</h2>
          <Button onClick={() => handleAdd('component')}>Add</Button>
        </div>
        <div className="mb-4">
          <Input
            placeholder="Search components..."
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
          {filterItems(sortItems(components)).map((component) => (
            <div
              key={component.id}
              className={cn(
                'p-3 rounded cursor-pointer hover:bg-gray-50 group',
                selectedComponent?.id === component.id && 'bg-blue-50 border border-blue-200'
              )}
              onClick={() => handleComponentSelect(component.id)}
            >
              <div className="flex justify-between items-start">
                <div
                  className="flex-1"
                  >
                  <h3 className="font-medium">{component.name}</h3>
                  {component.description && (
                    <p className="text-sm text-gray-500">{component.description}</p>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="opacity-0 group-hover:opacity-100"
                  onClick={() => handleDelete('component', component.id)}
                >
                  Delete
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Variations Panel */}
      {selectedComponent && (
        <div className="w-1/3 p-4 border-r border-gray-200 bg-white">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold">Variations</h2>
            <Button onClick={() => handleAdd('variation')}>Add</Button>
          </div>
          <div className="mb-4">
            <Input
              placeholder="Search variations..."
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
            {filterItems(sortItems(variations)).map((variation) => (
              <div
                key={variation.id}
                className={cn(
                  'p-3 rounded cursor-pointer hover:bg-gray-50 group',
                  selectedVariation?.id === variation.id && 'bg-blue-50 border border-blue-200'
                )}
                onClick={() => setSelectedVariation(variation)}
              >
                <div className="flex justify-between items-start">
                  <div
                    className="flex-1"
                  >
                    <h3 className="font-medium">{variation.name}</h3>
                    {variation.description && (
                      <p className="text-sm text-gray-500">{variation.description}</p>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="opacity-0 group-hover:opacity-100"
                    onClick={() => handleDelete('variation', variation.id)}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tokens Panel */}
      {selectedVariation && (
        <div className="w-1/3 p-4 bg-white">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold">Tokens</h2>
            <Button onClick={() => handleAdd('token')}>Add</Button>
          </div>
          <div className="mb-4">
            <Input
              placeholder="Search tokens..."
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
            {filterItems(sortItems(tokens)).map((token) => (
              <div
                key={token.id}
                className="p-3 rounded bg-gray-50 group"
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h3 className="font-medium">{token.name}</h3>
                    <p className="text-sm text-gray-500">Type: {token.type}</p>
                    <p className="text-sm text-gray-500 mt-1">Default Value: {token.defaultValue || 'Not set'}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="opacity-0 group-hover:opacity-100"
                    onClick={() => handleDelete('token', token.id)}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {renderDialog()}
    </div>
  );
};

export default Admin; 