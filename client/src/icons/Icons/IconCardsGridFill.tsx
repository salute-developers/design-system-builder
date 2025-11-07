import React from 'react';

import { CardsGridFill } from '../Icon.assets/CardsGridFill';
import { IconRoot, IconProps } from '../IconRoot';

export const IconCardsGridFill: React.FC<IconProps> = ({ size = 'xs', color, className }) => {
    return <IconRoot className={className} size={size} color={color} icon={CardsGridFill} />;
};
