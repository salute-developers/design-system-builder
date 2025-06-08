import React from 'react';
import { cn } from '../../lib/utils';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import type { DesignSystem } from '../../types';

interface DesignSystemsPanelProps {
  designSystems: DesignSystem[];
  selectedDesignSystem: DesignSystem | null;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  sortBy: 'name' | 'id';
  sortOrder: 'asc' | 'desc';
  onAdd: () => void;
  onEdit: (designSystem: DesignSystem) => void;
  onDelete: (id: number) => void;
  onSelect: (id: number) => void;
  onSort: (type: 'name' | 'id') => void;
  filterDesignSystems: (items: DesignSystem[]) => DesignSystem[];
  sortItems: <T extends DesignSystem>(items: T[]) => T[];
}

const DesignSystemsPanel: React.FC<DesignSystemsPanelProps> = ({
  designSystems,
  selectedDesignSystem,
  searchTerm,
  setSearchTerm,
  sortBy,
  sortOrder,
  onAdd,
  onEdit,
  onDelete,
  onSelect,
  onSort,
  filterDesignSystems,
  sortItems,
}) => {
  return (
    <div className="w-1/4 p-3 border-r border-gray-200 bg-white">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold">Design Systems</h2>
        <Button onClick={onAdd} size="sm">Add</Button>
      </div>
      <div className="mb-4">
        <Input
          placeholder="Search design systems..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="mb-2"
        />
        <div className="flex gap-1">
          <Button
            variant={sortBy === 'name' ? 'default' : 'outline'}
            size="sm"
            onClick={() => onSort('name')}
          >
            Name {sortBy === 'name' && (sortOrder === 'asc' ? '↑' : '↓')}
          </Button>
          <Button
            variant={sortBy === 'id' ? 'default' : 'outline'}
            size="sm"
            onClick={() => onSort('id')}
          >
            ID {sortBy === 'id' && (sortOrder === 'asc' ? '↑' : '↓')}
          </Button>
        </div>
      </div>
      <div className="space-y-2">
        {filterDesignSystems(sortItems(designSystems)).map((designSystem) => (
          <div
            key={designSystem.id}
            className={cn(
              'p-2 rounded cursor-pointer hover:bg-gray-50 group',
              selectedDesignSystem?.id === designSystem.id && 'bg-blue-50 border border-blue-200'
            )}
            onClick={() => onSelect(designSystem.id)}
          >
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <h3 className="font-medium text-sm">{designSystem.name}</h3>
                {designSystem.description && (
                  <p className="text-xs text-gray-500">{designSystem.description}</p>
                )}
              </div>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit(designSystem);
                  }}
                >
                  Edit
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(designSystem.id);
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
  );
};

export default DesignSystemsPanel; 