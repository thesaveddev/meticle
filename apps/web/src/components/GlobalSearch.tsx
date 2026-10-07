import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Dialog, DialogContent, Stack, Typography, Box, List, ListItemButton, ListItemIcon, ListItemText, InputBase, Chip,
} from '@mui/material'
import SearchIcon from '@mui/icons-material/Search'
import PersonIcon from '@mui/icons-material/Person'
import BadgeIcon from '@mui/icons-material/Badge'
import EventIcon from '@mui/icons-material/Event'
import MedicationIcon from '@mui/icons-material/Medication'
import api from '../services/api'

/**
 * Global search palette (brief §13). ⌘K / Ctrl-K anywhere in the shell.
 *
 * Scoped deliberately to the two directories that are cheap and reliably
 * queryable — people and staff — plus deep links into the module pages.
 * Results are grouped so the palette reads as navigation, not a data dump.
 */

type ResultKind = 'PEOPLE' | 'STAFF' | 'PAGES'

interface SearchHit {
  kind: ResultKind
  title: string
  subtitle?: string
  path: string
}

const KIND_ORDER: ResultKind[] = ['PEOPLE', 'STAFF', 'PAGES']

const KIND_ICON: Record<ResultKind, React.ReactNode> = {
  PEOPLE: <PersonIcon fontSize="small" />,
  STAFF: <BadgeIcon fontSize="small" />,
  PAGES: <EventIcon fontSize="small" />,
}

const QUICK_PAGES: SearchHit[] = [
  { kind: 'PAGES', title: 'Dashboard', subtitle: 'Overview of today', path: '/dashboard' },
  { kind: 'PAGES', title: 'People', subtitle: 'People you support', path: '/people' },
  { kind: 'PAGES', title: 'Care Notes', subtitle: 'Daily records', path: '/my-week' },
  { kind: 'PAGES', title: 'Medications', subtitle: 'eMAR', path: '/medications' },
  { kind: 'PAGES', title: 'Rota Planner', subtitle: 'Shifts and staffing', path: '/scheduling' },
  { kind: 'PAGES', title: 'Appointments', subtitle: 'Upcoming bookings', path: '/appointments' },
  { kind: 'PAGES', title: 'Incidents', subtitle: 'Safety events', path: '/incidents' },
  { kind: 'PAGES', title: 'Reports', subtitle: 'Operational insight', path: '/reports' },
  { kind: 'PAGES', title: 'Settings', subtitle: 'Organisation setup', path: '/settings' },
]

export default function GlobalSearch({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [people, setPeople] = useState<any[]>([])
  const [staff, setStaff] = useState<any[]>([])
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    setQuery('')
    // Warm the two directories once per open; both endpoints are already used
    // by their pages, so this adds no new API surface.
    api.get('/people', { params: { status: 'active' } }).then((r: { data: any }) => setPeople(Array.isArray(r.data) ? r.data : r.data?.people || [])).catch(() => setPeople([]))
    api.get('/staff/org-members').then((r: { data: any }) => setStaff(Array.isArray(r.data) ? r.data : r.data?.staff || r.data?.members || [])).catch(() => setStaff([]))
    const t = setTimeout(() => inputRef.current?.focus(), 50)
    return () => clearTimeout(t)
  }, [open])

  const results = useMemo<SearchHit[]>(() => {
    const q = query.trim().toLowerCase()
    const pages = QUICK_PAGES.filter(p => !q || p.title.toLowerCase().includes(q))
    if (!q) return [...pages].slice(0, 9)
    const peopleHits: SearchHit[] = people
      .filter(p => `${p.first_name || ''} ${p.last_name || ''}`.toLowerCase().includes(q))
      .slice(0, 5)
      .map(p => ({ kind: 'PEOPLE' as const, title: `${p.first_name} ${p.last_name}`.trim(), subtitle: p.room_number ? `Room ${p.room_number}` : 'Person supported', path: `/people/${p.id}` }))
    const staffHits: SearchHit[] = staff
      .filter(s => `${s.first_name || ''} ${s.last_name || ''}`.toLowerCase().includes(q))
      .slice(0, 5)
      .map(s => ({ kind: 'STAFF' as const, title: `${s.first_name || ''} ${s.last_name || ''}`.trim() || s.email, subtitle: String(s.role || 'Staff member').replace(/_/g, ' ').toLowerCase(), path: s.id ? `/staff/${s.id}` : '/staff' }))
    return [...peopleHits, ...staffHits, ...pages]
  }, [query, people, staff])

  const grouped = useMemo(() => {
    const g: Partial<Record<ResultKind, SearchHit[]>> = {}
    for (const r of results) (g[r.kind] ||= []).push(r)
    return KIND_ORDER.filter(k => g[k]?.length).map(k => [k, g[k]!] as const)
  }, [results])

  const go = (path: string) => { onClose(); navigate(path) }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="sm"
      PaperProps={{ sx: { borderRadius: 'var(--radius-lg)', border: '1px solid var(--mc-border)', backgroundImage: 'none' } }}
      aria-label="Global search"
    >
      <Stack direction="row" alignItems="center" spacing={1.5} sx={{ px: 2.5, pt: 2, pb: 1.5, borderBottom: '1px solid var(--mc-border)' }}>
        <SearchIcon fontSize="small" sx={{ color: 'text.secondary' }} />
        <InputBase
          inputRef={inputRef}
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search people, staff, pages…"
          sx={{ flex: 1, fontSize: 'var(--font-md)' }}
          inputProps={{ 'aria-label': 'Search people, staff and pages' }}
          onKeyDown={e => {
            if (e.key === 'Enter' && results[0]) { e.preventDefault(); go(results[0].path) }
          }}
        />
        <Chip label="esc" size="small" sx={{ height: 20, fontSize: 'var(--font-xs)', color: 'text.secondary' }} />
      </Stack>
      <DialogContent sx={{ p: 1, minHeight: 120 }}>
        {grouped.length === 0 ? (
          <Box sx={{ py: 5, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">No matches for “{query}”</Typography>
          </Box>
        ) : (
          grouped.map(([kind, hits]) => (
            <Box key={kind} sx={{ mb: 1 }}>
              <Typography variant="overline" sx={{ px: 1.5, color: 'text.secondary', letterSpacing: 1, fontSize: 'var(--font-xs)' }}>
                {kind}
              </Typography>
              <List disablePadding>
                {hits.map(hit => (
                  <ListItemButton key={`${hit.kind}-${hit.path}-${hit.title}`} onClick={() => go(hit.path)} sx={{ borderRadius: 'var(--radius-md)', py: 0.75 }}>
                    <ListItemIcon sx={{ minWidth: 34, color: 'text.secondary' }}>{KIND_ICON[hit.kind]}</ListItemIcon>
                    <ListItemText
                      primary={hit.title}
                      secondary={hit.subtitle}
                      primaryTypographyProps={{ fontSize: 'var(--font-md)', fontWeight: 600 }}
                      secondaryTypographyProps={{ fontSize: 'var(--font-sm)' }}
                    />
                    {hit.kind === 'PAGES' && hit.title === 'Medications' && <MedicationIcon fontSize="small" sx={{ color: 'text.disabled' }} />}
                  </ListItemButton>
                ))}
              </List>
            </Box>
          ))
        )}
      </DialogContent>
    </Dialog>
  )
}
