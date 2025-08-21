// Sample test data based on the actual design system structure

import { DesignSystemData } from '../src/validation';

export const sampleDesignSystem: DesignSystemData = {
    name: "test-design-system",
    version: "1.0.0",
    themeData: {
        meta: {
            name: "test-design-system",
            version: "1.0.0",
            tokens: [
                {
                    type: "color",
                    name: "dark.text.default.primary",
                    tags: ["dark", "text", "default", "primary"],
                    displayName: "textPrimary",
                    description: "Основной цвет текста",
                    enabled: true
                },
                {
                    type: "color",
                    name: "dark.text.default.secondary",
                    tags: ["dark", "text", "default", "secondary"],
                    displayName: "textSecondary",
                    description: "Вторичный цвет текста",
                    enabled: true
                },
                {
                    type: "spacing",
                    name: "spacing.xs",
                    tags: ["spacing", "xs"],
                    displayName: "spacingXs",
                    description: "Очень маленький отступ",
                    enabled: true
                }
            ],
            color: {
                mode: ["dark", "light"],
                category: ["text", "background", "surface"],
                subcategory: ["default", "primary", "secondary"]
            },
            gradient: {
                mode: ["dark", "light"],
                category: ["primary", "secondary"],
                subcategory: ["default"]
            },
            shadow: {
                direction: ["up", "down"],
                kind: ["soft", "hard"],
                size: ["s", "m", "l"]
            },
            shape: {
                kind: ["round", "square"],
                size: ["s", "m", "l"]
            },
            spacing: {
                kind: ["spacing"],
                size: ["xs", "s", "m", "l", "xl"]
            },
            typography: {
                screen: ["screen-s", "screen-m", "screen-l"],
                kind: ["body", "heading"],
                size: ["s", "m", "l"],
                weight: ["normal", "bold"]
            },
            fontFamily: {
                kind: ["display", "body"]
            }
        },
        variations: {
            color: {
                web: {
                    "dark.text.default.primary": "#FFFFFF",
                    "dark.text.default.secondary": "#CCCCCC"
                },
                ios: {
                    "dark.text.default.primary": "#FFFFFF", 
                    "dark.text.default.secondary": "#CCCCCC"
                },
                android: {
                    "dark.text.default.primary": "#FFFFFF",
                    "dark.text.default.secondary": "#CCCCCC"
                }
            },
            gradient: {
                web: {},
                ios: {},
                android: {}
            },
            shadow: {
                web: {},
                ios: {},
                android: {}
            },
            shape: {
                web: {},
                ios: {},
                android: {}
            },
            spacing: {
                web: {
                    "spacing.xs": "4px"
                },
                ios: {
                    "spacing.xs": "4pt"
                },
                android: {
                    "spacing.xs": "4px"
                }
            },
            typography: {
                web: {},
                ios: {},
                android: {}
            },
            fontFamily: {
                web: {},
                ios: {},
                android: {}
            }
        }
    },
    componentsData: [
        {
            name: "Button",
            description: "Primary button component",
            sources: {
                api: [
                    {
                        id: "button-size-api",
                        name: "size",
                        type: "dimension",
                        description: "Button size",
                        variations: ["size-var-s", "size-var-m", "size-var-l"], // IDs, not names
                        platformMappings: {
                            xml: null,
                            compose: null,
                            ios: null,
                            web: [
                                { name: "padding", adjustment: null },
                                { name: "fontSize", adjustment: null }
                            ]
                        }
                    },
                    {
                        id: "button-view-api",
                        name: "view",
                        type: "color",
                        description: "Button appearance",
                        variations: ["view-var-primary", "view-var-secondary"], // IDs, not names
                        platformMappings: {
                            xml: null,
                            compose: null,
                            ios: null,
                            web: [
                                { name: "backgroundColor", adjustment: null },
                                { name: "color", adjustment: null }
                            ]
                        }
                    }
                ],
                variations: [
                    {
                        id: "size-variation-id",
                        name: "size"
                    },
                    {
                        id: "view-variation-id", 
                        name: "view"
                    }
                ],
                configs: [
                    {
                        name: "Button",
                        id: "button-config-id",
                        config: {
                            defaultVariations: [
                                {
                                    variationID: "size-variation-id",
                                    styleID: "m"
                                },
                                {
                                    variationID: "view-variation-id",
                                    styleID: "primary"
                                }
                            ],
                            invariantProps: [],
                            variations: [
                                {
                                    id: "size-variation-id",
                                    styles: [
                                        {
                                            name: "Small",
                                            id: "s",
                                            intersections: null,
                                            props: [
                                                {
                                                    id: "padding",
                                                    value: 8
                                                }
                                            ]
                                        },
                                        {
                                            name: "Medium",
                                            id: "m",
                                            intersections: null,
                                            props: [
                                                {
                                                    id: "padding",
                                                    value: 12
                                                }
                                            ]
                                        }
                                    ]
                                }
                            ]
                        }
                    }
                ]
            }
        }
    ]
};

export const sampleDesignSystem2: DesignSystemData = {
    name: "another-design-system",
    version: "2.0.0",
    themeData: {
        meta: {
            name: "another-design-system",
            version: "2.0.0",
            tokens: [
                {
                    type: "color",
                    name: "primary.background",
                    tags: ["primary", "background"],
                    displayName: "primaryBackground",
                    description: "Primary background color",
                    enabled: true
                }
            ],
            color: {
                mode: ["default"],
                category: ["background"],
                subcategory: ["primary"]
            },
            gradient: {
                mode: [],
                category: [],
                subcategory: []
            },
            shadow: {
                direction: [],
                kind: [],
                size: []
            },
            shape: {
                kind: [],
                size: []
            },
            spacing: {
                kind: [],
                size: []
            },
            typography: {
                screen: [],
                kind: [],
                size: [],
                weight: []
            },
            fontFamily: {
                kind: []
            }
        },
        variations: {
            color: {
                web: {
                    "primary.background": "#F5F5F5"
                },
                ios: {
                    "primary.background": "#F5F5F5"
                },
                android: {
                    "primary.background": "#F5F5F5"
                }
            },
            gradient: {
                web: {},
                ios: {},
                android: {}
            },
            shadow: {
                web: {},
                ios: {},
                android: {}
            },
            shape: {
                web: {},
                ios: {},
                android: {}
            },
            spacing: {
                web: {},
                ios: {},
                android: {}
            },
            typography: {
                web: {},
                ios: {},
                android: {}
            },
            fontFamily: {
                web: {},
                ios: {},
                android: {}
            }
        }
    },
    componentsData: [
        {
            name: "Input",
            description: "Text input component",
            sources: {
                api: [
                    {
                        id: "input-size-api",
                        name: "size",
                        type: "dimension",
                        description: "Input size",
                        variations: ["input-size-s", "input-size-m"], // IDs, not names
                        platformMappings: {
                            xml: null,
                            compose: null,
                            ios: null,
                            web: [
                                { name: "height", adjustment: null },
                                { name: "padding", adjustment: null }
                            ]
                        }
                    }
                ],
                variations: [
                    {
                        id: "input-size-variation-id",
                        name: "size"
                    }
                ],
                configs: [
                    {
                        name: "Input",
                        id: "input-config-id",
                        config: {
                            defaultVariations: [
                                {
                                    variationID: "input-size-variation-id",
                                    styleID: "m"
                                }
                            ],
                            invariantProps: [],
                            variations: []
                        }
                    }
                ]
            }
        }
    ]
};
