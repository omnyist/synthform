import { create } from 'storybook/theming'

// Storybook's own chrome and its docs pages, in the overlays' dark. The values are the shark
// palette from src/index.css: --color-shark-960 (the chyron), -920, -880 and -760.
export const synthformTheme = create({
  base: 'dark',
  appBg: '#090a0c',
  appContentBg: '#121417',
  appPreviewBg: '#121417',
  barBg: '#121417',
  appBorderColor: '#353d46',
})
