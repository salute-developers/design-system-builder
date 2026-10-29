import type { ReactNode } from 'react';

interface VisibleProps {
    when: boolean;
    children: ReactNode;
}

export const choose = <T,>(condition: boolean, otherwise: T, matched: T): T => [otherwise, matched][Number(condition)];
export const all = (...values: unknown[]) => values.every(Boolean);
export const any = (...values: unknown[]) => values.some(Boolean);

export const Visible = ({ when, children }: VisibleProps) => choose(when, null, children);
