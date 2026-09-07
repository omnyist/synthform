import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['dist'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,

      // TRACKED DEBT, not a preference. Both are warnings so that lint can
      // GATE on everything else: before 2026-09-06 nothing ran eslint at all
      // (the old deploy workflow never linted), so these accumulated unseen.
      // They print on every build and the counts only go down deliberately.
      //
      // no-explicit-any: 27 occurrences, mostly src/types/*.ts describing
      // backend payloads. The honest fix is real types — several could come
      // from the generate:api OpenAPI output — not a blanket swap to unknown,
      // which just moves the narrowing to every call site.
      //
      // react-hooks/immutability: 1 occurrence, a connect() called in a
      // useEffect. A genuine correctness rule; left visible rather than
      // silenced, because fixing it means restructuring the hook.
      //
      // Promote each back to 'error' as its count reaches zero.
      '@typescript-eslint/no-explicit-any': 'warn',
      'react-hooks/immutability': 'warn',
      // Disable new v7 strict rules - these patterns are common and safe
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/purity': 'off',
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
      // Allow underscore-prefixed unused vars (standard TypeScript pattern)
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
)
