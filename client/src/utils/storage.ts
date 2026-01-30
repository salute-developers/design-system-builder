import { type Meta, type ThemeSource } from '../controllers';
import { Parameters } from '../types';
import { btoaUtf8 } from './other';

// Proxy server configuration - use env var at build time, fallback to localhost
const PROXY_SERVER_URL = import.meta.env.VITE_PROXY_SERVER_URL || 'http://localhost:3003';

export interface BackendDesignSystem {
    id: number;
    name: string;
    projectName: string;
    grayTone: string;
    accentColor: string;
    lightStrokeSaturation: number;
    lightFillSaturation: number;
    darkStrokeSaturation: number;
    darkFillSaturation: number;
    description?: string;
    createdAt: string;
    updatedAt: string;
}

// Helper function to handle API calls
const apiCall = async (url: string, options: RequestInit = {}) => {
    try {
        const response = await fetch(url, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                ...options.headers,
            },
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
        }

        // Handle empty responses
        const text = await response.text();
        if (!text) {
            console.warn('empty repspnse form API call');
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
    parameters?: Partial<Parameters>;
    themeData: ThemeSource;
    componentsData: Meta[];
}): Promise<any> => {
    try {
        const token = btoaUtf8(`${localStorage.getItem('login')}:${localStorage.getItem('password')}`);

        const response = await apiCall(`${PROXY_SERVER_URL}/api/design-systems`, {
            method: 'POST',
            body: JSON.stringify(data),
            headers: {
                Authorization: `Basic ${token}`,
            },
        });

        return response;
    } catch (error) {
        // // If server is not running, fall back to localStorage
        // console.warn('Proxy server not available, falling back to localStorage');
        // const { name, version, themeData, componentsData } = data;
        // const key = `#${name}@${version}`;
        // const value = JSON.stringify({
        //     themeData,
        //     componentsData,
        // });
        // localStorage.setItem(key, value);
    }
};

export const loadDesignSystem = async (
    name: string,
    version: string,
): Promise<{ themeData: ThemeSource; componentsData: Meta[]; parameters?: Partial<Parameters> } | undefined> => {
    try {
        const token = btoaUtf8(`${localStorage.getItem('login')}:${localStorage.getItem('password')}`);

        const data = await apiCall(
            `${PROXY_SERVER_URL}/api/design-systems/${encodeURIComponent(name)}/${encodeURIComponent(version)}`,
            {
                headers: {
                    Authorization: `Basic ${token}`,
                },
            },
        );

        return data;
    } catch (error) {
        // // If server is not running, fall back to localStorage
        // console.warn('Proxy server not available, falling back to localStorage');
        // try {
        //     const savedDesignSystemData = localStorage.getItem(`#${name}@${version}`);
        //     return savedDesignSystemData ? JSON.parse(savedDesignSystemData) : undefined;
        // } catch (localStorageError) {
        //     console.error('Both proxy server and localStorage failed:', error, localStorageError);
        //     return undefined;
        // }
    }
};

export const removeDesignSystem = async (name: string, version: string): Promise<void> => {
    try {
        await apiCall(
            `${PROXY_SERVER_URL}/api/design-systems/${encodeURIComponent(name)}/${encodeURIComponent(version)}`,
            {
                method: 'DELETE',
            },
        );
    } catch (error) {
        // If server is not running, fall back to localStorage
        // console.warn('Proxy server not available, falling back to localStorage');
        // localStorage.removeItem(`#${name}@${version}`);
    }
};

export const loadAllDesignSystems = async (): Promise<BackendDesignSystem[] | undefined> => {
    try {
        const token = btoaUtf8(`${localStorage.getItem('login')}:${localStorage.getItem('password')}`);

        const data = await apiCall(`${PROXY_SERVER_URL}/api/design-systems`, {
            headers: {
                Authorization: `Basic ${token}`,
            },
        });

        return data || undefined;
    } catch (error) {
        // // If server is not running, fall back to localStorage
        // console.warn('Proxy server not available, falling back to localStorage');
        // try {
        //     const themes = Object.keys(localStorage as unknown as Array<string>[number])
        //         .filter((key) => key.startsWith('#'))
        //         .map((item) => {
        //             const [name, version] = item.replace(`#`, '').split('@');
        //             return [name, version] as const;
        //         });
        //     return !themes.length ? undefined : themes;
        // } catch (localStorageError) {
        //     console.error('Both proxy server and localStorage failed:', error, localStorageError);
        //     return undefined;
        // }
    }
};
