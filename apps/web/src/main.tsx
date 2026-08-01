import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import ErrorBoundary from './components/ErrorBoundary'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeModeProvider } from './context/ThemeContext'
import { SnackbarProvider } from './context/SnackbarContext'
import './index.css'

const queryClient = new QueryClient()

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
