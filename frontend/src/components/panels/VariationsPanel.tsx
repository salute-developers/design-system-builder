import React from 'react';
import { cn } from '../../lib/utils';
import type { Variation, DesignSystem } from '../../types';

interface VariationsPanelProps {
  selectedComponent: any;
  selectedVariation: Variation | null;
  selectedDesignSystem: DesignSystem | null;
  onVariationSelect: (variation: Variation) => void;
  onInvariantsSelect: () => void;
  showInvariants: boolean;
}

const VariationsPanel: React.FC<VariationsPanelProps> = ({
  selectedComponent,
  selectedVariation,
  selectedDesignSystem,
  onVariationSelect,
  onInvariantsSelect,
  showInvariants,
}) => {
  return (
    <div className="w-1/4 h-full flex flex-col border-r border-gray-200 bg-white">
      {/* Header - Fixed */}
      <div className="flex-shrink-0 p-3 border-b border-gray-200">
        <div className="mb-4">
          <h2 className="text-lg font-semibold">Variations</h2>
          <p className="text-sm text-gray-600">{selectedComponent.component.name}</p>
        </div>
      </div>
      
      {/* Content - Scrollable */}
      <div className="flex-1 overflow-y-auto p-3">
        <div className="space-y-2">
          {/* Invariants Button */}
          <div
            className={cn(
              'p-2 rounded cursor-pointer hover:bg-gray-50 group border-2 border-dashed',
              showInvariants && 'bg-green-50 border-green-200'
            )}
            onClick={onInvariantsSelect}
          >
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500"></div>
              <h3 className="font-medium text-sm">Invariants</h3>
            </div>
            <p className="text-xs text-gray-500 mt-1">Component-level token values</p>
          </div>
          
          {/* Variations */}
          {selectedComponent.component.variations?.map((variation: Variation) => (
            <div
              key={variation.id}
              className={cn(
                'p-2 rounded cursor-pointer hover:bg-gray-50 group',
                selectedVariation?.id === variation.id && !showInvariants && 'bg-blue-50 border border-blue-200'
              )}
              onClick={() => onVariationSelect(variation)}
            >
              <div>
                <h3 className="font-medium text-sm">{variation.name}</h3>
                {variation.description && (
                  <p className="text-xs text-gray-500">{variation.description}</p>
                )}
                <p className="text-xs text-gray-400 mt-1">
                  {selectedDesignSystem?.variationValues.filter(vv => vv.variationId === variation.id).length || 0} value(s)
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default VariationsPanel; 