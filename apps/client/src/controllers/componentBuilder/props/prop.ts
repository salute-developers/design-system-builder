import { upperFirstLetter } from '@salutejs/plasma-tokens-utils';

import { camelToKebab } from '../../../utils';
import type { PlatformTokens, PropConfig, PropType, State, WebToken } from '../type';

export abstract class Prop {
    protected name = '';

    protected id = '';

    protected type?: PropType;

    protected value?: string | number;

    protected default?: string | number;

    protected states?: State[] | null;

    protected adjustment?: string | number;

    protected webTokens?: WebToken[] | null;

    constructor(name: string, data: PropConfig, platformTokens?: PlatformTokens) {
        const { value, id, adjustment, states } = data;

        this.name = name;
        this.id = id;
        this.value = value;
        this.default = value;
        this.adjustment = adjustment;
        this.states = states;

        this.webTokens = platformTokens?.web;
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

    public removeState(name: string) {
        if (!this.states) {
            return;
        }

        const newStates = this.states.filter((item) => item.state[0] !== name);

        if (!newStates.length) {
            this.states = null;
        }

        this.states = newStates;
    }

    public setState(name: string, value: State) {
        if (!this.states) {
            return;
        }

        // TODO: поддержать работу с несколькими стейтами
        const stateIndex = this.states.findIndex((item) => item.state[0] === name);

        if (stateIndex === -1) {
            return;
        }

        this.states[stateIndex] = value;
    }

    public addState(value: State) {
        this.states ??= [];

        this.states?.push(value);
    }

    public getAdjustment() {
        return this.adjustment;
    }

    public setAdjustment(value?: string | number) {
        this.adjustment = value;
    }

    public getWebTokens() {
        return this.webTokens;
    }

    protected getFormattedTokenName(tokenName: string, componentName?: string) {
        return upperFirstLetter(tokenName).startsWith(componentName || '')
            ? upperFirstLetter(tokenName)
            : `${componentName}${upperFirstLetter(tokenName)}`;
    }

    protected getAdditionalTokens(
        token: string,
        getValue: (state: State) => string | number | undefined,
        componentName?: string,
    ) {
        if (!this.states?.length) {
            return null;
        }

        const statesMap = {
            hovered: 'Hover',
            pressed: 'Active',
        };

        return this.states.reduce((acc, item) => {
            const state = item.state[0] as keyof typeof statesMap; // TODO поддержать работу с несколькими стейтами

            const formattedTokenName = this.getFormattedTokenName(token, componentName);
            const tokenName = `--plasma${formattedTokenName}${statesMap[state]}`;

            const value = getValue(item);

            return {
                ...acc,
                [camelToKebab(tokenName)]: value,
            };
        }, {});
    }

    public createWebToken(value: string | number, componentName?: string) {
        if (!this.webTokens || !this.webTokens.length || !value) {
            return null;
        }

        const replaceAdjustmentPlaceholders = (template: string, values: string[]) => {
            return template.replace(/\$(\d+)/g, (_, index) => {
                return values[index - 1] !== undefined ? values[index - 1] : `$${index}`;
            });
        };

        return this.webTokens.reduce((acc, { name, adjustment }) => {
            const formattedTokenName = this.getFormattedTokenName(name, componentName);
            const tokenName = `--plasma${formattedTokenName}`;

            const newValue = adjustment
                ? replaceAdjustmentPlaceholders(adjustment, [value.toString()])
                : value.toString();

            return {
                ...acc,
                [camelToKebab(tokenName)]: newValue,
            };
        }, {});
    }
}
