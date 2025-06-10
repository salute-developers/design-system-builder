import { meta } from '../_new/sources';
import type { Meta } from './type';
import { designSystemAPI, DataTransformer } from '../api';
import type { ComponentDetailed } from '../api';

// Cache for backend components to avoid repeated API calls
let componentCache: Map<string, Meta> = new Map();
let backendComponentsCache: ComponentDetailed[] | null = null;
let cacheExpiry = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Internal function to get backend components with caching
 */
const getBackendComponentsCached = async (): Promise<ComponentDetailed[]> => {
    const now = Date.now();
    
    // Return cached data if available and not expired
    if (backendComponentsCache && now < cacheExpiry) {
        return backendComponentsCache;
    }
    
    try {
        // Fetch from API
        const backendComponents = await designSystemAPI.getAvailableComponents();
        
        // Update cache
        backendComponentsCache = backendComponents;
        cacheExpiry = now + CACHE_DURATION;
        
        return backendComponents;
    } catch (error) {
        console.warn('Failed to load components from backend:', error);
        return [];
    }
};

/**
 * Get component metadata asynchronously, trying backend first, then falling back to local sources
 */
export const getComponentMetaAsync = async (componentName: string, designSystemId?: number): Promise<Meta | null> => {
    // Check cache first
    const now = Date.now();
    const cacheKey = `${componentName}:${designSystemId || 'default'}`;
    if (componentCache.has(cacheKey) && now < cacheExpiry) {
        return componentCache.get(cacheKey) || null;
    }

    try {
        // Try to load from backend using cached function
        const backendComponents = await getBackendComponentsCached();
        const foundComponent = backendComponents.find(
            comp => comp.name.toLowerCase() === componentName.toLowerCase()
        );

        if (foundComponent) {
            const transformedMeta = designSystemId 
                ? await DataTransformer.backendComponentToClientAsync(foundComponent, designSystemId)
                : DataTransformer.backendComponentToClient(foundComponent);
            
            // Update cache
            componentCache.set(cacheKey, transformedMeta);
            
            return transformedMeta;
        }
    } catch (error) {
        console.warn(`Failed to load component ${componentName} from backend, using local fallback:`, error);
    }

    // Fallback to local sources
    const localMeta = meta.find((item) => item.name === componentName);
    
    if (localMeta) {
        // Cache the local meta as well
        componentCache.set(cacheKey, localMeta as Meta);
        return localMeta as Meta;
    }

    return null;
};

/**
 * Synchronous version for backward compatibility
 * This will return cached data if available, otherwise local meta
 */
export const getComponentMeta = (componentName: string): Meta | null => {
    // Return from cache if available
    if (componentCache.has(componentName) && Date.now() < cacheExpiry) {
        return componentCache.get(componentName) || null;
    }

    // Fallback to local sources
    const localMeta = meta.find((item) => item.name === componentName);
    return localMeta as Meta || null;
};

/**
 * Get all available components from backend and local sources combined
 */
export const getAllComponents = async (): Promise<Meta[]> => {
    const allComponents: Meta[] = [];
    
    try {
        // Get from backend using cached function
        const backendComponents = await getBackendComponentsCached();
        const transformedComponents = backendComponents.map(comp => 
            DataTransformer.backendComponentToClient(comp)
        );
        allComponents.push(...transformedComponents);
        
        // Update cache for all backend components
        transformedComponents.forEach(comp => {
            componentCache.set(comp.name, comp);
        });
        
    } catch (error) {
        console.warn('Failed to load components from backend:', error);
    }
    
    // Add local components that aren't already included from backend
    const backendNames = new Set(allComponents.map(comp => comp.name.toLowerCase()));
    const localOnlyComponents = meta.filter(comp => 
        !backendNames.has(comp.name.toLowerCase())
    );
    
    // Cast local components to Meta type for compatibility
    allComponents.push(...(localOnlyComponents as Meta[]));
    
    return allComponents;
};

/**
 * Clear the component cache (useful for testing or forced refresh)
 */
export const clearComponentCache = (): void => {
    componentCache.clear();
    backendComponentsCache = null;
    cacheExpiry = 0;
};

/**
 * Check if a component is available in backend vs local only
 * Uses cached backend components to avoid redundant API calls
 */
export const isBackendComponent = async (componentName: string): Promise<boolean> => {
    try {
        // Use cached backend components instead of making a new API call
        const backendComponents = await getBackendComponentsCached();
        return backendComponents.some(comp => 
            comp.name.toLowerCase() === componentName.toLowerCase()
        );
    } catch (error) {
        return false;
    }
};
