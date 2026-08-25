import { FastifyReply } from 'fastify';

// TODO: забирать из отдельного пакета
import { Meta } from '../componentBuilder';
import { ThemeSource } from '../themeBuilder/types';

type ExportType = 'tgz' | 'zip' | 'source';

export interface DesignSystemData {
    packageName: string;
    packageVersion: string;
    componentsData: Meta[];
    themeData: ThemeSource;
}

export interface OutputParams {
    pathToDir: string;
    coreVersion: string;
    exportType: ExportType;
}

export interface GenerateRouteBody {
    packageName: string;
    packageVersion: string;
    exportType: ExportType;
    // componentsMeta: Meta[];
    // themeSource: ThemeSource;
    npmToken: string;
}

export interface BaseFileStructure {
    pathToDir: string;
    packageName: string;
    packageVersion: string;
    coreVersion: string;
}

export interface ComponentsFiles {
    pathToDir: string;
    componentsMeta: Meta[];
}

export interface ThemeFiles {
    pathToDir: string;
    packageName: string;
    packageVersion: string;
    themeSource: ThemeSource;
}

export interface GenerateRouteBodyResponse {
    packageName: string;
    packageVersion: string;
    pathToDir: string;
    reply: FastifyReply;
}
