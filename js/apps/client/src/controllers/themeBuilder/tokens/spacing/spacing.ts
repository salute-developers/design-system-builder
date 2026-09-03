import { PlatformClasses, Token } from '../token';
import { PlatformToken } from '../platformToken';

import type { Platforms, TokenType } from '../../types';
import type { WebSpacingToken, IOSSpacingToken, AndroidSpacingToken } from './types';

export type SpacingPlatforms = Platforms<WebSpacingToken, IOSSpacingToken, AndroidSpacingToken>;

export class WebSpacing extends PlatformToken<WebSpacingToken> {
    public setValue(value: WebSpacingToken[string]) {
        this.value = value;
    }
}

export class IOSSpacing extends PlatformToken<IOSSpacingToken> {
    public setValue(value: IOSSpacingToken[string]) {
        this.value = { ...this.value, ...value };
    }
}

export class AndroidSpacing extends PlatformToken<AndroidSpacingToken> {
    public setValue(value: AndroidSpacingToken[string]) {
        this.value = { ...this.value, ...value };
    }
}

export class SpacingToken extends Token<SpacingPlatforms> {
    constructor(meta: Omit<TokenType, 'type'>, values: PlatformClasses<SpacingPlatforms>) {
        const data: TokenType = {
            type: 'spacing',
            ...meta,
        };

        super(data, values);
    }
}
