import React, { ComponentProps, Ref, forwardRef } from 'react';
import { typographyComponent } from '@salutejs/plasma-new-hope/styled-components';

import { Text } from './Text';

// Компоненты с зафиксированным размером, как в sdds-serv: там на каждый размер свой конфиг
// темы, здесь размер — вариация одного компонента, поэтому обёртки просто подставляют `size`.
type Props = Omit<ComponentProps<typeof Text>, 'size'>;

const withSize = (size: string) => {
    const Sized = forwardRef((props: Props, ref: Ref<HTMLElement>) => <Text ref={ref} size={size} {...(props as any)} />);

    return typographyComponent(Sized as any);
};

export const TextL = withSize('l');
export const TextM = withSize('m');
export const TextS = withSize('s');
export const TextXS = withSize('xs');
