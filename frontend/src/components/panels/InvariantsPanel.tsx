import React from 'react';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import type { Component, InvariantTokenValue } from '../../types';

interface InvariantsPanelProps {
  selectedComponent: Component;
  invariantTokenValues: InvariantTokenValue[];
  onOpenEditInvariantsDialog: () => void;
  onDeleteInvariantTokenValue: (tokenValueId: number) => void;
}

const InvariantsPanel: React.FC<InvariantsPanelProps> = ({
  selectedComponent,
  invariantTokenValues,
  onOpenEditInvariantsDialog,
  onDeleteInvariantTokenValue,
}) => {
  return (
    <div className="flex-1 h-full flex flex-col bg-white">
      {/* Header - Fixed */}
      <div className="flex-shrink-0 p-4 border-b border-gray-200">
        <div className="max-w-2xl mx-auto">
          <div className="mb-4 flex justify-between items-center">
            <div>
              <h2 className="text-lg font-semibold">Invariant Token Values</h2>
              <p className="text-sm text-gray-600">{selectedComponent.name}</p>
            </div>
            <Button onClick={onOpenEditInvariantsDialog} size="sm">
              Edit Invariants
            </Button>
          </div>
        </div>
      </div>
      
      {/* Content - Scrollable */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-2xl mx-auto">
          <div className="space-y-4">
            {invariantTokenValues.length === 0 ? (
              <div className="text-center py-8">
                <div className="text-gray-400 mb-4">
                  <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Invariant Values</h3>
                <p className="text-gray-500 mb-4">
                  This component doesn't have any invariant token values yet.
                </p>
                <Button onClick={onOpenEditInvariantsDialog}>
                  Add Invariant Values
                </Button>
              </div>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle>Component Invariants</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {invariantTokenValues.map((tokenValue) => (
                      <div key={tokenValue.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg group">
                        <div className="flex-1">
                          <div className="font-medium text-sm">{tokenValue.token.name}</div>
                          {tokenValue.token.description && (
                            <div className="text-xs text-gray-500 mt-1">{tokenValue.token.description}</div>
                          )}
                          <div className="text-sm text-gray-600 mt-2">
                            Value: <span className="font-mono bg-white px-2 py-1 rounded border">{tokenValue.value}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="text-xs text-gray-400">
                            {new Date(tokenValue.updatedAt).toLocaleDateString()}
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              if (confirm('Are you sure you want to delete this invariant token value?')) {
                                onDeleteInvariantTokenValue(tokenValue.id);
                              }
                            }}
                            className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            ×
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default InvariantsPanel;

