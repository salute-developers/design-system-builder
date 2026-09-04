export const getBaseName = () => {
    const { pathname } = window.location;
    const buildBaseName = import.meta.env.BASE_URL;

    if (buildBaseName !== '/') {
        return buildBaseName;
    }

    const prMatch = pathname.match(/^\/pr\/design-system-builder-pr-\d+/);

    if (prMatch) {
        return prMatch[0];
    }

    if (pathname.startsWith('/design-system-builder/')) {
        return '/design-system-builder/';
    }

    return '/';
};
