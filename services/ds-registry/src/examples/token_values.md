# Связи между дизайн дизайн системой, тентами и токенами

## Дизайн система SDDS 

### Тенант sdds_cs

{
    "dark.text.default.primary": {
        web: ["general.blue.500"],
        ios: ["general.blue.500"],
        android: ["general.blue.500"],
        enabled: true,
    },
    "dark.text.default.secondary": {
        web: ["#1a0f24"],
        ios: ["#1a0f24"],
        android: ["#1a0f24"],
        enabled: false,
    },
    "dark.text.default.accent": {
        web: ["#0095ff"],
        ios: ["#0095ff"],
        android: ["#0095ff"],
        enabled: true,
    },
    "dark.text.default.accent-minor-gradient": {
        web: ["linear-gradient(45.00deg, #1A9E32FF 0%, #04C6C9FF 99.688%)"],
        ios: [{
                "kind": "linear",
                "locations": [
                    0,
                    1
                ],
                "colors": [
                    "#FFFFFF",
                    "#000000"
                ],
                "angle": 90
            }
        ],
        android: [{
                "kind": "linear",
                "locations": [
                    0,
                    1
                ],
                "colors": [
                    "#FFFFFF",
                    "#000000"
                ],
                "angle": 90
            }
        ],
        enabled: true,
    },
     "dark.text.default.primary-gradient": {
        web: ["linear-gradient(45.00deg, rgb(185, 9, 185) 0%, rgb(138, 218, 0) 99.688%)"],
        ios: [{
                "kind": "linear",
                "locations": [
                    0,
                    1
                ],
                "colors": [
                    "#c32525",
                    "#000000"
                ],
                "angle": 90
            }
        ],
        android: [{
                "kind": "linear",
                "locations": [
                    0,
                    1
                ],
                "colors": [
                    "#27d7e1",
                    "#000000"
                ],
                "angle": 90
            }
        ],
        enabled: false,
    },
    "round.xxs": {
        web: ["4"],
        ios: [{
            "kind": "round",
            "cornerRadius": 4
        }],
        android: [{
            "kind": "round",
            "cornerRadius": 4
        }],
        enabled: true,
    },
    "round.xs": {
        web: ["6"],
        ios: [{
            "kind": "round",
            "cornerRadius": 6
        }],
        android: [{
            "kind": "round",
            "cornerRadius": 6
        }],
        enabled: true,
    },
    "round.circle": {
        web: ["999"],
        ios: [{
            "kind": "round",
            "cornerRadius": 999
        }],
        android: [{
            "kind": "round",
            "cornerRadius": 999
        }],
        enabled: true,
    },
    "spacing.1x": {
        web: ["2"],
        ios: [{
            "value": 2,
        }],
        android: [{
            "value": 2,
        }],
        enabled: true,
    },
    "spacing.2x": {
        web: ["4"],
        ios: [{
            "value": 4,
        }],
        android: [{
            "value": 4,
        }],
        enabled: true,
    },
    "spacing.3x": {
        web: ["6"],
        ios: [{
            "value": 6,
        }],
        android: [{
            "value": 6,
        }],
        enabled: true,
    },
    "up.hard.s": {
        web: ["0rem 1.5rem 3rem -0.5rem #00000014"],
        ios: [{
            "color": "#00000014",
            "offsetX": 0,
            "offsetY": 24,
            "spreadRadius": -8,
            "blurRadius": 48
        }],
        android: [{
            "color": "#00000014",
            "offsetX": 0,
            "offsetY": 24,
            "spreadRadius": -8,
            "blurRadius": 48,
            "fallbackElevation": 4
        }],
        enabled: true,
    },
    "up.hard.m": {
        web: ["1rem 1.5rem 3rem -0.5rem #e21111b9"],
        ios: [{
            "color": "#bb202086",
            "offsetX": 0,
            "offsetY": 32,
            "spreadRadius": -8,
            "blurRadius": 48
        }],
        android: [{
            "color": "#046f43dd",
            "offsetX": 0,
            "offsetY": 32,
            "spreadRadius": -8,
            "blurRadius": 48,
            "fallbackElevation": 4
        }],
        enabled: true,
    },
    "screen-s.display.l.normal": {
        web: [{
            "fontFamilyRef": "fontFamily.display",
            "fontWeight": 600,
            "fontStyle": "normal",
            "textSize": 88,
            "lineHeight": 92,
            "letterSpacing": 0
        }],
        ios: [{
            "fontFamilyRef": "fontFamily.display",
            "weight": "light",
            "style": "normal",
            "size": 56,
            "lineHeight": 62,
            "kerning": 0
        }],
        android: [{
            "fontFamilyRef": "fontFamily.display",
            "fontWeight": "300",
            "fontStyle": "normal",
            "fontSize": "3.5rem",
            "lineHeight": "3.875rem",
            "letterSpacing": "normal"
        }],
        enabled: true,
    },
    "screen-s.display.h2.normal": {
        web: [{
            "fontFamilyRef": "fontFamily.display",
            "fontWeight": 600,
            "fontStyle": "normal",
            "textSize": 32,
            "lineHeight": 40,
            "letterSpacing": 0
        }],
        ios: [{
            "fontFamilyRef": "fontFamily.display",
            "weight": "light",
            "style": "normal",
            "size": 32,
            "lineHeight": 40,
            "kerning": 0
        }],
        android: [{
            "fontFamilyRef": "fontFamily.display",
            "fontWeight": "300",
            "fontStyle": "normal",
            "fontSize": "32",
            "lineHeight": "40",
            "letterSpacing": "normal"
        }],
        enabled: true,
    },
    display": {
        web: [{
            "name": "SB Sans Display",
            "fonts": [
                {
                    "src": [
                        "url('https://cdn-app.sberdevices.ru/shared-static/0.0.0/fonts/SBSansDisplay.0.2.0/SBSansDisplay-Light.woff2') format('woff2')",
                        "url('https://cdn-app.sberdevices.ru/shared-static/0.0.0/fonts/SBSansDisplay.0.2.0/SBSansDisplay-Light.woff') format('woff')"
                    ],
                    "fontWeight": "300",
                    "fontStyle": "normal"
                },
                {
                    "src": [
                        "url('https://cdn-app.sberdevices.ru/shared-static/0.0.0/fonts/SBSansDisplay.0.2.0/SBSansDisplay-Thin.woff2') format('woff2')",
                        "url('https://cdn-app.sberdevices.ru/shared-static/0.0.0/fonts/SBSansDisplay.0.2.0/SBSansDisplay-Thin.woff') format('woff')"
                    ],
                    "fontWeight": "100",
                    "fontStyle": "normal"
                },
                {
                    "src": [
                        "url('https://cdn-app.sberdevices.ru/shared-static/0.0.0/fonts/SBSansDisplay.0.2.0/SBSansDisplay-Bold.woff2') format('woff2')",
                        "url('https://cdn-app.sberdevices.ru/shared-static/0.0.0/fonts/SBSansDisplay.0.2.0/SBSansDisplay-Bold.woff') format('woff')"
                    ],
                    "fontWeight": "bold",
                    "fontStyle": "normal"
                },
                {
                    "src": [
                        "url('https://cdn-app.sberdevices.ru/shared-static/0.0.0/fonts/SBSansDisplay.0.2.0/SBSansDisplay-Regular.woff2') format('woff2')",
                        "url('https://cdn-app.sberdevices.ru/shared-static/0.0.0/fonts/SBSansDisplay.0.2.0/SBSansDisplay-Regular.woff') format('woff')"
                    ],
                    "fontWeight": "normal",
                    "fontStyle": "normal"
                },
                {
                    "src": [
                        "url('https://cdn-app.sberdevices.ru/shared-static/0.0.0/fonts/SBSansDisplay.0.2.0/SBSansDisplay-Semibold.woff2') format('woff2')",
                        "url('https://cdn-app.sberdevices.ru/shared-static/0.0.0/fonts/SBSansDisplay.0.2.0/SBSansDisplay-Semibold.woff') format('woff')"
                    ],
                    "fontWeight": "600",
                    "fontStyle": "normal"
                },
                {
                    "src": [
                        "url('https://cdn-app.sberdevices.ru/shared-static/0.0.0/fonts/SBSansDisplay.0.2.0/SBSansDisplay-Medium.woff2') format('woff2')",
                        "url('https://cdn-app.sberdevices.ru/shared-static/0.0.0/fonts/SBSansDisplay.0.2.0/SBSansDisplay-Medium.woff') format('woff')"
                    ],
                    "fontWeight": "500",
                    "fontStyle": "normal"
                }
            ]
        }],
        ios: [{
            "name": "SB Sans Display",
            "fonts": [
                {
                    "link": "https://cdn-app.sberdevices.ru/shared-static/0.0.0/fonts/SBSansDisplay.0.2.0/SBSansDisplay-Light.otf",
                    "weight": "light",
                    "style": "normal"
                },
                {
                    "link": "https://cdn-app.sberdevices.ru/shared-static/0.0.0/fonts/SBSansDisplay.0.2.0/SBSansDisplay-Thin.otf",
                    "weight": "ultralight",
                    "style": "normal"
                },
                {
                    "link": "https://cdn-app.sberdevices.ru/shared-static/0.0.0/fonts/SBSansDisplay.0.2.0/SBSansDisplay-Bold.otf",
                    "weight": "bold",
                    "style": "normal"
                },
                {
                    "link": "https://cdn-app.sberdevices.ru/shared-static/0.0.0/fonts/SBSansDisplay.0.2.0/SBSansDisplay-Regular.otf",
                    "weight": "regular",
                    "style": "normal"
                },
                {
                    "link": "https://cdn-app.sberdevices.ru/shared-static/0.0.0/fonts/SBSansDisplay.0.2.0/SBSansDisplay-Semibold.otf",
                    "weight": "semibold",
                    "style": "normal"
                },
                {
                    "link": "https://cdn-app.sberdevices.ru/shared-static/0.0.0/fonts/SBSansDisplay.0.2.0/SBSansDisplay-Medium.otf",
                    "weight": "medium",
                    "style": "normal"
                }
            ]
        }],
        android: [{
            "name": "SB Sans Display",
            "fonts": [
                {
                    "link": "https://cdn-app.sberdevices.ru/shared-static/0.0.0/fonts/SBSansDisplay.0.2.0/SBSansDisplay-Light.otf",
                    "fontWeight": 300,
                    "fontStyle": "normal"
                },
                {
                    "link": "https://cdn-app.sberdevices.ru/shared-static/0.0.0/fonts/SBSansDisplay.0.2.0/SBSansDisplay-Thin.otf",
                    "fontWeight": 100,
                    "fontStyle": "normal"
                },
                {
                    "link": "https://cdn-app.sberdevices.ru/shared-static/0.0.0/fonts/SBSansDisplay.0.2.0/SBSansDisplay-Bold.otf",
                    "fontWeight": 700,
                    "fontStyle": "normal"
                },
                {
                    "link": "https://cdn-app.sberdevices.ru/shared-static/0.0.0/fonts/SBSansDisplay.0.2.0/SBSansDisplay-Regular.otf",
                    "fontWeight": 400,
                    "fontStyle": "normal"
                },
                {
                    "link": "https://cdn-app.sberdevices.ru/shared-static/0.0.0/fonts/SBSansDisplay.0.2.0/SBSansDisplay-Semibold.otf",
                    "fontWeight": 600,
                    "fontStyle": "normal"
                },
                {
                    "link": "https://cdn-app.sberdevices.ru/shared-static/0.0.0/fonts/SBSansDisplay.0.2.0/SBSansDisplay-Medium.otf",
                    "fontWeight": 500,
                    "fontStyle": "normal"
                }
            ]
        }],
    }
}

