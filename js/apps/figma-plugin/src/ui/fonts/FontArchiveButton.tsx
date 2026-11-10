import { useState } from 'react';

import type { PlanFontFamily } from '../../shared/exportPlan';
import type { PackZip } from '../bridge';
import { FontDownloadError, fontArchive } from './fontArchive';
import { saveFile } from './saveFile';

const ARCHIVE_NAME = 'dsbuilder-fonts.zip';

type ArchiveState =
    | { state: 'idle' }
    | { state: 'loading'; done: number; total: number }
    | { state: 'saved' }
    | { state: 'failed'; message: string };

/**
 * Одна кнопка вместо списка файлов: скачивает начертания недостающих семейств и сохраняет их архивом. Если файл не
 * скачался, называет его и причину; кнопку можно нажать снова.
 */
export const FontArchiveButton = ({
    families,
    load,
    pack,
    save = saveFile,
}: {
    families: PlanFontFamily[];
    /** Байты файла по ссылке: через общее Kotlin-ядро, окно само сеть не трогает. */
    load: (url: string) => Promise<Uint8Array>;
    /** Упаковка в ZIP основным потоком. */
    pack: PackZip;
    save?: (bytes: Uint8Array, name: string, type: string) => void;
}) => {
    const [archive, setArchive] = useState<ArchiveState>({ state: 'idle' });
    const total = families.reduce((sum, family) => sum + family.files.length, 0);
    const download = () => {
        setArchive({ state: 'loading', done: 0, total });
        fontArchive(families, load, pack, (done) => setArchive({ state: 'loading', done, total })).then(
            (bytes) => {
                save(bytes, ARCHIVE_NAME, 'application/zip');
                setArchive({ state: 'saved' });
            },
            (error: unknown) => {
                const message =
                    error instanceof FontDownloadError
                        ? error.failures.map(({ name, reason }) => `${name} (${reason})`).join(', ')
                        : String(error);
                setArchive({ state: 'failed', message });
            },
        );
    };
    return (
        <div className="export-font-files" data-testid="font-files">
            <button type="button" disabled={archive.state === 'loading'} onClick={download}>
                {archive.state === 'loading'
                    ? `Скачиваем: ${archive.done} из ${archive.total}`
                    : 'Скачать шрифты одним архивом (ZIP)'}
            </button>
            {archive.state === 'saved' && (
                <p className="export-hint" role="status">
                    Архив {ARCHIVE_NAME} в загрузках: распакуйте, установите шрифты и повторите экспорт.
                </p>
            )}
            {archive.state === 'failed' && (
                <p className="error" role="alert">
                    Не удалось скачать: {archive.message}. Нажмите кнопку ещё раз.
                </p>
            )}
        </div>
    );
};
