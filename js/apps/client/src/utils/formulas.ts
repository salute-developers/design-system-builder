import type { Formula } from '../types';

// Общие операции используются всеми правилами с одинаковым вычислением.
const lightnessPlus6 = (l: number) => l + 6;
const lightnessPlus32 = (l: number) => l + 32;
const lightnessPlus16 = (l: number) => l + 16;
const lightnessPlus8 = (l: number) => l + 8;
const zero = () => 0;
const lightnessTimes0_8 = (l: number) => l * 0.8;
const lightnessMinus8 = (l: number) => l - 8;
const hundred = () => 100;
const invertedLightnessTimes0_8 = (l: number) => (100 - l) * 0.8;
const lightnessPlus12 = (l: number) => l + 12;
const lightnessMinus6 = (l: number) => l - 6;
const lightnessMinus20 = (l: number) => l - 20;
const lightnessMinus10 = (l: number) => l - 10;
const opacityUnchanged = (a: number) => a;
const one = () => 1;
const opacityTimes1_2 = (a: number) => a * 1.2;
const opacityTimes0_6 = (a: number) => a * 0.6;
const opacityTimes0_8 = (a: number) => a * 0.8;
const lightnessPlus20 = (l: number) => l + 20;
const lightnessMinus2 = (l: number) => l - 2;
const lightnessMinus4 = (l: number) => l - 4;
const lightnessPlus14 = (l: number) => l + 14;
const lightnessPlus10 = (l: number) => l + 10;
const lightnessPlus4 = (l: number) => l + 4;
const lightnessPlus2 = (l: number) => l + 2;
const lightnessPlus36 = (l: number) => l + 36;
const lightnessMinus32 = (l: number) => l - 32;
const lightnessMinus48 = (l: number) => l - 48;
const lightnessMinus16 = (l: number) => l - 16;
const opacityPlus0_1 = (a: number) => a + 0.1;
const opacityTimes0_5 = (a: number) => a * 0.5;
const lightnessUnchanged = (l: number) => l;
const opacityPlus0_02 = (a: number) => a + 0.02;
const opacityPlus0_04 = (a: number) => a + 0.04;
const opacityPlus0_06 = (a: number) => a + 0.06;
const opacityPlus0_08 = (a: number) => a + 0.08;
const opacityMinus0_02 = (a: number) => a - 0.02;

