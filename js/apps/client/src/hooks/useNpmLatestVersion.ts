import { useEffect, useState } from 'react';

import { getNpmLatestVersion } from '../api';

export const useNpmLatestVersion = (packagesName?: string, interval = 15_000) => {
    const [version, setVersion] = useState<string | null>(null);

    useEffect(() => {
        if (!packagesName) {
            return;
        }

        let stopped = false;
        let timer: ReturnType<typeof setTimeout> | undefined;

        const poll = async () => {
            try {
                const latest = await getNpmLatestVersion(packagesName);

                if (!stopped) {
                    setVersion(latest);
                }
            } catch (error) {
                console.error('[useNpmLatestVersion] Не удалось получить версию из npm', error);
            }

            if (!stopped) {
                timer = setTimeout(poll, interval);
            }
        };

        poll();

        return () => {
            stopped = true;

            if (timer) {
                clearTimeout(timer);
            }
        };
    }, [packagesName, interval]);

    return version;
};
