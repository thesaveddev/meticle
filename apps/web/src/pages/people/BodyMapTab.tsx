import { useRef, useState } from 'react'
import {
  Box, Typography, Paper, Stack, Chip, Button, CircularProgress, Alert,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem,
  IconButton, Tabs, Tab,
} from '@mui/material'
import { Delete as DeleteIcon } from '@mui/icons-material'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../../services/api'
import { ConfirmDialog, SectionHeader, EmptyRow } from '../../components/ui'
import bodyMapUrl from './body-map.svg'

const CONDITION_COLORS: Record<string, string> = {
  bruise: '#7C3AED', wound: '#DC2626', rash: '#D97706', injection: '#0F4C81',
  burn: '#EF4444', pressure_sore: '#DC2626', scar: '#6B7280', swelling: '#F59E0B',
  skin_tear: '#DC2626', other: '#6B7280',
}
const SEVERITY_COLORS: Record<string, string> = { mild: '#16A34A', moderate: '#D97706', severe: '#DC2626' }
const STATUS_COLORS: Record<string, string> = { active: '#DC2626', healing: '#D97706', resolved: '#16A34A' }

const VB = '0 0 155 360'
const BODY_W = 155; const BODY_H = 360
const IMG_W = 310; const IMG_H = 360

/* ── Human body silhouette — Wikimedia "Human silhouette gender neutral" (public domain) ──
   Single 310x360 SVG containing two figures side by side: front (x 0-155) and back (x 155-310).
   The active view crops to one half via an <image> offset; zones are in a 155x360 space. ── */

/* ── Clickable zones — 60+ invisible hit areas covering every body part ──
   Coordinates are in a 155x360 space. Front zones overlay the image's left half
   (front figure, x 0-155); back zones overlay its right half (x 155-310).
   Zones are drawn transparent so nothing overlays the silhouette; a floating
   label follows the cursor on hover. */
interface Zone { id: string; label: string; points: string }

