import type { PreviewPluginPlatform } from './types';

interface WebAssemblyValidator {
    validate(bytes: BufferSource): boolean;
}

/** Модуль с типом struct: проходит проверку только при поддержке WasmGC. */
const WASM_GC_PROBE = new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 95, 1, 120, 0]);

/**
 * Модуль с `try`/`catch_all`: проходит проверку только при поддержке Wasm exception handling.
 * Kotlin 2.1 использует именно эту (legacy) форму. При переходе плагина на `exnref` нужна другая проба.
 */
const WASM_EXCEPTIONS_PROBE = new Uint8Array([
    0, 97, 115, 109, 1, 0, 0, 0, 1, 4, 1, 96, 0, 0, 3, 2, 1, 0, 10, 8, 1, 6, 0, 6, 64, 25, 11, 11,
]);

const defaultWebAssembly = (): WebAssemblyValidator | null =>
    typeof WebAssembly === 'object' ? WebAssembly : null;

/**
 * Проверяет, что браузер способен выполнить Compose/Wasm-плагин: есть WebAssembly, WasmGC и
 * exception handling. При `false` Compose-плагин не загружается.
 */
export const isComposePreviewEnvironmentSupported = (
    wasm: WebAssemblyValidator | null = defaultWebAssembly(),
): boolean => {
    if (!wasm || typeof wasm.validate !== 'function') return false;
    try {
        return wasm.validate(WASM_GC_PROBE) && wasm.validate(WASM_EXCEPTIONS_PROBE);
    } catch {
        return false;
    }
};

/**
 * Может ли браузер выполнить плагин превью платформы `platform`. WebAssembly нужен только Compose-плагину;
 * web-плагин — обычное React-приложение и проверок окружения не требует.
 */
export const isPreviewPluginEnvironmentSupported = (
    platform: PreviewPluginPlatform,
    wasm: WebAssemblyValidator | null = defaultWebAssembly(),
): boolean => (platform === 'compose' ? isComposePreviewEnvironmentSupported(wasm) : true);
