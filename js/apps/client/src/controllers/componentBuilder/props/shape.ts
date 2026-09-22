import { DEFAULT_FONT_SIZE, type PlatformTokens, type PropConfig, type ThemeValues } from '../type';
import { Prop } from './prop';

export class ShapeProp extends Prop {
    protected readonly type = 'shape';

    constructor(name: string, data: PropConfig, platformTokens?: PlatformTokens) {
        super(name, data, platformTokens);
    }

    private getCSSVar(value: string | number) {
        const [, size] = value.toString().split('.');

        return `var(--border-radius-${size})`;
    }

    public getWebTokenValue(theme?: ThemeValues) {
        if (typeof this.value === 'number' || !this.value) {
            return;
        }

        const token = theme ? theme.getTokenValue(this.value, 'shape', 'web') : this.getCSSVar(this.value);

        const value = this.adjustment
            ? `calc(${token} + ${Number(this.adjustment) / DEFAULT_FONT_SIZE}rem)`
            : `${token}`;

        return {
            ...this.createWebToken(value),
        };
    }
}
