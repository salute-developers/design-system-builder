import type { ComponentAPI, PlatformTokens, PropConfig, PropType, PropUnion } from '../type';
import { ColorProp } from './color';
import { DimensionProp } from './dimension';
import { FloatProp } from './float';
import { IntegerProp } from './integer';
import { IconProp } from './icon';
import { ShadowProp } from './shadow';
import { ShapeProp } from './shape';
import { StyleReferenceProp } from './style-reference';
import { TypographyProp } from './typography';
import { ValueProp } from './value';

/** Единое соответствие типа API и клиентской модели свойства. */
const PROP_CONSTRUCTORS = new Map<PropType, new (name: string, data: PropConfig, tokens?: PlatformTokens) => PropUnion>(
    [
        ['color', ColorProp],
        ['dimension', DimensionProp],
        ['float', FloatProp],
        ['integer', IntegerProp],
        ['icon', IconProp],
        ['shadow', ShadowProp],
        ['shape', ShapeProp],
        ['typography', TypographyProp],
        ['value', ValueProp],
        ['component_style', StyleReferenceProp],
    ],
);

export class Props {
    private list: PropUnion[] = [];

    constructor(props: PropConfig[] | null, api: ComponentAPI[]) {
        (props ?? []).forEach((prop) => {
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
        const Constructor = PROP_CONSTRUCTORS.get(token.type);
        return Constructor ? new Constructor(token.name, item, token.platformMappings) : null;
    }
}
