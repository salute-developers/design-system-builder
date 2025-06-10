import type { Meta, ComponentAPI, ComponentVariation } from '../componentBuilder';
import type { 
  DesignSystem, 
  DesignSystemDetailed, 
  Component, 
  ComponentDetailed, 
  Variation, 
  Token,
  VariationValue,
  CreateDesignSystemRequest,
  CreateVariationValueRequest 
} from './designSystemApi';

/**
 * Data transformation utilities for mapping between client and backend formats
 */
export class DataTransformer {
  
  // ========== DESIGN SYSTEM TRANSFORMATIONS ==========
  
  /**
   * Transform client design system data to backend format for creation
   */
  static clientDesignSystemToBackend(name: string, description?: string): CreateDesignSystemRequest {
    return {
      name: name.trim(),
      description: description?.trim() || undefined,
    };
  }

  /**
   * Transform backend design system to client format
   */
  static backendDesignSystemToClient(backendDS: DesignSystemDetailed) {
    return {
      id: backendDS.id,
      name: backendDS.name,
      description: backendDS.description,
      components: backendDS.components.map(comp => this.backendComponentToClient(comp.component)),
      variationValues: backendDS.variationValues,
      createdAt: backendDS.createdAt,
      updatedAt: backendDS.updatedAt,
    };
  }

  // ========== COMPONENT TRANSFORMATIONS ==========

  /**
   * Transform backend component to client Meta format
   * This method will fetch variation values from the current design system if available
   */
  static async backendComponentToClientAsync(
    backendComponent: ComponentDetailed, 
    designSystemId?: number
  ): Promise<Meta> {
    console.log('Transforming backend component:', backendComponent.name);
    console.log('Component variations:', backendComponent.variations);
    
    const variations: ComponentVariation[] = backendComponent.variations.map(variation => ({
      id: variation.id.toString(),
      name: variation.name,
    }));

    const api: ComponentAPI[] = backendComponent.tokens.map(token => this.backendTokenToClientAPI(token));

    // Fetch design system with variation values if available
    let designSystemVariationValues: any[] = [];
    if (designSystemId) {
      try {
        const { designSystemAPI } = await import('./designSystemApi');
        const designSystem = await designSystemAPI.getDesignSystem(designSystemId);
        designSystemVariationValues = designSystem.variationValues || [];
        console.log(`Found ${designSystemVariationValues.length} variation values in design system`);
      } catch (error) {
        console.warn('Failed to fetch design system variation values:', error);
      }
    }

    // Transform backend variations to client config format
    const configVariations = await Promise.all(backendComponent.variations.map(async (variation) => {
      console.log(`Processing variation ${variation.name} (ID: ${variation.id})`);
      
      // Get variation values for this specific variation from design system
      const thisVariationValues = designSystemVariationValues.filter(vv => 
        vv.variationId === variation.id && vv.componentId === backendComponent.id
      );
      console.log(`Found ${thisVariationValues.length} variation values for variation ${variation.name}`);
      
      let styles: Array<{
        name: string;
        id: string;
        intersections: null;
        props: Array<{ id: string; value: string }>;
      }> = [];

      if (thisVariationValues.length > 0) {
        // Create styles from actual variation values with token values
        styles = thisVariationValues.map((variationValue) => {
          const tokenValues = variationValue.tokenValues || [];
          console.log(`Processing ${tokenValues.length} token values for style ${variationValue.name}`);
          
          return {
            name: variationValue.name,
            id: `style-${variation.id}-${variationValue.id}`,
            intersections: null,
            props: tokenValues.map((tokenValue: any) => ({
              id: tokenValue.tokenId.toString(),
              value: tokenValue.value || ''
            }))
          };
        });
      } else if (variation.tokenVariations) {
        // Fallback: create a default style with token default values
        const tokenProps = variation.tokenVariations.map(tokenVar => ({
          id: tokenVar.token.id.toString(),
          value: tokenVar.token.defaultValue || ''
        }));
        
        styles = [{
          name: 'default',
          id: `style-${variation.id}-0`,
          intersections: null,
          props: tokenProps
        }];
      } else {
        // Create empty default style so variation shows up
        styles = [{
          name: 'default',
          id: `style-${variation.id}-0`,
          intersections: null,
          props: []
        }];
      }

      console.log(`Created ${styles.length} styles for variation ${variation.name}:`, styles.map(s => s.name));
      return {
        id: variation.id.toString(),
        styles: styles
      };
    }));

    // Create default variations (use first style of each variation as default)
    const defaultVariations = backendComponent.variations.map(variation => ({
      variationID: variation.id.toString(),
      styleID: `style-${variation.id}-${designSystemVariationValues.find(vv => vv.variationId === variation.id)?.id || '0'}`
    }));

    const result = {
      name: backendComponent.name,
      description: backendComponent.description || '',
      sources: {
        api,
        variations,
        config: {
          defaultVariations,
          invariantProps: [],
          variations: configVariations
        }
      }
    };
    
    console.log('Transformed component result:', result);
    return result;
  }

