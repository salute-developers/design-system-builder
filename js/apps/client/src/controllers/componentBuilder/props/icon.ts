import type { PlatformTokens, PropConfig } from '../type';
import { Prop } from './prop';

/**
 * Иконка компонента: имя в формате данных (`disclosure.down.fill.16`). Токена темы за ней нет, а web-превью иконок
 * из конфигурации не использует; Compose-превью передаёт имя плагину, который находит иконку по нему.
 * В панели свойств значение не редактируется.
 */
export class IconProp extends Prop {
    protected readonly type = 'icon';

    constructor(name: string, data: PropConfig, platformTokens?: PlatformTokens) {
        super(name, data, platformTokens);
    }

    public getWebTokenValue() {
        return undefined;
    }
}
