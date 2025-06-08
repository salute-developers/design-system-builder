import React from 'react';
import { cn } from '../../lib/utils';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import type { DesignSystem, Variation } from '../../types';

interface ComponentsPanelProps {
  selectedDesignSystem: DesignSystem;
  selectedComponent: any;
  componentSearchTerm: string;
  setComponentSearchTerm: (term: string) => void;
  onShowAddComponentsDialog: () => void;
  onComponentSelect: (component: any) => void;
  onRemoveComponent: (component: any) => void;
  filterComponents: (components: any[]) => any[];
}

const ComponentsPanel: React.FC<ComponentsPanelProps> = ({
  selectedDesignSystem,
  selectedComponent,
  componentSearchTerm,
  setComponentSearchTerm,
  onShowAddComponentsDialog,
  onComponentSelect,
  onRemoveComponent,
  filterComponents,
}) => {
  return (
    <div className="w-1/4 p-3 border-r border-gray-200 bg-white">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold">Components</h2>
        <Button onClick={onShowAddComponentsDialog} size="sm">Add</Button>
      </div>
      <div className="mb-4">
        <Input
          placeholder="Search components..."
          value={componentSearchTerm}
          onChange={(e) => setComponentSearchTerm(e.target.value)}
          className="mb-2"
        />
      </div>
      <div className="space-y-2">
        {filterComponents(selectedDesignSystem.components).map((designSystemComponent) => (
          <div
            key={designSystemComponent.id}
            className={cn(
              'p-2 rounded cursor-pointer hover:bg-gray-50 group',
              selectedComponent?.id === designSystemComponent.id && 'bg-blue-50 border border-blue-200'
            )}
            onClick={() => onComponentSelect(designSystemComponent)}
          >
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <h3 className="font-medium text-sm">{designSystemComponent.component.name}</h3>
                {designSystemComponent.component.description && (
                  <p className="text-xs text-gray-500">{designSystemComponent.component.description}</p>
                )}
                <p className="text-xs text-gray-400 mt-1">
                  {designSystemComponent.component.variations?.length || 0} variation(s)
                  {(() => {
                    // Count total tokens across all variations
                    const totalTokens = designSystemComponent.component.variations?.reduce((acc: number, variation: Variation) => {
                      const tokenCount = variation.tokens?.length || 
                        variation.tokenVariations?.length || 0;
                      return acc + tokenCount;
                    }, 0) || 0;
                    return totalTokens > 0 ? ` • ${totalTokens} token(s)` : '';
                  })()}
                </p>
              </div>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemoveComponent(designSystemComponent);
                  }}
                >
                  Remove
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ComponentsPanel; 