export const formulas: Formula = {
    text: {
        solid: {
            light: [
                {
                    condition: {
                        lightness: [0, 29],
                        hue: [0, 360],
                        saturation: [0, 24],
                    },
                    operation: {
                        brightness: lightnessPlus6,
                        hover: lightnessPlus32,
                        active: lightnessPlus16,
                    },
                },
                {
                    condition: {
                        lightness: [0, 29],
                        hue: [0, 360],
                        saturation: [25, 100],
                    },
                    operation: {
                        brightness: lightnessPlus6,
                        hover: lightnessPlus16,
                        active: lightnessPlus8,
                    },
                },
                {
                    condition: {
                        lightness: [30, 79],
                        hue: [0, 179],
                        saturation: [0, 24],
                    },
                    operation: {
                        brightness: lightnessPlus6,
                        hover: zero,
                        active: lightnessTimes0_8,
                    },
                },
                {
                    condition: {
                        lightness: [30, 79],
                        hue: [0, 179],
                        saturation: [25, 100],
                    },
                    operation: {
                        brightness: lightnessPlus6,
                        hover: lightnessPlus8,
                        active: lightnessMinus8,
                    },
                },
                {
                    condition: {
                        lightness: [30, 79],
                        hue: [180, 279],
                        saturation: [0, 79],
                    },
                    operation: {
                        brightness: lightnessPlus6,
                        hover: zero,
                        active: lightnessTimes0_8,
                    },
                },
                {
                    condition: {
                        lightness: [30, 79],
                        hue: [180, 279],
                        saturation: [80, 100],
                    },
                    operation: {
                        brightness: lightnessPlus6,
                        hover: lightnessPlus8,
                        active: lightnessMinus8,
                    },
                },
                {
                    condition: {
                        lightness: [30, 79],
                        hue: [280, 360],
                        saturation: [0, 24],
                    },
                    operation: {
                        brightness: lightnessPlus6,
                        hover: zero,
                        active: lightnessTimes0_8,
                    },
                },
                {
                    condition: {
                        lightness: [30, 79],
                        hue: [280, 360],
                        saturation: [25, 100],
                    },
                    operation: {
                        brightness: lightnessPlus6,
                        hover: lightnessPlus8,
                        active: lightnessMinus8,
                    },
                },
                {
                    condition: {
                        lightness: [80, 100],
                        hue: [0, 179],
                        saturation: [0, 24],
                    },
                    operation: {
                        brightness: lightnessPlus6,
                        hover: zero,
                        active: lightnessTimes0_8,
                    },
                },
                {
                    condition: {
                        lightness: [80, 100],
                        hue: [0, 179],
                        saturation: [25, 100],
                    },
                    operation: {
                        brightness: lightnessPlus6,
                        hover: lightnessPlus8,
                        active: lightnessMinus8,
                    },
                },
                {
                    condition: {
                        lightness: [80, 100],
                        hue: [180, 279],
                        saturation: [0, 39],
                    },
                    operation: {
                        brightness: lightnessPlus6,
                        hover: zero,
                        active: lightnessTimes0_8,
                    },
                },
                {
                    condition: {
                        lightness: [80, 100],
                        hue: [180, 279],
                        saturation: [40, 100],
                    },
                    operation: {
                        brightness: lightnessPlus6,
                        hover: lightnessPlus8,
                        active: lightnessMinus8,
                    },
                },
                {
                    condition: {
                        lightness: [80, 100],
                        hue: [280, 360],
                        saturation: [0, 24],
                    },
                    operation: {
                        brightness: lightnessPlus6,
                        hover: zero,
                        active: lightnessTimes0_8,
                    },
                },
                {
                    condition: {
                        lightness: [80, 100],
                        hue: [280, 360],
                        saturation: [25, 100],
                    },
                    operation: {
                        brightness: lightnessPlus6,
                        hover: lightnessPlus8,
                        active: lightnessMinus8,
                    },
                },
            ],
            dark: [
                {
                    condition: {
                        lightness: [0, 29],
                        hue: [0, 360],
                        saturation: [0, 24],
                    },
                    operation: {
                        brightness: lightnessPlus6,
                        hover: hundred,
                        active: invertedLightnessTimes0_8,
                    },
                },
                {
                    condition: {
                        lightness: [0, 29],
                        hue: [0, 360],
                        saturation: [25, 100],
                    },
                    operation: {
                        brightness: lightnessPlus6,
                        hover: lightnessPlus12,
                        active: lightnessPlus6,
                    },
                },
                {
                    condition: {
                        lightness: [30, 79],
                        hue: [0, 179],
                        saturation: [0, 24],
                    },
                    operation: {
                        brightness: lightnessPlus6,
                        hover: hundred,
                        active: invertedLightnessTimes0_8,
                    },
                },
                {
                    condition: {
                        lightness: [30, 79],
                        hue: [0, 179],
                        saturation: [25, 100],
                    },
                    operation: {
                        brightness: lightnessPlus6,
                        hover: lightnessPlus6,
                        active: lightnessMinus6,
                    },
                },
                {
                    condition: {
                        lightness: [30, 79],
                        hue: [180, 279],
                        saturation: [0, 79],
                    },
                    operation: {
                        brightness: lightnessPlus6,
                        hover: hundred,
                        active: invertedLightnessTimes0_8,
                    },
                },
                {
                    condition: {
                        lightness: [30, 79],
                        hue: [180, 279],
                        saturation: [80, 100],
                    },
                    operation: {
                        brightness: lightnessPlus6,
                        hover: lightnessPlus16,
                        active: lightnessMinus6,
                    },
                },
                {
                    condition: {
                        lightness: [30, 79],
                        hue: [280, 360],
                        saturation: [0, 24],
                    },
                    operation: {
                        brightness: lightnessPlus6,
                        hover: hundred,
                        active: invertedLightnessTimes0_8,
                    },
                },
                {
                    condition: {
                        lightness: [30, 79],
                        hue: [280, 360],
                        saturation: [25, 100],
                    },
                    operation: {
                        brightness: lightnessPlus6,
                        hover: lightnessPlus6,
                        active: lightnessMinus6,
                    },
                },
                {
                    condition: {
                        lightness: [80, 100],
                        hue: [0, 360],
                        saturation: [0, 24],
                    },
                    operation: {
                        brightness: lightnessPlus6,
                        hover: lightnessMinus20,
                        active: lightnessMinus10,
                    },
                },
                {
                    condition: {
                        lightness: [80, 100],
                        hue: [0, 360],
                        saturation: [25, 100],
                    },
                    operation: {
                        brightness: lightnessPlus6,
                        hover: (l: number) => l - 12,
                        active: lightnessMinus6,
                    },
                },
            ],
        },
        transparent: {
            light: [
                {
                    condition: {
                        alpha: [0, 0],
                    },
                    operation: {
                        brightness: opacityUnchanged,
                        hover: zero,
                        active: zero,
                    },
                },
                {
                    condition: {
                        alpha: [0.01, 0.69],
                    },
                    operation: {
                        brightness: opacityUnchanged,
                        hover: one,
                        active: opacityTimes1_2,
                    },
                },
                {
                    condition: {
                        alpha: [0.7, 0.99],
                    },
                    operation: {
                        brightness: opacityUnchanged,
                        hover: opacityTimes0_6,
                        active: opacityTimes0_8,
                    },
                },
            ],
            dark: [
                {
                    condition: {
                        alpha: [0, 0],
                    },
                    operation: {
                        brightness: opacityUnchanged,
                        hover: zero,
                        active: zero,
                    },
                },
                {
                    condition: {
                        alpha: [0.01, 0.69],
                    },
                    operation: {
                        brightness: opacityUnchanged,
                        hover: one,
                        active: opacityTimes1_2,
                    },
                },
                {
                    condition: {
                        alpha: [0.7, 0.99],
                    },
                    operation: {
                        brightness: opacityUnchanged,
                        hover: opacityTimes0_6,
                        active: opacityTimes0_8,
                    },
                },
            ],
        },
    },
    stroke: {
        solid: {
            light: [
                {
                    condition: {
                        lightness: [0, 9],
                        hue: [0, 360],
                        saturation: [0, 24],
                    },
                    operation: {
                        brightness: lightnessPlus6,
                        hover: (l: number) => l + 56,
                        active: (l: number) => l + 0,
                    },
                },
                {
                    condition: {
                        lightness: [0, 9],
                        hue: [0, 360],
                        saturation: [25, 79],
                    },
                    operation: {
                        brightness: lightnessPlus6,
                        hover: (l: number) => l + 24,
                        active: lightnessPlus12,
                    },
                },
                {
                    condition: {
                        lightness: [0, 9],
                        hue: [0, 360],
                        saturation: [80, 100],
                    },
                    operation: {
                        brightness: lightnessPlus6,
                        hover: lightnessPlus16,
                        active: lightnessPlus8,
                    },
                },
                {
                    condition: {
                        lightness: [10, 24],
                        hue: [0, 360],
                        saturation: [0, 24],
                    },
                    operation: {
                        brightness: lightnessPlus6,
                        hover: (l: number) => l + 48,
                        active: lightnessPlus20,
                    },
                },
                {
                    condition: {
                        lightness: [10, 24],
                        hue: [0, 360],
                        saturation: [25, 79],
                    },
                    operation: {
                        brightness: lightnessPlus6,
                        hover: lightnessPlus20,
                        active: lightnessMinus2,
                    },
                },
                {
                    condition: {
                        lightness: [10, 24],
                        hue: [0, 360],
                        saturation: [80, 100],
                    },
                    operation: {
                        brightness: lightnessPlus6,
                        hover: lightnessPlus12,
                        active: lightnessMinus4,
                    },
                },
                {
                    condition: {
                        lightness: [25, 39],
                        hue: [0, 360],
                        saturation: [0, 24],
                    },
                    operation: {
                        brightness: lightnessPlus6,
                        hover: lightnessPlus32,
                        active: lightnessMinus2,
                    },
                },
                {
                    condition: {
                        lightness: [25, 39],
                        hue: [0, 360],
                        saturation: [25, 79],
                    },
                    operation: {
                        brightness: lightnessPlus6,
                        hover: lightnessPlus14,
                        active: lightnessMinus4,
                    },
                },
                {
                    condition: {
                        lightness: [25, 39],
                        hue: [0, 199],
                        saturation: [80, 100],
                    },
                    operation: {
                        brightness: lightnessPlus6,
                        hover: lightnessPlus10,
                        active: lightnessMinus8,
                    },
                },
                {
                    condition: {
                        lightness: [25, 39],
                        hue: [200, 299],
                        saturation: [80, 100],
                    },
                    operation: {
                        brightness: lightnessPlus6,
                        hover: lightnessPlus14,
                        active: lightnessMinus8,
                    },
                },
                {
                    condition: {
                        lightness: [25, 39],
                        hue: [300, 360],
                        saturation: [80, 100],
                    },
                    operation: {
                        brightness: lightnessPlus6,
                        hover: lightnessPlus10,
                        active: lightnessMinus8,
                    },
                },
                {
                    condition: {
                        lightness: [40, 54],
                        hue: [0, 360],
                        saturation: [0, 9],
                    },
                    operation: {
                        brightness: lightnessPlus6,
                        hover: lightnessPlus20,
                        active: lightnessMinus8,
                    },
                },
                {
                    condition: {
                        lightness: [40, 54],
                        hue: [0, 360],
                        saturation: [10, 100],
                    },
                    operation: {
                        brightness: lightnessPlus6,
                        hover: lightnessPlus20,
                        active: lightnessMinus6,
                    },
                },
                {
                    condition: {
                        lightness: [55, 69],
                        hue: [0, 360],
                        saturation: [0, 100],
                    },
                    operation: {
                        brightness: lightnessPlus6,
                        hover: lightnessPlus16,
                        active: lightnessMinus8,
                    },
                },
                {
                    condition: {
                        lightness: [70, 84],
                        hue: [0, 360],
                        saturation: [0, 24],
                    },
                    operation: {
                        brightness: lightnessPlus6,
                        hover: lightnessPlus16,
                        active: (l: number) => l - 14,
                    },
                },
                {
                    condition: {
                        lightness: [70, 84],
                        hue: [0, 360],
                        saturation: [25, 100],
                    },
                    operation: {
                        brightness: lightnessPlus6,
                        hover: lightnessPlus8,
                        active: lightnessMinus8,
                    },
                },
                {
                    condition: {
                        lightness: [85, 100],
                        hue: [0, 360],
                        saturation: [0, 25],
                    },
                    operation: {
                        brightness: lightnessPlus6,
                        hover: lightnessMinus20,
                        active: lightnessMinus10,
                    },
                },
                {
                    condition: {
                        lightness: [85, 100],
                        hue: [0, 360],
                        saturation: [25, 100],
                    },
                    operation: {
                        brightness: lightnessPlus6,
                        hover: lightnessMinus6,
                        active: lightnessMinus10,
                    },
                },
            ],
            dark: [
                {
                    condition: {
                        lightness: [0, 9],
                        hue: [0, 360],
                        saturation: [0, 24],
                    },
                    operation: {
                        brightness: lightnessPlus6,
                        hover: (l) => l + 24,
                        active: lightnessPlus12,
                    },
                },
                {
                    condition: {
                        lightness: [0, 9],
                        hue: [0, 360],
                        saturation: [25, 79],
                    },
                    operation: {
                        brightness: lightnessPlus6,
                        hover: lightnessPlus8,
                        active: lightnessPlus4,
                    },
                },
                {
                    condition: {
                        lightness: [0, 9],
                        hue: [0, 360],
                        saturation: [80, 100],
                    },
                    operation: {
                        brightness: lightnessPlus6,
                        hover: lightnessPlus6,
                        active: lightnessPlus2,
                    },
                },
                {
                    condition: {
                        lightness: [10, 24],
                        hue: [0, 360],
                        saturation: [0, 24],
                    },
                    operation: {
                        brightness: lightnessPlus6,
                        hover: (l: number) => l + 18,
                        active: lightnessMinus6,
                    },
                },
                {
                    condition: {
                        lightness: [10, 24],
                        hue: [0, 360],
                        saturation: [25, 79],
                    },
                    operation: {
                        brightness: lightnessPlus6,
                        hover: lightnessPlus16,
                        active: lightnessMinus4,
                    },
                },
                {
                    condition: {
                        lightness: [10, 24],
                        hue: [0, 360],
                        saturation: [80, 100],
                    },
                    operation: {
                        brightness: lightnessPlus6,
                        hover: lightnessPlus12,
                        active: lightnessMinus4,
                    },
                },
                {
                    condition: {
                        lightness: [25, 40],
                        hue: [0, 360],
                        saturation: [0, 24],
                    },
                    operation: {
                        brightness: lightnessPlus6,
                        hover: lightnessPlus36,
                        active: lightnessMinus10,
                    },
                },
                {
                    condition: {
                        lightness: [25, 40],
                        hue: [0, 360],
                        saturation: [25, 100],
                    },
                    operation: {
                        brightness: lightnessPlus6,
                        hover: lightnessPlus12,
                        active: lightnessMinus4,
                    },
                },
                {
                    condition: {
                        lightness: [40, 49],
                        hue: [0, 360],
                        saturation: [0, 24],
                    },
                    operation: {
                        brightness: lightnessPlus6,
                        hover: lightnessPlus36,
                        active: lightnessMinus10,
                    },
                },
                {
                    condition: {
                        lightness: [40, 49],
                        hue: [0, 360],
                        saturation: [25, 100],
                    },
                    operation: {
                        brightness: lightnessPlus6,
                        hover: lightnessPlus20,
                        active: lightnessMinus6,
                    },
                },
                {
                    condition: {
                        lightness: [50, 79],
                        hue: [0, 360],
                        saturation: [0, 24],
                    },
                    operation: {
                        brightness: lightnessPlus6,
                        hover: hundred,
                        active: lightnessMinus20,
                    },
                },
                {
                    condition: {
                        lightness: [50, 79],
                        hue: [0, 360],
                        saturation: [25, 100],
                    },
                    operation: {
                        brightness: lightnessPlus6,
                        hover: lightnessPlus16,
                        active: lightnessMinus6,
                    },
                },
                {
                    condition: {
                        lightness: [80, 94],
                        hue: [0, 360],
                        saturation: [0, 24],
                    },
                    operation: {
                        brightness: lightnessPlus6,
                        hover: lightnessMinus32,
                        active: lightnessMinus48,
                    },
                },
                {
                    condition: {
                        lightness: [80, 94],
                        hue: [0, 360],
                        saturation: [25, 59],
                    },
                    operation: {
                        brightness: lightnessPlus6,
                        hover: lightnessMinus20,
                        active: lightnessMinus32,
                    },
                },
                {
                    condition: {
                        lightness: [80, 94],
                        hue: [0, 360],
                        saturation: [60, 100],
                    },
                    operation: {
                        brightness: lightnessPlus6,
                        hover: lightnessMinus16,
                        active: (l: number) => l - 24,
                    },
                },
                {
                    condition: {
                        lightness: [95, 100],
                        hue: [0, 360],
                        saturation: [0, 24],
                    },
                    operation: {
                        brightness: lightnessPlus6,
                        hover: lightnessMinus48,
                        active: (l: number) => l - 60,
                    },
                },
                {
                    condition: {
                        lightness: [95, 100],
                        hue: [0, 360],
                        saturation: [25, 59],
                    },
                    operation: {
                        brightness: lightnessPlus6,
                        hover: lightnessMinus16,
                        active: lightnessMinus20,
                    },
                },
            ],
        },
        transparent: {
            light: [
                {
                    condition: {
                        alpha: [0, 0],
                    },
                    operation: {
                        brightness: opacityUnchanged,
                        hover: zero,
                        active: zero,
                    },
                },
                {
                    condition: {
                        alpha: [0.01, 0.14],
                    },
                    operation: {
                        brightness: opacityUnchanged,
                        hover: (a) => a + 0.2,
                        active: opacityPlus0_1,
                    },
                },
                {
                    condition: {
                        alpha: [0.15, 0.5],
                    },
                    operation: {
                        brightness: opacityUnchanged,
                        hover: opacityTimes0_6,
                        active: (a: number) => a * 1.6,
                    },
                },
                {
                    condition: {
                        alpha: [0.5, 0.99],
                    },
                    operation: {
                        brightness: opacityUnchanged,
                        hover: opacityTimes0_5,
                        active: one,
                    },
                },
            ],
            dark: [
                {
                    condition: {
                        alpha: [0, 0],
                    },
                    operation: {
                        brightness: opacityUnchanged,
                        hover: zero,
                        active: zero,
                    },
                },
                {
                    condition: {
                        alpha: [0.01, 0.09],
                    },
                    operation: {
                        brightness: opacityUnchanged,
                        hover: opacityPlus0_1,
                        active: (a: number) => a + 0.2,
                    },
                },
                {
                    condition: {
                        alpha: [0.1, 0.29],
                    },
                    operation: {
                        brightness: opacityUnchanged,
                        hover: (a: number) => a * 2.5,
                        active: opacityTimes0_6,
                    },
                },
                {
                    condition: {
                        alpha: [0.3, 0.49],
                    },
                    operation: {
                        brightness: opacityUnchanged,
                        hover: (a: number) => a * 2,
                        active: opacityTimes0_6,
                    },
                },
                {
                    condition: {
                        alpha: [0.5, 0.79],
                    },
                    operation: {
                        brightness: opacityUnchanged,
                        hover: one,
                        active: opacityTimes0_5,
                    },
                },
                {
                    condition: {
                        alpha: [0.8, 0.99],
                    },
                    operation: {
                        brightness: opacityUnchanged,
                        hover: opacityTimes0_6,
                        active: (a: number) => a * 0.4,
                    },
                },
            ],
        },
    },
    fill: {
        solid: {
            light: [
                {
                    condition: {
                        lightness: [0, 0],
                        hue: [0, 360],
                        saturation: [0, 100],
                    },
                    operation: {
                        brightness: lightnessPlus6,
                        hover: lightnessUnchanged,
                        active: lightnessUnchanged,
                    },
                },
                {
                    condition: {
                        lightness: [1, 4],
                        hue: [0, 360],
                        saturation: [0, 9],
                    },
                    operation: {
                        brightness: lightnessPlus6,
                        hover: lightnessPlus12,
                        active: lightnessMinus2,
                    },
                },
                {
                    condition: {
                        lightness: [1, 4],
                        hue: [0, 360],
                        saturation: [10, 79],
                    },
                    operation: {
                        brightness: lightnessPlus6,
                        hover: lightnessPlus6,
                        active: lightnessMinus2,
                    },
                },
                {
                    condition: {
                        lightness: [1, 4],
                        hue: [0, 360],
                        saturation: [80, 100],
                    },
                    operation: {
                        brightness: lightnessPlus6,
                        hover: lightnessPlus4,
                        active: lightnessMinus2,
                    },
                },
                {
                    condition: {
                        lightness: [5, 9],
                        hue: [0, 360],
                        saturation: [0, 9],
                    },
                    operation: {
                        brightness: lightnessPlus6,
                        hover: lightnessPlus12,
                        active: lightnessMinus4,
                    },
                },
                {
                    condition: {
                        lightness: [5, 9],
                        hue: [0, 360],
                        saturation: [10, 49],
                    },
                    operation: {
                        brightness: lightnessPlus6,
                        hover: lightnessPlus6,
                        active: lightnessMinus4,
                    },
                },
                {
                    condition: {
                        lightness: [5, 9],
                        hue: [0, 360],
                        saturation: [50, 100],
                    },
                    operation: {
                        brightness: lightnessPlus6,
                        hover: lightnessPlus4,
                        active: lightnessMinus4,
                    },
                },
                {
                    condition: {
                        lightness: [10, 49],
                        hue: [0, 199],
                        saturation: [0, 9],
                    },
                    operation: {
                        brightness: lightnessPlus6,
                        hover: lightnessPlus8,
                        active: lightnessMinus4,
                    },
                },
                {
                    condition: {
                        lightness: [10, 49],
                        hue: [0, 199],
                        saturation: [10, 69],
                    },
                    operation: {
                        brightness: lightnessPlus6,
                        hover: lightnessPlus4,
                        active: lightnessMinus4,
                    },
                },
                {
                    condition: {
                        lightness: [10, 49],
                        hue: [0, 199],
                        saturation: [70, 79],
                    },
                    operation: {
                        brightness: lightnessPlus6,
                        hover: lightnessPlus6,
                        active: lightnessMinus4,
                    },
                },
                {
                    condition: {
                        lightness: [10, 49],
                        hue: [0, 199],
                        saturation: [80, 100],
                    },
                    operation: {
                        brightness: lightnessPlus6,
                        hover: lightnessPlus4,
                        active: lightnessMinus4,
                    },
                },
                {
                    condition: {
                        lightness: [10, 49],
                        hue: [200, 299],
                        saturation: [0, 9],
                    },
                    operation: {
                        brightness: lightnessPlus6,
                        hover: lightnessPlus8,
                        active: lightnessMinus4,
                    },
                },
                {
                    condition: {
                        lightness: [10, 49],
                        hue: [200, 299],
                        saturation: [10, 69],
                    },
                    operation: {
                        brightness: lightnessPlus6,
                        hover: lightnessPlus4,
                        active: lightnessMinus4,
                    },
                },
                {
                    condition: {
                        lightness: [10, 49],
                        hue: [200, 299],
                        saturation: [70, 100],
                    },
                    operation: {
                        brightness: lightnessPlus6,
                        hover: lightnessPlus6,
                        active: lightnessMinus4,
                    },
                },
                {
                    condition: {
                        lightness: [10, 49],
                        hue: [300, 360],
                        saturation: [0, 9],
                    },
                    operation: {
                        brightness: lightnessPlus6,
                        hover: lightnessPlus8,
                        active: lightnessMinus4,
                    },
                },
                {
                    condition: {
                        lightness: [10, 49],
                        hue: [300, 360],
                        saturation: [10, 69],
                    },
                    operation: {
                        brightness: lightnessPlus6,
                        hover: lightnessPlus4,
                        active: lightnessMinus4,
                    },
                },
                {
                    condition: {
                        lightness: [10, 49],
                        hue: [300, 360],
                        saturation: [70, 79],
                    },
                    operation: {
                        brightness: lightnessPlus6,
                        hover: lightnessPlus6,
                        active: lightnessMinus4,
                    },
                },
                {
                    condition: {
                        lightness: [10, 49],
                        hue: [300, 360],
                        saturation: [80, 100],
                    },
                    operation: {
                        brightness: lightnessPlus6,
                        hover: lightnessPlus4,
                        active: lightnessMinus4,
                    },
                },
                {
                    condition: {
                        lightness: [50, 69],
                        hue: [0, 59],
                        saturation: [0, 9],
                    },
                    operation: {
                        brightness: lightnessPlus6,
                        hover: lightnessPlus6,
                        active: lightnessMinus4,
                    },
                },
                {
                    condition: {
                        lightness: [50, 69],
                        hue: [0, 59],
                        saturation: [10, 69],
                    },
                    operation: {
                        brightness: lightnessPlus6,
                        hover: lightnessPlus4,
                        active: lightnessMinus4,
                    },
                },
                {
                    condition: {
                        lightness: [50, 69],
                        hue: [0, 59],
                        saturation: [70, 89],
                    },
                    operation: {
                        brightness: lightnessPlus6,
                        hover: lightnessPlus6,
                        active: lightnessMinus4,
                    },
                },
                {
                    condition: {
                        lightness: [50, 69],
                        hue: [0, 59],
                        saturation: [90, 100],
                    },
                    operation: {
                        brightness: lightnessPlus6,
                        hover: lightnessPlus8,
                        active: lightnessMinus4,
                    },
                },
                {
                    condition: {
                        lightness: [50, 69],
                        hue: [60, 179],
                        saturation: [0, 9],
                    },
                    operation: {
                        brightness: lightnessPlus6,
                        hover: lightnessPlus6,
                        active: lightnessMinus4,
                    },
                },
                {
                    condition: {
                        lightness: [50, 69],
                        hue: [60, 179],
                        saturation: [10, 69],
                    },
                    operation: {
                        brightness: lightnessPlus6,
                        hover: lightnessPlus4,
                        active: lightnessMinus4,
                    },
                },
                {
                    condition: {
                        lightness: [50, 69],
                        hue: [60, 179],
                        saturation: [70, 89],
                    },
                    operation: {
                        brightness: lightnessPlus6,
                        hover: lightnessPlus6,
                        active: lightnessMinus4,
                    },
                },
                {
                    condition: {
                        lightness: [50, 69],
                        hue: [60, 179],
                        saturation: [90, 100],
                    },
                    operation: {
                        brightness: lightnessPlus6,
                        hover: lightnessPlus10,
                        active: lightnessMinus4,
                    },
                },
                {
                    condition: {
                        lightness: [50, 69],
                        hue: [180, 360],
                        saturation: [0, 9],
                    },
                    operation: {
                        brightness: lightnessPlus6,
                        hover: lightnessPlus6,
                        active: lightnessMinus4,
                    },
                },
                {
                    condition: {
                        lightness: [50, 69],
                        hue: [180, 360],
                        saturation: [10, 69],
                    },
                    operation: {
                        brightness: lightnessPlus6,
                        hover: lightnessPlus4,
                        active: lightnessMinus4,
                    },
                },
                {
                    condition: {
                        lightness: [50, 69],
                        hue: [180, 360],
                        saturation: [70, 89],
                    },
                    operation: {
                        brightness: lightnessPlus6,
                        hover: lightnessPlus6,
                        active: lightnessMinus4,
                    },
                },
                {
                    condition: {
                        lightness: [50, 69],
                        hue: [180, 360],
                        saturation: [90, 100],
                    },
                    operation: {
                        brightness: lightnessPlus6,
                        hover: lightnessPlus8,
                        active: lightnessMinus4,
                    },
                },
                {
                    condition: {
                        lightness: [70, 89],
                        hue: [0, 360],
                        saturation: [0, 9],
                    },
                    operation: {
                        brightness: lightnessPlus6,
                        hover: lightnessMinus2,
                        active: lightnessMinus4,
                    },
                },
                {
                    condition: {
                        lightness: [70, 89],
                        hue: [0, 360],
                        saturation: [10, 79],
                    },
                    operation: {
                        brightness: lightnessPlus6,
                        hover: lightnessMinus2,
                        active: lightnessMinus4,
                    },
                },
                {
                    condition: {
                        lightness: [70, 89],
                        hue: [0, 360],
                        saturation: [80, 89],
                    },
                    operation: {
                        brightness: lightnessPlus6,
                        hover: lightnessMinus2,
                        active: lightnessMinus4,
                    },
                },
                {
                    condition: {
                        lightness: [70, 89],
                        hue: [0, 360],
                        saturation: [90, 100],
                    },
                    operation: {
                        brightness: lightnessPlus6,
                        hover: lightnessMinus2,
                        active: lightnessMinus4,
                    },
                },
                {
                    condition: {
                        lightness: [90, 94],
                        hue: [0, 360],
                        saturation: [0, 100],
                    },
                    operation: {
                        brightness: lightnessPlus6,
                        hover: lightnessMinus2,
                        active: (l: number) => l - 3,
                    },
                },
                {
                    condition: {
                        lightness: [95, 99],
                        hue: [0, 360],
                        saturation: [0, 100],
                    },
                    operation: {
                        brightness: lightnessPlus6,
                        hover: (l: number) => l - 1,
                        active: lightnessMinus2,
                    },
                },
                {
                    condition: {
                        lightness: [100, 100],
                        hue: [0, 360],
                        saturation: [0, 100],
                    },
                    operation: {
                        brightness: lightnessPlus6,
                        hover: lightnessUnchanged,
                        active: lightnessUnchanged,
                    },
                },
            ],
            dark: [
                {
                    condition: {
                        lightness: [0, 0],
                        hue: [0, 360],
                        saturation: [0, 100],
                    },
                    operation: {
                        brightness: lightnessPlus6,
                        hover: lightnessUnchanged,
                        active: lightnessUnchanged,
                    },
                },
                {
                    condition: {
                        lightness: [1, 9],
                        hue: [0, 360],
                        saturation: [0, 100],
                    },
                    operation: {
                        brightness: lightnessPlus6,
                        hover: lightnessPlus2,
                        active: lightnessMinus2,
                    },
                },
                {
                    condition: {
                        lightness: [10, 49],
                        hue: [0, 360],
                        saturation: [0, 100],
                    },
                    operation: {
                        brightness: lightnessPlus6,
                        hover: lightnessPlus4,
                        active: lightnessMinus2,
                    },
                },
                {
                    condition: {
                        lightness: [50, 69],
                        hue: [0, 59],
                        saturation: [0, 79],
                    },
                    operation: {
                        brightness: lightnessPlus6,
                        hover: lightnessPlus4,
                        active: lightnessMinus2,
                    },
                },
                {
                    condition: {
                        lightness: [50, 69],
                        hue: [0, 59],
                        saturation: [80, 100],
                    },
                    operation: {
                        brightness: lightnessPlus6,
                        hover: lightnessPlus6,
                        active: lightnessMinus2,
                    },
                },
                {
                    condition: {
                        lightness: [50, 69],
                        hue: [60, 179],
                        saturation: [0, 79],
                    },
                    operation: {
                        brightness: lightnessPlus6,
                        hover: lightnessPlus4,
                        active: lightnessMinus2,
                    },
                },
                {
                    condition: {
                        lightness: [50, 69],
                        hue: [60, 179],
                        saturation: [80, 100],
                    },
                    operation: {
                        brightness: lightnessPlus6,
                        hover: lightnessPlus8,
                        active: lightnessMinus2,
                    },
                },
                {
                    condition: {
                        lightness: [50, 69],
                        hue: [180, 360],
                        saturation: [0, 79],
                    },
                    operation: {
                        brightness: lightnessPlus6,
                        hover: lightnessPlus4,
                        active: lightnessMinus2,
                    },
                },
                {
                    condition: {
                        lightness: [50, 69],
                        hue: [180, 360],
                        saturation: [80, 100],
                    },
                    operation: {
                        brightness: lightnessPlus6,
                        hover: lightnessPlus6,
                        active: lightnessMinus2,
                    },
                },
                {
                    condition: {
                        lightness: [70, 89],
                        hue: [0, 360],
                        saturation: [0, 100],
                    },
                    operation: {
                        brightness: lightnessPlus6,
                        hover: lightnessPlus4,
                        active: lightnessMinus2,
                    },
                },
                {
                    condition: {
                        lightness: [90, 94],
                        hue: [0, 360],
                        saturation: [0, 49],
                    },
                    operation: {
                        brightness: lightnessPlus6,
                        hover: lightnessPlus4,
                        active: lightnessMinus2,
                    },
                },
                {
                    condition: {
                        lightness: [90, 94],
                        hue: [0, 360],
                        saturation: [50, 100],
                    },
                    operation: {
                        brightness: lightnessPlus6,
                        hover: lightnessPlus2,
                        active: lightnessMinus2,
                    },
                },
                {
                    condition: {
                        lightness: [95, 99],
                        hue: [0, 360],
                        saturation: [0, 100],
                    },
                    operation: {
                        brightness: lightnessPlus6,
                        hover: lightnessPlus2,
                        active: lightnessMinus2,
                    },
                },
                {
                    condition: {
                        lightness: [100, 100],
                        hue: [0, 360],
                        saturation: [0, 100],
                    },
                    operation: {
                        brightness: lightnessPlus6,
                        hover: lightnessUnchanged,
                        active: lightnessUnchanged,
                    },
                },
            ],
        },
        transparent: {
            light: [
                {
                    condition: {
                        alpha: [0, 0],
                    },
                    operation: {
                        brightness: opacityUnchanged,
                        hover: zero,
                        active: zero,
                    },
                },
                {
                    condition: {
                        alpha: [0.01, 0.04],
                    },
                    operation: {
                        brightness: opacityUnchanged,
                        hover: (a: number) => a + 0.01,
                        active: opacityPlus0_02,
                    },
                },
                {
                    condition: {
                        alpha: [0.05, 0.09],
                    },
                    operation: {
                        brightness: opacityUnchanged,
                        hover: opacityPlus0_02,
                        active: opacityPlus0_04,
                    },
                },
                {
                    condition: {
                        alpha: [0.1, 0.74],
                    },
                    operation: {
                        brightness: opacityUnchanged,
                        hover: opacityPlus0_06,
                        active: opacityPlus0_08,
                    },
                },
                {
                    condition: {
                        alpha: [0.75, 0.99],
                    },
                    operation: {
                        brightness: opacityUnchanged,
                        hover: (a: number) => a - 0.1,
                        active: opacityPlus0_02,
                    },
                },
            ],
            dark: [
                {
                    condition: {
                        alpha: [0, 0],
                    },
                    operation: {
                        brightness: opacityUnchanged,
                        hover: zero,
                        active: zero,
                    },
                },
                {
                    condition: {
                        alpha: [0.01, 0.04],
                    },
                    operation: {
                        brightness: opacityUnchanged,
                        hover: opacityPlus0_04,
                        active: opacityMinus0_02,
                    },
                },
                {
                    condition: {
                        alpha: [0.05, 0.09],
                    },
                    operation: {
                        brightness: opacityUnchanged,
                        hover: opacityPlus0_06,
                        active: opacityMinus0_02,
                    },
                },
                {
                    condition: {
                        alpha: [0.1, 0.94],
                    },
                    operation: {
                        brightness: opacityUnchanged,
                        hover: (a: number) => a + 0.12,
                        active: (a: number) => a - 0.06,
                    },
                },
                {
                    condition: {
                        alpha: [0.95, 0.99],
                    },
                    operation: {
                        brightness: opacityUnchanged,
                        hover: opacityPlus0_08,
                        active: (a: number) => a - 0.04,
                    },
                },
            ],
        },
    },
};