const ALL_ZONES: Zone[] = [
  // Head & Face (front)
  { id: 'head', label: 'Head / Face', points: '62,24 95,24 95,55 88,60 79,62 70,60 62,55' },
  { id: 'forehead', label: 'Forehead', points: '64,24 93,24 93,42 64,42' },
  { id: 'left_eye', label: 'L Eye / Temple', points: '62,42 78,42 78,50 62,50' },
  { id: 'right_eye', label: 'R Eye / Temple', points: '79,42 95,42 95,50 79,50' },
  { id: 'jaw_chin', label: 'Jaw / Chin', points: '63,50 94,50 90,60 79,62 66,60' },
  { id: 'left_ear', label: 'L Ear', points: '58,30 63,30 63,50 58,50' },
  { id: 'right_ear', label: 'R Ear', points: '94,30 99,30 99,50 94,50' },
  { id: 'neck', label: 'Neck', points: '63,60 94,60 94,72 63,72' },

  // Torso — front
  { id: 'left_shoulder', label: 'L Shoulder', points: '38,70 62,70 62,100 40,100' },
  { id: 'right_shoulder', label: 'R Shoulder', points: '94,70 119,70 119,100 95,100' },
  { id: 'left_collarbone', label: 'L Collarbone', points: '63,70 79,70 78,84 63,84' },
  { id: 'right_collarbone', label: 'R Collarbone', points: '79,70 94,70 94,84 79,84' },
  { id: 'chest_upper', label: 'Upper Chest', points: '46,90 113,90 113,125 46,125' },
  { id: 'left_chest', label: 'L Chest', points: '46,90 79,95 78,125 46,125' },
  { id: 'right_chest', label: 'R Chest', points: '79,95 113,90 113,125 78,125' },
  { id: 'chest_lower', label: 'Lower Chest', points: '46,125 113,125 113,155 46,155' },
  { id: 'left_ribs', label: 'L Ribs', points: '46,125 79,125 78,155 46,155' },
  { id: 'right_ribs', label: 'R Ribs', points: '79,125 113,125 113,155 78,155' },
  { id: 'upper_abdomen', label: 'Upper Abdomen', points: '47,155 112,155 112,180 47,180' },
  { id: 'lower_abdomen', label: 'Lower Abdomen', points: '46,180 113,180 112,200 48,200' },
  { id: 'navel', label: 'Navel', points: '70,165 88,165 88,178 70,178' },
  { id: 'groin', label: 'Groin', points: '55,196 103,196 100,212 58,212' },

  // Arms — Left front
  { id: 'left_upper_arm', label: 'L Upper Arm', points: '30,108 47,108 38,140 22,140' },
  { id: 'left_bicep', label: 'L Bicep', points: '30,108 47,108 45,124 30,124' },
  { id: 'left_tricep_back', label: 'L Tricep', points: '29,124 45,124 38,140 24,140' },
  { id: 'left_elbow', label: 'L Elbow', points: '22,140 38,140 30,158 19,158' },
  { id: 'left_forearm', label: 'L Forearm', points: '19,158 30,158 22,190 15,190' },
  { id: 'left_wrist', label: 'L Wrist', points: '15,190 22,190 22,198 16,198' },
  { id: 'left_hand', label: 'L Hand', points: '12,190 26,190 26,202 14,202' },
  { id: 'left_palm', label: 'L Palm', points: '14,190 26,190 26,198 15,198' },
  { id: 'left_fingers', label: 'L Fingers', points: '13,198 26,198 25,206 14,206' },
  { id: 'left_thumb', label: 'L Thumb', points: '8,192 14,192 14,202 9,202' },

  // Arms — Right front
  { id: 'right_upper_arm', label: 'R Upper Arm', points: '110,108 127,108 135,140 119,140' },
  { id: 'right_bicep', label: 'R Bicep', points: '110,108 127,108 127,124 112,124' },
  { id: 'right_tricep_back', label: 'R Tricep', points: '112,124 127,124 135,140 119,140' },
  { id: 'right_elbow', label: 'R Elbow', points: '119,140 135,140 138,158 127,158' },
  { id: 'right_forearm', label: 'R Forearm', points: '127,158 138,158 143,190 136,190' },
  { id: 'right_wrist', label: 'R Wrist', points: '136,190 143,190 143,198 137,198' },
  { id: 'right_hand', label: 'R Hand', points: '131,190 145,190 145,202 132,202' },
  { id: 'right_palm', label: 'R Palm', points: '135,190 145,190 145,198 136,198' },
  { id: 'right_fingers', label: 'R Fingers', points: '135,198 145,198 144,206 135,206' },
  { id: 'right_thumb', label: 'R Thumb', points: '145,192 152,192 152,202 146,202' },

  // Hips — front
  { id: 'left_hip', label: 'L Hip', points: '43,196 78,196 77,215 45,215' },
  { id: 'right_hip', label: 'R Hip', points: '79,196 114,196 113,215 81,215' },

  // Thighs — Left front
  { id: 'left_thigh_upper', label: 'L Upper Thigh', points: '44,200 77,200 76,240 47,240' },
  { id: 'left_thigh_mid', label: 'L Mid Thigh', points: '46,240 76,240 75,275 48,275' },
  { id: 'left_thigh_lower', label: 'L Lower Thigh', points: '48,275 75,275 64,300 52,300' },

  // Thighs — Right front
  { id: 'right_thigh_upper', label: 'R Upper Thigh', points: '80,200 114,200 113,240 81,240' },
  { id: 'right_thigh_mid', label: 'R Mid Thigh', points: '81,240 113,240 112,275 82,275' },
  { id: 'right_thigh_lower', label: 'R Lower Thigh', points: '84,275 111,275 105,300 93,300' },

  // Knees
  { id: 'left_knee', label: 'L Knee', points: '52,300 64,300 64,318 53,318' },
  { id: 'right_knee', label: 'R Knee', points: '93,300 105,300 105,318 93,318' },

  // Lower legs
  { id: 'left_shin_upper', label: 'L Upper Shin', points: '53,318 64,318 63,330 52,330' },
  { id: 'left_shin_lower', label: 'L Lower Shin', points: '52,330 63,330 62,340 53,340' },
  { id: 'right_shin_upper', label: 'R Upper Shin', points: '93,318 105,318 105,330 94,330' },
  { id: 'right_shin_lower', label: 'R Lower Shin', points: '94,330 105,330 104,340 95,340' },

  // Calves
  { id: 'left_calf', label: 'L Calf', points: '52,314 64,314 63,330 52,330' },
  { id: 'right_calf', label: 'R Calf', points: '93,314 105,314 105,330 93,330' },

  // Ankles & feet
  { id: 'left_ankle', label: 'L Ankle', points: '53,338 62,338 62,348 54,348' },
  { id: 'right_ankle', label: 'R Ankle', points: '95,338 104,338 104,348 96,348' },
  { id: 'left_heel', label: 'L Heel', points: '52,344 62,344 62,352 54,352' },
  { id: 'right_heel', label: 'R Heel', points: '95,344 104,344 104,352 96,352' },
  { id: 'left_foot_top', label: 'L Foot Top', points: '47,332 64,332 64,346 49,346' },
  { id: 'right_foot_top', label: 'R Foot Top', points: '90,332 107,332 107,346 93,346' },
  { id: 'left_toes', label: 'L Toes', points: '46,340 64,340 63,352 48,352' },
  { id: 'right_toes', label: 'R Toes', points: '90,340 107,340 106,352 92,352' },

  // Back zones
  { id: 'back_head', label: 'Back of Head', points: '59,24 92,24 92,55 85,60 76,62 66,60 59,55' },
  { id: 'back_neck', label: 'Back of Neck', points: '61,60 90,60 90,70 61,70' },
  { id: 'upper_back', label: 'Upper Back', points: '38,72 116,72 114,125 42,125' },
  { id: 'left_shoulder_blade', label: 'L Shoulder Blade', points: '42,88 78,92 77,125 44,125' },
  { id: 'right_shoulder_blade', label: 'R Shoulder Blade', points: '78,92 111,88 111,125 77,125' },
  { id: 'mid_back', label: 'Mid Back', points: '44,125 110,125 109,160 45,160' },
  { id: 'lower_back', label: 'Lower Back', points: '45,160 109,160 108,195 46,195' },
  { id: 'sacral', label: 'Sacral / Tailbone', points: '50,195 105,195 102,210 55,210' },
  { id: 'left_buttock', label: 'L Buttock', points: '40,196 75,196 74,215 43,215' },
  { id: 'right_buttock', label: 'R Buttock', points: '77,196 111,196 110,215 75,215' },
  { id: 'back_left_arm', label: 'L Arm Back', points: '27,108 44,108 42,180 13,180' },
  { id: 'back_right_arm', label: 'R Arm Back', points: '108,108 124,108 140,180 126,180' },
  { id: 'back_left_thigh', label: 'L Thigh Back', points: '40,196 75,196 73,300 49,300' },
  { id: 'back_right_thigh', label: 'R Thigh Back', points: '77,196 111,196 108,300 90,300' },
  { id: 'back_left_knee', label: 'L Knee Back', points: '50,300 62,300 62,320 51,320' },
  { id: 'back_right_knee', label: 'R Knee Back', points: '90,300 101,300 101,320 90,320' },
  { id: 'back_left_shin', label: 'L Shin Back', points: '51,320 62,320 61,340 50,340' },
  { id: 'back_right_shin', label: 'R Shin Back', points: '90,320 101,320 101,340 89,340' },
  { id: 'back_left_foot', label: 'L Foot Back', points: '45,328 62,328 62,342 48,342' },
  { id: 'back_right_foot', label: 'R Foot Back', points: '90,328 107,328 106,342 92,342' },
]

