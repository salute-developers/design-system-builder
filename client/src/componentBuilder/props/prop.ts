import { camelToKebab } from '../../_new/utils';
import { capitalize } from '../utils';
import type { PropConfig, PropType, State, WebToken } from '../type';

export abstract class Prop {
    protected name = '';

    protected id = '';

    protected type?: PropType;

    protected value?: string | number;

    protected default?: string | number;

    protected states?: State[] | null;

    protected adjustment?: string | number;

    protected webTokens?: WebToken[] | null;

    constructor(name: string, data: PropConfig, webTokens?: WebToken[] | null) {
        const { value, id, adjustment, states } = data;

        this.name = name;
        this.id = id;
        this.value = value;
        this.default = value;
        this.adjustment = adjustment;
        this.states = states;

        this.webTokens = webTokens;
    }

    private replaceAdjustmentPlaceholders(template: string, values: string[]) {
        return template.replace(/\$(\d+)/g, (_, index) => {
            return values[index - 1] !== undefined ? values[index - 1] : `$${index}`;
        });
    }

    public createWebToken(value: string | number) {
        if (!this.webTokens || !this.webTokens.length || !value) {
            return null;
        }

        return this.webTokens.reduce((acc, { name, adjustment }) => {
            const tokenName = `--plasma${capitalize(name)}`;

            const newValue = adjustment
                ? this.replaceAdjustmentPlaceholders(adjustment, [value.toString()])
                : value.toString();

            return {
                ...acc,
                [camelToKebab(tokenName)]: newValue,
            };
        }, {});
    }

    public getName() {
        return this.name;
    }

    public setName(value: string) {
        this.name = value;
    }

    public getID() {
        return this.id;
    }

    public getValue() {
        return this.value;
    }

    public setValue(value: string | number) {
        this.value = value;
    }

    public getDefault() {
        return this.default;
    }

    public getType() {
        return this.type;
    }

    public getStates() {
        return this.states;
    }

    public setStates(value: State[] | null) {
        this.states = value;
    }

    public getAdjustment() {
        return this.adjustment;
    }

    public getWebTokens() {
        return this.webTokens;
    }
}
