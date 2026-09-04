import { useEffect, useState } from 'react';

import { PROJECTS_URL, http, tokenStore } from '../api';

type OwnerProjectIdState =
    | { status: 'loading' }
    | { status: 'ready'; projectId: string }
    | { status: 'no-project' }
    | { status: 'error' };

const getUserIdFromJWT = (token: string | null): string | undefined => {
    if (!token) {
        return undefined;
    }

    const [, payload] = token.split('.');
    if (!payload) {
        return undefined;
    }

    try {
        const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));

        return (JSON.parse(json) as { sub?: string }).sub;
    } catch {
        return undefined;
    }
};

export const fetchOwnerProjectId = async (): Promise<string | null> => {
    const userId = getUserIdFromJWT(tokenStore.access);

    if (!userId) {
        return null;
    }

    const projects = (await http.get(PROJECTS_URL)).data as Array<{
        id: string;
        ownerUserId: string;
    }>;

    return projects.find(({ ownerUserId }) => ownerUserId === userId)?.id ?? null;
};

export const useOwnerProjectId = (): OwnerProjectIdState => {
    const [state, setState] = useState<OwnerProjectIdState>({ status: 'loading' });

    useEffect(() => {
        const userId = getUserIdFromJWT(tokenStore.access);

        const setProjectId = async () => {
            try {
                const ownerProjectId = await fetchOwnerProjectId();

                setState(ownerProjectId ? { status: 'ready', projectId: ownerProjectId } : { status: 'no-project' });
            } catch {
                setState({ status: 'error' });
            }
        };

        if (!userId) {
            setState({ status: 'error' });

            return;
        }

        setProjectId();
    }, []);

    return state;
};
