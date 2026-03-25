import { type Meta, type ThemeSource } from '../controllers';
import { Parameters } from '../types';
import { btoaUtf8 } from './other';

const DS_REGISTRY_URL = import.meta.env.VITE_DS_REGISTRY_API || 'http://localhost:3008/api';

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
// const apiCall = async (url: string, options: RequestInit = {}) => {
//     try {
//         const response = await fetch(url, {
//             ...options,
//             headers: {
//                 'Content-Type': 'application/json',
//                 ...options.headers,
//             },
//         });

//         if (!response.ok) {
//             const errorData = await response.json().catch(() => ({}));
//             throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
//         }

//         // Handle empty responses
//         const text = await response.text();
//         if (!text) {
//             console.warn('empty repspnse form API call');
//             return null;
//         }

//         try {
//             return JSON.parse(text);
//         } catch (jsonError) {
//             console.warn('Failed to parse JSON response:', text);
//             return null;
//         }
//     } catch (error) {
//         console.error('API call failed:', error);
//         throw error;
//     }
// };

export const saveDesignSystem = async (data: {
    name: string;
    version: string;
    parameters?: Partial<Parameters>;
    themeData: ThemeSource;
    componentsData: Meta[];
}): Promise<any> => {
    try {
        const token = btoaUtf8(`${localStorage.getItem('login')}:${localStorage.getItem('password')}`);

        const response = (await fetch(`${DS_REGISTRY_URL}/legacy/design-systems/create`, {
            method: 'POST',
            body: JSON.stringify(data),
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Basic ${token}`,
            },
        }).then((res) => res.json())) as unknown as any;

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

export const updateDesignSystem = async (data: {
    name: string;
    version: string;
    parameters?: Partial<Parameters>;
    themeData: ThemeSource;
    componentsData: Meta[];
}): Promise<any> => {
    try {
        // const token = btoaUtf8(`${localStorage.getItem('login')}:${localStorage.getItem('password')}`);

        const response = (await fetch(`${DS_REGISTRY_URL}/legacy/design-systems/${data.name}/update`, {
            method: 'POST',
            body: JSON.stringify(data),
            headers: {
                'Content-Type': 'application/json',
            },
        }).then((res) => res.json())) as unknown as any;

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

        const themeData = (await fetch(`${DS_REGISTRY_URL}/legacy/design-systems/${name}/theme-data`, {
            headers: {
                Authorization: `Basic ${token}`,
            },
        }).then((response) => response.json())) as unknown as ThemeSource;

        const componentsData = (await fetch(`${DS_REGISTRY_URL}/legacy/design-systems/${name}/component-configs`, {
            headers: {
                Authorization: `Basic ${token}`,
            },
        }).then((response) => response.json())) as unknown as Meta[];

        const parameters = (await fetch(`${DS_REGISTRY_URL}/legacy/design-systems/${name}/tenant-params`, {
            headers: {
                Authorization: `Basic ${token}`,
            },
        }).then((response) => response.json())) as unknown as Partial<Parameters>;

        return {
            themeData,
            componentsData,
            parameters,
        };
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

export const loadAllDesignSystems = async (): Promise<BackendDesignSystem[] | undefined> => {
    try {
        const token = btoaUtf8(`${localStorage.getItem('login')}:${localStorage.getItem('password')}`);

        const data = await fetch(`${DS_REGISTRY_URL}/design-systems`, {
            headers: {
                Authorization: `Basic ${token}`,
            },
        }).then((response) => response.json());

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
