import React from 'react';

import { CharX } from '../Icon.assets/CharX';
import { IconRoot, IconProps } from '../IconRoot';

export const IconCharX: React.FC<IconProps> = ({ size = 'xs', color, className }) => {
    return <IconRoot className={className} size={size} color={color} icon={CharX} />;
};
