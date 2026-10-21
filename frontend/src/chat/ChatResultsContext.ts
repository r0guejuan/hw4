import { createContext, useContext } from 'react'
import type { PageResults } from '../types'

export interface ChatResultsState {
  /** The latest set of products the chat put on the page, or null to show the normal catalogue. */
  results: PageResults | null
  showResults: (results: PageResults) => void
  clearResults: () => void
}

export const ChatResultsContext = createContext<ChatResultsState | null>(null)

export function useChatResults(): ChatResultsState {
  const ctx = useContext(ChatResultsContext)
  if (!ctx) throw new Error('useChatResults must be used inside <ChatResultsProvider>')
  return ctx
}
