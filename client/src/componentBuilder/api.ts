import { meta } from '../_new/sources';
import type { Meta } from './type';

// TODO: загружать из базы
export const getComponentMeta = (componentName: string) => {
    const sources = meta.find((item) => item.name === componentName);

    return sources as Meta;
};
