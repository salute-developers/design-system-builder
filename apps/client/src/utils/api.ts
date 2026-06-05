import { isAxiosError } from 'axios';

import { type Meta, type ThemeSource } from '../controllers';
import { Parameters } from '../types';
import { PROJECTS_URL, http } from '../api';

export interface BackendDesignSystem {
    id: number;
    name: string;
    projectName: string;
    projectId?: string;
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

const logApiError = (scope: string, error: unknown): void => {
    if (isAxiosError(error)) {
        const { response, config } = error;

        console.error(
            `[${scope}] ${config?.method?.toUpperCase() ?? ''} ${config?.url ?? ''} — ${
                response?.status ?? 'network error'
            }`,
            response?.data ?? error.message,
        );
    } else {
        console.error(`[${scope}]`, error);
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
        const response = (
            await http.post(`${PROJECTS_URL}/${data?.parameters?.projectId}/ds/legacy/design-systems/create`, data)
        ).data as unknown as any;

        return response;
    } catch (error) {
        logApiError('saveDesignSystem', error);

        throw error;
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
        const response = (
            await http.post(
                `${PROJECTS_URL}/${data.parameters?.projectId}/ds/legacy/design-systems/${data.name}/update`,
                data,
            )
        ).data as unknown as any;

        return response;
    } catch (error) {
        logApiError('updateDesignSystem', error);

        throw error;
    }
};

export const loadDesignSystem = async (data: {
    name: string;
    version: string;
    projectId?: string;
}): Promise<{ themeData: ThemeSource; componentsData: Meta[]; parameters?: Partial<Parameters> } | undefined> => {
    try {
        const themeData = (
            await http.get(`${PROJECTS_URL}/${data.projectId}/ds/legacy/design-systems/${data.name}/theme-data`)
        ).data as unknown as ThemeSource;

        const componentsData = (
            await http.get(`${PROJECTS_URL}/${data.projectId}/ds/legacy/design-systems/${data.name}/component-configs`)
        ).data as unknown as Meta[];

        const parameters = (
            await http.get(`${PROJECTS_URL}/${data.projectId}/ds/legacy/design-systems/${data.name}/tenant-params`)
        ).data as unknown as Partial<Parameters>;

        return {
            themeData,
            componentsData,
            parameters,
        };
    } catch (error) {
        if (isAxiosError(error) && error.response?.status === 404) {
            return undefined;
        }

        logApiError('loadDesignSystem', error);

        throw error;
    }
};

export const loadBaseComponentsData = async (data: { parameters?: Partial<Parameters> }): Promise<Meta[]> => {
    try {
        console.log('data.parameters?.projectId', data.parameters?.projectId);

        const componentsData = (
            await http.get(
                `${PROJECTS_URL}/${data.parameters?.projectId}/ds/legacy/design-systems/base/component-configs`,
            )
        ).data as unknown as Meta[];

        return componentsData;
    } catch (error) {
        logApiError('loadBaseComponentsData', error);

        throw error;
    }
};

export const loadAllDesignSystems = async (projectId: string): Promise<BackendDesignSystem[] | undefined> => {
    try {
        const response = (await http.get(`${PROJECTS_URL}/${projectId}/ds/design-systems`))
            .data as unknown as BackendDesignSystem[];

        return response.length ? response : undefined;
    } catch (error) {
        logApiError('loadAllDesignSystems', error);

        throw error;
    }
};
