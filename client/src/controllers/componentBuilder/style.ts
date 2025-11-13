import { Props } from './props';
import type { ComponentAPI, Intersections, StyleConfig } from './type';

export class Style {
    private name: string;

    private id: string;

    private intersections: Intersections | null;

    private props: Props;

    constructor(data: StyleConfig, api: ComponentAPI[]) {
        const { name, id, intersections, props } = data;

        this.name = name;
        this.id = id;
        this.intersections = intersections;
        this.props = new Props(props, api);
    }

    public getName() {
        return this.name;
    }

    public getID() {
        return this.id;
    }

    public getIntersections() {
        return this.intersections;
    }

    public getProps() {
        return this.props;
    }
}
