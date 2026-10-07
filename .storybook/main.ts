import type { StorybookConfig } from '@storybook/react-vite'

// Props reach the docs pages through react-docgen, react-vite's default, which reads them from the
// TypeScript source without the compiler API, so there is no reactDocgen option or docgen tsconfig.
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
