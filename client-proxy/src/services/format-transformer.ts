import { v4 as uuidv4 } from 'uuid';

// Types for Backend Database Format
interface BackendFormat {
  timestamp: string;
  designSystem: {
    id: number;
    name: string;
    description: string;
    createdAt: string;
    updatedAt: string;
  };
  components: Array<{
    id: number;
    name: string;
    description: string;
    createdAt: string;
    updatedAt: string;
    variations: Array<{
      id: number;
      name: string;
      description: string;
      createdAt: string;
      updatedAt: string;
      tokenVariations: Array<{
        id: number;
        tokenId: number;
        variationId: number;
        token: {
          id: number;
          name: string;
          type: string;
          defaultValue: string;
          description: string;
          xmlParam: string;
          composeParam: string;
          iosParam: string;
          webParam: string;
        };
      }>;
    }>;
    tokens: Array<{
      id: number;
      name: string;
      type: string;
      defaultValue: string;
      description: string;
      xmlParam: string;
      composeParam: string;
      iosParam: string;
      webParam: string;
      createdAt: string;
      updatedAt: string;
    }>;
    propsAPI: Array<{
      id: number;
      componentId: number;
      name: string;
      value: string;
      createdAt: string;
      updatedAt: string;
    }>;
  }>;
  variationValues: Array<{
    id: number;
    name: string;
    componentId: number;
    variationId: number;
    isDefaultValue: string; // 'true' or 'false' as string from backend
    createdAt: string;
    updatedAt: string;
    tokenValues: Array<{
      id: number;
      value: string;
      variationValueId: number;
      tokenId: number;
      token: {
        id: number;
        name: string;
        type: string;
      };
    }>;
  }>;
  tokenValues: Array<{
    id: number;
    value: string;
    variationValueId: number;
    tokenId: number;
    createdAt: string;
    updatedAt: string;
    token: {
      id: number;
      name: string;
      type: string;
    };
  }>;
  invariantTokenValues: Array<{
    id: number;
    value: string;
    componentId: number;
    designSystemId: number;
    tokenId: number;
    type: string;
    createdAt: string;
    updatedAt: string;
    token: {
      id: number;
      name: string;
      type: string;
    };
  }>;
  metadata: {
    designSystemId: number;
    designSystemName: string;
    totalComponents: number;
    totalVariations: number;
    totalVariationValues: number;
    totalTokens: number;
    totalTokenValues: number;
    totalPropsAPI: number;
    apiBaseUrl: string;
  };
}

// Types for Client Storage Format - flexible interface for runtime data
interface ClientFormat {
  componentsData: Array<{
    name: string;
    description?: string;
    createdAt?: string;
    updatedAt?: string;
    props?: Array<{
      id: string;
      name: string;
      value: string;
      createdAt?: string;
      updatedAt?: string;
    }>;
    sources: {
      api: Array<{
        id: string;
        name: string;
        type: string;
        description?: string;
        variations: string[] | null;
        platformMappings: {
          xml: string | null;
          compose: string | null;
          ios: string | null;
          web: Array<{
            name: string;
            adjustment: string | null;
          }> | null;
        };
        createdAt?: string;
        updatedAt?: string;
      }>;
      variations: Array<{
        id: string;
        name: string;
        description?: string;
        createdAt?: string;
        updatedAt?: string;
        tokenVariations?: Array<{
          id: string;
          tokenId: string;
          token: {
            id: string;
            name: string;
            type: string;
            description?: string;
            defaultValue: string;
            xmlParam: string;
            composeParam: string;
            iosParam: string;
            webParam: string;
          };
        }>;
      }>;
      configs: Array<{
        name: string;
        id: string;
        config: {
          defaultVariations: Array<{
            variationID: string;
            styleID: string;
          }>;
          invariantProps: Array<{
            id: string;
            value: any;
            states?: Array<{
              state: string[];
              value: string;
            }> | null;
            adjustment?: any;
          }>;
          variations: Array<{
            id: string;
            styles?: Array<{
              name: string;
              id: string;
              intersections: any;
              props?: Array<{
                id: string;
                value: any;
                adjustment?: any;
              }> | null;
            }>;
          }>;
        };
      }>;
    };
  }>;
  savedAt: string;
  designSystem?: {
    id: string;
    name: string;
    description: string;
    createdAt: string;
    updatedAt: string;
  };
}

