import { FormatTransformer, BackendFormat, ClientFormat } from '../services';
import { DesignSystemData } from '../validation';

export class BackendComponentStore {
    private baseUrl: string;
    private transformer: FormatTransformer;

    constructor() {
        this.baseUrl = process.env.BACKEND_URL || 'http://localhost:3001/api';
        console.log(`🔧 BackendComponentStore baseUrl set to: ${this.baseUrl}`);
        this.transformer = new FormatTransformer();
    }

    /**
     * Save components to backend using our transformation system
     * Transforms from client format to backend format and stores in actual backend database
     */
    async saveComponents(name: string, version: string, componentsData: DesignSystemData['componentsData']): Promise<void> {
        console.log(`🔄 Saving components to backend: ${name}@${version}`);
        
        try {
            // Transform client format to backend format
            const clientFormat: ClientFormat = {
                componentsData: componentsData as ClientFormat['componentsData'],
                savedAt: new Date().toISOString(),
                designSystem: {
                    id: this.generateUUID(),
                    name,
                    description: `Design System ${name} version ${version}`,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                }
            };

            const backendFormat = this.transformer.transformClientToBackend(clientFormat);
            console.log(`🔍 Backend format created:`, JSON.stringify(backendFormat, null, 2));
            
            // Validate the transformation
            console.log(`🔍 Validating transformation...`);
            const validation = this.transformer.validateTransformation(clientFormat, backendFormat, 'toBackend');
            console.log(`🔍 Validation result:`, validation);
            if (!validation.isValid) {
                console.warn('⚠️ Transformation warnings:', validation.warnings);
                if (validation.dataLoss.length > 0) {
                    console.error('❌ Data loss detected:', validation.dataLoss);
                    throw new Error(`Data loss during transformation: ${validation.dataLoss.join(', ')}`);
                }
            }
            console.log(`✅ Transformation validation passed`);

            // Create or update design system in backend
            console.log(`🏗️ About to ensure design system exists: ${name}@${version}`);
            const designSystemId = await this.ensureDesignSystemExists(name, version, backendFormat.designSystem);
            console.log(`✅ Design system ensured: ${name}@${version} with ID: ${designSystemId}`);

            // Store the transformed data in the actual backend database
            console.log(`🚀 About to call storeBackendFormat for ${name}@${version}`);
            await this.storeBackendFormat(name, version, backendFormat, designSystemId, componentsData);
            console.log(`✅ storeBackendFormat completed for ${name}@${version}`);

            console.log(`✅ Components saved to backend: ${name}@${version}`);
        } catch (error) {
            console.error(`❌ Failed to save components to backend: ${name}@${version}`, error);
            throw error;
        }
    }

    /**
     * Load components from backend using our transformation system
     * We load the design system data and transform it back to client format
     */
    async loadComponents(name: string, version: string): Promise<any> {
        console.log(`🔄 Loading components from backend: ${name}@${version}`);
        
        try {
            // Get design system ID first
            const designSystemId = await this.getDesignSystemId(name);
            if (!designSystemId) {
                throw new Error(`Design system ${name} not found in backend`);
            }

            // Load design system data from backend
            const response = await fetch(`${this.baseUrl}/design-systems/${designSystemId}`);
            if (!response.ok) {
                throw new Error(`Failed to load design system: ${response.status} ${response.statusText}`);
            }

            const backendData = await response.json() as any;
            
            // Transform the backend data structure to match what FormatTransformer expects
            const transformedBackendData = this.transformBackendDataForTransformer(backendData);
            
            // Transform backend format to client format
            const clientFormat = this.transformer.transformBackendToClient(transformedBackendData);
            
            // Validate the transformation
            const validation = this.transformer.validateTransformation(backendData, clientFormat, 'toClient');
            if (!validation.isValid) {
                console.warn('⚠️ Transformation warnings:', validation.warnings);
                if (validation.dataLoss.length > 0) {
                    console.error('❌ Data loss detected:', validation.dataLoss);
                    throw new Error(`Data loss during transformation: ${validation.dataLoss.join(', ')}`);
                }
            }

            console.log(`✅ Components loaded from backend: ${name}@${version}`);
            return clientFormat.componentsData;
        } catch (error) {
            console.error(`❌ Failed to load components from backend: ${name}@${version}`, error);
            throw error;
        }
    }

