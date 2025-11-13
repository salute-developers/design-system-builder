import { useState } from 'react';

export const useForceRerender = () => {
    const [state, updateState] = useState<object | null>(null);
    const updateToken = (value?: null) => updateState(value === null ? null : {});

    return [state, updateToken] as const;
};
