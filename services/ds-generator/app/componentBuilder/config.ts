import type { ComponentAPI, ComponentVariation, Meta, State } from './type';
import { Props } from './props';
import { Variation } from './variation';
import { Default } from './default';

export class Config {
    private name: string;

    private description: string;

    private defaults: Default[];

    private variations: Variation[] = [];

    private invariants: Props;

    constructor(meta: Meta, configInfo: { id: string; name: string }) {
        const { name, description, sources } = meta;

        this.name = name;
        this.description = description;

        const { api, configs, variations } = sources;

        const config = configs.find((item) => item.id === configInfo.id)?.config;

        if (!config) {
            this.defaults = [];
            this.variations = [];
            this.invariants = {} as any;
            return;
        }

        this.variations = config.variations.map((item) => {
            const variation = this.getVariationName(variations, item.id);

            return new Variation(variation, item, api);
        });

        this.invariants = new Props(config.invariantProps, api);

        this.defaults = config.defaultVariations.map((item) => {
            const variation = this.getVariationName(variations, item.variationID);
            const style = this.getStyleName(item.variationID, item.styleID);

            return new Default(variation, item.variationID, style, item.styleID);
        });
    }

    public getName() {
        return this.name;
    }

    public getDescription() {
        return this.description;
    }

    public getDefaults() {
        return this.defaults;
    }

    public getVariations() {
        return this.variations;
    }

    public getInvariants() {
        return this.invariants;
    }

    public getVariation(variationID?: string) {
        if (!variationID) {
            return;
        }

        return this.variations.find((item) => item.getID() === variationID);
    }

    private getProps(variationID?: string, styleID?: string) {
        const isVariationToken = variationID && styleID;

        return isVariationToken ? this.getStyleByVariation(variationID, styleID)?.getProps() : this.invariants;
    }

    private getVariationName(variations: ComponentVariation[], id: string) {
        return variations.find((variation) => variation.id === id)?.name || '';
    }

    private getStyleName(variationID: string, styleID: string) {
        return this.getStyleByVariation(variationID, styleID)?.getName() || '';
    }

    public getStyleByVariation(variationID: string, styleID?: string) {
        const styles = this.variations.find((item) => item.getID() === variationID);

        return styles?.getStyle(styleID);
    }

    public updateDefaults(variationID: string, newStyledID: string) {
        const defaultItem = this.defaults.find((item) => item.getVariationID() === variationID);
        const style = this.getStyleName(variationID, newStyledID);

        defaultItem?.setStyle(style, newStyledID);
    }

    public updateToken(tokenID: string, value: string | number, variationID?: string, styleID?: string) {
        const props = this.getProps(variationID, styleID);
        const prop = props?.getProp(tokenID);

        prop?.setValue(value);
    }

    public addToken(
        tokenID: string,
        value: string | number,
        api: ComponentAPI[],
        variationID?: string,
        styleID?: string,
    ) {
        const props = this.getProps(variationID, styleID);

        props?.addProp(tokenID, value, api);
    }

    public removeToken(id: string, variationID?: string, styleID?: string) {
        if (!variationID || !styleID) {
            this.invariants?.removeProp(id);
            return;
        }

        const item = this.getStyleByVariation(variationID, styleID);
        item?.getProps().removeProp(id);
    }

    public addVariationStyle(api: ComponentAPI[], variationID: string, styleID: string) {
        const item = this.variations.find((item) => item.getID() === variationID);

        item?.addStyle(styleID, api);
    }

    public removeVariationStyle(variationID?: string, styleID?: string) {
        if (!variationID || !styleID) {
            return;
        }

        const item = this.variations.find((item) => item.getID() === variationID);

        item?.removeStyle(styleID);
    }

    public addTokenState(tokenID: string, value: State, variationID?: string, styleID?: string) {
        const props = this.getProps(variationID, styleID);
        const prop = props?.getProp(tokenID);

        prop?.addState(value);
    }

    public updateTokenState(tokenID: string, name: string, value: State, variationID?: string, styleID?: string) {
        const props = this.getProps(variationID, styleID);
        const prop = props?.getProp(tokenID);

        prop?.setState(name, value);
    }

    public removeTokenState(tokenID: string, name: string, variationID?: string, styleID?: string) {
        const props = this.getProps(variationID, styleID);
        const prop = props?.getProp(tokenID);

        prop?.removeState(name);
    }

    public updateTokenAdjustment(
        tokenID: string,
        value: string | number | undefined,
        variationID?: string,
        styleID?: string,
    ) {
        const props = this.getProps(variationID, styleID);
        const prop = props?.getProp(tokenID);

        prop?.setAdjustment(value);
    }

    public getMeta() {
        const newDefaultVariations = this.defaults.map((item) => ({
            variationID: item.getVariationID(),
            styleID: item.getStyleID(),
        }));

        const newInvariantProps = this.invariants.getList().map((item) => ({
            id: item.getID(),
            value: item.getValue(),
            states: item.getStates(),
            adjustment: item.getAdjustment(),
        }));

        const newVariations = this.variations.map((item) => ({
            id: item.getID(),
            styles: item.getStyles()?.map((style) => ({
                name: style.getName(),
                id: style.getID(),
                intersections: style.getIntersections(),
                props: style
                    .getProps()
                    ?.getList()
                    .map((prop) => ({
                        id: prop.getID(),
                        value: prop.getValue(),
                        states: prop.getStates(),
                        adjustment: prop.getAdjustment(),
                    })),
            })),
        }));

        return {
            defaultVariations: newDefaultVariations,
            variations: newVariations,
            invariantProps: newInvariantProps,
        };
    }
}
