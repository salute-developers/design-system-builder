/**
 * Копирует текст в буфер обмена. У окна плагина origin `null`, и `navigator.clipboard` там может быть запрещён,
 * поэтому сначала используется скрытое поле и `execCommand`, а `navigator.clipboard` — запасной путь.
 */
export const copyText = async (text: string): Promise<boolean> => {
    // Выделение уводит фокус в скрытое поле: после копирования он возвращается туда, где был.
    const focused = document.activeElement as HTMLElement | null;
    const field = document.createElement('textarea');
    field.value = text;
    field.setAttribute('readonly', '');
    field.style.position = 'fixed';
    field.style.top = '0';
    field.style.left = '0';
    field.style.opacity = '0';
    document.body.appendChild(field);
    field.select();
    let copied = false;
    try {
        copied = document.execCommand('copy');
    } catch {
        copied = false;
    } finally {
        field.remove();
        focused?.focus();
    }
    if (copied) return true;
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch {
        return false;
    }
};
