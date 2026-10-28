import assert from 'node:assert/strict';

export type Credentials = Readonly<{ username: string; password: string }>;

export function readCredentials(values: NodeJS.ProcessEnv): Credentials {
    const { DSB_E2E_USERNAME: username, DSB_E2E_PASSWORD: password } = values;
    assert(username && username.trim(), 'Заполните DSB_E2E_USERNAME в .env.e2e.local.');
    assert(password, 'Заполните DSB_E2E_PASSWORD в .env.e2e.local.');
    return { username, password };
}