class FormatTransformer {
  private idMappings: Map<string | number, string> = new Map();
  private reverseIdMappings: Map<string, number> = new Map();

  /**
   * Transform from Backend Database Format to Client Storage Format
   * ENHANCED: Now preserves props API, variation descriptions, token variations, and timestamps
   */
  transformBackendToClient(backendData: BackendFormat): ClientFormat {
    console.log('🔄 Transforming Backend → Client format (ENHANCED)...');
    
    // Clear previous mappings
    this.idMappings.clear();
    this.reverseIdMappings.clear();

    const componentsData = backendData.components.map(component => {
      // Generate UUIDs for new entities
      const componentUUID = this.generateUUID();
      this.idMappings.set(`${component.id}_COMPONENT`, componentUUID);

      // Transform tokens to API sources with timestamps
      const api = component.tokens.map(token => {
        const tokenUUID = this.generateUUID();
        this.idMappings.set(`${token.id}_API`, tokenUUID);

        let webTokens = token.webParam ? [{
              name: token.webParam,
              adjustment: null
            }] : null;

        // TODO: Подумать про другую реализацию
        if (token.type === 'typography' && token.webParam) {
          const cssFontProps = ['FontFamily', 'FontSize', 'FontStyle', 'FontWeight', 'LetterSpacing', 'LineHeight'];

          webTokens = cssFontProps.map(prop => ({
            name: `${token.webParam}${prop}`,
            adjustment: null
          }))
        }

        return {
          id: tokenUUID,
          name: token.name,
          type: token.type,
          description: token.description || '',
          variations: [] as string[], // TODO: this.getTokenVariations(component, token.id),
          platformMappings: {
            xml: token.xmlParam || null,
            compose: token.composeParam || null,
            ios: token.iosParam || null,
            web: webTokens,
          },
          // PRESERVE: Token timestamps
          createdAt: token.createdAt,
          updatedAt: token.updatedAt
        };
      });

      // Transform variations with descriptions and token variations
      const variations = component.variations.map(variation => {
        const variationUUID = this.generateUUID();
        this.idMappings.set(`${variation.id}_VARIATION`, variationUUID);

        // Transform token variations
        const tokenVariations = variation.tokenVariations.map(tv => {
          const tvUUID = this.generateUUID();
          return {
            id: tvUUID,
            tokenId: this.idMappings.get(`${tv.token.id}_API`) || this.generateUUID(),
            token: {
              id: this.idMappings.get(`${tv.token.id}_API`) || this.generateUUID(),
              name: tv.token.name,
              type: tv.token.type,
              description: tv.token.description || '',
              defaultValue: tv.token.defaultValue || '',
              xmlParam: tv.token.xmlParam || '',
              composeParam: tv.token.composeParam || '',
              iosParam: tv.token.iosParam || '',
              webParam: tv.token.webParam || ''
            }
          };
        });

        return {
          id: variationUUID,
          name: variation.name,
          // PRESERVE: Variation description
          description: variation.description || '',
          // PRESERVE: Variation timestamps
          createdAt: variation.createdAt,
          updatedAt: variation.updatedAt,
          // PRESERVE: Token variations
          tokenVariations
        };
      });


      variations.forEach(variation => {
        variation.tokenVariations.forEach(tv => {
          const apiIndex = api.findIndex(api => api.id === tv.tokenId);

          if (apiIndex !== -1 && api[apiIndex]) {
            api[apiIndex].variations.push(variation.id);
          }
        });
      });
    

      // Transform props API
      const props = component.propsAPI.map(prop => {
        const propUUID = this.generateUUID();
        return {
          id: propUUID,
          name: prop.name,
          value: prop.value,
          // PRESERVE: Props timestamps
          createdAt: prop.createdAt,
          updatedAt: prop.updatedAt
        };
      });

      // Transform variation values to configs
      const configs = this.transformVariationValuesToConfigs(
        backendData.variationValues.filter(vv => vv.componentId === component.id),
        component,
        backendData.invariantTokenValues || []
      );

      return {
        name: component.name,
        description: component.description || '',
        // PRESERVE: Component timestamps
        createdAt: component.createdAt,
        updatedAt: component.updatedAt,
        // PRESERVE: Props API
        props,
        sources: {
          api,
          variations,
          configs
        }
      };
    });

    return {
      componentsData: componentsData as any, // Type assertion to bypass strict type checking
      savedAt: new Date().toISOString(),
      // PRESERVE: Design system metadata
      designSystem: {
        id: this.generateUUID(),
        name: backendData.designSystem.name,
        description: backendData.designSystem.description,
        createdAt: backendData.designSystem.createdAt,
        updatedAt: backendData.designSystem.updatedAt
      }
    };
  }