  /**
   * Transform backend component to client Meta format (synchronous version)
   * This is the original method for backward compatibility
   */
  static backendComponentToClient(backendComponent: ComponentDetailed): Meta {
    console.log('Transforming backend component (sync):', backendComponent.name);
    console.log('Component variations:', backendComponent.variations);
    
    const variations: ComponentVariation[] = backendComponent.variations.map(variation => ({
      id: variation.id.toString(),
      name: variation.name,
    }));

    const api: ComponentAPI[] = backendComponent.tokens.map(token => this.backendTokenToClientAPI(token));

    // Transform backend variations to client config format
    const configVariations = backendComponent.variations.map(variation => {
      console.log(`Processing variation ${variation.name} (ID: ${variation.id})`);
      console.log('TokenVariations:', variation.tokenVariations);
      
      // Extract unique variation values from tokenVariations
      const variationValueGroups = new Map<string, Array<{ tokenId: string; value: string }>>();
      
      // Group token variations by some logical identifier
      // Since backend doesn't have explicit "styles", we'll create them based on token value patterns
      if (variation.tokenVariations) {
        variation.tokenVariations.forEach(tokenVar => {
          const token = tokenVar.token;
          
          // For now, create a single "default" style that contains all tokens for this variation
          // In a more sophisticated implementation, you might group by actual style names
          const styleKey = 'default';
          
          if (!variationValueGroups.has(styleKey)) {
            variationValueGroups.set(styleKey, []);
          }
          
          variationValueGroups.get(styleKey)!.push({
            tokenId: token.id.toString(),
            value: token.defaultValue || '' // Use defaultValue as the variation value
          });
        });
      }
      
      // If no tokenVariations, still create a default style so the variation shows up
      if (variationValueGroups.size === 0) {
        variationValueGroups.set('default', []);
      }
      
      // Convert groups to styles format
      const styles = Array.from(variationValueGroups.entries()).map(([styleName, tokens], index) => ({
        name: styleName,
        id: `style-${variation.id}-${index}`,
        intersections: null,
        props: tokens.map(({ tokenId, value }) => ({
          id: tokenId,
          value: value,
        }))
      }));

      console.log(`Created ${styles.length} styles for variation ${variation.name}`);
      return {
        id: variation.id.toString(),
        styles: styles
      };
    });

    // Create default variations (use first style of each variation as default)
    const defaultVariations = backendComponent.variations.map(variation => ({
      variationID: variation.id.toString(),
      styleID: `style-${variation.id}-0` // Use first style as default
    }));

    const result = {
      name: backendComponent.name,
      description: backendComponent.description || '',
      sources: {
        api,
        variations,
        config: {
          defaultVariations,
          invariantProps: [],
          variations: configVariations
        }
      }
    };
    
    console.log('Transformed component result:', result);
    return result;
  }

  /**
   * Transform backend token to client ComponentAPI format
   */
  static backendTokenToClientAPI(backendToken: Token): ComponentAPI {
    return {
      id: backendToken.id.toString(),
      name: backendToken.name,
      type: this.mapBackendTokenTypeToClient(backendToken.type),
      description: backendToken.description,
      variations: null, // Will be populated based on token-variation relationships
      platformMappings: {
        xml: backendToken.xmlParam || null,
        compose: backendToken.composeParam || null,
        ios: backendToken.iosParam || null,
        web: backendToken.webParam ? [{ name: backendToken.webParam, adjustment: null }] : null,
      },
    };
  }

  /**
   * Map backend token types to client prop types
   */
  static mapBackendTokenTypeToClient(backendType: string): 'color' | 'dimension' | 'float' | 'shape' | 'typography' {
    switch (backendType.toLowerCase()) {
      case 'color':
        return 'color';
      case 'spacing':
      case 'size':
      case 'dimension':
        return 'dimension';
      case 'number':
      case 'opacity':
      case 'float':
        return 'float';
      case 'border':
      case 'radius':
      case 'shape':
        return 'shape';
      case 'typography':
      case 'font':
        return 'typography';
      default:
        return 'dimension'; // Default fallback
    }
  }

  /**
   * Map client prop types to backend token types
   */
  static mapClientTokenTypeToBackend(clientType: 'color' | 'dimension' | 'float' | 'shape' | 'typography'): string {
    switch (clientType) {
      case 'color':
        return 'color';
      case 'dimension':
        return 'spacing';
      case 'float':
        return 'number';
      case 'shape':
        return 'border';
      case 'typography':
        return 'typography';
      default:
        return 'spacing';
    }
  }

  // ========== VARIATION VALUE TRANSFORMATIONS ==========

  /**
   * Transform client variation value to backend format for creation
   */
  static clientVariationValueToBackend(
    designSystemId: number,
    componentId: number,
    variationId: number,
    name: string,
    description?: string,
    tokenValues?: Array<{ tokenId: number; value: string }>
  ): CreateVariationValueRequest {
    return {
      designSystemId,
      componentId,
      variationId,
      name: name.trim(),
      description: description?.trim() || undefined,
      tokenValues: tokenValues || undefined,
    };
  }