    /**
     * Check if components exist in backend
     * Since we're linking existing components to design systems, 
     * we check if the design system exists (which means linking was successful)
     */
    async componentsExist(name: string, version: string): Promise<boolean> {
        try {
            const designSystemId = await this.getDesignSystemId(name);
            return designSystemId !== null;
        } catch (error) {
            return false;
        }
    }

    /**
     * Delete components from backend
     */
    async deleteComponents(name: string, version: string): Promise<void> {
        console.log(`🗑️ Deleting components from backend: ${name}@${version}`);
        
        try {
            // Remove from design systems index
            await this.removeDesignSystemFromIndex(name, version);
            
            console.log(`✅ Components deleted from backend: ${name}@${version}`);
        } catch (error) {
            console.error(`❌ Failed to delete components from backend: ${name}@${version}`, error);
            throw error;
        }
    }

    /**
     * List all component files from backend
     */
    async listComponentFiles(): Promise<string[]> {
        try {
            const response = await fetch(`${this.baseUrl}/design-systems`);
            if (!response.ok) {
                throw new Error(`Backend API error: ${response.status} ${response.statusText}`);
            }

            const designSystems = await response.json() as Array<{ id: number; name: string }>;
            return designSystems.map(ds => `${ds.name}@0.1.0.components.json`);
        } catch (error) {
            console.error('❌ Failed to list component files from backend:', error);
            return [];
        }
    }

