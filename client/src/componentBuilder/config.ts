import type { ComponentAPI, ComponentConfig, ComponentVariation, Meta, StaticAPI } from './type';
import { Props } from './props';
import { Variation } from './variation';
import { Default } from './default';

export class Config {
    private name: string;

    private description: string;

    private defaults: Default[];

    private variations: Variation[] = [];

    private invariants: Props;

    private source: {
        api: ComponentAPI[];
        variations: ComponentVariation[];
        staticAPI?: StaticAPI[];
        config: ComponentConfig;
    };

    constructor(meta: Meta) {
        const { name, description, sources } = meta;

        this.name = name;
        this.description = description;

        const { api, config, staticAPI, variations } = sources;

        this.source = {
            api,
            config,
            staticAPI,
            variations,
        };

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

    public getVariationName(variations: ComponentVariation[], id: string) {
        return variations.find((variation) => variation.id === id)?.name || '';
    }

    public getStyleName(variationID: string, styleID: string) {
        return this.getStyle(variationID, styleID)?.getName() || '';
    }

    public getVariations() {
        return this.variations;
    }

    public getInvariants() {
        return this.invariants;
    }

    public getStaticAPI() {
        return this.source.staticAPI;
    }

    public getVariation(variationID?: string) {
        if (!variationID) {
            return;
        }

        return this.variations.find((item) => item.getID() === variationID);
    }

    public getStyle(variationID: string, styleID?: string) {
        const styles = this.variations.find((item) => item.getID() === variationID)?.getStyles();

        if (!styleID) {
            return styles?.[0];
        }

        return styles?.find((item) => item.getID() === styleID);
    }

    public getProp(id: string, props?: Props) {
        return props?.getList().find((item) => item.getID() === id);
    }

    // TODO: нужно ли это убрать в утилиты
    public getTokensByVariation(variationID?: string) {
        const { api, variations } = this.source;

        if (!variationID) {
            return api.filter((item) => !item.variations);
        }

        const id = variations.find((variation) => variation.id === variationID)?.id || '';

        return api.filter((item) => item.variations?.find((item) => item === id));
    }

    // TODO: нужно ли убрать отдельные методы
    private updateVariationToken(variation: string, style: string, tokenName: string, value: string | number) {
        const item = this.getStyle(variation, style);
        const prop = this.getProp(tokenName, item?.getProps());

        prop?.setValue(value);
    }

    private addVariationToken(variation: string, style: string, tokenID: string, value: string | number) {
        const item = this.getStyle(variation, style);
        const { api } = this.source;

        item?.getProps().addProp(tokenID, value, api);
    }

    private removeVariationToken(variation: string, style: string, id: string) {
        const item = this.getStyle(variation, style);

        item?.getProps().removeProp(id);
    }

    private updateInvariantToken(tokenName: string, value: string | number) {
        const prop = this.getProp(tokenName, this.invariants);

        prop?.setValue(value);
    }

    private addInvariantToken(tokenID: string, value: string | number) {
        const { api } = this.source;

        this.invariants?.addProp(tokenID, value, api);
    }

    private removeInvariantToken(id: string) {
        this.invariants?.removeProp(id);
    }

    public updateDefaults(variationID: string, newStyledID: string) {
        const defaultItem = this.defaults.find((item) => item.getVariationID() === variationID);
        const style = this.getStyleName(variationID, newStyledID);

        defaultItem?.setStyle(style, newStyledID);
    }

    public updateToken(tokenID: string, value: string | number, variationID?: string, styleID?: string) {
        if (!variationID || !styleID) {
            this.updateInvariantToken(tokenID, value);
            return;
        }

        this.updateVariationToken(variationID, styleID, tokenID, value);
    }

    public addToken(tokenID: string, value: string | number, variationID?: string, styleID?: string) {
        if (!variationID || !styleID) {
            this.addInvariantToken(tokenID, value);
            return;
        }

        this.addVariationToken(variationID, styleID, tokenID, value);
    }

    public removeToken(id: string, variationID?: string, styleID?: string) {
        if (!variationID || !styleID) {
            this.removeInvariantToken(id);
            return;
        }

        this.removeVariationToken(variationID, styleID, id);
    }

    public addVariationStyle(variationID: string, styleID: string) {
        const item = this.variations.find((item) => item.getID() === variationID);
        const { api } = this.source;

        item?.addStyle(styleID, api);
    }

    public removeVariationStyle(variationID?: string, styleID?: string) {
        if (!variationID || !styleID) {
            return;
        }

        const item = this.variations.find((item) => item.getID() === variationID);

        item?.removeStyle(styleID);
    }

    // TODO: Подумать, здесь ли должен находиться метод для записи данных в бд
    public createMeta(): Meta {
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

        const config = {
            defaultVariations: newDefaultVariations,
            invariantProps: newInvariantProps,
            variations: newVariations,
        };

        const { api, variations, staticAPI } = this.source;

        return {
            name: this.name,
            description: this.description,
            sources: {
                config,
                // TODO: подумать, надо ли будет потом это тащить в бд
                api,
                staticAPI,
                variations,
            },
        };
    }
}
