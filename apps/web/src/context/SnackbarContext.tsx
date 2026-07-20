import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react'
import Snackbar from '@mui/material/Snackbar'
import Alert from '@mui/material/Alert'
import AlertTitle from '@mui/material/AlertTitle'
import { setOnApiError } from '../services/api'

type Severity = 'error' | 'warning' | 'info' | 'success'

interface SnackbarState {
  open: boolean
  message: string
  severity: Severity
  title?: string
}

interface SnackbarContextType {
  showSnackbar: (message: string, severity?: Severity, title?: string) => void
}

const SnackbarContext = createContext<SnackbarContextType>({ showSnackbar: () => {} })

export const useSnackbar = () => useContext(SnackbarContext)

export function SnackbarProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SnackbarState>({ open: false, message: '', severity: 'info' })

  const showSnackbar = useCallback((message: string, severity: Severity = 'info', title?: string) => {
    setState({ open: true, message, severity, title })
  }, [])

  useEffect(() => {
    setOnApiError((message) => showSnackbar(message, 'error', 'Request failed'))
  }, [showSnackbar])

  const handleClose = useCallback((_?: React.SyntheticEvent | Event, reason?: string) => {
    if (reason === 'clickaway') return
    setState(prev => ({ ...prev, open: false }))
  }, [])

  return (
    <SnackbarContext.Provider value={{ showSnackbar }}>
      {children}
      <Snackbar open={state.open} autoHideDuration={6000} onClose={handleClose} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert onClose={handleClose} severity={state.severity} variant="filled" sx={{ width: '100%', minWidth: 300 }}>
          {state.title && <AlertTitle>{state.title}</AlertTitle>}
          {state.message}
        </Alert>
      </Snackbar>
    </SnackbarContext.Provider>
  )
}
