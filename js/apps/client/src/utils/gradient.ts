import { getHEXAColor } from '@salutejs/plasma-tokens-utils';

const NUM = String.raw`\d+(?:\.\d+)?`;
const PCT = `${NUM}%`;
const STRICT_HEX = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
const STRICT_RGB = new RegExp(`^rgb\\(${NUM}, ${NUM}, ${NUM}\\)$`);
const STRICT_RGBA = new RegExp(`^rgba\\(${NUM}, ${NUM}, ${NUM}, ${NUM}\\)$`);
const STRICT_HSL = new RegExp(`^hsl\\(${NUM}(?:deg)?, ${PCT}, ${PCT}\\)$`);
const STRICT_HSLA = new RegExp(`^hsla\\(${NUM}(?:deg)?, ${PCT}, ${PCT}, ${NUM}\\)$`);

const isStrictColor = (color: string) =>
    STRICT_HEX.test(color) ||
    STRICT_RGB.test(color) ||
    STRICT_RGBA.test(color) ||
    STRICT_HSL.test(color) ||
    STRICT_HSLA.test(color);

export const getGradientParts = (value: string) => {
    const gradient = value.substring(value.indexOf('(') + 1, value.lastIndexOf(')'));
    return gradient.split(/,\s(?![^(]*\))(?![^"']*["'](?:[^"']*["'][^"']*["'])*[^"']*$)/gm);
};

export const parseGradientsByLayer = (value: string) => {
    if (!/^((rgba?|hsla?)\(|#\w{6,8}|(linear|radial)-gradient\()/.test(value)) {
        return null;
    }

    if (/,(?! )|,  +|\s[(),]|\(\s|\)(?![\s,)]|$)|\) {2,}|\) $/.test(value.replace(/\([^()]*\)/g, '()'))) {
        return null;
    }

    const colorCandidates = value.match(/#\w+|(?:rgba?|hsla?)\([^)]*\)/g) || [];
    if (colorCandidates.some((color) => !isStrictColor(color))) {
        return null;
    }

    // TODO: поправить превью для цвета и градиентов

    const regex =
        /((rgba?|hsla?)\([\d.%\s,()#\w]*\))|(#\w{6,8})|(?:linear-gradient\((?=[\d.]+deg,)|radial-gradient\()(?![^)]*(?:#\w{6,8}\b|rgba?\([^)]*\)|hsla?\([^)]*\))(?! \d+(?:\.\d+)?%)[^)]*[,)])[\d.%\s,()#\w]+?\)(?=,*\s*(linear|radial|$|rgb|hsl|#))/g;
    return value.match(regex);
};

/** Стоп `<цвет> <позиция>%`: позиция из одной и более цифр, с дробной частью или без. */
const STOP = /^(.*?)\s+(\d+(?:\.\d+)?)%$/;

const getColors = (restParams: string[]) =>
    restParams.reduce((colors: string[], item: string) => {
        const [, color = item.trim()] = item.trim().match(STOP) || [];
        colors.push(color);

        return colors;
    }, []);

const getLocations = (restParams: string[]) =>
    restParams.reduce((locations: number[], item: string) => {
        const [, , location = '0'] = item.trim().match(STOP) || [];
        const locationNumber = Number((Number(location) / 100).toFixed(2));

        locations.push(locationNumber);

        return locations;
    }, []);

const parseRadialParams = (shapeAndPosition: string) => {
    const atMatch = shapeAndPosition.match(/at\s+([\d.]+%?)\s+([\d.]+%?)/);
    const sizeMatch = shapeAndPosition.match(/([\d.]+%?)\s+([\d.]+%?)\s+at/);

    const centerX = atMatch ? parseFloat(atMatch[1]) / (atMatch[1].includes('%') ? 100 : 1) : 0.5;
    const centerY = atMatch ? parseFloat(atMatch[2]) / (atMatch[2].includes('%') ? 100 : 1) : 0.5;

    let radius = 0.5;

    if (sizeMatch) {
        const radiusX = parseFloat(sizeMatch[1]) / (sizeMatch[1].includes('%') ? 100 : 1);
        const radiusY = parseFloat(sizeMatch[2]) / (sizeMatch[2].includes('%') ? 100 : 1);
        radius = Math.max(radiusX, radiusY);
    }

    return { centerX, centerY, radius };
};

/** `from <угол>deg at <x>% <y>%` слоя Conic; без указанного — 0° и центр. */
const parseConicParams = (fromAndPosition: string) => {
    const fromMatch = fromAndPosition.match(/from\s+(-?[\d.]+)deg/);
    const atMatch = fromAndPosition.match(/at\s+([\d.]+)%\s+([\d.]+)%/);

    return {
        from: fromMatch ? Number(fromMatch[1]) : 0,
        centerX: atMatch ? Number(atMatch[1]) / 100 : 0.5,
        centerY: atMatch ? Number(atMatch[2]) / 100 : 0.5,
    };
};

export const parseGradient = (gradientArray: string[], platform: 'ios' | 'android') => {
    const layers = gradientArray.reduce((result, gradient) => {
        const type = gradient.substring(0, gradient.indexOf('('));

        if (type === 'linear-gradient') {
            const [angle, ...restParams] = getGradientParts(gradient);

            result.push({
                kind: 'linear',
                locations: getLocations(restParams),
                colors: getColors(restParams).map(getHEXAColor),
                angle: Number(angle.replace(/deg/gm, '')),
            });

            return result;
        }

        if (type === 'radial-gradient') {
            const [shapeAndPosition, ...restParams] = getGradientParts(gradient);
            const { centerX, centerY, radius } = parseRadialParams(shapeAndPosition);

            result.push({
                kind: 'radial',
                locations: getLocations(restParams),
                colors: getColors(restParams).map(getHEXAColor),
                centerX,
                centerY,
                ...(platform === 'ios'
                    ? {
                          startRadius: 0,
                          endRadius: radius,
                      }
                    : {
                          radius,
                      }),
            });

            return result;
        }

        if (type === 'conic-gradient') {
            const [fromAndPosition, ...restParams] = getGradientParts(gradient);
            const { from, centerX, centerY } = parseConicParams(fromAndPosition);

            // В слое `angular` Android угла нет: legacy-экраны передают слой без начального угла.
            result.push({
                kind: 'angular',
                locations: getLocations(restParams),
                colors: getColors(restParams).map(getHEXAColor),
                ...(platform === 'ios' ? { startAngle: from, endAngle: from + 360 } : {}),
                centerX,
                centerY,
            });

            return result;
        }

        result.push({
            kind: 'color',
            background: getHEXAColor(gradient),
        });

        return result;
    }, [] as Array<any>);

    return layers;
};