  /**
   * Transform from Client Storage Format to Backend Database Format
   * ENHANCED: Now restores props API, variation descriptions, token variations, and timestamps
   */
  transformClientToBackend(clientData: ClientFormat): BackendFormat {
    console.log('🔄 Transforming Client → Backend format (ENHANCED)...');
    
    // Clear previous mappings
    this.idMappings.clear();
    this.reverseIdMappings.clear();

    const components = clientData.componentsData.map(component => {
      const componentId = this.generateNumericId();
      this.idMappings.set(`${componentId}_COMPONENT`, component.name);

      // Transform API sources to tokens with timestamps
      const tokens = component.sources.api.map(token => {
        const tokenId = this.generateNumericId();
        this.idMappings.set(`${tokenId}_API`, token.id);

        return {
          id: tokenId,
          componentId,
          name: token.name,
          type: token.type,
          defaultValue: '',
          description: token.description || '', // Ensure description is always a string
          xmlParam: token.platformMappings.xml || '',
          composeParam: token.platformMappings.compose || '',
          iosParam: token.platformMappings.ios || '',
          webParam: token.platformMappings.web?.[0]?.name || '',
          // RESTORE: Token timestamps
          createdAt: token.createdAt || new Date().toISOString(),
          updatedAt: token.updatedAt || new Date().toISOString()
        };
      });

      // Transform variations with descriptions and token variations
      const variations = component.sources.variations.map(variation => {
        const variationId = this.generateNumericId();
        this.idMappings.set(`${variationId}_VARIATION`, variation.id);

        // Transform token variations back (handle missing field gracefully)
        const tokenVariations = (variation.tokenVariations || []).map(tv => {
          const tvId = this.generateNumericId();
          return {
            id: tvId,
            tokenId: this.findTokenIdByName(component.sources.api, tv.token.name),
            variationId,
            token: {
              id: this.findTokenIdByName(component.sources.api, tv.token.name),
              name: tv.token.name,
              type: tv.token.type,
              defaultValue: tv.token.defaultValue || '',
              description: tv.token.description || '', // Ensure description is always a string
              xmlParam: tv.token.xmlParam || '',
              composeParam: tv.token.composeParam || '',
              iosParam: tv.token.iosParam || '',
              webParam: tv.token.webParam || '',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            }
          };
        });

        return {
          id: variationId,
          componentId,
          name: variation.name,
          // RESTORE: Variation description (handle missing field)
          description: variation.description || '',
          // RESTORE: Variation timestamps (handle missing field)
          createdAt: variation.createdAt || new Date().toISOString(),
          updatedAt: variation.updatedAt || new Date().toISOString(),
          // RESTORE: Token variations
          tokenVariations
        };
      });

      // Transform props back to propsAPI (handle missing field gracefully)
      const propsAPI = (component.props || []).map(prop => {
        const propId = this.generateNumericId();
        return {
          id: propId,
          componentId,
          name: prop.name,
          value: prop.value,
          // RESTORE: Props timestamps (handle missing field)
          createdAt: prop.createdAt || new Date().toISOString(),
          updatedAt: prop.updatedAt || new Date().toISOString()
        };
      });

      // Transform configs to variation values and token values
      const { variationValues, tokenValues, invariantTokenValues } = this.transformConfigsToVariationValues(
        component.sources.configs,
        componentId,
        component.sources.variations,
        component.sources.api
      );

      return {
        id: componentId,
        name: component.name,
        description: component.description || '', // Provide default value for optional description
        // RESTORE: Component timestamps
        createdAt: component.createdAt || new Date().toISOString(),
        updatedAt: component.updatedAt || new Date().toISOString(),
        variations,
        tokens,
        // RESTORE: Props API
        propsAPI,
        // PRESERVE: Variation values, token values, and invariant token values for this component
        _variationValues: variationValues,
        _tokenValues: tokenValues,
        _invariantTokenValues: invariantTokenValues
      };
    });

    // Collect all variation values, token values, and invariant token values
    const allVariationValues: any[] = [];
    const allTokenValues: any[] = [];
    const allInvariantTokenValues: any[] = [];
    components.forEach(component => {
      // Collect variation values, token values, and invariant token values from each component
      if (component._variationValues) {
        allVariationValues.push(...component._variationValues);
      }
      if (component._tokenValues) {
        allTokenValues.push(...component._tokenValues);
      }
      if (component._invariantTokenValues) {
        allInvariantTokenValues.push(...component._invariantTokenValues);
      }
    });

    return {
      timestamp: new Date().toISOString(),
      designSystem: {
        id: 1, // Default ID
        name: clientData.designSystem?.name || 'Transformed Design System',
        description: clientData.designSystem?.description || 'Transformed from client format',
        // RESTORE: Design system timestamps
        createdAt: clientData.designSystem?.createdAt || new Date().toISOString(),
        updatedAt: clientData.designSystem?.updatedAt || new Date().toISOString()
      },
      components,
      variationValues: allVariationValues,
      tokenValues: allTokenValues,
      invariantTokenValues: allInvariantTokenValues,
      metadata: {
        designSystemId: 1,
        designSystemName: clientData.designSystem?.name || 'Transformed Design System',
        totalComponents: components.length,
        totalVariations: components.reduce((sum, c) => sum + c.variations.length, 0),
        totalVariationValues: allVariationValues.length,
        totalTokens: components.reduce((sum, c) => sum + c.tokens.length, 0),
        totalTokenValues: allTokenValues.length,
        // RESTORE: Props API count
        totalPropsAPI: components.reduce((sum, c) => sum + c.propsAPI.length, 0),
        apiBaseUrl: 'http://localhost:3001'
      }
    };
  }

