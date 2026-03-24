import React from 'react';

import { LineHeight } from '../Icon.assets/LineHeight';
import { IconRoot, IconProps } from '../IconRoot';

export const IconLineHeight: React.FC<IconProps> = ({ size = 'xs', color, className }) => {
    return <IconRoot className={className} size={size} color={color} icon={LineHeight} />;
};
