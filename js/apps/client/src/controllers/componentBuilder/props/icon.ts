import type { PlatformTokens, PropConfig } from '../type';
import { Prop } from './prop';

/**
 * Иконка компонента: имя в формате данных (`disclosure.down.fill.16`). Токена темы за ней нет: превью передаёт имя плагину,
 * который находит иконку по нему.
 * В панели свойств иконка выбирается из каталога билдера (`IconPicker`); сохраняется строка старого формата без
 * преобразований, превью получает её литералом.
 */
export class IconProp extends Prop {
    protected readonly type = 'icon';

    constructor(name: string, data: PropConfig, platformTokens?: PlatformTokens) {
        super(name, data, platformTokens);
    }
}
