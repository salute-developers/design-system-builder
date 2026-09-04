import React from 'react';

import { Typography } from '../Icon.assets/Typography';
import { IconRoot, IconProps } from '../IconRoot';

export const IconTypography: React.FC<IconProps> = ({ size = 'xs', color, className }) => {
    return <IconRoot className={className} size={size} color={color} icon={Typography} />;
};
