import type { ComponentAPI, PropConfig, PropUnion } from '../type.ts';
import { ColorProp } from './color.ts';
import { DimensionProp } from './dimension.ts';
import { FloatProp } from './float.ts';
import { ShadowProp } from './shadow.ts';
import { ShapeProp } from './shape.ts';
import { TypographyProp } from './typography.ts';
import { ValueProp } from './value.ts';

export class Props {
    private list: PropUnion[] = [];

    constructor(props: PropConfig[] | null, api: ComponentAPI[]) {
        if (props === null) {
            return;
        }

        // TOOD: подумать, можно ли сделать лучше
        (props || []).forEach((prop) => {
            const tokenFromAPI = this.getTokenFromAPI(api, prop.id);

            if (!tokenFromAPI) {
                return;
            }

            const isTokenExist = this.list.find((item) => item.getID() === tokenFromAPI.id);

            if (isTokenExist) {
                return;
            }

            const token = this.getConfigToken(tokenFromAPI, prop);

            if (token === null) {
                return;
            }

            this.list.push(token);
        });
    }

    public getList() {
        return [...this.list].sort((a, b) => a.getName().localeCompare(b.getName()));
    }

    public getProp(id: string) {
        return this.list.find((item) => item.getID() === id);
    }

    public addProp(id: string, value: string | number, api: ComponentAPI[]) {
        const tokenFromAPI = this.getTokenFromAPI(api, id);

        if (!tokenFromAPI) {
            return;
        }

        const propValues = {
            id,
            value,
            adjustment: undefined,
            states: undefined,
        };

        const token = this.getConfigToken(tokenFromAPI, propValues);

        if (token === null) {
            return;
        }

        this.list.push(token);
    }

    public removeProp(id: string) {
        this.list = this.list.filter((item) => item.getID() !== id);
    }

    private getTokenFromAPI(api: ComponentAPI[], id: string) {
        return api.find((item) => item.id === id);
    }

    private getConfigToken(token: ComponentAPI, item: PropConfig) {
        const { type, name, platformMappings } = token;

        if (type === 'color') {
            return new ColorProp(name, item, platformMappings);
        }

        if (type === 'float') {
            return new FloatProp(name, item, platformMappings);
        }

        if (type === 'shadow') {
            return new ShadowProp(name, item, platformMappings);
        }

        if (type === 'shape') {
            return new ShapeProp(name, item, platformMappings);
        }

        if (type === 'dimension') {
            return new DimensionProp(name, item, platformMappings);
        }

        if (type === 'typography') {
            return new TypographyProp(name, item, platformMappings);
        }

        if (type === 'value') {
            return new ValueProp(name, item, platformMappings);
        }

        return null;
    }
}
