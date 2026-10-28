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
