import React, { ComponentProps, Ref, forwardRef } from 'react';
import { typographyComponent } from '@salutejs/plasma-new-hope/styled-components';

import { Heading } from './Heading';

// Компоненты с зафиксированным размером, как в sdds-serv: там на каждый размер свой конфиг
// темы, здесь размер — вариация одного компонента, поэтому обёртки просто подставляют `size`.
type Props = Omit<ComponentProps<typeof Heading>, 'size'>;

const withSize = (size: string) => {
    const Sized = forwardRef((props: Props, ref: Ref<HTMLElement>) => <Heading ref={ref} size={size} {...(props as any)} />);

    return typographyComponent(Sized as any);
};

export const H1 = withSize('h1');
export const H2 = withSize('h2');
export const H3 = withSize('h3');
export const H4 = withSize('h4');
export const H5 = withSize('h5');
export const H6 = withSize('h6');
