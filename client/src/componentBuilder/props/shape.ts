import type { Theme } from '../../themeBuilder';
import { DEFAULT_FONT_SIZE, type PropConfig, type WebToken } from '../type';
import { Prop } from './prop';

export class ShapeProp extends Prop {
    protected readonly type = 'shape';

    constructor(name: string, data: PropConfig, webTokens?: WebToken[] | null) {
        super(name, data, webTokens);
    }

    private getCSSVar(value: string | number) {
        const [, size] = value.toString().split('.');

        return `var(--border-radius-${size})`;
    }

    public getWebTokenValue(theme?: Theme) {
        if (typeof this.adjustment === 'string' || typeof this.value === 'number' || this.value === undefined) {
            return;
        }

        const token = theme ? theme.getTokenValue(this.value, 'shape', 'web') : this.getCSSVar(this.value);

        const value = this.adjustment ? `calc(${token} + ${this.adjustment / DEFAULT_FONT_SIZE}rem)` : `${token}`;

        return {
            ...this.createWebToken(value),
        };
    }
}
