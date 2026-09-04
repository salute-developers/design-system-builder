import { useEffect } from 'react';

export const useGlobalKeyDown = (handleKeyDown: (event: KeyboardEvent) => void) => {
    useEffect(() => {
        window.addEventListener('keydown', handleKeyDown);

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [handleKeyDown]);
};
