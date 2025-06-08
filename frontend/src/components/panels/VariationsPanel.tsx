import React from 'react';
import { cn } from '../../lib/utils';
import { Input } from '../ui/input';
import type { Variation, DesignSystem } from '../../types';

interface VariationsPanelProps {
  selectedComponent: any;
  selectedVariation: Variation | null;
  selectedDesignSystem: DesignSystem | null;
  variationSearchTerm: string;
  setVariationSearchTerm: (term: string) => void;
  onVariationSelect: (variation: Variation) => void;
  filterVariations: (variations: Variation[]) => Variation[];
}

const VariationsPanel: React.FC<VariationsPanelProps> = ({
  selectedComponent,
  selectedVariation,
  selectedDesignSystem,
  variationSearchTerm,
  setVariationSearchTerm,
  onVariationSelect,
  filterVariations,
}) => {
  return (
    <div className="w-1/4 p-3 border-r border-gray-200 bg-white">
      <div className="mb-4">
        <h2 className="text-lg font-semibold">Variations</h2>
        <p className="text-sm text-gray-600">{selectedComponent.component.name}</p>
      </div>
      <div className="mb-4">
        <Input
          placeholder="Search variations..."
          value={variationSearchTerm}
          onChange={(e) => setVariationSearchTerm(e.target.value)}
          className="mb-2"
        />
      </div>
      <div className="space-y-2">
        {filterVariations(selectedComponent.component.variations || []).map((variation: Variation) => (
          <div
            key={variation.id}
            className={cn(
              'p-2 rounded cursor-pointer hover:bg-gray-50 group',
              selectedVariation?.id === variation.id && 'bg-blue-50 border border-blue-200'
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
  );
};

export default VariationsPanel; 