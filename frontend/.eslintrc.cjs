module.exports = {
  root: true,
  env: {
    browser: true,
    es2020: true,
    node: true,
  },
  globals: {
    console: 'readonly',
    crypto: 'readonly',
    window: 'readonly',
    setTimeout: 'readonly',
    clearTimeout: 'readonly',
    setInterval: 'readonly',
    clearInterval: 'readonly',
    File: 'readonly',
    CustomEvent: 'readonly',
    EventListener: 'readonly',
    confirm: 'readonly',
    module: 'readonly',
    process: 'readonly',
    __dirname: 'readonly',
  },
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: 'module',
    ecmaFeatures: {
      jsx: true,
    },
  },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
    'plugin:jsx-a11y/recommended',
    'prettier',
  ],
  ignorePatterns: ['dist', '.eslintrc.cjs', 'node_modules', '**/bpmn-js/**', '**/dmn-js/**'],
  parser: '@typescript-eslint/parser',
  plugins: ['react-refresh', '@typescript-eslint', 'react', 'react-hooks', 'jsx-a11y'],
  rules: {
    'react/react-in-jsx-scope': 'off',
    'react/prop-types': 'off',
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    // Disable no-undef for TypeScript files - TypeScript compiler handles this
    // Browser/node env should provide globals, but disable rule to be safe
    'no-undef': 'off',
    // Disable set-state-in-effect - form initialization is a valid use case
    'react-hooks/set-state-in-effect': 'off',
    'jsx-a11y/alt-text': 'error',
    'jsx-a11y/aria-props': 'error',
    'jsx-a11y/aria-proptypes': 'error',
    'jsx-a11y/aria-unsupported-elements': 'error',
    'jsx-a11y/role-has-required-aria-props': 'error',
    'jsx-a11y/role-supports-aria-props': 'error',
    'jsx-a11y/label-has-associated-control': [
      'error',
      {
        labelComponents: [],
        labelAttributes: ['htmlFor'],
        controlComponents: [],
        assert: 'either',
        depth: 25,
      },
    ],
  },
  overrides: [
    {
      files: ['**/*.{ts,tsx}'],
      rules: {
        // TypeScript handles undefined variable checking, so disable ESLint's no-undef
        'no-undef': 'off',
      },
    },
  ],
  settings: {
    react: {
      version: 'detect',
    },
  },
};
