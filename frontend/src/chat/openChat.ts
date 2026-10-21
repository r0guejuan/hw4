export const OPEN_CHAT_EVENT = 'campus-customs:open-chat'

/** Open the chat from anywhere on the site, optionally sending a question right away. */
export function openChat(prompt?: string) {
  window.dispatchEvent(new CustomEvent(OPEN_CHAT_EVENT, { detail: { prompt } }))
}
