import { describe, expect, it } from 'vitest';

import { crc32, zip } from '../../shared/zip';
import { FontDownloadError, fontArchive } from './fontArchive';

const bytes = (text: string) => new TextEncoder().encode(text);

/** Читает центральный каталог ZIP: имена, размеры и CRC, как это делает распаковщик. */
const entries = (archive: Uint8Array) => {
    const view = new DataView(archive.buffer, archive.byteOffset, archive.byteLength);
    const end = archive.length - 22;
    expect(view.getUint32(end, true)).toBe(0x06054b50);
    const count = view.getUint16(end + 10, true);
    let offset = view.getUint32(end + 16, true);
    const result = [];
    for (let index = 0; index < count; index += 1) {
        expect(view.getUint32(offset, true)).toBe(0x02014b50);
        const nameLength = view.getUint16(offset + 28, true);
        const local = view.getUint32(offset + 42, true);
        const size = view.getUint32(offset + 24, true);
        const name = new TextDecoder().decode(archive.subarray(offset + 46, offset + 46 + nameLength));
        expect(view.getUint32(local, true)).toBe(0x04034b50);
        const data = archive.subarray(local + 30 + nameLength, local + 30 + nameLength + size);
        result.push({ name, crc: view.getUint32(offset + 16, true), text: new TextDecoder().decode(data) });
        offset += 46 + nameLength;
    }
    return result;
};

describe('архив шрифтов', () => {
    it('считает CRC-32 как распаковщики', () => {
        expect(crc32(bytes('123456789')).toString(16)).toBe('cbf43926');
    });

    it('собирает ZIP с папками семейств и именами в UTF-8', () => {
        const archive = zip([
            { path: 'SB Sans Display/Bold.otf', data: bytes('bold') },
            { path: 'Шрифт/Regular.otf', data: bytes('regular') },
        ]);

        expect(entries(archive)).toEqual([
            { name: 'SB Sans Display/Bold.otf', crc: crc32(bytes('bold')), text: 'bold' },
            { name: 'Шрифт/Regular.otf', crc: crc32(bytes('regular')), text: 'regular' },
        ]);
    });

    it('скачивает файлы недостающих семейств и сообщает прогресс', async () => {
        const progress: string[] = [];
        const archive = await fontArchive(
            [
                { family: 'SB Sans Display', files: [{ name: 'Bold.otf', url: 'https://cdn/Bold.otf' }] },
                { family: 'SB Sans Text', files: [{ name: 'Light.otf', url: 'https://cdn/Light.otf' }] },
            ],
            async (url) => bytes(url),
            async (files) => zip(files),
            (done, total) => progress.push(`${done}/${total}`),
        );

        expect(entries(archive).map(({ name, text }) => [name, text])).toEqual([
            ['SB Sans Display/Bold.otf', 'https://cdn/Bold.otf'],
            ['SB Sans Text/Light.otf', 'https://cdn/Light.otf'],
        ]);
        expect(progress).toEqual(['1/2', '2/2']);
    });

    it('не отдаёт неполный архив и называет нескачанные файлы', async () => {
        const download = fontArchive(
            [
                {
                    family: 'SB Sans Text',
                    files: [
                        { name: 'Light.otf', url: 'https://cdn/Light.otf' },
                        { name: 'Bold.otf', url: 'https://cdn/Bold.otf' },
                    ],
                },
            ],
            async (url) => {
                if (url.endsWith('Bold.otf')) throw new Error('ответ 404');
                return bytes(url);
            },
            async (files) => zip(files),
        );

        await expect(download).rejects.toThrow(FontDownloadError);
        await expect(download).rejects.toMatchObject({ failures: [{ name: 'Bold.otf', reason: 'ответ 404' }] });
    });
});
