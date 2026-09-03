export const listenAuthChanges = (onChange: () => void) => {
    const handler = (event: StorageEvent) => {
        if (event.key?.startsWith('auth.')) {
            onChange();
        }
    };

    window.addEventListener('storage', handler);

    return () => window.removeEventListener('storage', handler);
};
