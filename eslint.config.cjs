const js = require('@eslint/js')
const globals = require('globals')
const tseslint = require('typescript-eslint')

module.exports = [
    {
        ignores: [
            '**/node_modules/**',
            '**/dist/**',
            '**/.dist/**',
            '**/*.d.ts',
            '**/*.tsbuildinfo',
            '.pnpm-store/**',
            'eslint.config.cjs',
        ],
    },
    js.configs.recommended,
    ...tseslint.configs.recommended,
    {
        files: ['**/*.ts'],
        languageOptions: {
            globals: {
                ...globals.node,
            },
        },
        rules: {
            'no-console': 'off',
        },
    },
]