    /**
     * Ensure design system exists in backend
     * First check if it exists with GET, then create if needed
     */
    private async ensureDesignSystemExists(name: string, version: string, designSystem: any): Promise<number> {
        try {
            // First check if design system already exists
            const existingId = await this.getDesignSystemId(name);
            if (existingId) {
                console.log(`✅ Design system already exists in backend: ${name}@${version} with ID: ${existingId}`);
                return existingId;
            }

            // Create new design system if it doesn't exist
            const response = await fetch(`${this.baseUrl}/design-systems`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    name: designSystem.name,
                    description: designSystem.description
                })
            });

            if (response.ok) {
                // New design system created
                const result = await response.json() as any;
                console.log(`✅ New design system created in backend: ${name}@${version} with ID: ${result.id}`);
                return result.id;
            } else {
                throw new Error(`Failed to create design system: ${response.status} ${response.statusText}`);
            }
        } catch (error) {
            console.error(`❌ Failed to ensure design system exists: ${name}@${version}`, error);
            throw error;
        }
    }

    /**
     * Remove design system from index
     */
    private async removeDesignSystemFromIndex(name: string, version: string): Promise<void> {
        try {
            // Get design system ID first
            const response = await fetch(`${this.baseUrl}/design-systems`);
            if (!response.ok) {
                throw new Error(`Backend API error: ${response.status} ${response.statusText}`);
            }

            const designSystems = await response.json() as Array<{ id: number; name: string }>;
            const designSystem = designSystems.find((ds) => ds.name === name);
            
            if (designSystem) {
                const deleteResponse = await fetch(`${this.baseUrl}/design-systems/${designSystem.id}`, {
                    method: 'DELETE'
                });

                if (!deleteResponse.ok) {
                    throw new Error(`Failed to delete design system: ${deleteResponse.status} ${deleteResponse.statusText}`);
                }
            }
        } catch (error) {
            console.error(`❌ Failed to remove design system from index: ${name}@${version}`, error);
            throw error;
        }
    }

    /**
     * List design systems from index
     */
    private async listDesignSystemsFromIndex(): Promise<Array<[string, string]>> {
        try {
            const response = await fetch(`${this.baseUrl}/design-systems`);
            if (!response.ok) {
                throw new Error(`Backend API error: ${response.status} ${response.statusText}`);
            }

            const designSystems = await response.json() as Array<{ id: number; name: string }>;
            return designSystems.map((ds) => [ds.name, '0.1.0'] as [string, string]);
        } catch (error) {
            console.error('❌ Failed to list design systems from index:', error);
            return [];
        }
    }

    /**
     * Store backend format data using only public API endpoints
     * We check for existing components/variations/tokens and link them to the design system
     */
    private async storeBackendFormat(name: string, version: string, backendFormat: BackendFormat, designSystemId: number, originalComponentsData: any): Promise<void> {
        try {
            console.log(`🗄️ Storing design system data using public API approach: ${name}@${version}`);
            console.log(`📊 Components to store: ${backendFormat.components.length}`);
            console.log(`🔍 Using design system ID: ${designSystemId}`);

            // Get existing components from backend (includes variations and tokens)
            const existingComponents = await this.getExistingComponents();
            console.log(`🔍 Found ${existingComponents.length} existing components in backend`);

            // Link existing components to design system
            for (const component of backendFormat.components) {
                const existingComponent = existingComponents.find(c => c.name === component.name);
                if (existingComponent) {
                    try {
                        await this.linkComponentToDesignSystem(designSystemId, existingComponent.id);
                        console.log(`🔗 Linked existing component ${component.name} to design system`);
                    } catch (error: any) {
                        if (error.message.includes('409')) {
                            console.log(`ℹ️ Component ${component.name} already linked to design system, continuing with variation values`);
                        } else {
                            throw error;
                        }
                    }
                } else {
                    console.log(`⚠️ Component ${component.name} not found in backend, skipping link`);
                }
            }

            // Get existing tokens from backend to map UUIDs to numeric IDs
            console.log(`🔍 Getting existing tokens from backend for ID mapping...`);
            const existingTokens = await this.getExistingTokens();
            console.log(`🔍 Found ${existingTokens.length} existing tokens in backend`);
            
            // Create a mapping from token names to backend IDs
            const tokenNameToBackendId = new Map<string, number>();
            existingTokens.forEach((token: any) => {
                tokenNameToBackendId.set(token.name, token.id);
            });
            console.log(`🔍 Created token name to backend ID mapping for ${tokenNameToBackendId.size} tokens`);
            
            // Add variation values with token values (only if they don't already exist)
            console.log(`\n🔍 Starting variation value creation for ${backendFormat.components.length} components`);
            console.log(`🔍 Backend format components:`, backendFormat.components.map(c => ({ name: c.name, variationsCount: c.variations?.length || 0 })));
            console.log(`🔍 Original components data:`, originalComponentsData.map((c: any) => ({ name: c.name, variationsCount: c.variations?.length || 0, hasSources: !!c.sources, hasConfigs: !!c.sources?.configs })));
            
            for (const component of backendFormat.components) {
                console.log(`\n🔍 Processing component: ${component.name}`);
                console.log(`🔍 Component variations:`, component.variations?.map(v => ({ name: v.name, id: v.id })) || []);
                
                const existingComponent = existingComponents.find(c => c.name === component.name);
                if (!existingComponent) {
                    console.log(`⚠️ Component ${component.name} not found in backend, skipping`);
                    continue;
                }
                console.log(`✅ Found existing component: ${component.name} (ID: ${existingComponent.id})`);

                // Find the original client component data that contains the sources/configs
                const originalClientComponent = originalComponentsData.find((c: any) => c.name === component.name);
                if (!originalClientComponent) {
                    console.log(`⚠️ Original client component not found for ${component.name}`);
                    continue;
                }
                console.log(`✅ Found original client component: ${component.name}`);
                console.log(`🔍 Original client component structure:`, {
                    name: originalClientComponent.name,
                    hasVariations: !!originalClientComponent.variations,
                    variationsCount: originalClientComponent.variations?.length || 0,
                    hasSources: !!originalClientComponent.sources,
                    hasConfigs: !!originalClientComponent.sources?.configs,
                    configsCount: originalClientComponent.sources?.configs?.length || 0
                });

                                // Use variations from the BACKEND FORMAT (which has the complete structure)
                console.log(`🔍 Component ${component.name} has ${component.variations?.length || 0} variations in backend format`);
                
                for (const backendVariation of component.variations || []) {
                    console.log(`🔍 Processing variation: ${backendVariation.name} (ID: ${backendVariation.id})`);
                    
                    // Find the corresponding backend variation by name (case-insensitive)
                    const existingVariation = existingComponent.variations?.find(v => 
                        v.name.toLowerCase() === backendVariation.name.toLowerCase()
                    );
                    
                    if (!existingVariation) {
                        console.log(`⚠️ Backend variation not found for ${component.name} variation: ${backendVariation.name}`);
                        continue;
                    }
                    console.log(`✅ Found backend variation: ${existingVariation.name} (ID: ${existingVariation.id})`);
                    
                    // Find the ORIGINAL variation by name to get the correct ID for config lookup
                    const originalVariation = originalClientComponent.sources?.variations?.find((v: any) => 
                        v.name.toLowerCase() === backendVariation.name.toLowerCase()
                    );
                    
                    if (!originalVariation) {
                        console.log(`⚠️ Original variation not found for ${component.name} variation: ${backendVariation.name}`);
                        continue;
                    }
                    console.log(`✅ Found original variation: ${originalVariation.name} (ID: ${originalVariation.id})`);
                    
                    // Find the variation config in component sources that contains the styles
                    console.log(`🔍 Looking for variation config for ${component.name} variation: ${backendVariation.name} with ID: ${originalVariation.id}`);
                    console.log(`🔍 Component structure:`, JSON.stringify({
                        name: originalClientComponent.name,
                        variations: originalClientComponent.sources?.variations?.map((v: any) => ({ id: v.id, name: v.name })),
                        configsCount: originalClientComponent.sources?.configs?.length || 0
                    }, null, 2));
                    
                    const variationConfig = this.findVariationConfig(originalClientComponent, originalVariation.id.toString());
                    if (!variationConfig) {
                        console.log(`⚠️ No variation config found for ${component.name} variation: ${backendVariation.name}`);
                        continue;
                    }

                    // Create a variation value for EACH style within this variation
                    for (const style of variationConfig.styles || []) {
                        // Check if variation value already exists for this design system + component + variation + style combination
                        const variationValueExists = await this.variationValueExists(designSystemId, existingComponent.id, existingVariation.id, style.name);
                        
                        if (variationValueExists) {
                            console.log(`ℹ️ Variation value already exists for ${backendVariation.name} style ${style.name}, skipping`);
                            // For debugging: still extract token values to see what we would have sent
                            const debugTokenValues = this.extractTokenValuesFromStyle(style, originalClientComponent, originalVariation.id, tokenNameToBackendId);
                            console.log(`🔍 🔍 EXTRACTING TOKEN VALUES FOR EXISTING VARIATION VALUE (for debugging):`);
                            console.log(`🔍 Would have extracted ${debugTokenValues.length} token values for ${backendVariation.name} style ${style.name}:`, debugTokenValues);
                            continue;
                        }

                        // Check if this style is marked as a default variation in the original client data
                        const isDefaultVariation = this.isDefaultVariationInConfig(originalClientComponent, originalVariation.id.toString(), style.id);
                        console.log(`🔍 Style ${style.name} (${style.id}) is default variation: ${isDefaultVariation}`);

                        // Extract token values from this specific style using backend token IDs
                        const tokenValues = this.extractTokenValuesFromStyle(style, originalClientComponent, originalVariation.id, tokenNameToBackendId);
                        console.log(`🔍 Extracted ${tokenValues.length} token values for ${backendVariation.name} style ${style.name}:`, tokenValues);
                        
                        // Validate token values structure
                        if (tokenValues.length > 0) {
                            console.log(`🔍 First token value structure:`, JSON.stringify(tokenValues[0], null, 2));
                        }
                        
                        // Create variation value with extracted token values
                        console.log(`🔍 About to call addVariationValue with:`, {
                            designSystemId,
                            componentId: existingComponent.id,
                            variationId: existingVariation.id,
                            variationIdType: typeof existingVariation.id,
                            styleName: style.name,
                            tokenValuesCount: tokenValues.length,
                            isDefaultVariation
                        });
                        
                        // Ensure variationId is a number
                        const variationId = typeof existingVariation.id === 'string' ? parseInt(existingVariation.id, 10) : existingVariation.id;
                        
                        await this.addVariationValue(designSystemId, existingComponent.id, variationId, style, tokenValues, isDefaultVariation);
                        console.log(`💾 Added variation value for ${backendVariation.name} style ${style.name} with ${tokenValues.length} token values (default: ${isDefaultVariation})`);
                    }
                }
            }

            // Add invariant token values from original client data
            console.log(`\n🔍 Starting invariant token value creation from original client data`);
            for (const component of backendFormat.components) {
                const existingComponent = existingComponents.find(c => c.name === component.name);
                if (!existingComponent) {
                    console.log(`⚠️ Component ${component.name} not found in backend, skipping invariant values`);
                    continue;
                }

                // Find the original client component data that contains the invariant props
                const originalClientComponent = originalComponentsData.find((c: any) => c.name === component.name);
                if (!originalClientComponent) {
                    console.log(`⚠️ Original client component not found for ${component.name}`);
                    continue;
                }

                // Process invariant props from configs
                for (const config of originalClientComponent.sources?.configs || []) {
                    if (config.config?.invariantProps) {
                        for (const prop of config.config.invariantProps) {
                            // Find the token by UUID in the original component's API
                            const token = originalClientComponent.sources?.api?.find((t: any) => t.id === prop.id);
                            if (token) {
                                // Get the backend token ID using the token name
                                const backendTokenId = tokenNameToBackendId.get(token.name);
                                if (backendTokenId) {
                                    try {
                                        await this.addInvariantTokenValue(designSystemId, {
                                            componentId: existingComponent.id,
                                            tokenId: backendTokenId,
                                            value: prop.value
                                        });
                                        console.log(`💾 Added invariant token value for ${token.name} (${backendTokenId}) with value ${prop.value}`);
                                    } catch (error) {
                                        console.error(`❌ Failed to add invariant token value for ${token.name}:`, error);
                                        // Continue with other invariant values
                                    }
                                } else {
                                    console.warn(`⚠️ Could not find backend token ID for token: ${token.name}`);
                                }
                            } else {
                                console.warn(`⚠️ Could not find token for prop ID: ${prop.id}`);
                            }
                        }
                    }
                }
            }

            console.log(`✅ Successfully linked design system data to backend: ${name}@${version}`);

        } catch (error) {
            console.error(`❌ Failed to store design system data: ${name}@${version}`, error);
            throw error;
        }
    }

    /**
     * Get design system ID by name from backend
     */
    private async getDesignSystemId(name: string): Promise<number | null> {
        try {
            const response = await fetch(`${this.baseUrl}/design-systems`);
            if (!response.ok) {
                throw new Error(`Backend API error: ${response.status} ${response.statusText}`);
            }

            const designSystems = await response.json() as Array<{ id: number; name: string }>;
            const designSystem = designSystems.find(ds => ds.name === name);
            return designSystem ? designSystem.id : null;
        } catch (error) {
            console.error(`❌ Failed to get design system ID for ${name}:`, error);
            return null;
        }
    }



    /**
     * Get existing tokens from backend by extracting them from components data
     */
    private async getExistingTokens(): Promise<Array<{
        id: number;
        name: string;
        type: string;
        defaultValue?: string;
    }>> {
        try {
            // Get components which include tokens in their structure
            const components = await this.getExistingComponents();
            
            // Extract all unique tokens from components
            const tokenMap = new Map<number, { id: number; name: string; type: string; defaultValue?: string }>();
            
            for (const component of components) {
                // Add tokens from the component's tokens array
                if (component.tokens) {
                    for (const token of component.tokens) {
                        tokenMap.set(token.id, token);
                    }
                }
                
                // Add tokens from variations' tokenVariations
                if (component.variations) {
                    for (const variation of component.variations) {
                        if (variation.tokenVariations) {
                            for (const tokenVariation of variation.tokenVariations) {
                                if (tokenVariation.token) {
                                    tokenMap.set(tokenVariation.token.id, tokenVariation.token);
                                }
                            }
                        }
                    }
                }
            }
            
            const tokens = Array.from(tokenMap.values());
            console.log(`🔍 Extracted ${tokens.length} unique tokens from ${components.length} components`);
            return tokens;
        } catch (error) {
            console.error(`❌ Failed to get existing tokens:`, error);
            return [];
        }
    }

    /**
     * Get existing components from backend (includes variations and tokens)
     */
    private async getExistingComponents(): Promise<Array<{
        id: number; 
        name: string; 
        description?: string;
        variations: Array<{
            id: number;
            name: string;
            description?: string;
            tokenVariations: Array<{
                token: {
                    id: number;
                    name: string;
                    type: string;
                    defaultValue?: string;
                }
            }>
        }>;
        tokens: Array<{
            id: number;
            name: string;
            type: string;
            defaultValue?: string;
        }>;
        propsAPI: Array<{
            id: number;
            name: string;
            value: string;
        }>;
    }>> {
        try {
            const response = await fetch(`${this.baseUrl}/components/available`);
            if (!response.ok) {
                throw new Error(`Backend API error: ${response.status} ${response.statusText}`);
            }

            const components = await response.json() as Array<{
                id: number; 
                name: string; 
                description?: string;
                variations: Array<{
                    id: number;
                    name: string;
                    description?: string;
                    tokenVariations: Array<{
                        token: {
                            id: number;
                            name: string;
                            type: string;
                            defaultValue?: string;
                        }
                    }>
                }>;
                tokens: Array<{
                    id: number;
                    name: string;
                    type: string;
                    defaultValue?: string;
                }>;
                propsAPI: Array<{
                    id: number;
                    name: string;
                    value: string;
                }>;
            }>;
            return components;
        } catch (error) {
            console.error(`❌ Failed to get existing components:`, error);
            return [];
        }
    }

    /**
     * Link existing component to design system
     */
    private async linkComponentToDesignSystem(designSystemId: number, componentId: number): Promise<void> {
        try {
            const response = await fetch(`${this.baseUrl}/design-systems/components`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    designSystemId,
                    componentId
                })
            });

            if (!response.ok) {
                throw new Error(`Failed to link component to design system: ${response.status} ${response.statusText}`);
            }

            console.log(`🔗 Linked component ${componentId} to design system ${designSystemId}`);
        } catch (error) {
            console.error(`❌ Failed to link component to design system:`, error);
            throw error;
        }
    }

    /**
     * Add variation value with token values
     */
    private async addVariationValue(designSystemId: number, componentId: number, variationId: number, style: any, tokenValues: Array<{ id: number; value: any }>, isDefaultValue: boolean = false): Promise<void> {
        try {
            // Convert the extracted token values to the format expected by the backend
            // Ensure all values are strings as the backend expects
            const backendTokenValues = tokenValues.map(tokenValue => ({
                tokenId: tokenValue.id,
                value: String(tokenValue.value) // Convert all values to strings
            }));

            const payload = {
                designSystemId,
                componentId,
                variationId,
                name: style.name,
                description: style.description || '',
                isDefaultValue,
                tokenValues: backendTokenValues
            };

            console.log(`🔍 Sending payload to /variation-values:`, JSON.stringify(payload, null, 2));
            console.log(`🔍 Backend URL: ${this.baseUrl}/variation-values`);

            const response = await fetch(`${this.baseUrl}/variation-values`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                let errorDetails = '';
                try {
                    const errorResponse = await response.json();
                    errorDetails = ` - Details: ${JSON.stringify(errorResponse)}`;
                } catch (e) {
                    errorDetails = ` - Could not parse error response`;
                }
                throw new Error(`Failed to add variation value: ${response.status} ${response.statusText}${errorDetails}`);
            }

            console.log(`💾 Added variation value for ${style.name} with ${tokenValues.length} token values`);
        } catch (error) {
            console.error(`❌ Failed to add variation value for ${style.name}:`, error);
            throw error;
        }
    }

    /**
     * Add invariant token value
     */
    private async addInvariantTokenValue(designSystemId: number, invariantTokenValue: any): Promise<void> {
        try {
            const payload = {
                tokenValues: [{
                    tokenId: invariantTokenValue.tokenId,
                    value: String(invariantTokenValue.value)
                }]
            };

            console.log(`🔍 Sending invariant token value payload to /components/${invariantTokenValue.componentId}/invariants:`, JSON.stringify(payload, null, 2));

            const response = await fetch(`${this.baseUrl}/components/${invariantTokenValue.componentId}/invariants?designSystemId=${designSystemId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                let errorDetails = '';
                try {
                    const errorResponse = await response.json();
                    errorDetails = ` - Details: ${JSON.stringify(errorResponse)}`;
                } catch (e) {
                    errorDetails = ` - Could not parse error response`;
                }
                throw new Error(`Failed to add invariant token value: ${response.status} ${response.statusText}${errorDetails}`);
            }

            console.log(`💾 Added invariant token value for token ${invariantTokenValue.tokenId}`);
        } catch (error) {
            console.error(`❌ Failed to add invariant token value for token ${invariantTokenValue.tokenId}:`, error);
            throw error;
        }
    }

    /**
     * Transform backend data structure to match FormatTransformer expectations
     */
    private transformBackendDataForTransformer(backendData: any): any {
        try {
            // The backend returns: { id, name, components: [{ component: {...} }], variationValues: [...] }
            // We need to transform it to: { designSystem: {...}, components: [...], variationValues: [...], tokenValues: [...] }
            
            const transformedData: any = {
                designSystem: {
                    id: backendData.id,
                    name: backendData.name,
                    description: backendData.description,
                    createdAt: backendData.createdAt,
                    updatedAt: backendData.updatedAt
                },
                components: backendData.components?.map((link: any) => link.component) || [],
                variationValues: backendData.variationValues || [],
                tokenValues: [],
                invariantTokenValues: backendData.invariantTokenValues || []
            };

            // Extract token values from variation values
            if (backendData.variationValues) {
                backendData.variationValues.forEach((variationValue: any) => {
                    if (variationValue.tokenValues) {
                        variationValue.tokenValues.forEach((tokenValue: any) => {
                            transformedData.tokenValues.push({
                                id: tokenValue.id,
                                variationValueId: tokenValue.variationValueId,
                                tokenId: tokenValue.tokenId,
                                value: tokenValue.value,
                                token: tokenValue.token
                            });
                        });
                    }
                });
            }

            console.log(`🔧 Transformed backend data structure for transformer`);
            return transformedData;
        } catch (error) {
            console.error(`❌ Failed to transform backend data:`, error);
            return backendData; // Fallback to original data
        }
    }

    /**
     * Check if variation value already exists
     */
    private async variationValueExists(designSystemId: number, componentId: number, variationId: number, styleName: string): Promise<boolean> {
        try {
            const response = await fetch(`${this.baseUrl}/variation-values`);
            if (!response.ok) {
                return false;
            }

            const variationValues = await response.json() as Array<{
                designSystemId: number;
                componentId: number;
                variationId: number;
                name: string;
            }>;

            return variationValues.some(v => 
                v.designSystemId === designSystemId && 
                v.componentId === componentId && 
                v.variationId === variationId &&
                v.name.toLowerCase() === styleName.toLowerCase()
            );
        } catch (error) {
            console.error(`❌ Failed to check if variation value exists:`, error);
            return false;
        }
    }

    /**
     * Find the variation config in component sources that contains the styles
     */
    private findVariationConfig(component: any, variationId: string): any | null {
        try {
            console.log(`🔍 Looking for variation config with ID: ${variationId}`);
            console.log(`🔍 Component has ${component.sources?.configs?.length || 0} configs`);
            
            for (const config of component.sources?.configs || []) {
                console.log(`🔍 Checking config: ${config.name}`);
                console.log(`🔍 Config has ${config.config?.variations?.length || 0} variations`);
                
                if (config.config?.variations) {
                    for (const variation of config.config.variations) {
                        console.log(`🔍 Checking variation: ${variation.id} (${typeof variation.id}) vs ${variationId} (${typeof variationId})`);
                        if (variation.id === variationId) {
                            console.log(`✅ Found variation config for ${variationId}`);
                            return variation;
                        }
                    }
                }
            }
            
            console.log(`❌ No variation config found for variation ${variationId}`);
            return null;
        } catch (error) {
            console.error(`❌ Error finding variation config for variation ${variationId}:`, error);
            return null;
        }
    }

    /**
     * Extract token values from a specific style's props
     * The style.props contains the actual token values for this variation
     */
    private extractTokenValuesFromStyle(style: any, component: any, variationId: string, tokenNameToBackendId: Map<string, number>): Array<{ id: number; value: any }> {
        const tokenValues: Array<{ id: number; value: any }> = [];
        try {
            console.log(`🔍 Extracting token values for style ${style.name} in variation ${variationId}`);
            console.log(`🔍 Style props:`, style.props);
            
            // Find tokens that belong to this variation
            const variationTokens = component.sources?.api?.filter((token: any) => 
                token.variations && token.variations.includes(variationId)
            ) || [];
            
            console.log(`🔍 Found ${variationTokens.length} tokens for variation ${variationId}:`, variationTokens.map((t: any) => t.name));
            
            // Extract token values from style props
            for (const prop of style.props || []) {
                if (prop.id && prop.value !== undefined) {
                    // Find the token that this prop belongs to
                    const token = variationTokens.find((t: any) => t.id === prop.id);
                    if (token) {
                        // Use the backend token ID instead of generating a new one
                        const backendTokenId = tokenNameToBackendId.get(token.name);
                        if (backendTokenId) {
                            tokenValues.push({
                                id: backendTokenId,
                                value: prop.value
                            });
                            console.log(`🔍 Mapped token ${token.name} (${token.id}) -> backend ID ${backendTokenId} with value ${prop.value}`);
                        } else {
                            console.warn(`⚠️ Could not find backend token ID for token: ${token.name} (${token.id})`);
                        }
                    } else {
                        console.warn(`⚠️ Could not find token for prop ID: ${prop.id}`);
                    }
                }
            }
            
            console.log(`🔍 Extracted ${tokenValues.length} token values for style ${style.name}`);
            return tokenValues;
        } catch (error) {
            console.error(`❌ Error extracting token values for style ${style.name}:`, error);
            return [];
        }
    }

    /**
     * Check if a variation style is marked as default in the original client config
     */
    private isDefaultVariationInConfig(component: any, variationId: string, styleId: string): boolean {
        try {
            // Look through all configs for this component
            for (const config of component.sources?.configs || []) {
                if (config.config?.defaultVariations) {
                    // Check if this variation/style combination is in the defaultVariations array
                    const isDefault = config.config.defaultVariations.some((dv: any) => 
                        dv.variationID === variationId && dv.styleID === styleId
                    );
                    if (isDefault) {
                        return true;
                    }
                }
            }
            return false;
        } catch (error) {
            console.error(`❌ Error checking if variation is default:`, error);
            return false;
        }
    }

    /**
     * Generate UUID for temporary use
     */
    private generateUUID(): string {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }
}
