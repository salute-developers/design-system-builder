import { useState, useEffect } from 'react';
import axios from 'axios';
import * as Dialog from '@radix-ui/react-dialog';

interface DesignSystem {
  id: number;
  name: string;
  version: string;
  owner: string;
  config: any;
}

export default function Index() {
  const [designSystems, setDesignSystems] = useState<DesignSystem[]>([]);
  const [open, setOpen] = useState(false);
  const [newDesignSystem, setNewDesignSystem] = useState({
    name: '',
    version: '',
    owner: '',
    config: {},
  });

  useEffect(() => {
    fetchDesignSystems();
  }, []);

  const fetchDesignSystems = async () => {
    try {
      const response = await axios.get('http://localhost:3001/api/design-systems');
      setDesignSystems(response.data);
    } catch (error) {
      console.error('Error fetching design systems:', error);
    }
  };

  const handleCreateDesignSystem = async () => {
    try {
      await axios.post('http://localhost:3001/api/design-systems', newDesignSystem);
      setOpen(false);
      fetchDesignSystems();
      setNewDesignSystem({ name: '', version: '', owner: '', config: {} });
    } catch (error) {
      console.error('Error creating design system:', error);
    }
  };

  const handleDeleteDesignSystem = async (id: number) => {
    try {
      await axios.delete(`http://localhost:3001/api/design-systems/${id}`);
      fetchDesignSystems();
    } catch (error) {
      console.error('Error deleting design system:', error);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Design System Builder</h1>
        <button
          onClick={() => setOpen(true)}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
        >
          Create Design System
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {designSystems.map((ds) => (
          <div key={ds.id} className="p-4 bg-card rounded-lg shadow">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-medium">{ds.name}</h3>
                <p className="text-sm text-muted-foreground">Version: {ds.version}</p>
                <p className="text-sm text-muted-foreground">Owner: {ds.owner}</p>
              </div>
              <button
                onClick={() => handleDeleteDesignSystem(ds.id)}
                className="p-2 text-destructive hover:bg-destructive/10 rounded"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/50" />
          <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-background p-6 rounded-lg shadow-lg w-[500px]">
            <Dialog.Title className="text-xl font-bold mb-4">Create Design System</Dialog.Title>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Name</label>
                <input
                  type="text"
                  className="w-full p-2 border rounded"
                  value={newDesignSystem.name}
                  onChange={(e) => setNewDesignSystem({ ...newDesignSystem, name: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Version</label>
                <input
                  type="text"
                  className="w-full p-2 border rounded"
                  value={newDesignSystem.version}
                  onChange={(e) => setNewDesignSystem({ ...newDesignSystem, version: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Owner</label>
                <input
                  type="text"
                  className="w-full p-2 border rounded"
                  value={newDesignSystem.owner}
                  onChange={(e) => setNewDesignSystem({ ...newDesignSystem, owner: e.target.value })}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => setOpen(false)}
                className="px-4 py-2 border rounded hover:bg-muted"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateDesignSystem}
                className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90"
              >
                Create
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
} 