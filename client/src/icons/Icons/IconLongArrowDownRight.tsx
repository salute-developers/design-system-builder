import React from 'react';

import { LongArrowDownRight } from '../Icon.assets/LongArrowDownRight';
import { IconRoot, IconProps } from '../IconRoot';

export const IconLongArrowDownRight: React.FC<IconProps> = ({ size = 'xs', color, className }) => {
    return <IconRoot className={className} size={size} color={color} icon={LongArrowDownRight} />;
};
