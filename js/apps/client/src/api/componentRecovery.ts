interface CoreOperation {
    coreSelectionRevision?: number;
    predecessor?: CoreOperation;
}
interface SavedOperation {
    generation: string;
    coreSelectionRevision?: number;
    predecessor?: SavedOperation;
    recoveryCopies?: SavedOperation[];
}

export function* coreSaveChain<T extends { predecessor?: T }>(head: T | null | undefined): Generator<T> {
    while (head) {
        yield head;
        head = head.predecessor;
    }
}

const preparations = (head: SavedOperation): SavedOperation[] =>
    [...coreSaveChain(head)].flatMap((item) =>
        item.recoveryCopies?.length ? item.recoveryCopies.flatMap(preparations) : [item],
    );

export const hasStaleCoreSave = (head: CoreOperation | null | undefined, revision?: number): boolean =>
    revision != null && [...coreSaveChain(head)].some((item) => item.coreSelectionRevision !== revision);

const recoveryBytes = (key: string): string[] =>
    Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i))
        .filter((slot): slot is string => slot?.startsWith(`${key}:recovery`) === true)
        .map((slot) => localStorage.getItem(slot))
        .filter((bytes): bytes is string => bytes !== null);

const savedPreparations = (bytes: string): SavedOperation[] => {
    try {
        return preparations(JSON.parse(bytes));
    } catch {
        return [];
    }
};

/** Подтверждена только точная сохранённая подготовка, а не всё поколение. Исходный ключ не удаляется. */
export const readPendingComponentMutation = (key: string): string | null => {
    const bytes = localStorage.getItem(key);
    if (bytes === null) return null;
    return recoveryBytes(key).some((copy) => savedPreparations(copy).some((item) => JSON.stringify(item) === bytes))
        ? null
        : bytes;
};

/** Все физически сохранённые копии доступны в UI, даже если необязательный указатель не записался. */
export const readComponentRecovery = (key: string): string | null => {
    const copies = recoveryBytes(key);
    if (!copies.length) return null;
    const values = [...new Set(copies.flatMap(savedPreparations).map((item) => JSON.stringify(item)))].map((bytes) =>
        JSON.parse(bytes),
    );
    if (!values.length) return null;
    const head = values[values.length - 1];
    return JSON.stringify(values.length > 1 ? { ...head, recoveryCopies: values } : head);
};

/** Сохраняет свою полную цепочку; независимая правка другой вкладки остаётся действующей. */
export const archiveCoreSave = (key: string, head: SavedOperation): SavedOperation => {
    const pending = readPendingComponentMutation(key);
    const disk = pending ? (JSON.parse(pending) as SavedOperation) : null;
    const chain = [...coreSaveChain(head)];
    if (disk && !chain.some((item) => item.generation === disk.generation))
        throw new Error('Локальная правка изменилась в другой вкладке. Обновите страницу.');
    const copies = disk && !chain.some((item) => JSON.stringify(item) === pending) ? [head, disk] : null;
    const snapshot = copies ? { ...head, recoveryCopies: copies } : head;
    const bytes = JSON.stringify(snapshot);
    if (!recoveryBytes(key).includes(bytes)) localStorage.setItem(`${key}:recovery:${crypto.randomUUID()}`, bytes);
    try {
        localStorage.setItem(`${key}:recovery`, bytes);
    } catch {
        /* Полная копия уже сохранена отдельно. */
    }
    return snapshot;
};

export const waitForComponentRequests = async (pending: () => boolean) => {
    const deadline = Date.now() + 10_000;
    while (pending()) {
        if (Date.now() >= deadline) throw new Error('Не удалось дождаться предыдущего запроса');
        await new Promise((resolve) => setTimeout(resolve, 25));
    }
};
