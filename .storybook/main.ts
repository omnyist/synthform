import type { StorybookConfig } from '@storybook/react-vite'

// Props reach the docs pages through Storybook 11's server-side docgen, which is on by default and
// reads the TypeScript types itself, so there is no reactDocgen option or docgen tsconfig here.
// Vite's publicDir (public/: fonts, sounds, stickers) is served and copied by Storybook itself in
// 11, so there is no staticDirs either.
const config: StorybookConfig = {
  stories: ['../src/**/*.stories.@(ts|tsx)'],
  addons: [
    '@storybook/addon-vitest',
    '@storybook/addon-a11y',
    '@storybook/addon-docs',
    '@storybook/addon-mcp',
  ],
  framework: '@storybook/react-vite',
  core: {
    disableTelemetry: true,
  },
  features: {
    sidebarOnboardingChecklist: false,
  },
}
export default config
