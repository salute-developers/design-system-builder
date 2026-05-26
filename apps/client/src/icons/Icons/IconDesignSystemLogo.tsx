import React from 'react';

import { DesignSystemLogo } from '../Icon.assets/DesignSystemLogo';
import { IconRoot, IconProps } from '../IconRoot';

export const IconDesignSystemLogo: React.FC<IconProps> = ({ size = 'xs', color, className }) => {
    return <IconRoot className={className} size={size} color={color} icon={DesignSystemLogo} />;
};
