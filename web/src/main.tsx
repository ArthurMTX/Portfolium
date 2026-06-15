import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/app/App'
import '@/styles.css'
import '@/app/i18n'
import '@/registerSW'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
