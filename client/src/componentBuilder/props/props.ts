import type { ComponentAPI, PropConfig, PropUnion } from '../type';
import { ColorProp } from './color';
import { DimensionProp } from './dimension';
import { FloatProp } from './float';
import { ShapeProp } from './shape';
import { TypographyProp } from './typography';

export class Props {
    private list: PropUnion[] = [];

    constructor(props: PropConfig[] | null, api: ComponentAPI[]) {
        if (props === null) {
            return;
        }

        // TOOD: подумать, можно ли сделать лучше
        (props || []).forEach((prop) => {
            const webToken = this.getTokenFromAPI(api, prop.id);

            if (!webToken) {
                return;
            }

            const isTokenExist = this.list.find((item) => item.getID() === webToken.id);

            if (isTokenExist) {
                return;
            }

            const token = this.getConfigToken(webToken, prop);

            if (token === null) {
                return;
            }

            this.list.push(token);
        });
    }

    public getList() {
        return this.list;
    }

    public addProp(id: string, value: string | number, api: ComponentAPI[]) {
        const webToken = this.getTokenFromAPI(api, id);

        if (!webToken) {
            return;
        }

        const propValues = {
            id,
            value,
            adjustment: undefined,
            states: undefined,
        };

        const token = this.getConfigToken(webToken, propValues);

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
        const webTokens = token.platformMappings.web;

        const { type, name } = token;

        if (type === 'color') {
            return new ColorProp(name, item, webTokens);
        }

        if (type === 'float') {
            return new FloatProp(name, item, webTokens);
        }

        if (type === 'shape') {
            return new ShapeProp(name, item, webTokens);
        }

        if (type === 'dimension') {
            return new DimensionProp(name, item, webTokens);
        }

        if (type === 'typography') {
            return new TypographyProp(name, item, webTokens);
        }

        return null;
    }
}