### Тенант sdds_serv

{
    "dark.text.default.primary": {
        web: ["general.green.500"],
        ios: ["general.green.500"],
        android: ["general.green.500"],
        enabled: true,
    },
    "dark.text.default.secondary": {
        web: ["#a0a8b4"],
        ios: ["#a0a8b4"],
        android: ["#a0a8b4"],
        enabled: false,
    },
    "dark.text.default.accent": {
        web: ["#21a038"],
        ios: ["#21a038"],
        android: ["#21a038"],
        enabled: true,
    },
    "dark.text.default.accent-minor-gradient": {
        web: ["linear-gradient(135.00deg, #21A038FF 0%, #00B2FFFF 100%)"],
        ios: [{
                "kind": "linear",
                "locations": [
                    0,
                    1
                ],
                "colors": [
                    "#21A038",
                    "#00B2FF"
                ],
                "angle": 135
            }
        ],
        android: [{
                "kind": "linear",
                "locations": [
                    0,
                    1
                ],
                "colors": [
                    "#21A038",
                    "#00B2FF"
                ],
                "angle": 135
            }
        ],
        enabled: true,
    },
    "dark.text.default.primary-gradient": {
        web: ["linear-gradient(90.00deg, rgb(33, 160, 56) 0%, rgb(0, 178, 255) 100%)"],
        ios: [{
                "kind": "linear",
                "locations": [
                    0,
                    1
                ],
                "colors": [
                    "#21a038",
                    "#00b2ff"
                ],
                "angle": 90
            }
        ],
        android: [{
                "kind": "linear",
                "locations": [
                    0,
                    1
                ],
                "colors": [
                    "#21a038",
                    "#00b2ff"
                ],
                "angle": 90
            }
        ],
        enabled: false,
    },
    "round.xxs": {
        web: ["2"],
        ios: [{
            "kind": "round",
            "cornerRadius": 2
        }],
        android: [{
            "kind": "round",
            "cornerRadius": 2
        }],
        enabled: true,
    },
    "round.xs": {
        web: ["4"],
        ios: [{
            "kind": "round",
            "cornerRadius": 4
        }],
        android: [{
            "kind": "round",
            "cornerRadius": 4
        }],
        enabled: true,
    },
    "round.circle": {
        web: ["999"],
        ios: [{
            "kind": "round",
            "cornerRadius": 999
        }],
        android: [{
            "kind": "round",
            "cornerRadius": 999
        }],
        enabled: true,
    },
    "spacing.1x": {
        web: ["4"],
        ios: [{
            "value": 4,
        }],
        android: [{
            "value": 4,
        }],
        enabled: true,
    },
    "spacing.2x": {
        web: ["8"],
        ios: [{
            "value": 8,
        }],
        android: [{
            "value": 8,
        }],
        enabled: true,
    },
    "spacing.3x": {
        web: ["12"],
        ios: [{
            "value": 12,
        }],
        android: [{
            "value": 12,
        }],
        enabled: true,
    },
    "up.hard.s": {
        web: ["0rem 0.5rem 1rem 0rem #0000001f"],
        ios: [{
            "color": "#0000001f",
            "offsetX": 0,
            "offsetY": 8,
            "spreadRadius": 0,
            "blurRadius": 16
        }],
        android: [{
            "color": "#0000001f",
            "offsetX": 0,
            "offsetY": 8,
            "spreadRadius": 0,
            "blurRadius": 16,
            "fallbackElevation": 2
        }],
        enabled: true,
    },
    "up.hard.m": {
        web: ["0rem 1rem 2rem 0rem #21a03833"],
        ios: [{
            "color": "#21a03833",
            "offsetX": 0,
            "offsetY": 16,
            "spreadRadius": 0,
            "blurRadius": 32
        }],
        android: [{
            "color": "#21a03833",
            "offsetX": 0,
            "offsetY": 16,
            "spreadRadius": 0,
            "blurRadius": 32,
            "fallbackElevation": 6
        }],
        enabled: true,
    },
    "screen-s.display.l.normal": {
        web: [{
            "fontFamilyRef": "fontFamily.display",
            "fontWeight": 400,
            "fontStyle": "normal",
            "textSize": 72,
            "lineHeight": 80,
            "letterSpacing": -1
        }],
        ios: [{
            "fontFamilyRef": "fontFamily.display",
            "weight": "regular",
            "style": "normal",
            "size": 48,
            "lineHeight": 56,
            "kerning": -0.5
        }],
        android: [{
            "fontFamilyRef": "fontFamily.display",
            "fontWeight": "400",
            "fontStyle": "normal",
            "fontSize": "4.5rem",
            "lineHeight": "5rem",
            "letterSpacing": "-0.0625rem"
        }],
        enabled: true,
    },
    "screen-s.display.h2.normal": {
        web: [{
            "fontFamilyRef": "fontFamily.display",
            "fontWeight": 400,
            "fontStyle": "normal",
            "textSize": 28,
            "lineHeight": 36,
            "letterSpacing": 0
        }],
        ios: [{
            "fontFamilyRef": "fontFamily.display",
            "weight": "regular",
            "style": "normal",
            "size": 28,
            "lineHeight": 36,
            "kerning": 0
        }],
        android: [{
            "fontFamilyRef": "fontFamily.display",
            "fontWeight": "400",
            "fontStyle": "normal",
            "fontSize": "28",
            "lineHeight": "36",
            "letterSpacing": "normal"
        }],
        enabled: true,
    },
    "display": {
        web: [{
            "name": "SB Sans Text",
            "fonts": [
                {
                    "src": [
                        "url('https://cdn-app.sberdevices.ru/shared-static/0.0.0/fonts/SBSansText.0.1.0/SBSansText-Light.woff2') format('woff2')",
                        "url('https://cdn-app.sberdevices.ru/shared-static/0.0.0/fonts/SBSansText.0.1.0/SBSansText-Light.woff') format('woff')"
                    ],
                    "fontWeight": "300",
                    "fontStyle": "normal"
                },
                {
                    "src": [
                        "url('https://cdn-app.sberdevices.ru/shared-static/0.0.0/fonts/SBSansText.0.1.0/SBSansText-Regular.woff2') format('woff2')",
                        "url('https://cdn-app.sberdevices.ru/shared-static/0.0.0/fonts/SBSansText.0.1.0/SBSansText-Regular.woff') format('woff')"
                    ],
                    "fontWeight": "normal",
                    "fontStyle": "normal"
                },
                {
                    "src": [
                        "url('https://cdn-app.sberdevices.ru/shared-static/0.0.0/fonts/SBSansText.0.1.0/SBSansText-Semibold.woff2') format('woff2')",
                        "url('https://cdn-app.sberdevices.ru/shared-static/0.0.0/fonts/SBSansText.0.1.0/SBSansText-Semibold.woff') format('woff')"
                    ],
                    "fontWeight": "600",
                    "fontStyle": "normal"
                },
                {
                    "src": [
                        "url('https://cdn-app.sberdevices.ru/shared-static/0.0.0/fonts/SBSansText.0.1.0/SBSansText-Bold.woff2') format('woff2')",
                        "url('https://cdn-app.sberdevices.ru/shared-static/0.0.0/fonts/SBSansText.0.1.0/SBSansText-Bold.woff') format('woff')"
                    ],
                    "fontWeight": "bold",
                    "fontStyle": "normal"
                }
            ]
        }],
        ios: [{
            "name": "SB Sans Text",
            "fonts": [
                {
                    "link": "https://cdn-app.sberdevices.ru/shared-static/0.0.0/fonts/SBSansText.0.1.0/SBSansText-Light.otf",
                    "weight": "light",
                    "style": "normal"
                },
                {
                    "link": "https://cdn-app.sberdevices.ru/shared-static/0.0.0/fonts/SBSansText.0.1.0/SBSansText-Regular.otf",
                    "weight": "regular",
                    "style": "normal"
                },
                {
                    "link": "https://cdn-app.sberdevices.ru/shared-static/0.0.0/fonts/SBSansText.0.1.0/SBSansText-Semibold.otf",
                    "weight": "semibold",
                    "style": "normal"
                },
                {
                    "link": "https://cdn-app.sberdevices.ru/shared-static/0.0.0/fonts/SBSansText.0.1.0/SBSansText-Bold.otf",
                    "weight": "bold",
                    "style": "normal"
                }
            ]
        }],
        android: [{
            "name": "SB Sans Text",
            "fonts": [
                {
                    "link": "https://cdn-app.sberdevices.ru/shared-static/0.0.0/fonts/SBSansText.0.1.0/SBSansText-Light.otf",
                    "fontWeight": 300,
                    "fontStyle": "normal"
                },
                {
                    "link": "https://cdn-app.sberdevices.ru/shared-static/0.0.0/fonts/SBSansText.0.1.0/SBSansText-Regular.otf",
                    "fontWeight": 400,
                    "fontStyle": "normal"
                },
                {
                    "link": "https://cdn-app.sberdevices.ru/shared-static/0.0.0/fonts/SBSansText.0.1.0/SBSansText-Semibold.otf",
                    "fontWeight": 600,
                    "fontStyle": "normal"
                },
                {
                    "link": "https://cdn-app.sberdevices.ru/shared-static/0.0.0/fonts/SBSansText.0.1.0/SBSansText-Bold.otf",
                    "fontWeight": 700,
                    "fontStyle": "normal"
                }
            ]
        }],
    }
}

