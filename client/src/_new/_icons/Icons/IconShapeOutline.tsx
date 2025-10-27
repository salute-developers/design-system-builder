import React from 'react';

import { ShapeOutline } from '../Icon.assets/ShapeOutline';
import { IconRoot, IconProps } from '../IconRoot';

export const IconShapeOutline: React.FC<IconProps> = ({ size = 'xs', color, className }) => {
    return <IconRoot className={className} size={size} color={color} icon={ShapeOutline} />;
};
