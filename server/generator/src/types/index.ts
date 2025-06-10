import { FastifyReply } from 'fastify';
import { ThemeSource } from '@salutejs/core-themes/build/cjs/types';

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { Meta } from '../../../../client/src/componentBuilder';

export interface GenerateRouteBody {
    packageName: string;
    packageVersion: string;
    componentsMeta: Meta[];
    themeSource: ThemeSource;
    exportType: 'tgz' | 'zip';
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
