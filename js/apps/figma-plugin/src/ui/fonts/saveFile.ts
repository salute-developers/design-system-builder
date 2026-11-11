/** Сохраняет байты файлом через загрузку браузера окна плагина. */
export const saveFile = (bytes: Uint8Array, name: string, type: string) => {
    const url = URL.createObjectURL(new Blob([bytes], { type }));
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    document.body.append(link);
    link.click();
    link.remove();
    // Ссылка нужна браузеру до начала загрузки: освобождается позже.
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
};
