import { describe, expect, it, vi } from 'vitest';

import { isComposePreviewEnvironmentSupported } from './environment';

// Пробы проверяются в порядке: сначала WasmGC, затем exception handling.
describe('isComposePreviewEnvironmentSupported', () => {
    it('supports an environment that validates both probes', () => {
        const validate = vi.fn().mockReturnValue(true);

        expect(isComposePreviewEnvironmentSupported({ validate })).toBe(true);
        expect(validate).toHaveBeenCalledTimes(2);
    });

    it('rejects an environment without WebAssembly', () => {
        expect(isComposePreviewEnvironmentSupported(null)).toBe(false);
    });

    it('rejects an environment without WasmGC', () => {
        const validate = vi.fn().mockReturnValueOnce(false).mockReturnValue(true);

        expect(isComposePreviewEnvironmentSupported({ validate })).toBe(false);
    });

    it('rejects an environment without exception handling', () => {
        const validate = vi.fn().mockReturnValueOnce(true).mockReturnValueOnce(false);

        expect(isComposePreviewEnvironmentSupported({ validate })).toBe(false);
    });

    it('rejects an environment whose validator throws', () => {
        const validate = vi.fn(() => {
            throw new Error('unsupported');
        });

        expect(isComposePreviewEnvironmentSupported({ validate })).toBe(false);
    });

    // Настоящая проверка байтов проб: ошибка в них не должна проходить незамеченной.
    const nodeMajor = Number(process.versions.node.split('.')[0]);
    const hasRealWebAssembly = typeof WebAssembly === 'object' && nodeMajor >= 22;

    it.skipIf(!hasRealWebAssembly)('supports a runtime with WasmGC and exception handling (Node 22+)', () => {
        expect(isComposePreviewEnvironmentSupported()).toBe(true);
    });

    it.skipIf(!hasRealWebAssembly)('rejects corrupted probe modules with the real validator', () => {
        const corrupting = {
            validate: (bytes: BufferSource) => {
                const copy = new Uint8Array(bytes as Uint8Array);
                copy[copy.length - 1] = 0xff;
                return WebAssembly.validate(copy);
            },
        };

        expect(isComposePreviewEnvironmentSupported(corrupting)).toBe(false);
    });
});
