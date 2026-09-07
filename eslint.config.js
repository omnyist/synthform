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
      // no-explicit-any: 27 occurrences. NOT in the API types — that guess was
      // wrong and is corrected here. They cluster in route components:
      // telestrator/output.tsx (6), debug/ironmon.tsx (3),
      // telestrator/index.tsx (2), debug/server.tsx (2), the rest scattered.
      //
      // Nearly all are `as any` at serverConnection.subscribe/unsubscribe call
      // sites, and the tempting conclusion — "one badly typed signature" — is
      // also wrong. subscribe is already correctly generic
      // (<T extends MessageType>, callback: (data: PayloadType<T>) => void)
      // and already absorbs the variance internally. The casts exist because
      // callers pass a message-type VARIABLE rather than a literal, so T
      // widens and PayloadType<T> becomes a union the handler cannot satisfy.
      //
      // The fix is therefore per-call-site (narrow those to literals or
      // as-const), not one signature change. Real work, modest payoff, in
      // overlay code — worth doing while touching these files, not as a
      // dedicated sweep.
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