## Дизайн система PLASMA

### Тенант plasma_web

{
    "dark.text.default.primary": {
        web: ["general.red.500"],
        ios: ["general.red.500"],
        android: ["general.red.500"],
        enabled: true,
    },
    "dark.text.default.secondary": {
        web: ["#ffffff66"],
        ios: ["#ffffff66"],
        android: ["#ffffff66"],
        enabled: true,
    },
    "dark.text.default.accent": {
        web: ["#24b23e"],
        ios: ["#24b23e"],
        android: ["#24b23e"],
        enabled: true,
    },
    "dark.text.default.accent-minor-gradient": {
        web: ["linear-gradient(270.00deg, #24B23EFF 0%, #7CFC90FF 100%)"],
        ios: [{
                "kind": "linear",
                "locations": [
                    0,
                    1
                ],
                "colors": [
                    "#24B23E",
                    "#7CFC90"
                ],
                "angle": 270
            }
        ],
        android: [{
                "kind": "linear",
                "locations": [
                    0,
                    1
                ],
                "colors": [
                    "#24B23E",
                    "#7CFC90"
                ],
                "angle": 270
            }
        ],
        enabled: true,
    },
    "dark.text.default.primary-gradient": {
        web: ["linear-gradient(180.00deg, rgb(36, 178, 62) 0%, rgb(124, 252, 144) 100%)"],
        ios: [{
                "kind": "linear",
                "locations": [
                    0,
                    1
                ],
                "colors": [
                    "#24b23e",
                    "#7cfc90"
                ],
                "angle": 180
            }
        ],
        android: [{
                "kind": "linear",
                "locations": [
                    0,
                    1
                ],
                "colors": [
                    "#24b23e",
                    "#7cfc90"
                ],
                "angle": 180
            }
        ],
        enabled: false,
    },
    "round.xxs": {
        web: ["8"],
        ios: [{
            "kind": "round",
            "cornerRadius": 8
        }],
        android: [{
            "kind": "round",
            "cornerRadius": 8
        }],
        enabled: true,
    },
    "round.xs": {
        web: ["12"],
        ios: [{
            "kind": "round",
            "cornerRadius": 12
        }],
        android: [{
            "kind": "round",
            "cornerRadius": 12
        }],
        enabled: true,
    },
    "round.circle": {
        web: ["999"],
        ios: [{
            "kind": "round",
            "cornerRadius": 999
        }],
        android: [{
            "kind": "round",
            "cornerRadius": 999
        }],
        enabled: true,
    },
    "spacing.1x": {
        web: ["4"],
        ios: [{
            "value": 4,
        }],
        android: [{
            "value": 4,
        }],
        enabled: true,
    },
    "spacing.2x": {
        web: ["8"],
        ios: [{
            "value": 8,
        }],
        android: [{
            "value": 8,
        }],
        enabled: true,
    },
    "spacing.3x": {
        web: ["12"],
        ios: [{
            "value": 12,
        }],
        android: [{
            "value": 12,
        }],
        enabled: true,
    },
    "up.hard.s": {
        web: ["0rem 0.25rem 0.75rem 0rem #00000029"],
        ios: [{
            "color": "#00000029",
            "offsetX": 0,
            "offsetY": 4,
            "spreadRadius": 0,
            "blurRadius": 12
        }],
        android: [{
            "color": "#00000029",
            "offsetX": 0,
            "offsetY": 4,
            "spreadRadius": 0,
            "blurRadius": 12,
            "fallbackElevation": 3
        }],
        enabled: true,
    },
    "up.hard.m": {
        web: ["0rem 0.5rem 1.5rem 0rem #24b23e29"],
        ios: [{
            "color": "#24b23e29",
            "offsetX": 0,
            "offsetY": 8,
            "spreadRadius": 0,
            "blurRadius": 24
        }],
        android: [{
            "color": "#24b23e29",
            "offsetX": 0,
            "offsetY": 8,
            "spreadRadius": 0,
            "blurRadius": 24,
            "fallbackElevation": 8
        }],
        enabled: true,
    },
    "screen-s.display.l.normal": {
        web: [{
            "fontFamilyRef": "fontFamily.display",
            "fontWeight": 700,
            "fontStyle": "normal",
            "textSize": 96,
            "lineHeight": 104,
            "letterSpacing": -2
        }],
        ios: [{
            "fontFamilyRef": "fontFamily.display",
            "weight": "bold",
            "style": "normal",
            "size": 64,
            "lineHeight": 72,
            "kerning": -1
        }],
        android: [{
            "fontFamilyRef": "fontFamily.display",
            "fontWeight": "700",
            "fontStyle": "normal",
            "fontSize": "6rem",
            "lineHeight": "6.5rem",
            "letterSpacing": "-0.125rem"
        }],
        enabled: true,
    },
    "screen-s.display.h2.normal": {
        web: [{
            "fontFamilyRef": "fontFamily.display",
            "fontWeight": 700,
            "fontStyle": "normal",
            "textSize": 36,
            "lineHeight": 44,
            "letterSpacing": 0
        }],
        ios: [{
            "fontFamilyRef": "fontFamily.display",
            "weight": "bold",
            "style": "normal",
            "size": 36,
            "lineHeight": 44,
            "kerning": 0
        }],
        android: [{
            "fontFamilyRef": "fontFamily.display",
            "fontWeight": "700",
            "fontStyle": "normal",
            "fontSize": "36",
            "lineHeight": "44",
            "letterSpacing": "normal"
        }],
        enabled: true,
    },
    "display": {
        web: [{
            "name": "SB Sans Interface",
            "fonts": [
                {
                    "src": [
                        "url('https://cdn-app.sberdevices.ru/shared-static/0.0.0/fonts/SBSansInterface.0.1.0/SBSansInterface-Light.woff2') format('woff2')",
                        "url('https://cdn-app.sberdevices.ru/shared-static/0.0.0/fonts/SBSansInterface.0.1.0/SBSansInterface-Light.woff') format('woff')"
                    ],
                    "fontWeight": "300",
                    "fontStyle": "normal"
                },
                {
                    "src": [
                        "url('https://cdn-app.sberdevices.ru/shared-static/0.0.0/fonts/SBSansInterface.0.1.0/SBSansInterface-Regular.woff2') format('woff2')",
                        "url('https://cdn-app.sberdevices.ru/shared-static/0.0.0/fonts/SBSansInterface.0.1.0/SBSansInterface-Regular.woff') format('woff')"
                    ],
                    "fontWeight": "normal",
                    "fontStyle": "normal"
                },
                {
                    "src": [
                        "url('https://cdn-app.sberdevices.ru/shared-static/0.0.0/fonts/SBSansInterface.0.1.0/SBSansInterface-Medium.woff2') format('woff2')",
                        "url('https://cdn-app.sberdevices.ru/shared-static/0.0.0/fonts/SBSansInterface.0.1.0/SBSansInterface-Medium.woff') format('woff')"
                    ],
                    "fontWeight": "500",
                    "fontStyle": "normal"
                },
                {
                    "src": [
                        "url('https://cdn-app.sberdevices.ru/shared-static/0.0.0/fonts/SBSansInterface.0.1.0/SBSansInterface-Bold.woff2') format('woff2')",
                        "url('https://cdn-app.sberdevices.ru/shared-static/0.0.0/fonts/SBSansInterface.0.1.0/SBSansInterface-Bold.woff') format('woff')"
                    ],
                    "fontWeight": "bold",
                    "fontStyle": "normal"
                }
            ]
        }],
        ios: [{
            "name": "SB Sans Interface",
            "fonts": [
                {
                    "link": "https://cdn-app.sberdevices.ru/shared-static/0.0.0/fonts/SBSansInterface.0.1.0/SBSansInterface-Light.otf",
                    "weight": "light",
                    "style": "normal"
                },
                {
                    "link": "https://cdn-app.sberdevices.ru/shared-static/0.0.0/fonts/SBSansInterface.0.1.0/SBSansInterface-Regular.otf",
                    "weight": "regular",
                    "style": "normal"
                },
                {
                    "link": "https://cdn-app.sberdevices.ru/shared-static/0.0.0/fonts/SBSansInterface.0.1.0/SBSansInterface-Medium.otf",
                    "weight": "medium",
                    "style": "normal"
                },
                {
                    "link": "https://cdn-app.sberdevices.ru/shared-static/0.0.0/fonts/SBSansInterface.0.1.0/SBSansInterface-Bold.otf",
                    "weight": "bold",
                    "style": "normal"
                }
            ]
        }],
        android: [{
            "name": "SB Sans Interface",
            "fonts": [
                {
                    "link": "https://cdn-app.sberdevices.ru/shared-static/0.0.0/fonts/SBSansInterface.0.1.0/SBSansInterface-Light.otf",
                    "fontWeight": 300,
                    "fontStyle": "normal"
                },
                {
                    "link": "https://cdn-app.sberdevices.ru/shared-static/0.0.0/fonts/SBSansInterface.0.1.0/SBSansInterface-Regular.otf",
                    "fontWeight": 400,
                    "fontStyle": "normal"
                },
                {
                    "link": "https://cdn-app.sberdevices.ru/shared-static/0.0.0/fonts/SBSansInterface.0.1.0/SBSansInterface-Medium.otf",
                    "fontWeight": 500,
                    "fontStyle": "normal"
                },
                {
                    "link": "https://cdn-app.sberdevices.ru/shared-static/0.0.0/fonts/SBSansInterface.0.1.0/SBSansInterface-Bold.otf",
                    "fontWeight": 700,
                    "fontStyle": "normal"
                }
            ]
        }],
    }
}

