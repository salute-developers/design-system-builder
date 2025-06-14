import { meta } from './meta';
import { webColor, webFontFamily, webGradient, webShadow, webShape, webSpacing, webTypography } from './web';
import {
    androidColor,
    androidFontFamily,
    androidGradient,
    androidShadow,
    androidShape,
    androidSpacing,
    androidTypography,
} from './android';
import { iosColor, iosFontFamily, iosGradient, iosShadow, iosShape, iosSpacing, iosTypography } from './ios';

// TODO: Забирать из бд по api
export const themeData = {
    meta,
    variations: {
        color: {
            web: webColor,
            android: androidColor,
            ios: iosColor,
        },
        gradient: {
            web: webGradient,
            android: androidGradient,
            ios: iosGradient,
        },
        shadow: {
            web: webShadow,
            android: androidShadow,
            ios: iosShadow,
        },
        shape: {
            web: webShape,
            android: androidShape,
            ios: iosShape,
        },
        spacing: {
            web: webSpacing,
            android: androidSpacing,
            ios: iosSpacing,
        },
        typography: {
            web: webTypography,
            android: androidTypography,
            ios: iosTypography,
        },
        fontFamily: {
            web: webFontFamily,
            android: androidFontFamily,
            ios: iosFontFamily,
        },
    },
};
