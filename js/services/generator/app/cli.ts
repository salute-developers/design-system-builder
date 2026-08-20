#!/usr/bin/env node
import { program } from 'commander';
import * as fs from 'fs-extra';

import { CORE_VERSION, DB_SERVICE_URL } from './utils';
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
    .action(async (options) => {
        try {
            const {
                dsName: packageName,
                dsVersion: packageVersion,
                exportType,
                output: pathToDir,
            } = options;

            console.log('Design system generation params');
            console.log(`Name: ${packageName}`);
            console.log(`Version: ${packageVersion}`);
            console.log(`Export type: ${exportType}`);
            console.log(`Output path: ${pathToDir}`);

            const themeData = (await fetch(
                `${DB_SERVICE_URL}/legacy/design-systems/${packageName}/theme-data`,
            ).then((response) => response.json())) as unknown as ThemeSource;

            const componentsData = (await fetch(
                `${DB_SERVICE_URL}/legacy/design-systems/${packageName}/component-configs`,
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