### Тенант plasma_giga

{
    "dark.text.default.primary": {
        web: ["general.pink.500"],
        ios: ["general.pink.500"],
        android: ["general.pink.500"],
        enabled: true,
    },
    "dark.text.default.secondary": {
        web: ["#9e9e9eff"],
        ios: ["#9e9e9eff"],
        android: ["#9e9e9eff"],
        enabled: true,
    },
    "dark.text.default.accent": {
        web: ["#a855f7"],
        ios: ["#a855f7"],
        android: ["#a855f7"],
        enabled: true,
    },
    "dark.text.default.accent-minor-gradient": {
        web: ["linear-gradient(225.00deg, #A855F7FF 0%, #EC4899FF 100%)"],
        ios: [{
                "kind": "linear",
                "locations": [
                    0,
                    1
                ],
                "colors": [
                    "#A855F7",
                    "#EC4899"
                ],
                "angle": 225
            }
        ],
        android: [{
                "kind": "linear",
                "locations": [
                    0,
                    1
                ],
                "colors": [
                    "#A855F7",
                    "#EC4899"
                ],
                "angle": 225
            }
        ],
        enabled: true,
    },
    "dark.text.default.primary-gradient": {
        web: ["linear-gradient(315.00deg, rgb(168, 85, 247) 0%, rgb(236, 72, 153) 100%)"],
        ios: [{
                "kind": "linear",
                "locations": [
                    0,
                    1
                ],
                "colors": [
                    "#a855f7",
                    "#ec4899"
                ],
                "angle": 315
            }
        ],
        android: [{
                "kind": "linear",
                "locations": [
                    0,
                    1
                ],
                "colors": [
                    "#a855f7",
                    "#ec4899"
                ],
                "angle": 315
            }
        ],
        enabled: false,
    },
    "round.xxs": {
        web: ["6"],
        ios: [{
            "kind": "round",
            "cornerRadius": 6
        }],
        android: [{
            "kind": "round",
            "cornerRadius": 6
        }],
        enabled: true,
    },
    "round.xs": {
        web: ["10"],
        ios: [{
            "kind": "round",
            "cornerRadius": 10
        }],
        android: [{
            "kind": "round",
            "cornerRadius": 10
        }],
        enabled: true,
    },
    "round.circle": {
        web: ["999"],
        ios: [{
            "kind": "round",
            "cornerRadius": 999
        }],
        android: [{
            "kind": "round",
            "cornerRadius": 999
        }],
        enabled: true,
    },
    "spacing.1x": {
        web: ["3"],
        ios: [{
            "value": 3,
        }],
        android: [{
            "value": 3,
        }],
        enabled: true,
    },
    "spacing.2x": {
        web: ["6"],
        ios: [{
            "value": 6,
        }],
        android: [{
            "value": 6,
        }],
        enabled: true,
    },
    "spacing.3x": {
        web: ["9"],
        ios: [{
            "value": 9,
        }],
        android: [{
            "value": 9,
        }],
        enabled: true,
    },
    "up.hard.s": {
        web: ["0rem 0.75rem 2rem 0rem #a855f714"],
        ios: [{
            "color": "#a855f714",
            "offsetX": 0,
            "offsetY": 12,
            "spreadRadius": 0,
            "blurRadius": 32
        }],
        android: [{
            "color": "#a855f714",
            "offsetX": 0,
            "offsetY": 12,
            "spreadRadius": 0,
            "blurRadius": 32,
            "fallbackElevation": 3
        }],
        enabled: true,
    },
    "up.hard.m": {
        web: ["0rem 1.25rem 3rem 0rem #ec489933"],
        ios: [{
            "color": "#ec489933",
            "offsetX": 0,
            "offsetY": 20,
            "spreadRadius": 0,
            "blurRadius": 48
        }],
        android: [{
            "color": "#ec489933",
            "offsetX": 0,
            "offsetY": 20,
            "spreadRadius": 0,
            "blurRadius": 48,
            "fallbackElevation": 10
        }],
        enabled: true,
    },
    "screen-s.display.l.normal": {
        web: [{
            "fontFamilyRef": "fontFamily.display",
            "fontWeight": 500,
            "fontStyle": "normal",
            "textSize": 80,
            "lineHeight": 88,
            "letterSpacing": -1.5
        }],
        ios: [{
            "fontFamilyRef": "fontFamily.display",
            "weight": "medium",
            "style": "normal",
            "size": 52,
            "lineHeight": 60,
            "kerning": -0.75
        }],
        android: [{
            "fontFamilyRef": "fontFamily.display",
            "fontWeight": "500",
            "fontStyle": "normal",
            "fontSize": "5rem",
            "lineHeight": "5.5rem",
            "letterSpacing": "-0.09375rem"
        }],
        enabled: true,
    },
    "screen-s.display.h2.normal": {
        web: [{
            "fontFamilyRef": "fontFamily.display",
            "fontWeight": 500,
            "fontStyle": "normal",
            "textSize": 30,
            "lineHeight": 38,
            "letterSpacing": 0
        }],
        ios: [{
            "fontFamilyRef": "fontFamily.display",
            "weight": "medium",
            "style": "normal",
            "size": 30,
            "lineHeight": 38,
            "kerning": 0
        }],
        android: [{
            "fontFamilyRef": "fontFamily.display",
            "fontWeight": "500",
            "fontStyle": "normal",
            "fontSize": "30",
            "lineHeight": "38",
            "letterSpacing": "normal"
        }],
        enabled: true,
    },
    "display": {
        web: [{
            "name": "SB Sans Display",
            "fonts": [
                {
                    "src": [
                        "url('https://cdn-app.sberdevices.ru/shared-static/0.0.0/fonts/SBSansDisplay.0.2.0/SBSansDisplay-Thin.woff2') format('woff2')",
                        "url('https://cdn-app.sberdevices.ru/shared-static/0.0.0/fonts/SBSansDisplay.0.2.0/SBSansDisplay-Thin.woff') format('woff')"
                    ],
                    "fontWeight": "100",
                    "fontStyle": "normal"
                },
                {
                    "src": [
                        "url('https://cdn-app.sberdevices.ru/shared-static/0.0.0/fonts/SBSansDisplay.0.2.0/SBSansDisplay-Regular.woff2') format('woff2')",
                        "url('https://cdn-app.sberdevices.ru/shared-static/0.0.0/fonts/SBSansDisplay.0.2.0/SBSansDisplay-Regular.woff') format('woff')"
                    ],
                    "fontWeight": "normal",
                    "fontStyle": "normal"
                },
                {
                    "src": [
                        "url('https://cdn-app.sberdevices.ru/shared-static/0.0.0/fonts/SBSansDisplay.0.2.0/SBSansDisplay-Medium.woff2') format('woff2')",
                        "url('https://cdn-app.sberdevices.ru/shared-static/0.0.0/fonts/SBSansDisplay.0.2.0/SBSansDisplay-Medium.woff') format('woff')"
                    ],
                    "fontWeight": "500",
                    "fontStyle": "normal"
                },
                {
                    "src": [
                        "url('https://cdn-app.sberdevices.ru/shared-static/0.0.0/fonts/SBSansDisplay.0.2.0/SBSansDisplay-Semibold.woff2') format('woff2')",
                        "url('https://cdn-app.sberdevices.ru/shared-static/0.0.0/fonts/SBSansDisplay.0.2.0/SBSansDisplay-Semibold.woff') format('woff')"
                    ],
                    "fontWeight": "600",
                    "fontStyle": "normal"
                },
                {
                    "src": [
                        "url('https://cdn-app.sberdevices.ru/shared-static/0.0.0/fonts/SBSansDisplay.0.2.0/SBSansDisplay-Bold.woff2') format('woff2')",
                        "url('https://cdn-app.sberdevices.ru/shared-static/0.0.0/fonts/SBSansDisplay.0.2.0/SBSansDisplay-Bold.woff') format('woff')"
                    ],
                    "fontWeight": "bold",
                    "fontStyle": "normal"
                }
            ]
        }],
        ios: [{
            "name": "SB Sans Display",
            "fonts": [
                {
                    "link": "https://cdn-app.sberdevices.ru/shared-static/0.0.0/fonts/SBSansDisplay.0.2.0/SBSansDisplay-Thin.otf",
                    "weight": "ultralight",
                    "style": "normal"
                },
                {
                    "link": "https://cdn-app.sberdevices.ru/shared-static/0.0.0/fonts/SBSansDisplay.0.2.0/SBSansDisplay-Regular.otf",
                    "weight": "regular",
                    "style": "normal"
                },
                {
                    "link": "https://cdn-app.sberdevices.ru/shared-static/0.0.0/fonts/SBSansDisplay.0.2.0/SBSansDisplay-Medium.otf",
                    "weight": "medium",
                    "style": "normal"
                },
                {
                    "link": "https://cdn-app.sberdevices.ru/shared-static/0.0.0/fonts/SBSansDisplay.0.2.0/SBSansDisplay-Semibold.otf",
                    "weight": "semibold",
                    "style": "normal"
                },
                {
                    "link": "https://cdn-app.sberdevices.ru/shared-static/0.0.0/fonts/SBSansDisplay.0.2.0/SBSansDisplay-Bold.otf",
                    "weight": "bold",
                    "style": "normal"
                }
            ]
        }],
        android: [{
            "name": "SB Sans Display",
            "fonts": [
                {
                    "link": "https://cdn-app.sberdevices.ru/shared-static/0.0.0/fonts/SBSansDisplay.0.2.0/SBSansDisplay-Thin.otf",
                    "fontWeight": 100,
                    "fontStyle": "normal"
                },
                {
                    "link": "https://cdn-app.sberdevices.ru/shared-static/0.0.0/fonts/SBSansDisplay.0.2.0/SBSansDisplay-Regular.otf",
                    "fontWeight": 400,
                    "fontStyle": "normal"
                },
                {
                    "link": "https://cdn-app.sberdevices.ru/shared-static/0.0.0/fonts/SBSansDisplay.0.2.0/SBSansDisplay-Medium.otf",
                    "fontWeight": 500,
                    "fontStyle": "normal"
                },
                {
                    "link": "https://cdn-app.sberdevices.ru/shared-static/0.0.0/fonts/SBSansDisplay.0.2.0/SBSansDisplay-Semibold.otf",
                    "fontWeight": 600,
                    "fontStyle": "normal"
                },
                {
                    "link": "https://cdn-app.sberdevices.ru/shared-static/0.0.0/fonts/SBSansDisplay.0.2.0/SBSansDisplay-Bold.otf",
                    "fontWeight": 700,
                    "fontStyle": "normal"
                }
            ]
        }],
    }
}

