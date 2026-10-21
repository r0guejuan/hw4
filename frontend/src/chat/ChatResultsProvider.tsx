import { useMemo, useState, type ReactNode } from 'react'
import type { PageResults } from '../types'
import { ChatResultsContext, type ChatResultsState } from './ChatResultsContext'

// Kept in sessionStorage so the results survive a page refresh and back/forward navigation.
const STORAGE_KEY = 'campus-customs:chat-results'

function load(): PageResults | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as PageResults) : null
  } catch {
    return null
  }
}

function save(results: PageResults | null) {
  try {
    if (results) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(results))
    else sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    // Storage can be unavailable (private mode); results still work for this page view.
  }
}

/** Holds the products the chat asked the site to display, shared by the chat and the Products page. */
export default function ChatResultsProvider({ children }: { children: ReactNode }) {
  const [results, setResults] = useState<PageResults | null>(load)

  const value = useMemo<ChatResultsState>(
    () => ({
      results,
      showResults: (r) => {
        save(r)
        setResults(r)
      },
      clearResults: () => {
        save(null)
        setResults(null)
      },
    }),
    [results],
  )

  return <ChatResultsContext.Provider value={value}>{children}</ChatResultsContext.Provider>
}