interface BodyMapEntry {
  id: string; body_view: 'front' | 'back'; body_zone: string;
  zone_x: number | null; zone_y: number | null; condition_type: string;
  description: string | null; severity: string; status: string;
  recorded_date: string; created_by_name: string | null;
}

const BACK_ZONE_IDS = new Set<string>([
  'back_head', 'back_neck', 'upper_back', 'left_shoulder_blade', 'right_shoulder_blade',
  'mid_back', 'lower_back', 'sacral', 'left_buttock', 'right_buttock',
  'back_left_arm', 'back_right_arm', 'back_left_thigh', 'back_right_thigh',
  'back_left_knee', 'back_right_knee', 'back_left_shin', 'back_right_shin',
  'back_left_foot', 'back_right_foot',
])
const BACK_ZONES = ALL_ZONES.filter(z => BACK_ZONE_IDS.has(z.id))
const FRONT_ZONES = ALL_ZONES.filter(z => !BACK_ZONE_IDS.has(z.id))

function zoneCenter(z: Zone): { cx: number; cy: number } {
  const nums = z.points.split(/[\s,]+/).map(Number)
  let sx = 0, sy = 0, n = 0
  for (let i = 0; i < nums.length - 1; i += 2) { sx += nums[i]; sy += nums[i + 1]; n++ }
  return { cx: Math.round(sx / n), cy: Math.round(sy / n) }
}

