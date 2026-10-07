import type { Preview } from '@storybook/react-vite'

import { useRealtimeStore } from '../src/store/realtime'
import { RouterFrame } from './RouterFrame'
import { synthformTheme } from './theme'
import '../src/index.css'

const preview: Preview = {
  tags: ['autodocs'],
  // The overlays sit on the chyron's shark-960, never on white, so the stories do too. It is a
  // real element rather than the backgrounds toolbar so the accessibility checks measure contrast
  // against it.
  decorators: [
    (Story) => (
      <RouterFrame>
        <div className="bg-shark-960 p-6">
          <Story />
        </div>
      </RouterFrame>
    ),
  ],
  // Most overlay components read the realtime store rather than props, and a story seeds it in its
  // own beforeEach. Every story starts from the store's initial state, so nothing one story seeds
  // leaks into the next.
  beforeEach: () => {
    useRealtimeStore.setState(useRealtimeStore.getInitialState(), true)
  },
  parameters: {
    backgrounds: {
      options: {
        shark: { name: 'shark-960', value: '#090a0c' },
        light: { name: 'light', value: '#f7f7f7' },
      },
    },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    docs: {
      theme: synthformTheme,
      toc: true,
    },
    a11y: {
      test: 'error',
    },
  },
  initialGlobals: {
    backgrounds: {
      value: 'shark',
    },
  },
}

export default preview
