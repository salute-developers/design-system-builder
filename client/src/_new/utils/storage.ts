import type { Meta } from '../../componentBuilder';
import type { ThemeSource } from '../../designSystem';

// Proxy server configuration
const PROXY_SERVER_URL = 'http://localhost:3003';

// Helper function to handle API calls
const apiCall = async (url: string, options: RequestInit = {}) => {
    try {
        const response = await fetch(url, {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers,
            },
            ...options,
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
        }

        // Handle empty responses
        const text = await response.text();
        if (!text) {
            console.warn('empty repspnse form API call')
            return null;
        }

        try {
            return JSON.parse(text);
        } catch (jsonError) {
            console.warn('Failed to parse JSON response:', text);
            return null;
        }
    } catch (error) {
        console.error('API call failed:', error);
        throw error;
    }
};

export const saveDesignSystem = async (data: {
    name: string;
    version: string;
    themeData: ThemeSource;
    componentsData: Meta[];
}): Promise<void> => {
    try {
        await apiCall(`${PROXY_SERVER_URL}/api/design-systems`, {
            method: 'POST',
            body: JSON.stringify(data),
        });
    } catch (error) {
        // If server is not running, fall back to localStorage
        console.warn('Proxy server not available, falling back to localStorage');
        const { name, version, themeData, componentsData } = data;
        const key = `#${name}@${version}`;
        const value = JSON.stringify({
            themeData,
            componentsData,
        });
        localStorage.setItem(key, value);
    }
};

export const loadDesignSystem = async (
    name: string,
    version: string,
): Promise<{ themeData: ThemeSource; componentsData: Meta[] } | undefined> => {
    try {
        const data = await apiCall(`${PROXY_SERVER_URL}/api/design-systems/${encodeURIComponent(name)}/${encodeURIComponent(version)}`);
        return data;
    } catch (error) {
        // If server is not running, fall back to localStorage
        console.warn('Proxy server not available, falling back to localStorage');
        try {
            const savedDesignSystemData = localStorage.getItem(`#${name}@${version}`);
            return savedDesignSystemData ? JSON.parse(savedDesignSystemData) : undefined;
        } catch (localStorageError) {
            console.error('Both proxy server and localStorage failed:', error, localStorageError);
            return undefined;
        }
    }
};

export const removeDesignSystem = async (name: string, version: string): Promise<void> => {
    try {
        await apiCall(`${PROXY_SERVER_URL}/api/design-systems/${encodeURIComponent(name)}/${encodeURIComponent(version)}`, {
            method: 'DELETE',
        });
    } catch (error) {
        // If server is not running, fall back to localStorage
        console.warn('Proxy server not available, falling back to localStorage');
        localStorage.removeItem(`#${name}@${version}`);
    }
};

export const loadAllDesignSystemNames = async (): Promise<(readonly [string, string])[] | undefined> => {
    try {
        const data = await apiCall(`${PROXY_SERVER_URL}/api/design-systems`);
        return data || undefined;
    } catch (error) {
        // If server is not running, fall back to localStorage
        console.warn('Proxy server not available, falling back to localStorage');
        try {
            const themes = Object.keys(localStorage as unknown as Array<string>[number])
                .filter((key) => key.startsWith('#'))
                .map((item) => {
                    const [name, version] = item.replace(`#`, '').split('@');
                    return [name, version] as const;
                });
            return !themes.length ? undefined : themes;
        } catch (localStorageError) {
            console.error('Both proxy server and localStorage failed:', error, localStorageError);
            return undefined;
        }
    }
};
