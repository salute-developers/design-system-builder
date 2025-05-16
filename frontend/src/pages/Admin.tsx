import { useState, useEffect } from 'react';
import * as Tabs from '@radix-ui/react-tabs';
import * as Dialog from '@radix-ui/react-dialog';
import axios from 'axios';

interface Component {
  id: number;
  name: string;
  description: string;
}

interface Variation {
  id: number;
  componentId: number;
  name: string;
  description: string;
}

interface Token {
  id: number;
  name: string;
  type: string;
  defaultValue: string;
}

const Admin = () => {
  const [tab, setTab] = useState('components');
  const [components, setComponents] = useState<Component[]>([]);
  const [variations, setVariations] = useState<Variation[]>([]);
  const [tokens, setTokens] = useState<Token[]>([]);
  const [open, setOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);

  useEffect(() => {
    fetchData();
  }, [tab]);

  const fetchData = async () => {
    try {
      if (tab === 'components') {
        const response = await axios.get('http://localhost:3001/api/components');
        setComponents(response.data);
      } else if (tab === 'variations') {
        const response = await axios.get('http://localhost:3001/api/variations');
        setVariations(response.data);
      } else {
        const response = await axios.get('http://localhost:3001/api/tokens');
        setTokens(response.data);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  };

  const handleCreate = async () => {
    try {
      if (tab === 'components') {
        await axios.post('http://localhost:3001/api/components', editingItem);
      } else if (tab === 'variations') {
        await axios.post('http://localhost:3001/api/variations', editingItem);
      } else {
        await axios.post('http://localhost:3001/api/tokens', editingItem);
      }
      setOpen(false);
      fetchData();
      setEditingItem(null);
    } catch (error) {
      console.error('Error creating item:', error);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      if (tab === 'components') {
        await axios.delete(`http://localhost:3001/api/components/${id}`);
      } else if (tab === 'variations') {
        await axios.delete(`http://localhost:3001/api/variations/${id}`);
      } else {
        await axios.delete(`http://localhost:3001/api/tokens/${id}`);
      }
      fetchData();
    } catch (error) {
      console.error('Error deleting item:', error);
    }
  };

  const renderList = () => {
    const items = tab === 'components' ? components : tab === 'variations' ? variations : tokens;
    return (
      <div className="space-y-2">
        {items.map((item) => (
          <div key={item.id} className="flex items-center justify-between p-4 bg-card rounded-lg">
            <div>
              <h3 className="font-medium">{item.name}</h3>
              {'description' in item && <p className="text-sm text-muted-foreground">{item.description}</p>}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handleDelete(item.id)}
                className="p-2 text-destructive hover:bg-destructive/10 rounded"
              >
                Delete
              </button>
              <button
                onClick={() => {
                  setEditingItem(item);
                  setOpen(true);
                }}
                className="p-2 text-primary hover:bg-primary/10 rounded"
              >
                Edit
              </button>
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Admin Panel</h1>
        <button
          onClick={() => {
            setEditingItem(null);
            setOpen(true);
          }}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
        >
          Create New {tab === 'components' ? 'Component' : tab === 'variations' ? 'Variation' : 'Token'}
        </button>
      </div>

      <Tabs.Root value={tab} onValueChange={setTab}>
        <Tabs.List className="flex border-b">
          <Tabs.Trigger
            value="components"
            className="px-4 py-2 data-[state=active]:border-b-2 data-[state=active]:border-primary"
          >
            Components
          </Tabs.Trigger>
          <Tabs.Trigger
            value="variations"
            className="px-4 py-2 data-[state=active]:border-b-2 data-[state=active]:border-primary"
          >
            Variations
          </Tabs.Trigger>
          <Tabs.Trigger
            value="tokens"
            className="px-4 py-2 data-[state=active]:border-b-2 data-[state=active]:border-primary"
          >
            Tokens
          </Tabs.Trigger>
        </Tabs.List>
      </Tabs.Root>

      {renderList()}

      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/50" />
          <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-background p-6 rounded-lg shadow-lg w-[500px]">
            <Dialog.Title className="text-xl font-bold mb-4">
              {editingItem ? 'Edit' : 'Create New'} {tab === 'components' ? 'Component' : tab === 'variations' ? 'Variation' : 'Token'}
            </Dialog.Title>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Name</label>
                <input
                  type="text"
                  className="w-full p-2 border rounded"
                  value={editingItem?.name || ''}
                  onChange={(e) => setEditingItem({ ...editingItem, name: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <input
                  type="text"
                  className="w-full p-2 border rounded"
                  value={editingItem?.description || ''}
                  onChange={(e) => setEditingItem({ ...editingItem, description: e.target.value })}
                />
              </div>
              {tab === 'tokens' && (
                <>
                  <div>
                    <label className="block text-sm font-medium mb-1">Type</label>
                    <input
                      type="text"
                      className="w-full p-2 border rounded"
                      value={editingItem?.type || ''}
                      onChange={(e) => setEditingItem({ ...editingItem, type: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Default Value</label>
                    <input
                      type="text"
                      className="w-full p-2 border rounded"
                      value={editingItem?.defaultValue || ''}
                      onChange={(e) => setEditingItem({ ...editingItem, defaultValue: e.target.value })}
                    />
                  </div>
                </>
              )}
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => setOpen(false)}
                className="px-4 py-2 border rounded hover:bg-muted"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90"
              >
                {editingItem ? 'Save' : 'Create'}
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
};

export default Admin; 