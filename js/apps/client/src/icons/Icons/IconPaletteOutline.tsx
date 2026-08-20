import React from 'react';

import { PaletteOutline } from '../Icon.assets/PaletteOutline';
import { IconRoot, IconProps } from '../IconRoot';

export const IconPaletteOutline: React.FC<IconProps> = ({ size = 'xs', color, className }) => {
    return <IconRoot className={className} size={size} color={color} icon={PaletteOutline} />;
};
