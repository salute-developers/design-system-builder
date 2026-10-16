import React, { ComponentProps, Ref, forwardRef } from 'react';
import { typographyComponent } from '@salutejs/plasma-new-hope/styled-components';

import { Dspl } from './Dspl';

// Компоненты с зафиксированным размером, как в sdds-serv: там на каждый размер свой конфиг
// темы, здесь размер — вариация одного компонента, поэтому обёртки просто подставляют `size`.
type Props = Omit<ComponentProps<typeof Dspl>, 'size'>;

const withSize = (size: string) => {
    const Sized = forwardRef((props: Props, ref: Ref<HTMLElement>) => <Dspl ref={ref} size={size} {...(props as any)} />);

    return typographyComponent(Sized as any);
};

export const DsplL = withSize('l');
export const DsplM = withSize('m');
export const DsplS = withSize('s');
