import { randomUUID } from 'node:crypto';

export function uniqueSystemName(): string {
    return 'e2e-' + randomUUID();
}

export type SystemTestData = Readonly<{
    name: string;
    projectId: string;
    observeCreation(operation: Promise<unknown>): void;
    creationAttempted(): void;
    register(system: unknown): void;
}>;
