#!/usr/bin/env node
import { program } from 'commander';
import * as fs from 'fs-extra';

import { CORE_VERSION, DS_REGISTRY_URL } from './utils';
import { generateDesignSystem } from './generate';
import { ThemeSource } from './themeBuilder/types';
import { Meta } from './componentBuilder';

program
    .name('plasma-ds-generate')
    .description('Generate Plasma DS package')
    .option('--ds-name <string>', 'Design system name')
    .option('--ds-version <string>', 'Design system version')
    .option('--export-type <string>', 'Export type (tgz, zip, source)', 'source')
    .option('--output <dir>', 'Output directory', './output')
    .option('--auth-token <string>', 'Auth token for client-proxy')
    .action(async (options) => {
        try {
            const {
                dsName: packageName,
                dsVersion: packageVersion,
                exportType,
                output: pathToDir,
                authToken,
            } = options;

            console.log('Design system generation params');
            console.log(`Name: ${packageName}`);
            console.log(`Version: ${packageVersion}`);
            console.log(`Export type: ${exportType}`);
            console.log(`Output path: ${pathToDir}`);

            const headers: Record<string, string> = {};
            if (authToken) {
                headers['Authorization'] = `Basic ${authToken}`;
            }

            const themeData = (await fetch(`${DS_REGISTRY_URL}/legacy/design-systems/${packageName}/theme-data`, {
                headers,
            }).then((response) => response.json())) as unknown as ThemeSource;

            const componentsData = (await fetch(
                `${DS_REGISTRY_URL}/legacy/design-systems/${packageName}/component-configs`,
                {
                    headers,
                },
            ).then((response) => response.json())) as unknown as Meta[];

            console.log(`Generating ${exportType}...`);

            const buffer = await generateDesignSystem(
                { packageName, packageVersion, componentsData, themeData },
                { pathToDir, exportType, coreVersion: CORE_VERSION },
            );

            if (exportType !== 'source') {
                fs.rmSync(pathToDir, { recursive: true, force: true });
                fs.mkdirSync(pathToDir);
                fs.writeFileSync(`${pathToDir}/${packageName}@${packageVersion}.${exportType}`, buffer);
            }

            console.log('Done!');
        } catch (error) {
            console.error('❌ Error:', error instanceof Error ? error.message : error);
            process.exit(1);
        }
    });

program.parse();
