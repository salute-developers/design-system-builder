import type { Theme } from '../../themeBuilder';
import type { PlatformTokens, PropConfig } from '../type';
import { Prop } from './prop';

export class ShadowProp extends Prop {
    protected readonly type = 'shadow';

    constructor(name: string, data: PropConfig, platformTokens?: PlatformTokens) {
        super(name, data, platformTokens);
    }

    private getCSSVar(value: string | number) {
        return `var(--shadow-${value.toString().replace(/\./g, '-')})`;
    }

    public getWebTokenValue(componentName?: string, theme?: Theme) {
        if (typeof this.value === 'number' || this.value === undefined) {
            return;
        }

        const themeValue = theme?.getTokenValue(this.value, 'shadow', 'web');
        const value = themeValue ? [themeValue].flat().join(', ') : this.getCSSVar(this.value);

        return {
            ...this.createWebToken(value, componentName),
        };
    }
}
