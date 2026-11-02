import type { PlatformTokens, PropConfig } from '../type';
import { Prop } from './prop';

/**
 * Ссылка на стиль другого компонента (`basic-button.xxs.default`): первая часть — конфигурация целевого
 * компонента, остальные — имена его стилей. Токена темы за ней нет: превью Compose разворачивает её во
 * вложенный стиль. В панели свойств значение не редактируется.
 */
export class StyleReferenceProp extends Prop {
    protected readonly type = 'component_style';

    constructor(name: string, data: PropConfig, platformTokens?: PlatformTokens) {
        super(name, data, platformTokens);
    }
}
