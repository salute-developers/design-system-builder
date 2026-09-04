import { getColorAndOpacity } from '../../../../utils';
import { WebShadowToken, WebShapeToken, WebSpacingToken } from '../../../../controllers';
import { ShadowType } from '../../../../features';

export const getTokenValue = (
    token: WebShadowToken[string] | WebShapeToken[string] | WebSpacingToken[string],
): string | ShadowType[] => {
    if (typeof token === 'string') {
        return `${parseFloat(token) * 16}`;
    }

    return token.map((shadow) => {
        const [offsetX, offsetY, blur, spread, ...value] = shadow.split(' ');
        const [color, opacity] = getColorAndOpacity(value.join(' '));

        return {
            offsetX: (parseFloat(offsetX) * 16).toString(),
            offsetY: (parseFloat(offsetY) * 16).toString(),
            blur: (parseFloat(blur) * 16).toString(),
            spread: (parseFloat(spread) * 16).toString(),
            color,
            opacity,
        };
    });
};
