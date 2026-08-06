import { copyFile, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import process from 'node:process';

const check = process.argv.includes('--check');
const sourceArgument = process.argv.slice(2).find((argument) => argument !== '--check');
const source = resolve(
    sourceArgument ??
        '../../../design-system-builder-kt/preview/contract/schemas/v1/preview-payload.schema.json',
);
const destination = resolve('src/composePreview/schema/preview-payload.schema.json');
const sourceContents = await readFile(source, 'utf8');
const schema = JSON.parse(sourceContents);
if (schema.$id !== 'https://schemas.sdds.dev/preview/v1/preview-payload.schema.json') {
    throw new Error(`Unexpected canonical schema $id: ${schema.$id}`);
}
if (check) {
    const destinationContents = await readFile(destination, 'utf8');
    if (destinationContents !== sourceContents) {
        throw new Error('Client Preview Protocol schema snapshot is out of sync with preview-contract');
    }
} else {
    await copyFile(source, destination);
}
