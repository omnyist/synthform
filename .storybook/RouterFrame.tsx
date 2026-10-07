import { createContext, useContext, useState, type ReactNode } from 'react'
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'

const StoryContext = createContext<ReactNode>(null)

function CurrentStory() {
  return useContext(StoryContext)
}

// Components render <Link>, which throws without a router above it.
export function RouterFrame({ children }: { children: ReactNode }) {
  const [router] = useState(() =>
    createRouter({
      routeTree: createRootRoute({ component: CurrentStory, notFoundComponent: CurrentStory }),
      history: createMemoryHistory({ initialEntries: ['/'] }),
    }),
  )
  return (
    <StoryContext.Provider value={children}>
      <RouterProvider router={router} />
    </StoryContext.Provider>
  )
}
