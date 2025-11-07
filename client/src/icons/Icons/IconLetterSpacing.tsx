import React from 'react';

import { LetterSpacing } from '../Icon.assets/LetterSpacing';
import { IconRoot, IconProps } from '../IconRoot';

export const IconLetterSpacing: React.FC<IconProps> = ({ size = 'xs', color, className }) => {
    return <IconRoot className={className} size={size} color={color} icon={LetterSpacing} />;
};
