export class Default {
    private variation: string;

    private variationID: string;

    private styleID: string;

    private style: string;

    constructor(variation: string, variationID: string, style: string, styleID: string) {
        this.variation = variation;
        this.variationID = variationID;
        this.style = style;
        this.styleID = styleID;
    }

    getVariation() {
        return this.variation;
    }

    getVariationID() {
        return this.variationID;
    }

    getStyle() {
        return this.style;
    }

    setStyle(style: string, styleID: string) {
        this.style = style;
        this.styleID = styleID;
    }

    getStyleID() {
        return this.styleID;
    }
}
