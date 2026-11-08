// The board's service worker (docs/features/decision-notifications.md). It only receives decision
// notifications and opens them: no caching, no offline, no Firebase SDK. A classic script.
//
// The desktop agent sends a data-only web push through Firebase Cloud Messaging, so the payload is
// FCM's `{ data: { title, body, tag, url } }`. It is untrusted: only non-empty strings are shown,
// and the url is used only when it is a same-origin path.
'use strict'

const OPEN_TASK_MESSAGE = 'kanban:open-task'

const isText = (value) => typeof value === 'string' && value !== ''

// A path on this site ("/…", never "//host"), else the board's home.
const safePath = (url) => (isText(url) && url.startsWith('/') && !url.startsWith('//') ? url : '/')

function readNotice(event) {
  if (!event.data) return null
  let payload
  try {
    payload = event.data.json()
  } catch {
    return null // not JSON: nothing to show
  }
  const data = payload !== null && typeof payload === 'object' ? payload.data : null
  if (data === null || typeof data !== 'object') return null
  const { title, body, tag, url } = data
  if (!isText(title) || !isText(body) || !isText(tag)) return null
  return { title, body, tag, url: safePath(url) }
}

self.addEventListener('push', (event) => {
  const notice = readNotice(event)
  if (!notice) return
  event.waitUntil(
    self.registration.showNotification(notice.title, {
      body: notice.body,
      tag: notice.tag, // one notification per task: a later decision replaces it
      renotify: true,
      data: { url: notice.url },
    })
  )
})

const sameOrigin = (client) => new URL(client.url).origin === self.location.origin

async function openBoard(url) {
  const tabs = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
  const tab = tabs.find(sameOrigin)
  if (!tab) return self.clients.openWindow(url)
  const taskId = new URL(url, self.location.origin).searchParams.get('task')
  await tab.focus()
  if (taskId) tab.postMessage({ type: OPEN_TASK_MESSAGE, taskId })
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const stored = event.notification.data
  event.waitUntil(openBoard(safePath(stored && stored.url)))
})