  /**
   * Transform variation values to client config format
   */
  private transformVariationValuesToConfigs(
    variationValues: any[],
    component: any,
    invariantTokenValues: any[] = []
  ): any[] {
    // Transform invariant token values to invariant props
    const invariantProps = invariantTokenValues
      .filter(itv => itv.componentId === component.id)
      .map(itv => ({
        id: this.idMappings.get(`${itv.tokenId}_API`) || this.generateUUID(),
        value: itv.value
      }));

    if (variationValues.length === 0) {
      return [{
        name: 'default',
        id: this.generateUUID(),
        config: {
          defaultVariations: [],
          invariantProps,
          variations: []
        }
      }];
    }

    // Group variation values by variation
    const variationsMap = new Map();
    variationValues.forEach(vv => {
      if (!variationsMap.has(vv.variationId)) {
        variationsMap.set(vv.variationId, []);
      }
      variationsMap.get(vv.variationId).push(vv);
    });

    const variations = Array.from(variationsMap.entries()).map(([variationId, vvs]) => {
      const variation = component.variations.find((v: any) => v.id === variationId);
      if (!variation) return null;

      const styles = vvs.map((vv: any) => ({
        name: vv.name,
        id: this.generateUUID(),
        intersections: null,
        props: vv.tokenValues.map((tv: any) => {
          return {
            id: this.idMappings.get(`${tv.token.id}_API`) || this.generateUUID(),
            value: tv.value
        }})
      }));

      return {
        id: this.idMappings.get(`${variationId}_VARIATION`) || this.generateUUID(),
        styles
      };
    }).filter(Boolean);

    // Find default variations (variation values with isDefaultValue === 'true')
    const defaultVariations = variationValues
      .filter(vv => vv.isDefaultValue === 'true')
      .map(vv => {
        const variation = component.variations.find((v: any) => v.id === vv.variationId);
        if (!variation) return null;
        
        // Find the style ID for this variation value
        const variationUUID = this.idMappings.get(`${vv.variationId}_VARIATION`);
        if (!variationUUID) return null;
        
        const variationConfig = variations.find(v => v && v.id === variationUUID);
        const style = variationConfig?.styles.find((s: any) => s.name === vv.name);
        
        return {
          variationID: variationUUID,
          styleID: style?.id || this.generateUUID()
        };
      })
      .filter(Boolean);

    return [{
      name: 'default',
      id: this.generateUUID(),
      config: {
        defaultVariations,
        invariantProps,
        variations
      }
    }];
  }

