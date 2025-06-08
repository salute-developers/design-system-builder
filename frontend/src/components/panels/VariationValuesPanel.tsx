import React from 'react';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import type { Variation, DesignSystem, VariationValue } from '../../types';

interface VariationValuesPanelProps {
  selectedVariation: Variation;
  selectedDesignSystem: DesignSystem;
  onOpenEditVariationValueDialog: (variationValue: VariationValue) => void;
  onOpenEditTokenValuesDialog: (variationValue: VariationValue) => void;
  onOpenAddVariationValueDialog: () => void;
  onDeleteVariationValue: (variationValue: VariationValue) => void;
}

const VariationValuesPanel: React.FC<VariationValuesPanelProps> = ({
  selectedVariation,
  selectedDesignSystem,
  onOpenEditVariationValueDialog,
  onOpenEditTokenValuesDialog,
  onOpenAddVariationValueDialog,
  onDeleteVariationValue,
}) => {
  return (
    <div className="flex-1 p-4 bg-white overflow-y-auto">
      <div className="max-w-2xl mx-auto">
        <div className="mb-4 flex justify-between items-center">
          <div>
            <h2 className="text-lg font-semibold">{selectedVariation.name} Values</h2>
            <p className="text-sm text-gray-600">{selectedVariation.description}</p>
          </div>
          <Button onClick={onOpenAddVariationValueDialog} size="sm">
            Add Value
          </Button>
        </div>

        <div className="space-y-4">
          {selectedDesignSystem.variationValues
            .filter(vv => vv.variationId === selectedVariation.id)
            .map((variationValue) => (
              <Card key={variationValue.id} className="mb-2">
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle>{variationValue.name}</CardTitle>
                      <p>{variationValue.description}</p>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onOpenEditVariationValueDialog(variationValue)}
                      >
                        Edit Value
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onOpenEditTokenValuesDialog(variationValue)}
                      >
                        Edit Tokens
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onDeleteVariationValue(variationValue)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        Delete
                      </Button>
                    </div>
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
      </div>
    </div>
  );
};

export default VariationValuesPanel; 