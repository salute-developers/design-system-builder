import type { PlatformTokens, PropConfig } from '../type';
import { Prop } from './prop';

/**
 * INFO: Значение «как есть»: `auto`, `100%`, `fit-content`, `pointer`, transition, `url(...)`.
 * Токена темы за ним нет: в payload превью значение уходит литералом.
 * В панели свойств пока не редактируется.
 */
export class ValueProp extends Prop {
    protected readonly type = 'value';

    constructor(name: string, data: PropConfig, platformTokens?: PlatformTokens) {
        super(name, data, platformTokens);
    }
}
