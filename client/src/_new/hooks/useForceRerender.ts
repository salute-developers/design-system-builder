import { useState } from 'react';

export const useForceRerender = () => {
    const [state, updateState] = useState({});
    const updateToken = () => updateState({});

    return [state, updateToken] as const;
};
