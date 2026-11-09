/** Пункт списка токенов: значение, которое записывается в свойство, подпись и необязательное пояснение справа. */
export interface TokenOption {
    value: string;
    label: string;
    /** Пояснение справа от подписи: размер скругления, кегль стиля. */
    hint?: string;
}

/** Токен цвета для библиотеки пикера: цвет в текущем режиме, группа и подгруппа, подтема. */
export interface ColorTokenOption extends TokenOption {
    color: string;
    group: string;
    subgroup: string;
    /** `default` или подтема `on-dark`, `on-light`, `inverse`: без флажка «Токены подтем» видны только `default`. */
    subtheme: string;
}
