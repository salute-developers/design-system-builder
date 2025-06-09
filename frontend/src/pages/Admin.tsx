import { useState, useEffect } from 'react';
import { cn } from '../lib/utils';
import { getAdminApiUrl } from '../config/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../components/ui/dialog';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '../components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';

interface Component {
  id: number;
  name: string;
  description: string | null;
  variations?: Variation[];
  tokens?: Token[];
}

interface Variation {
  id: number;
  name: string;
  description: string | null;
  componentId: number;
  tokenVariations?: { token: Token }[];
}

interface Token {
  id: number;
  componentId?: number;
  name: string;
  type: string;
  defaultValue: string | null;
  description: string | null;
  xmlParam: string | null;
  composeParam: string | null;
  iosParam: string | null;
  webParam: string | null;
}

interface FormData {
  name: string;
  description: string;
  type?: string;
  defaultValue?: string;
  xmlParam?: string;
  composeParam?: string;
  iosParam?: string;
  webParam?: string;
  componentId?: number;
}

const Admin = () => {
  const [components, setComponents] = useState<Component[]>([]);
  const [selectedComponent, setSelectedComponent] = useState<Component | null>(null);
  const [tokens, setTokens] = useState<Token[]>([]);
  const [variations, setVariations] = useState<Variation[]>([]);
  const [activeTab, setActiveTab] = useState<'tokens' | 'variations'>('tokens');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [dialogType, setDialogType] = useState<'component' | 'variation' | 'token'>('component');
  const [formData, setFormData] = useState<FormData>({
    name: '',
    description: '',
  });
  const [componentsSearchTerm, setComponentsSearchTerm] = useState('');
  const [tokensSearchTerm, setTokensSearchTerm] = useState('');
  const [variationsSearchTerm, setVariationsSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'id'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingItem, setEditingItem] = useState<Component | Variation | Token | null>(null);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [isAssignTokenDialogOpen, setIsAssignTokenDialogOpen] = useState(false);
  const [selectedVariationForAssignment, setSelectedVariationForAssignment] = useState<Variation | null>(null);
  const [availableTokensForAssignment, setAvailableTokensForAssignment] = useState<Token[]>([]);
  const [selectedTokensForAssignment, setSelectedTokensForAssignment] = useState<number[]>([]);
  const [dialogFilterTerm, setDialogFilterTerm] = useState('');

  useEffect(() => {
    fetchComponents();
  }, []);

  useEffect(() => {
    if (selectedComponent) {
      setTokens(selectedComponent.tokens || []);
      setVariations(selectedComponent.variations || []);
    } else {
      setTokens([]);
      setVariations([]);
    }
  }, [selectedComponent]);

  const fetchComponents = async () => {
    try {
      const response = await fetch(getAdminApiUrl('components'));
      const data = await response.json();
      setComponents(data);
    } catch (error) {
      console.error('Error fetching components:', error);
    }
  };

  const fetchComponentDetails = async (componentId: number) => {
    try {
      const response = await fetch(getAdminApiUrl('components') + `/${componentId}`);
      const data = await response.json();
      setSelectedComponent(data);
    } catch (error) {
      console.error('Error fetching component details:', error);
    }
  };

  const refreshComponentData = async () => {
    if (selectedComponent) {
      await fetchComponentDetails(selectedComponent.id);
    }
  };

  const refreshComponentList = async () => {
    await fetchComponents();
  };

  const validateForm = () => {
    const errors: Record<string, string> = {};
    
    if (!formData.name.trim()) {
      errors.name = 'Name is required';
    }
    
    if (dialogType === 'token') {
      if (!formData.type?.trim()) {
        errors.type = 'Type is required';
      }
      if (!formData.componentId) {
        errors.componentId = 'Component is required';
      }
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleAdd = (type: 'component' | 'variation' | 'token') => {
    setDialogType(type);
    setIsEditMode(false);
    setEditingItem(null);
    setFormData({
      name: '',
      description: '',
      type: '',
      defaultValue: '',
      xmlParam: '',
      composeParam: '',
      iosParam: '',
      webParam: '',
      componentId: selectedComponent?.id,
    });
    setFormErrors({});
    setIsDialogOpen(true);
  };

  const handleEdit = (type: 'component' | 'variation' | 'token', item: Component | Variation | Token) => {
    setDialogType(type);
    setIsEditMode(true);
    setEditingItem(item);
    setFormData({
      name: item.name,
      description: 'description' in item ? item.description || '' : '',
      type: 'type' in item ? item.type : '',
      defaultValue: 'defaultValue' in item ? item.defaultValue || '' : '',
      xmlParam: 'xmlParam' in item ? item.xmlParam || '' : '',
      composeParam: 'composeParam' in item ? item.composeParam || '' : '',
      iosParam: 'iosParam' in item ? item.iosParam || '' : '',
      webParam: 'webParam' in item ? item.webParam || '' : '',
      componentId: 'componentId' in item ? item.componentId : selectedComponent?.id,
    });
    setFormErrors({});
    setIsDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      return;
    }

    try {
      let response;
      let needsComponentRefresh = false;
      let needsListRefresh = false;

      if (isEditMode && editingItem) {
        switch (dialogType) {
          case 'component':
            response = await fetch(getAdminApiUrl('components') + `/${editingItem.id}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                name: formData.name,
                description: formData.description,
              }),
            });
            const updatedComponent = await response.json();
            setComponents(components.map(c => c.id === updatedComponent.id ? updatedComponent : c));
            // Update selected component if it's the one being edited
            if (selectedComponent?.id === updatedComponent.id) {
              needsComponentRefresh = true;
            }
            break;

          case 'variation':
            response = await fetch(getAdminApiUrl('variations') + `/${editingItem.id}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                name: formData.name,
                description: formData.description,
                componentId: formData.componentId,
              }),
            });
            await response.json();
            needsComponentRefresh = true;
            break;

          case 'token':
            response = await fetch(getAdminApiUrl('tokens') + `/${editingItem.id}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                name: formData.name,
                type: formData.type,
                defaultValue: formData.defaultValue,
                description: formData.description,
                xmlParam: formData.xmlParam,
                composeParam: formData.composeParam,
                iosParam: formData.iosParam,
                webParam: formData.webParam,
                componentId: formData.componentId,
              }),
            });
            await response.json();
            needsComponentRefresh = true;
            break;
        }
      } else {
        switch (dialogType) {
          case 'component':
            response = await fetch(getAdminApiUrl('components'), {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                name: formData.name,
                description: formData.description,
              }),
            });
            const newComponent = await response.json();
            setComponents([...components, newComponent]);
            break;

          case 'variation':
            response = await fetch(getAdminApiUrl('variations'), {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                name: formData.name,
                description: formData.description,
                componentId: formData.componentId,
              }),
            });
            await response.json();
            needsComponentRefresh = true;
            break;

          case 'token':
            response = await fetch(getAdminApiUrl('tokens'), {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                name: formData.name,
                type: formData.type,
                defaultValue: formData.defaultValue,
                description: formData.description,
                xmlParam: formData.xmlParam,
                composeParam: formData.composeParam,
                iosParam: formData.iosParam,
                webParam: formData.webParam,
                componentId: formData.componentId,
              }),
            });
            await response.json();
            needsComponentRefresh = true;
            break;
        }
      }

      // Refresh data only when necessary
      if (needsComponentRefresh) {
        await refreshComponentData();
      }
      if (needsListRefresh) {
        await refreshComponentList();
      }

      setIsDialogOpen(false);
      setIsEditMode(false);
      setEditingItem(null);
      setFormErrors({});
    } catch (error) {
      console.error('Error saving item:', error);
    }
  };

  const handleDelete = async (type: 'component' | 'variation' | 'token', id: number) => {
    if (!confirm('Are you sure you want to delete this item?')) return;

    try {
      switch (type) {
        case 'component':
          await fetch(getAdminApiUrl('components') + `/${id}`, { method: 'DELETE' });
          setComponents(components.filter(c => c.id !== id));
          if (selectedComponent?.id === id) {
            setSelectedComponent(null);
          }
          break;

        case 'variation':
          await fetch(getAdminApiUrl('variations') + `/${id}`, { method: 'DELETE' });
          await refreshComponentData();
          break;

        case 'token':
          await fetch(getAdminApiUrl('tokens') + `/${id}`, { method: 'DELETE' });
          await refreshComponentData();
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

  const filterItems = <T extends { name?: string; token?: { name: string } }>(items: T[], searchTerm: string) => {
    return items.filter(item => {
      const name = 'name' in item ? item.name : item.token?.name;
      return name?.toLowerCase().includes(searchTerm.toLowerCase());
    });
  };

  const handleComponentSelect = async (componentId: number) => {
    // Only fetch if it's a different component
    if (selectedComponent?.id !== componentId) {
      await fetchComponentDetails(componentId);
    }
  };

  const getComponentCounts = (component: Component) => {
    const tokensCount = component.tokens?.length || 0;
    const variationsCount = component.variations?.length || 0;
    return { tokensCount, variationsCount };
  };

  const isTokenAssignedToVariation = (tokenId: number) => {
    return variations.some(variation => 
      variation.tokenVariations?.some(tv => tv.token.id === tokenId)
    );
  };

  const handleAssignToken = async (variationId: number) => {
    const variation = variations.find(v => v.id === variationId);
    const currentlyAssignedTokenIds = variation?.tokenVariations?.map(tv => tv.token.id) || [];
    
    // Show all tokens, not just available ones
    setAvailableTokensForAssignment(tokens);
    setSelectedVariationForAssignment(variation || null);
    // Pre-select currently assigned tokens
    setSelectedTokensForAssignment(currentlyAssignedTokenIds);
    setDialogFilterTerm('');
    setIsAssignTokenDialogOpen(true);
  };

  const handleConfirmTokenAssignment = async () => {
    if (!selectedVariationForAssignment) return;

    try {
      const variation = selectedVariationForAssignment;
      const currentlyAssignedTokenIds = variation.tokenVariations?.map(tv => tv.token.id) || [];
      const newlySelectedTokenIds = selectedTokensForAssignment;

      // Find tokens to add (selected but not currently assigned)
      const tokensToAdd = newlySelectedTokenIds.filter(id => !currentlyAssignedTokenIds.includes(id));
      
      // Find tokens to remove (currently assigned but not selected)
      const tokensToRemove = currentlyAssignedTokenIds.filter(id => !newlySelectedTokenIds.includes(id));

      // Add new tokens
      for (const tokenId of tokensToAdd) {
        await fetch(getAdminApiUrl('tokens') + `/${tokenId}/variations/${variation.id}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Remove unselected tokens
      for (const tokenId of tokensToRemove) {
        await fetch(getAdminApiUrl('tokens') + `/${tokenId}/variations/${variation.id}`, {
          method: 'DELETE',
        });
      }
      
      await refreshComponentData();
      
      setIsAssignTokenDialogOpen(false);
      setSelectedTokensForAssignment([]);
      setSelectedVariationForAssignment(null);
      setDialogFilterTerm('');
    } catch (error) {
      console.error('Error updating token assignments:', error);
    }
  };

  const handleRemoveTokenFromVariation = async (tokenId: number, variationId: number) => {
    if (!confirm('Are you sure you want to remove this token from the variation?')) return;

    try {
      await fetch(getAdminApiUrl('tokens') + `/${tokenId}/variations/${variationId}`, {
        method: 'DELETE',
      });
      
      await refreshComponentData();
    } catch (error) {
      console.error('Error removing token from variation:', error);
    }
  };

  const renderDialog = () => {
    return (
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-h-[90vh] flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle>
              {isEditMode ? 'Edit' : 'Add New'} {dialogType.charAt(0).toUpperCase() + dialogType.slice(1)}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto space-y-4 py-4 px-1">
            <div className="space-y-2">
              <label className="text-sm font-medium">Name</label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Enter name"
                className={formErrors.name ? 'border-red-500' : ''}
              />
              {formErrors.name && <p className="text-sm text-red-500">{formErrors.name}</p>}
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
                  <label className="text-sm font-medium">Component</label>
                  <Select 
                    value={formData.componentId?.toString() || ''} 
                    onValueChange={(value) => setFormData({ ...formData, componentId: parseInt(value) })}
                  >
                    <SelectTrigger className={formErrors.componentId ? 'border-red-500' : ''}>
                      <SelectValue placeholder="Select component" />
                    </SelectTrigger>
                    <SelectContent>
                      {components.map((component) => (
                        <SelectItem key={component.id} value={component.id.toString()}>
                          {component.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {formErrors.componentId && <p className="text-sm text-red-500">{formErrors.componentId}</p>}
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Type</label>
                  <Input
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    placeholder="e.g., color, spacing, typography"
                    className={formErrors.type ? 'border-red-500' : ''}
                  />
                  {formErrors.type && <p className="text-sm text-red-500">{formErrors.type}</p>}
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Default Value (Optional)</label>
                  <Input
                    value={formData.defaultValue}
                    onChange={(e) => setFormData({ ...formData, defaultValue: e.target.value })}
                    placeholder="Enter default value (optional)"
                  />
                </div>
                
                {/* Platform Parameters Section */}
                <div className="border-t pt-4 mt-6">
                  <h4 className="text-sm font-medium text-gray-700 mb-3">Platform Parameters (Optional)</h4>
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">XML Parameter</label>
                      <Input
                        value={formData.xmlParam}
                        onChange={(e) => setFormData({ ...formData, xmlParam: e.target.value })}
                        placeholder="Enter XML parameter"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Compose Parameter</label>
                      <Input
                        value={formData.composeParam}
                        onChange={(e) => setFormData({ ...formData, composeParam: e.target.value })}
                        placeholder="Enter Compose parameter"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">iOS Parameter</label>
                      <Input
                        value={formData.iosParam}
                        onChange={(e) => setFormData({ ...formData, iosParam: e.target.value })}
                        placeholder="Enter iOS parameter"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Web Parameter</label>
                      <Input
                        value={formData.webParam}
                        onChange={(e) => setFormData({ ...formData, webParam: e.target.value })}
                        placeholder="Enter Web parameter"
                      />
                    </div>
                  </div>
                </div>
              </>
            )}
            {dialogType === 'variation' && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Component</label>
                <Select 
                  value={formData.componentId?.toString() || ''} 
                  onValueChange={(value) => setFormData({ ...formData, componentId: parseInt(value) })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select component" />
                  </SelectTrigger>
                  <SelectContent>
                    {components.map((component) => (
                      <SelectItem key={component.id} value={component.id.toString()}>
                        {component.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter className="flex-shrink-0 mt-4">
            <Button variant="outline" onClick={() => {
              setIsDialogOpen(false);
              setIsEditMode(false);
              setEditingItem(null);
              setFormErrors({});
            }}>
              Cancel
            </Button>
            <Button onClick={handleSubmit}>{isEditMode ? 'Save' : 'Create'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  };

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Components Panel - Narrow */}
      <div className="w-1/4 p-4 border-r border-gray-200 bg-white">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">Components</h2>
          <Button onClick={() => handleAdd('component')} size="sm">Add</Button>
        </div>
        <div className="mb-4">
          <div className="relative">
            <Input
              placeholder="Search components..."
              value={componentsSearchTerm}
              onChange={(e) => setComponentsSearchTerm(e.target.value)}
              className="mb-2 pr-8"
            />
            {componentsSearchTerm && (
              <button
                onClick={() => setComponentsSearchTerm('')}
                className="absolute right-2 top-1 text-gray-400 hover:text-gray-600"
              >
                ×
              </button>
            )}
          </div>
        </div>
        <div className="space-y-2">
          {filterItems(sortItems(components), componentsSearchTerm).map((component) => {
            const { tokensCount, variationsCount } = getComponentCounts(component);
            return (
              <div
                key={component.id}
                className={cn(
                  'p-3 rounded cursor-pointer hover:bg-gray-50 group transition-colors',
                  selectedComponent?.id === component.id && 'bg-blue-50 border border-blue-200'
                )}
                onClick={() => handleComponentSelect(component.id)}
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h3 className="font-medium">{component.name}</h3>
                    {component.description && (
                      <p className="text-xs text-gray-500 mt-1">{component.description}</p>
                    )}
                    <div className="flex gap-2 mt-2">
                      <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                        {tokensCount} tokens
                      </span>
                      <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                        {variationsCount} variations
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEdit('component', component);
                      }}
                      className="h-8 w-8 p-0 text-xs"
                    >
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete('component', component.id);
                      }}
                      className="h-8 w-8 p-0 text-xs"
                    >
                      Del
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Main Panel - Tokens and Variations */}
      <div className="flex-1 p-4 bg-white">
        {selectedComponent ? (
          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'tokens' | 'variations')}>
            <div className="flex justify-between items-center mb-4">
              <div>
                <h2 className="text-lg font-semibold mb-2">
                  {selectedComponent.name}
                </h2>
                <TabsList className="grid w-full grid-cols-2 max-w-md">
                  <TabsTrigger value="tokens">Tokens</TabsTrigger>
                  <TabsTrigger value="variations">Variations</TabsTrigger>
                </TabsList>
              </div>
            </div>

            <TabsContent value="tokens" className="space-y-4">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-md font-medium">Component Tokens</h3>
                  {(() => {
                    const unassignedCount = tokens.filter(token => !isTokenAssignedToVariation(token.id)).length;
                    return unassignedCount > 0 ? (
                      <p className="text-sm text-orange-600 mt-1">
                        {unassignedCount} token{unassignedCount === 1 ? '' : 's'} not assigned to any variation
                      </p>
                    ) : null;
                  })()}
                </div>
                <Button onClick={() => handleAdd('token')}>Add Token</Button>
              </div>
              <div className="mb-4">
                <div className="relative">
                  <Input
                    placeholder="Search tokens..."
                    value={tokensSearchTerm}
                    onChange={(e) => setTokensSearchTerm(e.target.value)}
                    className="mb-2 pr-8"
                  />
                  {tokensSearchTerm && (
                    <button
                      onClick={() => setTokensSearchTerm('')}
                      className="absolute right-2 top-1 text-gray-400 hover:text-gray-600"
                    >
                      ×
                    </button>
                  )}
                </div>
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
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {filterItems(sortItems(tokens), tokensSearchTerm).map((token) => {
                  const isAssigned = isTokenAssignedToVariation(token.id);
                  return (
                    <div
                      key={token.id}
                      className={cn(
                        "p-4 rounded border group hover:bg-gray-100 transition-colors",
                        isAssigned 
                          ? "bg-gray-50" 
                          : "bg-orange-50 border-orange-200"
                      )}
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium text-gray-900">{token.name}</h4>
                            {!isAssigned && (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                                Unassigned
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-500">Type: {token.type}</p>
                          <p className="text-sm text-gray-500 mt-1">Default: {token.defaultValue || 'Not set'}</p>
                          {token.description && (
                            <p className="text-sm text-gray-500 mt-1">{token.description}</p>
                          )}
                          <div className="mt-2 text-xs text-gray-400 space-y-1">
                            {token.xmlParam && <div>XML: {token.xmlParam}</div>}
                            {token.composeParam && <div>Compose: {token.composeParam}</div>}
                            {token.iosParam && <div>iOS: {token.iosParam}</div>}
                            {token.webParam && <div>Web: {token.webParam}</div>}
                          </div>
                        </div>
                        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit('token', token)}
                          >
                            Edit
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete('token', token.id)}
                          >
                            Delete
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </TabsContent>

            <TabsContent value="variations" className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-md font-medium">Component Variations</h3>
                <Button onClick={() => handleAdd('variation')}>Add Variation</Button>
              </div>
              <div className="mb-4">
                <div className="relative">
                  <Input
                    placeholder="Search variations..."
                    value={variationsSearchTerm}
                    onChange={(e) => setVariationsSearchTerm(e.target.value)}
                    className="mb-2 pr-8"
                  />
                  {variationsSearchTerm && (
                    <button
                      onClick={() => setVariationsSearchTerm('')}
                      className="absolute right-2 top-1 text-gray-400 hover:text-gray-600"
                    >
                      ×
                    </button>
                  )}
                </div>
              </div>
              <div className="space-y-4">
                {filterItems(sortItems(variations), variationsSearchTerm).map((variation) => (
                  <div key={variation.id} className="border rounded-lg p-4 bg-gray-50">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h4 className="font-medium">{variation.name}</h4>
                        {variation.description && (
                          <p className="text-sm text-gray-500">{variation.description}</p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleAssignToken(variation.id)}
                        >
                          Assign Tokens
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit('variation', variation)}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete('variation', variation.id)}
                        >
                          Delete
                        </Button>
                      </div>
                    </div>
                    
                    {/* Variation Tokens - Dense View */}
                    <div className="space-y-2">
                      <h5 className="text-sm font-medium text-gray-700">Assigned Tokens:</h5>
                      {variation.tokenVariations && variation.tokenVariations.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          {variation.tokenVariations.map((tokenVariation) => (
                            <div
                              key={tokenVariation.token.id}
                              className="flex justify-between items-center p-2 bg-white rounded border text-sm"
                            >
                              <div>
                                <span className="font-medium">{tokenVariation.token.name}</span>
                                <span className="text-gray-500 ml-2">({tokenVariation.token.type})</span>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleRemoveTokenFromVariation(tokenVariation.token.id, variation.id)}
                                className="h-6 w-6 p-0 text-gray-400 hover:text-gray-600"
                              >
                                ×
                              </Button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-gray-500">No tokens assigned to this variation.</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </TabsContent>
          </Tabs>
        ) : (
          <div className="flex items-center justify-center h-full text-gray-500">
            <p>Select a component to view its tokens and variations</p>
          </div>
        )}
      </div>

      {renderDialog()}
      
      {/* Token Assignment Dialog */}
      <Dialog open={isAssignTokenDialogOpen} onOpenChange={setIsAssignTokenDialogOpen}>
        <DialogContent className="max-h-[90vh] flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle>Manage Tokens for Variation</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto space-y-4 py-4">
            <p className="text-sm text-gray-600">
              Select which tokens should be assigned to <strong>{selectedVariationForAssignment?.name}</strong>:
            </p>
            
            {/* Filter Input */}
            <div className="relative">
              <Input
                placeholder="Filter tokens..."
                value={dialogFilterTerm}
                onChange={(e) => setDialogFilterTerm(e.target.value)}
                className="pr-8"
              />
              {dialogFilterTerm && (
                <button
                  onClick={() => setDialogFilterTerm('')}
                  className="absolute right-2 top-1 text-gray-400 hover:text-gray-600"
                >
                  ×
                </button>
              )}
            </div>
            
            {availableTokensForAssignment.length > 0 ? (
              <>
                <div className="flex gap-2 mb-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedTokensForAssignment(
                      filterItems(availableTokensForAssignment, dialogFilterTerm).map(t => t.id)
                    )}
                  >
                    Select All{dialogFilterTerm ? ' Filtered' : ''}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedTokensForAssignment([])}
                    disabled={selectedTokensForAssignment.length === 0}
                  >
                    Deselect All
                  </Button>
                </div>
                <div className="space-y-2 max-h-60 overflow-y-auto border rounded-md p-3">
                  {filterItems(availableTokensForAssignment, dialogFilterTerm).map((token) => {
                    const isCurrentlyAssigned = selectedVariationForAssignment?.tokenVariations?.some(tv => tv.token.id === token.id) || false;
                    return (
                      <label key={token.id} className="flex items-start space-x-3 cursor-pointer hover:bg-gray-50 p-2 rounded">
                        <input
                          type="checkbox"
                          checked={selectedTokensForAssignment.includes(token.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedTokensForAssignment([...selectedTokensForAssignment, token.id]);
                            } else {
                              setSelectedTokensForAssignment(selectedTokensForAssignment.filter(id => id !== token.id));
                            }
                          }}
                          className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">{token.name}</span>
                            {isCurrentlyAssigned && (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                Currently Assigned
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-gray-500">
                            Type: {token.type} | Default: {token.defaultValue || 'Not set'}
                          </div>
                          {token.description && (
                            <div className="text-xs text-gray-400 mt-1">{token.description}</div>
                          )}
                        </div>
                      </label>
                    );
                  })}
                </div>
                {filterItems(availableTokensForAssignment, dialogFilterTerm).length === 0 && (
                  <p className="text-sm text-gray-500 text-center py-4">No tokens match your filter.</p>
                )}
              </>
            ) : (
              <p className="text-sm text-gray-500">No tokens available for this component.</p>
            )}
            
            {selectedTokensForAssignment.length > 0 && (
              <div className="mt-4 p-3 bg-blue-50 rounded-md">
                <p className="text-sm font-medium text-blue-900">
                  Selected {selectedTokensForAssignment.length} token{selectedTokensForAssignment.length === 1 ? '' : 's'}:
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {selectedTokensForAssignment.map(tokenId => {
                    const token = availableTokensForAssignment.find(t => t.id === tokenId);
                    return token ? (
                      <span key={tokenId} className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {token.name}
                        <button
                          onClick={() => setSelectedTokensForAssignment(selectedTokensForAssignment.filter(id => id !== tokenId))}
                          className="ml-1 inline-flex items-center justify-center h-4 w-4 rounded-full text-blue-400 hover:bg-blue-200 hover:text-blue-600"
                        >
                          ×
                        </button>
                      </span>
                    ) : null;
                  })}
                </div>
              </div>
            )}
          </div>
          <DialogFooter className="flex-shrink-0">
            <Button variant="outline" onClick={() => setIsAssignTokenDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleConfirmTokenAssignment}
            >
              Update Assignment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Admin; 