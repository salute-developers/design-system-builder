import { cp, mkdir, readdir, readFile, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import process from 'node:process';

const check = process.argv.includes('--check');
const sourceArgument = process.argv.slice(2).find((argument) => argument !== '--check');
const contractRoot = resolve(sourceArgument ?? '../../../backend-kt/preview/contract');
const schemaDestination = resolve('src/composePreview/schema');
const fixturesDestination = join(schemaDestination, 'fixtures');
const schemaSource = join(contractRoot, 'schemas/v1');
const fixturesSource = join(contractRoot, 'fixtures/v1');

const listFiles = async (root, prefix = '') => {
    const entries = await readdir(join(root, prefix), { withFileTypes: true });
    const nested = await Promise.all(
        entries.map((entry) =>
            entry.isDirectory()
                ? listFiles(root, join(prefix, entry.name))
                : Promise.resolve([join(prefix, entry.name)]),
        ),
    );
    return nested.flat().sort();
};

const canonicalSchema = JSON.parse(await readFile(join(schemaSource, 'preview-payload.schema.json'), 'utf8'));
if (canonicalSchema.$id !== 'https://schemas.sdds.dev/preview/v1/preview-payload.schema.json') {
    throw new Error(`Unexpected canonical schema $id: ${canonicalSchema.$id}`);
}

const verify = async (source, destination, ignore = () => false) => {
    const expected = await listFiles(source);
    const actual = (await listFiles(destination).catch(() => [])).filter((file) => !ignore(file));
    const missing = expected.filter((file) => !actual.includes(file));
    const extra = actual.filter((file) => !expected.includes(file));
    if (missing.length || extra.length) {
        throw new Error(
            `Preview Protocol file set differs in ${destination}: missing [${missing}], unexpected [${extra}]`,
        );
    }
    for (const file of expected) {
        const [canonical, copy] = await Promise.all([
            readFile(join(source, file), 'utf8'),
            readFile(join(destination, file), 'utf8'),
        ]);
        if (canonical !== copy) {
            throw new Error(`Preview Protocol file is out of sync with the contract: ${file}`);
        }
    }
};

if (check) {
    await verify(schemaSource, schemaDestination, (file) => file.startsWith('fixtures'));
    await verify(fixturesSource, fixturesDestination);
} else {
    await mkdir(schemaDestination, { recursive: true });
    await Promise.all(
        (await readdir(schemaDestination, { withFileTypes: true }))
            .filter((entry) => entry.isFile())
            .map((entry) => rm(join(schemaDestination, entry.name))),
    );
    await cp(schemaSource, schemaDestination, { recursive: true });
    await rm(fixturesDestination, { recursive: true, force: true });
    await cp(fixturesSource, fixturesDestination, { recursive: true });
}
