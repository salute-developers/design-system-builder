const CRC_TABLE = (() => {
    const table = new Uint32Array(256);
    for (let n = 0; n < 256; n += 1) {
        let c = n;
        for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        table[n] = c >>> 0;
    }
    return table;
})();

export const crc32 = (data: Uint8Array) => {
    let crc = 0xffffffff;
    for (const byte of data) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
    return (crc ^ 0xffffffff) >>> 0;
};

/** UTF-8 имени файла: в основном потоке Figma нет `TextEncoder`. */
const utf8 = (text: string) => {
    const out: number[] = [];
    for (const char of text) {
        const code = char.codePointAt(0)!;
        if (code < 0x80) out.push(code);
        else if (code < 0x800) out.push(0xc0 | (code >> 6), 0x80 | (code & 63));
        else if (code < 0x10000) out.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 63), 0x80 | (code & 63));
        else out.push(0xf0 | (code >> 18), 0x80 | ((code >> 12) & 63), 0x80 | ((code >> 6) & 63), 0x80 | (code & 63));
    }
    return new Uint8Array(out);
};

export interface ArchiveFile {
    path: string;
    data: Uint8Array;
}

/** 1 января 1980 года в формате DOS: нулевая дата ZIP недопустима, а точное время файлам не нужно. */
const DOS_DATE = 0x21;
/** Имена в UTF-8. */
const UTF8 = 0x0800;
const VERSION = 20;

/** Заголовок записи: локальный (30 байт) или центрального каталога (46 байт) с общими полями по смещению. */
const header = (size: number, signature: number, fields: number, name: Uint8Array) => {
    const bytes = new Uint8Array(size + name.length);
    const view = new DataView(bytes.buffer);
    view.setUint32(0, signature, true);
    bytes.set(name, size);
    return { bytes, view, at: (offset: number) => fields + offset };
};

/**
 * ZIP без сжатия (метод STORE). Файлы шрифтов почти не сжимаются, а своя запись не тянет библиотеку. Архив собирает
 * основной поток: размер окна плагина ограничен.
 */
export const zip = (files: ArchiveFile[]): Uint8Array => {
    const parts: Uint8Array[] = [];
    const directory: Uint8Array[] = [];
    let offset = 0;
    const used = new Set<string>();
    for (const file of files) {
        // Сегменты пути без `..` и разделителей внутри: архив не пишет за пределы папки распаковки.
        const path = file.path
            .split('/')
            .filter(Boolean)
            .map((part) => part.replace(/[\\:]/g, '_').replace(/^\.+$/, '_'))
            .join('/');
        // Повтор пути распаковщик перезаписал бы молча: второй файл получает номер.
        let unique = path;
        // Регистр не различают файловые системы macOS и Windows: `Bold.otf` и `bold.otf` — один файл.
        for (let index = 2; used.has(unique.toLowerCase()); index += 1) {
            unique = path.replace(/(\.[^./]*)?$/, ` (${index})$1`);
        }
        used.add(unique.toLowerCase());
        const name = utf8(unique);
        const crc = crc32(file.data);
        const size = file.data.length;
        // Общие поля: версия, флаги, метод, время, дата, CRC, размеры, длина имени.
        const fill = ({ view, at }: ReturnType<typeof header>) => {
            view.setUint16(at(0), VERSION, true);
            view.setUint16(at(2), UTF8, true);
            view.setUint16(at(8), DOS_DATE, true);
            view.setUint32(at(10), crc, true);
            view.setUint32(at(14), size, true);
            view.setUint32(at(18), size, true);
            view.setUint16(at(22), name.length, true);
        };
        const local = header(30, 0x04034b50, 4, name);
        fill(local);
        const central = header(46, 0x02014b50, 6, name);
        central.view.setUint16(4, VERSION, true);
        fill(central);
        central.view.setUint32(42, offset, true);
        parts.push(local.bytes, file.data);
        directory.push(central.bytes);
        offset += local.bytes.length + size;
    }
    const directorySize = directory.reduce((sum, item) => sum + item.length, 0);
    const end = new Uint8Array(22);
    const view = new DataView(end.buffer);
    view.setUint32(0, 0x06054b50, true);
    view.setUint16(8, files.length, true);
    view.setUint16(10, files.length, true);
    view.setUint32(12, directorySize, true);
    view.setUint32(16, offset, true);
    const all = [...parts, ...directory, end];
    const result = new Uint8Array(all.reduce((sum, item) => sum + item.length, 0));
    let position = 0;
    for (const item of all) {
        result.set(item, position);
        position += item.length;
    }
    return result;
};
