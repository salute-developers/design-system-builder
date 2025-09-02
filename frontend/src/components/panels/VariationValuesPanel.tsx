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
  onSetDefaultVariationValue: (variationValue: VariationValue) => void;
}

const VariationValuesPanel: React.FC<VariationValuesPanelProps> = ({
  selectedVariation,
  selectedDesignSystem,
  onOpenEditVariationValueDialog,
  onOpenEditTokenValuesDialog,
  onOpenAddVariationValueDialog,
  onDeleteVariationValue,
  onSetDefaultVariationValue,
}) => {
  return (
    <div className="flex-1 h-full flex flex-col bg-white">
      {/* Header - Fixed */}
      <div className="flex-shrink-0 p-4 border-b border-gray-200">
        <div className="max-w-2xl mx-auto">
          <div className="mb-4 flex justify-between items-center">
            <div>
              <h2 className="text-lg font-semibold">{selectedVariation.name} Values</h2>
            </div>
            <Button onClick={onOpenAddVariationValueDialog} size="sm">
              Add Value
            </Button>
          </div>
        </div>
      </div>
      
      {/* Content - Scrollable */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-2xl mx-auto">
          <div className="space-y-4">
            {selectedDesignSystem.variationValues
              .filter(vv => vv.variationId === selectedVariation.id)
              .sort((a, b) => a.id - b.id)
              .map((variationValue) => (
                <Card key={variationValue.id} className={`mb-2 ${variationValue.isDefaultValue === 'true' ? 'ring-2 ring-blue-500 bg-blue-50' : ''}`}>
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div className="flex-1 pr-4">
                        <div className="flex items-center gap-2">
                          <CardTitle>{variationValue.name}</CardTitle>
                          {variationValue.isDefaultValue === 'true' && (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                              Default
                            </span>
                          )}
                        </div>
                        {variationValue.description && (
                          <p className="text-sm text-gray-600 mt-1">{variationValue.description}</p>
                        )}
                      </div>
                      <div className="flex flex-col gap-1 flex-shrink-0">
                        {variationValue.isDefaultValue !== 'true' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onSetDefaultVariationValue(variationValue)}
                            className="whitespace-nowrap text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                          >
                            Set as Default
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onOpenEditVariationValueDialog(variationValue)}
                          className="whitespace-nowrap text-xs"
                        >
                          Edit Value
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onOpenEditTokenValuesDialog(variationValue)}
                          className="whitespace-nowrap text-xs"
                        >
                          Edit Tokens
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onDeleteVariationValue(variationValue)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50 whitespace-nowrap text-xs"
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
    </div>
  );
};

export default VariationValuesPanel; 