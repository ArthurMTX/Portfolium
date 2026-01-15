import { registerSW } from 'virtual:pwa-register'

// Register service worker with automatic reload prompt
const updateSW = registerSW({
  onNeedRefresh() {
    // Show a prompt to user to reload the app
    if (confirm('New content available. Reload?')) {
      updateSW(true)
    }
  },
  onOfflineReady() {
    console.log('App ready to work offline')
  },
  immediate: true
})

export { updateSW }
