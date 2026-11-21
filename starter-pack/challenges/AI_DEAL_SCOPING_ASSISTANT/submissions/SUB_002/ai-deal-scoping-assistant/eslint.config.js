import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

/**
 * Lint rules double as the project's secure-coding conventions:
 *  - no dynamic `obj[key]` access (use Map / switch / Array.prototype.at) so lookups can never
 *    reach prototype members and static analysers (eslint-plugin-security style rules) stay quiet;
 *  - no Math.random (ids come from crypto.randomUUID);
 *  - no raw HTML injection APIs.
 */
export default tseslint.config(
  { ignores: ['dist', 'coverage', 'node_modules', 'submission'] },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: { ecmaVersion: 2023, globals: globals.browser },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'no-console': ['error', { allow: ['warn', 'error'] }],
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
      eqeqeq: ['error', 'always'],
      'no-restricted-properties': [
        'error',
        { object: 'Math', property: 'random', message: 'Use crypto.randomUUID() via src/domain/ids.ts.' },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: 'MemberExpression[computed=true][property.type!="Literal"]',
          message: 'Dynamic property access is banned. Use Map, switch, destructuring, or Array.prototype.at().',
        },
        {
          selector: 'JSXAttribute[name.name="dangerouslySetInnerHTML"]',
          message: 'Render text through React so it is escaped.',
        },
        {
          selector: 'NewExpression[callee.name="RegExp"]',
          message: 'Use regex literals; dynamic RegExp construction is banned.',
        },
      ],
      'max-lines': ['error', { max: 320, skipBlankLines: true, skipComments: true }],
      'max-lines-per-function': ['error', { max: 70, skipBlankLines: true, skipComments: true }],
      complexity: ['error', 15],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
    },
  },
  {
    // Declarative content (seed scenarios, catalogs, taxonomies) and test suites are data-heavy by nature.
    files: ['src/seed/**', 'src/**/catalog/**', 'src/**/*.data.ts', 'src/**/*.test.{ts,tsx}', 'src/test/**'],
    rules: { 'max-lines': 'off', 'max-lines-per-function': 'off' },
  },
  {
    // React components: JSX is verbose, so allow a little more room than pure logic.
    files: ['src/**/*.tsx'],
    rules: { 'max-lines-per-function': ['error', { max: 140, skipBlankLines: true, skipComments: true }] },
  },
);
