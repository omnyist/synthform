// The lint config is the only thing that decides which rules run, and a mistake in it fails
// silently: @oxlint/migrate drops rules without saying so and has written file patterns Oxlint
// cannot match, and a JS plugin or tsgolint that fails to load just stops reporting. This writes
// code that breaks one rule from each family the config turns on, lints it with the real config,
// and checks that each rule is reported.

import { afterAll, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'

import { resolvedConfig } from '@omnyist/declick/guard'

const root = join(import.meta.dir, '..')
const oxlint = join(root, 'node_modules', '.bin', 'oxlint')
// A temporary folder, so neither a lint running at the same moment nor an editor sees the broken
// files. The type-aware rules need a tsconfig.json to find them.
const probe = mkdtempSync(join(tmpdir(), 'lint-config-'))

const tsconfig = JSON.stringify({
  compilerOptions: { strict: true, noEmit: true, jsx: 'react-jsx', target: 'ES2022' },
  include: ['*.ts', '*.tsx'],
})

const plain = `export function legacy(input: any) {
  var old = input
  let never = 1
  debugger
  try {
    old = 2
  } catch {}
  return old + never
}

async function load() {
  return 1
}

export function start(name: string) {
  load()
  return name as string
}
`

const hooks = `import { useEffect, useState } from 'react'

export function Hooks({ items }: { items: string[] }) {
  if (items.length > 0) {
    useState(1)
  }

  useEffect(() => {
    console.log(items)
  }, [])

  const unused = 1
  // @ts-ignore
  const anything: any = 2
  return <div>{anything}</div>
}

export function Compiled({ items }: { items: string[] }) {
  const [count, setCount] = useState(0)
  useEffect(() => {
    setCount(items.length)
  }, [items])
  return <div>{count + Math.random()}</div>
}

export function Suppressed({ items }: { items: string[] }) {
  useEffect(() => {
    console.log(items)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return null
}

export const helper = () => 1
export type Empty = {}
`

const query = `import { QueryClient, useInfiniteQuery, useMutation, useQuery } from '@tanstack/react-query'
import { useEffect } from 'react'

export function Query({ id }: { id: string }) {
  const client = new QueryClient()
  const { data, ...rest } = useQuery({ queryKey: ['a'], queryFn: () => fetch('/a/' + id) })
  const unstable = useQuery({ queryKey: ['b'], queryFn: async () => 1 })
  useEffect(() => {}, [unstable])
  useMutation({ onError: () => {}, onMutate: () => {}, mutationFn: async () => 1 })
  useInfiniteQuery({
    queryKey: ['c'],
    getNextPageParam: () => 1,
    queryFn: async () => 1,
    initialPageParam: 0,
  })
  return <div>{[data, rest, client].length}</div>
}
`

const stories = `import { render } from '@storybook/react'
import { expect } from 'vitest'
import { userEvent } from '@testing-library/user-event'
import { within } from 'storybook/test'

const meta = { title: 'Group/Probe', component: render }

export const BadStory = {
  name: 'Bad Story',
  play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button'))
    expect(meta).toBeDefined()
  },
}

export const bad_case = {}
`

const main = `export default { stories: [], addons: ['@storybook/addon-not-installed'] }
`

// One rule at least from every plugin and rule family the config enables.
const EXPECTED: Record<string, string[]> = {
  'probe.ts': [
    'eslint(no-debugger)',
    'eslint(no-empty)',
    'eslint(no-var)',
    'eslint(prefer-const)',
    'typescript(no-explicit-any)',
    // Type-aware, through tsgolint.
    'typescript(no-floating-promises)',
    'typescript(no-unnecessary-type-assertion)',
  ],
  'Hooks.tsx': [
    'eslint(no-unused-vars)',
    'typescript(ban-ts-comment)',
    'typescript(no-empty-object-type)',
    'typescript(no-explicit-any)',
    'react-hooks(rules-of-hooks)',
    'react-hooks(exhaustive-deps)',
    // The React Compiler rules.
    'react(purity)',
    'react(set-state-in-effect)',
    'react(rule-suppression)',
    // react-refresh.
    'react(only-export-components)',
  ],
  'Query.tsx': [
    '@tanstack/query(exhaustive-deps)',
    '@tanstack/query(stable-query-client)',
    '@tanstack/query(no-rest-destructuring)',
    '@tanstack/query(no-unstable-deps)',
    '@tanstack/query(mutation-property-order)',
    '@tanstack/query(infinite-query-property-order)',
  ],
  'Probe.stories.tsx': [
    'storybook(default-exports)',
    'storybook(no-redundant-story-name)',
    'storybook(no-renderer-packages)',
    'storybook(prefer-pascal-case)',
    'storybook(use-storybook-expect)',
    'storybook(use-storybook-testing-library)',
  ],
  'main.ts': ['storybook(no-uninstalled-addons)'],
}

afterAll(() => rmSync(probe, { recursive: true, force: true }))

test('every rule family in the lint config still reports', () => {
  writeFileSync(join(probe, 'tsconfig.json'), tsconfig)
  writeFileSync(join(probe, 'probe.ts'), plain)
  writeFileSync(join(probe, 'Hooks.tsx'), hooks)
  writeFileSync(join(probe, 'Query.tsx'), query)
  writeFileSync(join(probe, 'Probe.stories.tsx'), stories)
  mkdirSync(join(probe, '.storybook'))
  writeFileSync(join(probe, '.storybook', 'main.ts'), main)

  const result = Bun.spawnSync([oxlint, '-c', join(root, '.oxlintrc.json'), '-f', 'json', probe], {
    cwd: root,
    stdin: 'ignore',
  })
  let diagnostics: { code: string; filename: string }[]
  try {
    diagnostics = JSON.parse(result.stdout.toString()).diagnostics
  } catch {
    throw new Error(
      `Oxlint did not print JSON (exit ${result.exitCode}): ${result.stderr.toString() || result.stdout.toString()}`,
    )
  }

  const reported = new Map<string, Set<string>>()
  for (const { code, filename } of diagnostics) {
    const file = basename(filename)
    reported.set(file, (reported.get(file) ?? new Set()).add(code))
  }

  const silent: Record<string, string[]> = {}
  for (const [file, codes] of Object.entries(EXPECTED)) {
    const missing = codes.filter((code) => !reported.get(file)?.has(code))
    if (missing.length > 0) silent[file] = missing
  }
  expect(silent).toEqual({})
})

// The whole resolved config, so one rule dropped from a preset or from .oxlintrc.json fails here,
// not only a whole family going quiet.
test('the resolved lint config matches its snapshot', async () => {
  expect(await resolvedConfig()).toMatchSnapshot()
})
