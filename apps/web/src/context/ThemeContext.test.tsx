import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ThemeModeProvider, useThemeMode, STORAGE_KEY_ZOOM, DEFAULT_ZOOM, ZOOM_OPTIONS } from './ThemeContext'

function Probe() {
  const { zoomScale, setZoomScale } = useThemeMode()
  return (
    <div>
      <span data-testid="zoom">{zoomScale}</span>
      <button onClick={() => setZoomScale(1.5)}>set 1.5</button>
      <button onClick={() => setZoomScale(0.85)}>set 0.85</button>
    </div>
  )
}

function renderProvider() {
  return render(
    <ThemeModeProvider>
      <Probe />
    </ThemeModeProvider>
  )
}

function appliedZoom() {
  const root = document.documentElement
  return {
    cssVar: root.style.getPropertyValue('--app-zoom'),
    zoomProp: (root.style as any).zoom as string,
  }
}

describe('ThemeModeProvider zoom scale', () => {
  beforeEach(() => {
    window.localStorage.clear()
    document.documentElement.style.removeProperty('--app-zoom')
    ;(document.documentElement.style as any).zoom = ''
  })

  it('applies the default zoom and persists it on mount', () => {
    renderProvider()
    expect(screen.getByTestId('zoom')).toHaveTextContent(String(DEFAULT_ZOOM))
    expect(appliedZoom().cssVar).toBe(String(DEFAULT_ZOOM))
    expect(appliedZoom().zoomProp).toBe(String(DEFAULT_ZOOM))
    expect(window.localStorage.getItem(STORAGE_KEY_ZOOM)).toBe(String(DEFAULT_ZOOM))
  })

  it('loads a valid stored zoom preference from localStorage', () => {
    window.localStorage.setItem(STORAGE_KEY_ZOOM, '1.25')
    renderProvider()
    expect(screen.getByTestId('zoom')).toHaveTextContent('1.25')
    expect(appliedZoom().cssVar).toBe('1.25')
    expect(appliedZoom().zoomProp).toBe('1.25')
  })

  it('falls back to the default when the stored value is not a valid zoom option', () => {
    window.localStorage.setItem(STORAGE_KEY_ZOOM, '0.5')
    renderProvider()
    expect(screen.getByTestId('zoom')).toHaveTextContent(String(DEFAULT_ZOOM))
    expect(appliedZoom().cssVar).toBe(String(DEFAULT_ZOOM))
  })

  it('updates the CSS zoom and persists when setZoomScale is called', () => {
    renderProvider()
    fireEvent.click(screen.getByText('set 1.5'))
    expect(screen.getByTestId('zoom')).toHaveTextContent('1.5')
    expect(appliedZoom().cssVar).toBe('1.5')
    expect(appliedZoom().zoomProp).toBe('1.5')
    expect(window.localStorage.getItem(STORAGE_KEY_ZOOM)).toBe('1.5')

    fireEvent.click(screen.getByText('set 0.85'))
    expect(screen.getByTestId('zoom')).toHaveTextContent('0.85')
    expect(appliedZoom().cssVar).toBe('0.85')
    expect(window.localStorage.getItem(STORAGE_KEY_ZOOM)).toBe('0.85')
  })

  it('exposes every zoom option the UI offers as a valid loadable value', () => {
    for (const z of ZOOM_OPTIONS) {
      window.localStorage.setItem(STORAGE_KEY_ZOOM, String(z))
      const { unmount } = renderProvider()
      expect(screen.getByTestId('zoom')).toHaveTextContent(String(z))
      unmount()
    }
  })
})
