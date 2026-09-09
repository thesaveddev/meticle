import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import ErrorBoundary from './components/ErrorBoundary'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeModeProvider } from './context/ThemeContext'
import { SnackbarProvider } from './context/SnackbarContext'
import { registerSW } from 'virtual:pwa-register'
import './index.css'

const queryClient = new QueryClient()

// Register the custom Workbox service worker so it can receive browser push
// events as well as manage the existing offline cache.
if (!import.meta.env.SSR) registerSW({ immediate: true })

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ThemeModeProvider>
          <BrowserRouter>
            <SnackbarProvider>
              <App />
            </SnackbarProvider>
          </BrowserRouter>
        </ThemeModeProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  </React.StrictMode>,
)