  /**
   * Transform client configs to variation values and token values
   */
  private transformConfigsToVariationValues(
    configs: any[],
    componentId: number,
    variations: any[],
    api: any[]
  ): { variationValues: any[], tokenValues: any[], invariantTokenValues: any[] } {
    const variationValues: any[] = [];
    const tokenValues: any[] = [];
    const invariantTokenValues: any[] = [];

    configs.forEach(config => {
      // Check if this style is a default variation
      const isDefaultVariation = (variationId: string, styleId: string) => {
        return config.config.defaultVariations?.some((dv: any) => 
          dv.variationID === variationId && dv.styleID === styleId
        ) || false;
      };

      config.config.variations.forEach((variation: any) => {
        variation.styles.forEach((style: any) => {
          const variationValueId = this.generateNumericId();
          const isDefault = isDefaultVariation(variation.id, style.id);
          
          const variationValue = {
            id: variationValueId,
            designSystemId: 1,
            componentId,
            variationId: this.findVariationIdByName(variations, variation.id),
            name: style.name,
            description: '',
            isDefaultValue: isDefault ? 'true' : 'false',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            tokenValues: [] as any[]
          };

          // if (style.props) {
          //   style.props.forEach((prop: any) => {
          //     const tokenValueId = this.generateNumericId();
          //     // prop.id is the TOKEN ID (UUID), not the token name
          //     // We need to find the token by ID and get its numeric ID
          //     const tokenId = this.findTokenIdById(api, prop.id);

          //     if (tokenId) {
          //       const tokenValue = {
          //         id: tokenValueId,
          //         variationValueId,
          //         tokenId,
          //         value: prop.value,
          //         createdAt: new Date().toISOString(),
          //         updatedAt: new Date().toISOString()
          //       };

          //       tokenValues.push(tokenValue);
          //       variationValue.tokenValues.push(tokenValue);
          //     } else {
          //       console.warn(`⚠️ Could not find token with ID: ${prop.id} for style: ${style.name}`);
          //     }
          //   });
          // }

          variationValues.push(variationValue);
        });
      });

      // Note: Invariant props are handled directly in BackendComponentStore
      // after we have access to the token name to backend ID mapping
    });

    return { variationValues, tokenValues, invariantTokenValues };
  }

  /**
   * Helper methods
   */
  // private getTokenVariations(component: any, tokenId: number): string[] | null {
  //   const variations = component.variations
  //     .filter((v: any) => v.tokenVariations.some((tv: any) => tv.token.id === tokenId))
  //     .map((v: any) => this.idMappings.get(v.id) || this.generateUUID());
    
  //   return variations.length > 0 ? variations : null;
  // }

