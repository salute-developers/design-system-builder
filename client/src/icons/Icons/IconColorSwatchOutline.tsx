import React from 'react';

import { ColorSwatchOutline } from '../Icon.assets/ColorSwatchOutline';
import { IconRoot, IconProps } from '../IconRoot';

export const IconColorSwatchOutline: React.FC<IconProps> = ({ size = 'xs', color, className }) => {
    return <IconRoot className={className} size={size} color={color} icon={ColorSwatchOutline} />;
};
