import { addons } from 'storybook/manager-api'
import { synthformTheme } from './theme'

addons.setConfig({
  theme: {
    ...synthformTheme,
    brandTitle: 'synthform',
  },
})
