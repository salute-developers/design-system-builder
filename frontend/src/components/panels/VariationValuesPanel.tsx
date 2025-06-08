import React from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Label } from '../ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import type { Variation, DesignSystem, VariationValue, Token } from '../../types';

interface VariationValuesPanelProps {
  selectedVariation: Variation;
  selectedDesignSystem: DesignSystem;
  selectedComponent: any;
  editingVariationValue: VariationValue | null;
  newVariationValue: {
    componentId: string;
    variationId: string;
    name: string;
    description: string;
    tokenValues: { tokenId: number; value: string }[];
  };
  setNewVariationValue: (value: any) => void;
  setEditingVariationValue: (value: VariationValue | null) => void;
  onOpenEditVariationValueDialog: (variationValue: VariationValue) => void;
  onOpenEditTokenValuesDialog: (variationValue: VariationValue) => void;
  onUpdateVariationValue: (e: React.FormEvent) => Promise<void>;
  onAddVariationValue: (e: React.FormEvent) => Promise<void>;
  onOpenAddVariationValueDialog: () => void;
}

const VariationValuesPanel: React.FC<VariationValuesPanelProps> = ({
  selectedVariation,
  selectedDesignSystem,
  selectedComponent,
  editingVariationValue,
  newVariationValue,
  setNewVariationValue,
  setEditingVariationValue,
  onOpenEditVariationValueDialog,
  onOpenEditTokenValuesDialog,
  onUpdateVariationValue,
  onAddVariationValue,
  onOpenAddVariationValueDialog,
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

        {/* Add New Variation Value Form */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>{editingVariationValue ? 'Edit' : 'Add'} Variation Value</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={editingVariationValue ? onUpdateVariationValue : onAddVariationValue} className="space-y-4">
              <div>
                <Label htmlFor="variationValueName">Value Name</Label>
                <Input
                  id="variationValueName"
                  value={newVariationValue.name}
                  onChange={(e) => setNewVariationValue({ ...newVariationValue, name: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="variationValueDescription">Description</Label>
                <Textarea
                  id="variationValueDescription"
                  value={newVariationValue.description}
                  onChange={(e) => setNewVariationValue({ ...newVariationValue, description: e.target.value })}
                />
              </div>
              {(() => {
                // Get tokens from the selected variation
                const availableTokens = selectedVariation.tokens || 
                  (selectedVariation.tokenVariations?.map(tv => tv.token).filter(Boolean) as Token[]) || [];
                
                return availableTokens.map((token: Token) => (
                  <div key={token.id}>
                    <Label htmlFor={`token-${token.id}`}>
                      {token.name} {token.defaultValue && `(Default: ${token.defaultValue})`}
                    </Label>
                    <Input
                      id={`token-${token.id}`}
                      value={newVariationValue.tokenValues.find(tv => tv.tokenId === token.id)?.value || ''}
                      onChange={(e) => {
                        const tokenValues = [...newVariationValue.tokenValues];
                        const existingIndex = tokenValues.findIndex(tv => tv.tokenId === token.id);
                        if (existingIndex >= 0) {
                          tokenValues[existingIndex] = { tokenId: token.id, value: e.target.value };
                        } else {
                          tokenValues.push({ tokenId: token.id, value: e.target.value });
                        }
                        setNewVariationValue({ ...newVariationValue, tokenValues });
                      }}
                      placeholder={token.defaultValue || `Enter ${token.name} value`}
                      required
                    />
                  </div>
                ));
              })()}
              <div className="flex gap-2">
                <Button 
                  type="submit"
                  onClick={() => {
                    if (!editingVariationValue) {
                      setNewVariationValue({
                        ...newVariationValue,
                        componentId: selectedComponent?.component.id.toString() || '',
                        variationId: selectedVariation.id.toString()
                      });
                    }
                  }}
                >
                  {editingVariationValue ? 'Update' : 'Add'} Variation Value
                </Button>
                {editingVariationValue && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setEditingVariationValue(null);
                      setNewVariationValue({
                        componentId: '',
                        variationId: '',
                        name: '',
                        description: '',
                        tokenValues: []
                      });
                    }}
                  >
                    Cancel
                  </Button>
                )}
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default VariationValuesPanel; 