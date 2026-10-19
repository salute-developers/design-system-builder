/** Clipboard API есть только в безопасном контексте; запасной путь — временный `textarea`. */
export const copyText = async (text: string) => {
    if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return;
    }

    const area = document.createElement('textarea');
    area.value = text;
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    const copied = document.execCommand('copy');
    document.body.removeChild(area);

    if (!copied) throw new Error('Copy is not available');
};
