import { describe, expect, it } from 'vitest';

import { parseGradient } from './gradient';

describe('слои платформ legacy-экранов', () => {
    it('читает позиции стопов из одной цифры', () => {
        expect(parseGradient(['linear-gradient(90deg, #FFFFFF 0%, #000000 5%, #111111 100%)'], 'ios')).toEqual([
            {
                kind: 'linear',
                locations: [0, 0.05, 1],
                colors: ['#FFFFFFFF', '#000000FF', '#111111FF'],
                angle: 90,
            },
        ]);
    });

    it('переводит Conic в слой angular: на iOS с углом, на Android без угла', () => {
        const conic = ['conic-gradient(from 90deg at 25% 75%, #FFFFFF 0%, #000000 100%)'];
        expect(parseGradient(conic, 'ios')).toEqual([
            {
                kind: 'angular',
                locations: [0, 1],
                colors: ['#FFFFFFFF', '#000000FF'],
                startAngle: 90,
                endAngle: 450,
                centerX: 0.25,
                centerY: 0.75,
            },
        ]);
        expect(parseGradient(conic, 'android')).toEqual([
            { kind: 'angular', locations: [0, 1], colors: ['#FFFFFFFF', '#000000FF'], centerX: 0.25, centerY: 0.75 },
        ]);
    });
});
