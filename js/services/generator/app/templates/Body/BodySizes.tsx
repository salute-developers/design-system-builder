import React, { ComponentProps, Ref, forwardRef } from 'react';
import { typographyComponent } from '@salutejs/plasma-new-hope/styled-components';

import { Body } from './Body';

// Компоненты с зафиксированным размером, как в sdds-serv: там на каждый размер свой конфиг
// темы, здесь размер — вариация одного компонента, поэтому обёртки просто подставляют `size`.
type Props = Omit<ComponentProps<typeof Body>, 'size'>;

const withSize = (size: string) => {
    const Sized = forwardRef((props: Props, ref: Ref<HTMLElement>) => <Body ref={ref} size={size} {...(props as any)} />);

    return typographyComponent(Sized as any);
};

export const BodyL = withSize('l');
export const BodyM = withSize('m');
export const BodyS = withSize('s');
export const BodyXS = withSize('xs');
export const BodyXXS = withSize('xxs');
