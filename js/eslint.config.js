import js from '@eslint/js';
import tseslint from 'typescript-eslint';
// import reactHooks from 'eslint-plugin-react-hooks';

export default [
    {
        ignores: ['cli/.sdds/**', 'cli/output/**'],
    },
    js.configs.recommended,
    ...tseslint.configs.recommended,
    // reactHooks.configs.recommended,
    {
        rules: {
            'no-unused-vars': 'off',
            '@typescript-eslint/no-unused-vars': 'warn',
            '@typescript-eslint/no-explicit-any': 'warn',
        },
    },
    {
        // Ссылки на палитру в клиенте раскрываются только через restorePaletteColor,
        // который учитывает палитру открытой темы.
        files: ['apps/client/src/**/*.{ts,tsx}'],
        rules: {
            'no-restricted-imports': [
                'error',
                {
                    paths: [
                        {
                            name: '@salutejs/plasma-tokens-utils',
                            importNames: ['getRestoredColorFromPalette'],
                            message: 'Используйте restorePaletteColor из src/palette/activePalette.',
                        },
                    ],
                },
            ],
        },
    },
];
