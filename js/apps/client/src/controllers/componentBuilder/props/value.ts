import type { PlatformTokens, PropConfig } from '../type';
import { Prop } from './prop';

/**
 * INFO: Значение «как есть»: `auto`, `100%`, `fit-content`, `pointer`, transition, `url(...)`.
 * Токена темы за ним нет, преобразований нет — строка уходит в CSS-переменную без изменений.
 * В панели свойств пока не редактируется, но в превью применяется.
 */
export class ValueProp extends Prop {
    protected readonly type = 'value';

    constructor(name: string, data: PropConfig, platformTokens?: PlatformTokens) {
        super(name, data, platformTokens);
    }

    public getWebTokenValue() {
        if (this.value === undefined || this.value === null || this.value === '') {
            return;
        }

        return {
            ...this.createWebToken(String(this.value)),
        };
    }
}
