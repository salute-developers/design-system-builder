import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

import { authService } from '../api';
import { normalizeAnalyticsView } from './routes';
import { webAnalytics } from './metrica';

/** Router уже удалил basename; таймер позволяет завершить синхронные редиректы. */
export const AnalyticsNavigation = () => {
    const observedPathname = useRef<string>();
    const sentPathname = useRef<string>();
    const { pathname } = useLocation();
    useEffect(() => {
        if (observedPathname.current !== pathname) sentPathname.current = undefined;
        observedPathname.current = pathname;
        if (sentPathname.current === pathname) return;
        const authenticated = authService.isAuthenticated();
        if ((pathname === '/login') === authenticated) return;
        const view = normalizeAnalyticsView(pathname);
        if (!view) return;
        const timer = window.setTimeout(() => {
            sentPathname.current = pathname;
            webAnalytics.view(view);
        }, 0);
        return () => window.clearTimeout(timer);
    }, [pathname]);
    return null;
};
