import React from 'react';

import { CharY } from '../Icon.assets/CharY';
import { IconRoot, IconProps } from '../IconRoot';

export const IconCharY: React.FC<IconProps> = ({ size = 'xs', color, className }) => {
    return <IconRoot className={className} size={size} color={color} icon={CharY} />;
};
