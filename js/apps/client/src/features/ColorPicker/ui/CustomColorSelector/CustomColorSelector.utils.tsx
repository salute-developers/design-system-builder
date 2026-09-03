import {
    IconAndroidFill,
    IconAppleFill,
    IconGradientColorOutline,
    IconPictureSquareFill,
    IconSolidColorOutline,
    IconWebFill,
} from '@salutejs/plasma-icons';

import { IconButton } from '../../../../components';
import { VariationType } from '../../../../controllers';

export const styleTypeList = [
    {
        value: 'fill',
        disabled: false,
        label: (
            <IconButton>
                <IconSolidColorOutline color="inherit" size="xs" />
            </IconButton>
        ),
    },
    {
        value: 'gradient',
        disabled: false,
        label: (
            <IconButton>
                <IconGradientColorOutline color="inherit" size="xs" />
            </IconButton>
        ),
    },
    {
        value: 'pattern',
        disabled: false,
        label: (
            <IconButton disabled>
                <IconPictureSquareFill color="inherit" size="xs" />
            </IconButton>
        ),
    },
];

export const getStyleList = (type: VariationType) => {
    return styleTypeList.map((item) => ({
        ...item,
        disabled: (type === 'gradient' && item.value === 'fill') || (type === 'color' && item.value === 'gradient'),
    }));
};

export const platformTypeList = [
    {
        value: 'web',
        label: (
            <IconButton>
                <IconWebFill color="inherit" size="xs" />
            </IconButton>
        ),
    },
    {
        value: 'ios',
        label: (
            <IconButton disabled>
                <IconAppleFill color="inherit" size="xs" />
            </IconButton>
        ),
    },
    {
        value: 'android',
        label: (
            <IconButton disabled>
                <IconAndroidFill color="inherit" size="xs" />
            </IconButton>
        ),
    },
];
