import { getAdditionalMetaTokens } from './getAdditionalMetaTokens';
import { ExtraMetaTokensGetters } from '../createMetaTokens';

export const extraMetaTokenGetters: ExtraMetaTokensGetters = {
    color: getAdditionalMetaTokens,
    gradient: getAdditionalMetaTokens,
};