# ВАЖНО

## Структура файла

Каждый раздел `## Дизайн система <NAME>` соответствует одной записи в таблице `design_systems`.
Каждый подраздел `### Тенант <name>` — одной записи в таблице `tenants` с полем `design_system_id` родительской ДС.

## Таблица tokens

Для каждого уникального имени токена внутри одной ДС создаётся одна запись в `tokens`:
- `design_system_id` — берётся из раздела дизайн системы, в котором встречается токен
- `name` — ключ объекта (например `dark.text.default.primary`)
- `type`, `displayName`, `description` — берутся из файла tokens.md по совпадению имени
- `enabled` — берётся из поля `enabled` в данном файле

Одно и то же имя токена может встречаться в нескольких тенантах одной ДС, но в `tokens` вставляется только одна строка. Значение `enabled` должно быть одинаковым у всех тенантов одной ДС — за эталон принимается первый тенант (sdds_cs для SDDS, plasma_web для PLASMA).

## Таблица token_values

Для каждой платформы (`web`, `ios`, `android`) внутри каждого тенанта создаётся отдельная запись:
- `token_id` — ссылка на соответствующую запись в `tokens`
- `tenant_id` — ссылка на тенант текущего подраздела
- `platform` — `web` | `ios` | `android`
- `value` — массив значений для данной платформы (jsonb)

Итого одна запись в md-файле порождает 3 записи в `token_values` (по одной на платформу).
