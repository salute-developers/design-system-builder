import type { ComponentAPI, VariationConfig } from './type';
import { Style } from './style';

export class Variation {
    private name: string;

    private id: string;

    private styles?: Style[] = [];

    constructor(name: string, data: VariationConfig, api: ComponentAPI[]) {
        const { id, styles } = data;

        this.name = name;
        this.id = id;

        if (!styles?.length) {
            return;
        }

        styles.forEach((item) => {
            const style = new Style(item, api);

            this.styles?.push(style);
        });
    }

    public getStyle(styleID?: string) {
        if (!styleID) {
            return this.styles?.[0];
        }

        return this.styles?.find((item) => item.getID() === styleID);
    }

    public addStyle(name: string, api: ComponentAPI[]) {
        const styleValues = {
            name,
            id: window.crypto.randomUUID(),
            intersections: null,
            props: null,
        };

        const style = new Style(styleValues, api);

        const props = style.getProps();
        api.filter((item) => item.variations?.includes(this.id)).forEach((item) => {
            props.addProp(item.id, undefined as never, api);
        });

        this.styles?.push(style);

        return style;
    }

    public removeStyle(id: string) {
        this.styles = this.styles?.filter((item) => item.getID() !== id);
    }

    public getName() {
        return this.name;
    }

    public getID() {
        return this.id;
    }

    public getStyles() {
        return this.styles;
    }
}
