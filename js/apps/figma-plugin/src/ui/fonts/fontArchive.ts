import type { PlanFontFamily } from '../../shared/exportPlan';
import type { ArchiveFile } from '../../shared/zip';

/** Файл, который не удалось скачать, и причина. */
export interface FontDownloadFailure {
    name: string;
    reason: string;
}

export class FontDownloadError extends Error {
    constructor(readonly failures: FontDownloadFailure[]) {
        super(failures.map((item) => item.name).join(', '));
    }
}

/**
 * Скачивает файлы недостающих семейств через [load] и упаковывает через [pack] в архив `<семейство>/<файл>`. Любой нескачанный файл
 * прерывает сборку: неполный архив выглядел бы как полный набор начертаний.
 */
export const fontArchive = async (
    families: PlanFontFamily[],
    load: (url: string) => Promise<Uint8Array>,
    pack: (files: ArchiveFile[]) => Promise<Uint8Array>,
    onProgress: (done: number, total: number) => void = () => undefined,
): Promise<Uint8Array> => {
    const entries = families.flatMap(({ family, files }) => files.map((file) => ({ family, file })));
    const failures: FontDownloadFailure[] = [];
    let done = 0;
    const files = await Promise.all(
        entries.map(async ({ family, file }) => {
            try {
                return { path: `${family}/${file.name}`, data: await load(file.url) };
            } catch (error) {
                failures.push({ name: file.name, reason: error instanceof Error ? error.message : String(error) });
                return null;
            } finally {
                done += 1;
                onProgress(done, entries.length);
            }
        }),
    );
    if (failures.length) throw new FontDownloadError(failures);
    return pack(files.filter((item): item is ArchiveFile => item !== null));
};