export default function BodyMapTab({ personId }: { personId: string }) {
  const qc = useQueryClient()
  const [view, setView] = useState<'front' | 'back'>('front')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedEntry, setSelectedEntry] = useState<BodyMapEntry | null>(null)
  const [selectedZone, setSelectedZone] = useState<Zone | null>(null)
  const [hoverZone, setHoverZone] = useState<string | null>(null)
  const [hoverPos, setHoverPos] = useState<{ x: number; y: number } | null>(null)
  const figureWrapRef = useRef<HTMLDivElement>(null)
  const onFigureMove = (ev: React.MouseEvent) => {
    const el = figureWrapRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    setHoverPos({ x: ev.clientX - r.left, y: ev.clientY - r.top })
  }
  const [form, setForm] = useState({ condition_type: 'bruise', severity: 'mild', description: '', recorded_date: new Date().toISOString().split('T')[0], status: 'active' as string })
  const [error, setError] = useState('')

  const { data: entries = [], isLoading } = useQuery<BodyMapEntry[]>({
    queryKey: ['body-map', personId],
    queryFn: () => api.get(`/people/${personId}/body-map`).then(r => r.data),
  })

  const createM = useMutation({
    mutationFn: (d: any) => api.post(`/people/${personId}/body-map`, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['body-map', personId] }); setDialogOpen(false) },
    onError: (err: any) => setError(err.response?.data?.message || 'Failed'),
  })
  const updateM = useMutation({
    mutationFn: (d: { id: string; p: any }) => api.patch(`/people/body-map/${d.id}`, d.p),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['body-map', personId] }); setDialogOpen(false) },
    onError: (err: any) => setError(err.response?.data?.message || 'Failed'),
  })
  const deleteM = useMutation({
    mutationFn: (id: string) => api.delete(`/people/body-map/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['body-map', personId] }); setDialogOpen(false); setDeleteTarget(null) },
    onError: () => setDeleteTarget(null),
  })
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)

  const openCreate = (z: Zone) => { setSelectedZone(z); setSelectedEntry(null); setForm({ condition_type: 'bruise', severity: 'mild', description: '', recorded_date: new Date().toISOString().split('T')[0], status: 'active' }); setError(''); setDialogOpen(true) }
  const openEdit = (e: BodyMapEntry) => { setSelectedEntry(e); setSelectedZone(null); setForm({ condition_type: e.condition_type, severity: e.severity, description: e.description || '', recorded_date: e.recorded_date, status: e.status }); setError(''); setDialogOpen(true) }

  const save = (ev: React.FormEvent) => {
    ev.preventDefault(); setError('')
    if (selectedEntry) updateM.mutate({ id: selectedEntry.id, p: form })
    else if (selectedZone) {
      const c = zoneCenter(selectedZone)
      createM.mutate({ body_view: view, body_zone: selectedZone.id, zone_x: c.cx, zone_y: c.cy, ...form })
    }
  }

  if (isLoading) return <Box sx={{ textAlign: 'center', py: 4 }}><CircularProgress /></Box>

  const viewEntries = entries.filter(e => e.body_view === view)
  const zones = view === 'front' ? FRONT_ZONES : BACK_ZONES
  const zoneCounts: Record<string, number> = {}
  viewEntries.forEach(e => { zoneCounts[e.body_zone] = (zoneCounts[e.body_zone] || 0) + 1 })

  return (
    <Box>
      <SectionHeader title="Body Map" action={<Chip label={`${entries.filter(e => e.status === 'active').length} Active`} size="small" color="error" variant="outlined" />} />

      <Paper sx={{ borderRadius: 2, border: '1px solid #E5E7EB', mb: 3, overflow: 'hidden' }}>
        <Tabs value={view} onChange={(_, v) => setView(v)} sx={{ borderBottom: 1, borderColor: '#E5E7EB' }}>
          <Tab value="front" label="Front View" sx={{ textTransform: 'none', fontWeight: 700 }} />
          <Tab value="back" label="Back View" sx={{ textTransform: 'none', fontWeight: 700 }} />
        </Tabs>
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', bgcolor: '#FAFBFC', py: 2, px: 1, position: 'relative' }}>
          <Typography variant="caption" color="#6B7280" sx={{ mb: 0.5 }}>
            Click any body part to add a condition
          </Typography>
          <Box ref={figureWrapRef} onMouseMove={onFigureMove}
            onMouseLeave={() => { setHoverZone(null); setHoverPos(null) }}
            sx={{ position: 'relative', lineHeight: 0 }}>
          <svg viewBox={VB} width={BODY_W * 1.7} height={BODY_H * 1.7} style={{ maxWidth: '100%', height: 'auto', display: 'block' }}>
            <defs>
              <filter id="bodyShadow" x="-10%" y="-10%" width="120%" height="130%">
                <feDropShadow dx={1} dy={1} stdDeviation={2} floodColor="#000" floodOpacity={0.08} />
              </filter>
            </defs>

            {/* Body silhouette — the 310x360 asset holds both figures; offset -155 shows the back half */}
            <g filter="url(#bodyShadow)">
              <image href={bodyMapUrl} x={view === 'back' ? -BODY_W : 0} y={0} width={IMG_W} height={IMG_H} />
            </g>

            {/* Spine (back only) */}
            {view === 'back' && (
              <path d="M75,85 L75,200" fill="none" stroke="#CBD5E1" strokeWidth={1.5} strokeDasharray="4 5" opacity={0.7} />
            )}

            {/* Clickable zones — invisible hit areas; nothing is drawn over the silhouette */}
            {zones.map(z => (
              <polygon key={z.id} points={z.points}
                fill={hoverZone === z.id ? 'rgba(15,76,129,0.07)' : 'transparent'}
                stroke="transparent" strokeWidth={0}
                style={{ cursor: 'pointer', transition: 'fill 0.12s ease' }}
                onMouseEnter={() => setHoverZone(z.id)}
                onMouseLeave={() => setHoverZone(null)}
                onClick={() => openCreate(z)}
              />
            ))}

            {/* Entry markers */}
            {viewEntries.map(e => {
              const zd = zones.find(z => z.id === e.body_zone)
              if (!zd) return null
              const c = zoneCenter(zd)
              const color = CONDITION_COLORS[e.condition_type] || '#6B7280'
              return (
                <g key={e.id} style={{ cursor: 'pointer' }} onClick={(ev) => { ev.stopPropagation(); openEdit(e) }}>
                  <circle cx={c.cx} cy={c.cy} r={13} fill={color} fillOpacity={0.12} stroke={color} strokeWidth={1.5} />
                  <circle cx={c.cx} cy={c.cy} r={6} fill={color} />
                  <text x={c.cx} y={c.cy - 18} textAnchor="middle" fontSize={9} fontWeight={800} fill={color}>
                    {e.condition_type.slice(0, 2).toUpperCase()}
                  </text>
                </g>
              )
            })}

            {/* Pulse ring */}
            {(() => {
              const latest = viewEntries.find(e => e.status === 'active')
              if (!latest) return null
              const zd = zones.find(z => z.id === latest.body_zone)
              if (!zd) return null
              const c = zoneCenter(zd)
              const color = CONDITION_COLORS[latest.condition_type] || '#6B7280'
              return <circle cx={c.cx} cy={c.cy} r={13} fill="none" stroke={color} strokeWidth={1.5} opacity={0.5}>
                <animate attributeName="r" from={10} to={22} dur="2s" repeatCount="indefinite" />
                <animate attributeName="opacity" from={0.5} to={0} dur="2s" repeatCount="indefinite" />
              </circle>
            })()}
          </svg>

          {/* Floating zone label — follows the cursor, never drawn over the body */}
          {hoverZone && hoverPos && (() => {
            const z = zones.find(zz => zz.id === hoverZone)
            if (!z) return null
            const wrapW = figureWrapRef.current?.clientWidth ?? 260
            const left = Math.min(Math.max(hoverPos.x + 14, 0), Math.max(wrapW - 130, 0))
            const top = Math.max(hoverPos.y - 34, 4)
            return (
              <Box sx={{ position: 'absolute', left, top, zIndex: 5, pointerEvents: 'none',
                bgcolor: '#0F4C81', color: '#fff', px: 1, py: 0.5, borderRadius: '6px',
                fontSize: '0.7rem', fontWeight: 700, whiteSpace: 'nowrap',
                boxShadow: '0 2px 8px rgba(11,44,81,0.25)' }}>
                {z.label}
              </Box>
            )
          })()}
        </Box>
        </Box>

        {/* Legend */}
        <Box sx={{ p: 1.5, borderTop: '1px solid #E5E7EB', bgcolor: '#F8FAFC', display: 'flex', flexWrap: 'wrap', gap: 0.5, justifyContent: 'center' }}>
          {zones.map(z => {
            const has = zoneCounts[z.id]
            return <Chip key={z.id} label={`${z.label}${has ? ` (${has})` : ''}`}
              size="small" variant="outlined" sx={{ fontSize: '0.58rem', height: 20, cursor: 'pointer', '&:hover': { bgcolor: '#0F4C8110' } }}
              onMouseEnter={() => setHoverZone(z.id)} onMouseLeave={() => setHoverZone(null)}
            />
          })}
        </Box>
      </Paper>

      {/* Entries list */}
      {entries.length === 0 ? (
        <EmptyRow message="No body map entries yet. Click a body zone above to add one." />
      ) : (
        <Stack spacing={1.5}>
          {entries.map(e => (
            <Paper key={e.id} onClick={() => openEdit(e)}
              sx={{ p: 2, borderRadius: 2, border: '1px solid #E5E7EB', borderLeft: 4, borderLeftColor: CONDITION_COLORS[e.condition_type] || '#6B7280', cursor: 'pointer' }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Stack direction="row" spacing={1} alignItems="center">
                  <Chip label={e.condition_type.replace(/_/g, ' ')} size="small"
                    sx={{ bgcolor: `${CONDITION_COLORS[e.condition_type] || '#6B7280'}20`, color: CONDITION_COLORS[e.condition_type] || '#6B7280', fontWeight: 700, textTransform: 'capitalize' }} />
                  <Chip label={e.severity} size="small"
                    sx={{ bgcolor: `${SEVERITY_COLORS[e.severity] || '#6B7280'}20`, color: SEVERITY_COLORS[e.severity] || '#6B7280', fontWeight: 600, textTransform: 'capitalize' }} />
                  <Chip label={e.status} size="small" variant="outlined"
                    color={e.status === 'active' ? 'error' : e.status === 'healing' ? 'warning' : 'success'} sx={{ textTransform: 'capitalize' }} />
                </Stack>
                <Typography variant="caption" color="#6B7280">{e.recorded_date ? new Date(e.recorded_date + 'T00:00:00').toLocaleDateString('en-GB') : ''}</Typography>
              </Stack>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mt: 0.5 }}>
                <Typography variant="body2" fontWeight={600} color="#374151" sx={{ textTransform: 'capitalize' }}>{e.body_zone?.replace(/_/g, ' ')}</Typography>
                {e.created_by_name && <Typography variant="caption" color="#9CA3AF">{e.created_by_name}</Typography>}
              </Stack>
              {e.description && <Typography variant="body2" color="#6B7280" sx={{ mt: 0.5, fontStyle: 'italic' }}>{e.description}</Typography>}
            </Paper>
          ))}
        </Stack>
      )}

      {/* Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <Box component="form" onSubmit={save}>
          <DialogTitle sx={{ fontWeight: 800 }}>{selectedEntry ? 'Edit Entry' : `New — ${selectedZone?.label || ''}`}</DialogTitle>
          <DialogContent>
            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
            <Stack spacing={2} sx={{ mt: 1 }}>
              <Stack direction="row" spacing={1}>
                <TextField select label="Condition" fullWidth required value={form.condition_type}
                  onChange={e => setForm(f => ({ ...f, condition_type: e.target.value }))}>
                  {Object.entries(CONDITION_COLORS).map(([k]) => <MenuItem key={k} value={k} sx={{ textTransform: 'capitalize' }}>{k.replace(/_/g, ' ')}</MenuItem>)}
                </TextField>
                <TextField select label="Severity" fullWidth value={form.severity}
                  onChange={e => setForm(f => ({ ...f, severity: e.target.value }))}>
                  {Object.entries(SEVERITY_COLORS).map(([k]) => <MenuItem key={k} value={k} sx={{ textTransform: 'capitalize' }}>{k}</MenuItem>)}
                </TextField>
              </Stack>
              <TextField label="Description" fullWidth multiline rows={3} value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Size, colour, shape, treatment..." />
              <Stack direction="row" spacing={1}>
                <TextField label="Date" type="date" fullWidth InputLabelProps={{ shrink: true }} value={form.recorded_date}
                  onChange={e => setForm(f => ({ ...f, recorded_date: e.target.value }))} />
                {selectedEntry && (
                  <TextField select label="Status" fullWidth value={form.status}
                    onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                    {Object.entries(STATUS_COLORS).map(([k]) => <MenuItem key={k} value={k} sx={{ textTransform: 'capitalize' }}>{k}</MenuItem>)}
                  </TextField>
                )}
              </Stack>
            </Stack>
          </DialogContent>
          <DialogActions sx={{ p: 3 }}>
            {selectedEntry && <IconButton onClick={() => setDeleteTarget(selectedEntry.id)} color="error" sx={{ mr: 'auto' }}><DeleteIcon /></IconButton>}
            <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={createM.isPending || updateM.isPending} sx={{ bgcolor: '#0F4C81', textTransform: 'none' }}>
              {createM.isPending || updateM.isPending ? <CircularProgress size={20} /> : 'Save'}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>
      <ConfirmDialog open={!!deleteTarget} title="Delete body map entry" message="This will permanently remove this body map entry." onCancel={() => setDeleteTarget(null)} onConfirm={() => { if (deleteTarget) deleteM.mutate(deleteTarget) }} />
    </Box>
  )
}