  /**
   * Transform backend variation value to client format
   */
  static backendVariationValueToClient(backendVariationValue: VariationValue) {
    return {
      id: backendVariationValue.id,
      designSystemId: backendVariationValue.designSystemId,
      componentId: backendVariationValue.componentId,
      variationId: backendVariationValue.variationId,
      name: backendVariationValue.name,
      description: backendVariationValue.description,
      createdAt: backendVariationValue.createdAt,
      updatedAt: backendVariationValue.updatedAt,
    };
  }

  // ========== UTILITY FUNCTIONS ==========

  /**
   * Generate display name from a semantic name
   * Example: "button.background.primary" -> "buttonBackgroundPrimary"
   */
  static generateDisplayName(semanticName: string): string {
    return semanticName
      .split('.')
      .map((part, index) => 
        index === 0 ? part : part.charAt(0).toUpperCase() + part.slice(1)
      )
      .join('');
  }

  /**
   * Generate semantic name from display name
   * Example: "buttonBackgroundPrimary" -> "button.background.primary"
   */
  static generateSemanticName(displayName: string, componentName?: string): string {
    // Simple camelCase to kebab-case conversion
    const kebabCase = displayName
      .replace(/([a-z])([A-Z])/g, '$1.$2')
      .toLowerCase();
    
    if (componentName) {
      return `${componentName.toLowerCase()}.${kebabCase}`;
    }
    
    return kebabCase;
  }

  /**
   * Validate required fields for component creation
   */
  static validateComponentData(name: string, variations: any[], tokens: any[]): string[] {
    const errors: string[] = [];
    
    if (!name || name.trim().length === 0) {
      errors.push('Component name is required');
    }
    
    if (!variations || variations.length === 0) {
      errors.push('At least one variation is required');
    }
    
    if (!tokens || tokens.length === 0) {
      errors.push('At least one token is required');
    }
    
    return errors;
  }

  /**
   * Sanitize string inputs for API calls
   */
  static sanitizeString(input: string | undefined): string | undefined {
    if (!input) return undefined;
    return input.trim().replace(/\s+/g, ' ');
  }

  /**
   * Extract component name from full component path
   * Example: "plasma-button" -> "Button"
   */
  static extractComponentName(componentPath: string): string {
    const parts = componentPath.split('-');
    return parts
      .map(part => part.charAt(0).toUpperCase() + part.slice(1))
      .join('');
  }

  /**
   * Generate tags from semantic name
   * Example: "light.text.primary" -> ["light", "text", "primary"]
   */
  static generateTags(semanticName: string): string[] {
    return semanticName.split('.').filter(tag => tag.length > 0);
  }

  /**
   * Create a standardized token naming convention
   */
  static createTokenName(component: string, property: string, variant?: string): string {
    const parts = [component.toLowerCase(), property.toLowerCase()];
    if (variant) {
      parts.push(variant.toLowerCase());
    }
    return parts.join('.');
  }

  /**
   * Parse token name into components
   */
  static parseTokenName(tokenName: string): { component?: string; property?: string; variant?: string } {
    const parts = tokenName.split('.');
    return {
      component: parts[0] || undefined,
      property: parts[1] || undefined,
      variant: parts[2] || undefined,
    };
  }

  /**
   * Check if a value is a valid color value
   */
  static isValidColor(value: string): boolean {
    // Basic color validation (hex, rgb, rgba, named colors)
    const colorRegex = /^(#[0-9A-Fa-f]{3,8}|rgb\(|rgba\(|hsl\(|hsla\(|[a-zA-Z]+).*$/;
    return colorRegex.test(value);
  }

  /**
   * Check if a value is a valid dimension value
   */
  static isValidDimension(value: string): boolean {
    // Basic dimension validation (px, rem, em, %, etc.)
    const dimensionRegex = /^-?[\d.]+(%|px|em|rem|vh|vw|pt|pc|in|cm|mm|ex|ch|lh|vmin|vmax)?$/;
    return dimensionRegex.test(value);
  }

  /**
   * Normalize platform-specific token values
   */
  static normalizePlatformValue(value: string, platform: 'web' | 'ios' | 'android'): string {
    switch (platform) {
      case 'web':
        // Ensure CSS-compatible values
        return value.endsWith('px') ? value : `${value}px`;
      case 'ios':
        // Remove 'px' suffix for iOS
        return value.replace('px', '');
      case 'android':
        // Convert to dp for Android
        return value.replace('px', 'dp');
      default:
        return value;
    }
  }
}

// Export additional utility types for use in components
export interface ClientComponent {
  id: number;
  name: string;
  description?: string;
  variations: Array<{
    id: string;
    name: string;
    description?: string;
  }>;
  tokens: Array<{
    id: string;
    name: string;
    type: 'color' | 'dimension' | 'float' | 'shape' | 'typography';
    description?: string;
    defaultValue?: string;
    platformMappings: {
      xml: string | null;
      compose: string | null;
      ios: string | null;
      web: Array<{ name: string; adjustment: string | null }> | null;
    };
  }>;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

export interface TransformationOptions {
  sanitizeInputs?: boolean;
  validateRequired?: boolean;
  generateDisplayNames?: boolean;
} 