import React from 'react';

import { BookOpenOutline } from '../Icon.assets/BookOpenOutline';
import { IconRoot, IconProps } from '../IconRoot';

export const IconBookOpenOutline: React.FC<IconProps> = ({ size = 'xs', color, className }) => {
    return <IconRoot className={className} size={size} color={color} icon={BookOpenOutline} />;
};
