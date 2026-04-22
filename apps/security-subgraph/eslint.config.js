const js = require('@eslint/js');
const prettier = require('eslint-config-prettier');
const tseslint = require('typescript-eslint');

// AssemblyScript compiles to WebAssembly for The Graph Protocol and needs
// relaxed linting for patterns that are idiomatic in AssemblyScript but not
// in plain TypeScript.
module.exports = [
  {
    ignores: [
      '**/generated/**',
      '**/build/**',
      '**/node_modules/**',
      '**/.turbo/**',
      'subgraph.yaml',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  prettier,
  {
    files: ['src/**/*.ts', 'tests/**/*.ts'],
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-unused-vars': 'warn',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-array-constructor': 'off',
      eqeqeq: 'off',
      'prefer-const': 'off',
      curly: 'off',
      'no-console': 'warn',
    },
  },
];
