import { VariationType } from '../../controllers';

const typeList = [
    { value: 'custom', label: 'Custom' },
    { value: 'library', label: 'Library' },
] as const;

export const getTypeList = (type: VariationType) => {
    return typeList.map((item) => ({ ...item, disabled: type === 'gradient' && item.value === 'library' }));
};