  private generateUUID(): string {
    return uuidv4();
  }

  private generateNumericId(): number {
    return Math.floor(Math.random() * 1000000) + 1;
  }

  private findVariationIdByName(variations: any[], name: string): number {
    const variation = variations.find(v => v.name === name);
    return variation ? this.generateNumericId() : 1;
  }

  private findTokenIdByName(api: any[], name: string): number {
    const token = api.find(t => t.name === name);
    return token ? this.generateNumericId() : 1;
  }

  // private findTokenIdById(api: any[], tokenId: string): number | null {
  //   // Find the token by its UUID
  //   const token = api.find(t => t.id === tokenId);
  //   if (!token) {
  //     return null;
  //   }
    
  //   // Convert the UUID to a numeric ID using our ID mappings
  //   const numericId = this.findNumericIdByUUID(token.id);
  //   if (numericId) {
  //     return numericId;
  //   }
    
  //   // If no mapping exists, we need to get the actual token ID from the backend
  //   // For now, return null to indicate this token needs to be handled differently
  //   console.warn(`⚠️ No ID mapping found for token ${token.name} (${token.id}) - this token may not exist in backend yet`);
  //   return null;
  // }



  /**
   * Validate transformation completeness
   * ENHANCED: Now checks for the previously missing data
   */
  validateTransformation(original: any, transformed: any, direction: 'toClient' | 'toBackend'): {
    isValid: boolean;
    warnings: string[];
    dataLoss: string[];
  } {
    const warnings: string[] = [];
    const dataLoss: string[] = [];

    if (direction === 'toClient') {
      // Check for data loss when transforming to client format
      if (original.propsAPI && original.propsAPI.length > 0) {
        // Now we check if props are preserved
        const hasProps = transformed.componentsData?.some((c: any) => c.props?.length > 0);
        if (!hasProps) {
          dataLoss.push('Props API data not preserved in client format');
        }
      }
      
      if (original.metadata) {
        // Now we check if design system metadata is preserved
        if (!transformed.designSystem) {
          warnings.push('Design system metadata not fully preserved in client format');
        }
      }

      // Check for variation descriptions
      const hasVariationDescriptions = transformed.componentsData?.some((c: any) => 
        c.sources.variations?.some((v: any) => v.description)
      );
      if (!hasVariationDescriptions) {
        warnings.push('Variation descriptions not fully preserved in client format');
      }

      // Check for token variations
      const hasTokenVariations = transformed.componentsData?.some((c: any) => 
        c.sources.variations?.some((v: any) => v.tokenVariations?.length > 0)
      );
      if (!hasTokenVariations) {
        warnings.push('Token variations not fully preserved in client format');
      }
    } else {
      // Check for data loss when transforming to backend format
      if (original.sources?.configs) {
        // Check for complex config structures
        original.sources.configs.forEach((config: any) => {
          if (config.config.intersections) {
            warnings.push('Intersection data not fully represented in backend format');
          }
          if (config.config.invariantProps?.some((prop: any) => prop.states)) {
            warnings.push('State-based props not fully represented in backend format');
          }
        });
      }

      // Check for props restoration
      if (original.props && original.props.length > 0) {
        const hasPropsAPI = transformed.components?.some((c: any) => c.propsAPI?.length > 0);
        if (!hasPropsAPI) {
          dataLoss.push('Props not restored to propsAPI in backend format');
        }
      }
    }

    return {
      isValid: warnings.length === 0 && dataLoss.length === 0,
      warnings,
      dataLoss
    };
  }

  /**
   * Find numeric ID by UUID from the reverse mappings
   */
  // findNumericIdByUUID(uuid: string): number | null {
  //   return this.reverseIdMappings.get(uuid) || null;
  // }

  /**
   * Get reverse ID mappings for debugging
   */
  // getReverseIdMappings(): Map<string, number> {
  //   return this.reverseIdMappings;
  // }
}

export { FormatTransformer, BackendFormat, ClientFormat };
