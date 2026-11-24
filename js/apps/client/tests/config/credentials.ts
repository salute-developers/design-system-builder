import assert from 'node:assert/strict';

export type Credentials = Readonly<{ username: string; password: string }>;

export function readCredentials(values: NodeJS.ProcessEnv, account: 'owner' | 'member' = 'owner'): Credentials {
    const prefix = account === 'member' ? 'DSB_E2E_MEMBER_' : 'DSB_E2E_';
    const username = values[prefix + 'USERNAME'];
    const password = values[prefix + 'PASSWORD'];
    const source = values.DSB_E2E_CREDENTIALS_FILE ? 'файле DSB_E2E_CREDENTIALS_FILE' : '.env.e2e.local';
    assert(username && username.trim(), 'Заполните ' + prefix + 'USERNAME в ' + source + '.');
    assert(password, 'Заполните ' + prefix + 'PASSWORD в ' + source + '.');
    return { username, password };
}
