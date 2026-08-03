import { useState } from 'react'
import {
  Box, Typography, Paper, Stack, Chip, Button, CircularProgress, Alert,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem,
  IconButton, Tabs, Tab,
} from '@mui/material'
import { Delete as DeleteIcon } from '@mui/icons-material'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../../services/api'

const CONDITION_COLORS: Record<string, string> = {
  bruise: '#7C3AED', wound: '#DC2626', rash: '#D97706', injection: '#0F4C81',
  burn: '#EF4444', pressure_sore: '#DC2626', scar: '#6B7280', swelling: '#F59E0B',
  skin_tear: '#DC2626', other: '#6B7280',
}
const SEVERITY_COLORS: Record<string, string> = { mild: '#16A34A', moderate: '#D97706', severe: '#DC2626' }
const STATUS_COLORS: Record<string, string> = { active: '#DC2626', healing: '#D97706', resolved: '#16A34A' }

const VB = '0 0 250 600'
const BODY_W = 250; const BODY_H = 600

/* ── Human body silhouette — front view, 8-head proportion ── */
const FRONT_BODY_PATH = [
  // Head (oval)
  'M130,5 C155,5 165,22 163,40 C162,52 152,60 140,66 L130,75',
  // Neck right
  'L135,82',
  // Right shoulder out
  'C155,84 180,88 200,94',
  // Right upper arm down
  'C208,98 212,120 210,145',
  // Right elbow area
  'C208,168 205,185 202,202',
  // Right forearm down
  'C199,220 195,245 192,265',
  // Right wrist
  'C190,275 188,280 186,284',
  // Right hand
  'C184,290 180,293 178,290 C176,287 178,284 180,280',
  // Right palm
  'C182,276 182,270 182,262',
  // Right inner arm up
  'C180,248 178,228 176,210',
  'C174,192 172,175 170,160',
  'C166,138 160,118 150,104',
  // Right armpit to chest
  'C148,100 150,108 154,118',
  // Right chest
  'C158,132 162,150 162,168',
  // Right waist
  'C162,185 158,200 155,215',
  // Right hip
  'C155,230 158,245 160,258',
  // Right thigh outer
  'C162,278 165,310 165,345',
  // Right knee
  'C165,358 163,370 158,382',
  // Right shin
  'C155,395 152,420 148,450',
  // Right calf
  'C144,470 140,485 140,495',
  // Right ankle
  'C140,505 138,512 136,518',
  // Right foot
  'C134,526 132,535 130,540 L120,540 C118,535 118,528 120,518',
  // Right foot inner
  'C122,510 124,502 125,495',
  // Right shin inner
  'C126,470 130,445 134,420',
  // Right knee inner
  'C136,400 136,390 134,382',
  // Right thigh inner
  'C132,360 130,335 128,310',
  'C125,290 123,270 122,255',
  'C120,248 116,243 110,240',
  // Crotch
  'C105,238 100,238 95,240',
  // Left inner thigh
  'C88,243 83,248 80,255',
  'C78,270 75,290 72,310',
  'C70,335 68,360 66,382',
  // Left knee inner
  'C64,390 64,400 66,420',
  // Left shin inner
  'C70,442 74,465 76,490',
  // Left foot inner
  'C77,500 78,508 78,516',
  // Left foot
  'C78,524 78,533 80,540 L68,540',
  // Left foot outer
  'C66,535 66,528 64,520',
  // Left ankle outer
  'C62,510 60,500 58,488',
  // Left shin outer
  'C54,468 50,442 45,420',
  // Left knee outer
  'C40,400 38,385 38,368',
  // Left thigh outer
  'C40,345 38,318 38,288',
  // Left hip
  'C38,258 40,240 44,225',
  // Left waist
  'C42,210 38,195 38,178',
  // Left chest
  'C38,160 42,138 45,120',
  // Left armpit
  'C50,108 54,100 56,96',
  // Left arm inner
  'C52,106 48,120 44,140',
  'C40,160 38,178 36,195',
  'C34,215 32,235 30,255',
  'C28,272 26,282 24,288',
  // Left hand
  'C22,292 18,295 16,292 C14,289 16,284 18,280',
  // Left wrist
  'C20,275 22,260 24,245',
  // Left forearm outer
  'C22,228 20,208 18,190',
  // Left arm outer
  'C15,170 12,150 10,130',
  'C8,112 6,100 8,90',
  // Left shoulder
  'C12,84 30,80 50,78',
  // Left shoulder to neck
  'C78,76 100,75 125,74',
  // Left neck
  'L130,66 C120,60 110,52 105,40 C100,25 105,5 130,5 Z',
].join(' ')

// Back view uses same silhouette, differentiated by styling

/* ── Clickable zone polygons — 60+ zones covering every body part ── */
interface Zone { id: string; label: string; points: string }

const ALL_ZONES: Zone[] = [
  // Head & Face (front)
  { id: 'head', label: 'Head / Face', points: '105,5 155,5 155,55 143,62 132,70 120,60 105,50' },
  { id: 'forehead', label: 'Forehead', points: '108,5 152,5 152,28 108,28' },
  { id: 'left_eye', label: 'L Eye / Temple', points: '105,28 130,28 130,44 108,44' },
  { id: 'right_eye', label: 'R Eye / Temple', points: '130,28 155,28 155,44 130,44' },
  { id: 'jaw_chin', label: 'Jaw / Chin', points: '108,44 152,44 148,58 130,68 112,58' },
  { id: 'left_ear', label: 'L Ear', points: '100,28 108,28 108,44 100,44' },
  { id: 'right_ear', label: 'R Ear', points: '152,28 160,28 160,44 152,44' },
  { id: 'neck', label: 'Neck', points: '115,70 140,70 138,84 118,84' },

  // Torso — front
  { id: 'left_shoulder', label: 'L Shoulder', points: '40,78 115,78 112,95 55,92' },
  { id: 'right_shoulder', label: 'R Shoulder', points: '135,78 210,90 195,100 140,90' },
  { id: 'left_collarbone', label: 'L Collarbone', points: '85,78 115,78 112,88 88,86' },
  { id: 'right_collarbone', label: 'R Collarbone', points: '135,78 165,78 160,85 138,86' },
  { id: 'chest_upper', label: 'Upper Chest', points: '65,92 185,98 180,130 70,125' },
  { id: 'left_chest', label: 'L Chest', points: '65,92 130,96 125,130 70,125' },
  { id: 'right_chest', label: 'R Chest', points: '130,96 185,98 180,130 125,130' },
  { id: 'chest_lower', label: 'Lower Chest', points: '75,125 178,130 175,160 80,155' },
  { id: 'left_ribs', label: 'L Ribs', points: '75,125 125,130 122,155 80,155' },
  { id: 'right_ribs', label: 'R Ribs', points: '125,130 178,130 175,155 122,155' },
  { id: 'upper_abdomen', label: 'Upper Abdomen', points: '82,155 172,162 168,195 86,190' },
  { id: 'lower_abdomen', label: 'Lower Abdomen', points: '92,190 165,195 160,228 96,225' },
  { id: 'navel', label: 'Navel', points: '112,195 138,195 138,212 112,212' },
  { id: 'groin', label: 'Groin', points: '98,225 158,228 148,248 105,245' },

  // Arms — Left front
  { id: 'left_upper_arm', label: 'L Upper Arm', points: '10,92 50,92 45,135 12,135' },
  { id: 'left_bicep', label: 'L Bicep', points: '10,92 50,92 48,112 12,112' },
  { id: 'left_tricep_back', label: 'L Tricep', points: '10,112 48,112 45,135 12,135' },
  { id: 'left_elbow', label: 'L Elbow', points: '10,135 45,135 42,158 12,158' },
  { id: 'left_forearm', label: 'L Forearm', points: '10,158 42,158 38,210 12,210' },
  { id: 'left_wrist', label: 'L Wrist', points: '10,210 38,210 36,222 12,222' },
  { id: 'left_hand', label: 'L Hand', points: '8,222 40,222 38,248 10,248' },
  { id: 'left_palm', label: 'L Palm', points: '8,222 40,222 38,238 10,238' },
  { id: 'left_fingers', label: 'L Fingers', points: '8,238 38,238 35,260 10,260' },
  { id: 'left_thumb', label: 'L Thumb', points: '6,222 14,222 14,240 6,240' },

  // Arms — Right front
  { id: 'right_upper_arm', label: 'R Upper Arm', points: '200,92 238,90 240,132 198,135' },
  { id: 'right_bicep', label: 'R Bicep', points: '200,92 238,90 238,110 198,112' },
  { id: 'right_tricep_back', label: 'R Tricep', points: '198,112 238,110 240,132 198,135' },
  { id: 'right_elbow', label: 'R Elbow', points: '198,135 240,132 238,155 196,158' },
  { id: 'right_forearm', label: 'R Forearm', points: '196,158 238,155 235,208 194,210' },
  { id: 'right_wrist', label: 'R Wrist', points: '194,210 235,208 232,220 194,222' },
  { id: 'right_hand', label: 'R Hand', points: '192,222 234,222 232,248 194,248' },
  { id: 'right_palm', label: 'R Palm', points: '192,222 234,222 232,238 194,238' },
  { id: 'right_fingers', label: 'R Fingers', points: '192,238 234,238 231,260 194,260' },
  { id: 'right_thumb', label: 'R Thumb', points: '230,222 238,222 238,240 230,240' },

  // Hips — front
  { id: 'left_hip', label: 'L Hip', points: '42,225 108,228 105,252 48,252' },
  { id: 'right_hip', label: 'R Hip', points: '148,228 208,225 200,252 148,252' },

  // Thighs — Left front
  { id: 'left_thigh_upper', label: 'L Upper Thigh', points: '40,255 112,255 108,300 44,300' },
  { id: 'left_thigh_mid', label: 'L Mid Thigh', points: '44,300 108,300 105,340 48,340' },
  { id: 'left_thigh_lower', label: 'L Lower Thigh', points: '48,340 105,340 100,378 52,378' },

  // Thighs — Right front
  { id: 'right_thigh_upper', label: 'R Upper Thigh', points: '130,255 200,255 196,300 130,300' },
  { id: 'right_thigh_mid', label: 'R Mid Thigh', points: '130,300 196,300 192,340 130,340' },
  { id: 'right_thigh_lower', label: 'R Lower Thigh', points: '130,340 192,340 188,378 130,378' },

  // Knees
  { id: 'left_knee', label: 'L Knee', points: '52,378 100,378 98,398 56,398' },
  { id: 'right_knee', label: 'R Knee', points: '130,378 188,378 186,398 130,398' },

  // Lower legs
  { id: 'left_shin_upper', label: 'L Upper Shin', points: '56,398 98,398 94,438 60,438' },
  { id: 'left_shin_lower', label: 'L Lower Shin', points: '60,438 94,438 90,478 64,478' },
  { id: 'right_shin_upper', label: 'R Upper Shin', points: '130,398 186,398 182,438 130,438' },
  { id: 'right_shin_lower', label: 'R Lower Shin', points: '130,438 182,438 178,478 130,478' },

  // Calves
  { id: 'left_calf', label: 'L Calf', points: '60,440 94,440 92,472 64,472' },
  { id: 'right_calf', label: 'R Calf', points: '130,440 182,440 180,472 130,472' },

  // Ankles & feet
  { id: 'left_ankle', label: 'L Ankle', points: '64,478 90,478 88,500 66,500' },
  { id: 'right_ankle', label: 'R Ankle', points: '130,478 178,478 175,500 130,500' },
  { id: 'left_heel', label: 'L Heel', points: '64,500 88,500 86,515 66,515' },
  { id: 'right_heel', label: 'R Heel', points: '130,500 175,500 173,515 130,515' },
  { id: 'left_foot_top', label: 'L Foot Top', points: '64,515 110,515 108,525 66,525' },
  { id: 'right_foot_top', label: 'R Foot Top', points: '130,515 175,515 173,525 128,525' },
  { id: 'left_toes', label: 'L Toes', points: '62,525 110,525 108,545 64,545' },
  { id: 'right_toes', label: 'R Toes', points: '128,525 175,525 173,545 125,545' },

  // Back zones
  { id: 'back_head', label: 'Back of Head', points: '105,5 155,5 155,55 105,50' },
  { id: 'back_neck', label: 'Back of Neck', points: '115,70 140,70 138,84 118,84' },
  { id: 'upper_back', label: 'Upper Back', points: '65,92 185,98 180,130 70,125' },
  { id: 'left_shoulder_blade', label: 'L Shoulder Blade', points: '65,92 120,96 118,125 72,125' },
  { id: 'right_shoulder_blade', label: 'R Shoulder Blade', points: '130,96 185,98 178,125 120,125' },
  { id: 'mid_back', label: 'Mid Back', points: '75,125 178,130 175,160 80,155' },
  { id: 'lower_back', label: 'Lower Back', points: '82,155 172,162 168,195 86,190' },
  { id: 'sacral', label: 'Sacral / Tailbone', points: '92,190 165,195 160,228 96,225' },
  { id: 'left_buttock', label: 'L Buttock', points: '42,225 108,228 105,252 48,252' },
  { id: 'right_buttock', label: 'R Buttock', points: '148,228 208,225 200,252 148,252' },
  { id: 'back_left_arm', label: 'L Arm Back', points: '10,92 50,92 45,135 12,135' },
  { id: 'back_right_arm', label: 'R Arm Back', points: '200,92 238,90 240,132 198,135' },
  { id: 'back_left_thigh', label: 'L Thigh Back', points: '40,255 112,255 108,340 48,340' },
  { id: 'back_right_thigh', label: 'R Thigh Back', points: '130,255 200,255 196,340 130,340' },
  { id: 'back_left_knee', label: 'L Knee Back', points: '52,378 100,378 98,398 56,398' },
  { id: 'back_right_knee', label: 'R Knee Back', points: '130,378 188,378 186,398 130,398' },
  { id: 'back_left_shin', label: 'L Shin Back', points: '56,398 98,398 94,478 64,478' },
  { id: 'back_right_shin', label: 'R Shin Back', points: '130,398 186,398 182,478 130,478' },
  { id: 'back_left_foot', label: 'L Foot Back', points: '64,515 110,515 108,545 64,545' },
  { id: 'back_right_foot', label: 'R Foot Back', points: '128,525 175,525 173,545 125,545' },
]

interface BodyMapEntry {
  id: string; body_view: 'front' | 'back'; body_zone: string;
  zone_x: number | null; zone_y: number | null; condition_type: string;
  description: string | null; severity: string; status: string;
  recorded_date: string; created_by_name: string | null;
}

const FRONT_ZONES = ALL_ZONES.filter(z => !z.id.startsWith('back_'))
const BACK_ZONES = ALL_ZONES.filter(z => z.id.startsWith('back_'))

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
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['body-map', personId] }); setDialogOpen(false) },
  })

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
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="subtitle1" fontWeight={800}>Body Map</Typography>
        <Stack direction="row" spacing={1}>
          <Chip label={`${entries.filter(e => e.status === 'active').length} Active`} size="small" color="error" variant="outlined" />
        </Stack>
      </Stack>

      <Paper sx={{ borderRadius: 2, border: '1px solid #E5E7EB', mb: 3, overflow: 'hidden' }}>
        <Tabs value={view} onChange={(_, v) => setView(v)} sx={{ borderBottom: 1, borderColor: '#E5E7EB' }}>
          <Tab value="front" label="Front View" sx={{ textTransform: 'none', fontWeight: 700 }} />
          <Tab value="back" label="Back View" sx={{ textTransform: 'none', fontWeight: 700 }} />
        </Tabs>
        <Box sx={{ display: 'flex', justifyContent: 'center', bgcolor: '#FAFBFC', py: 2, px: 1 }}>
          <svg viewBox={VB} width={BODY_W * 1.1} height={BODY_H * 1.1} style={{ maxWidth: '100%', height: 'auto' }}>
            <defs>
              <filter id="bodyShadow">
                <feDropShadow dx={1} dy={1} stdDeviation={2} floodColor="#000" floodOpacity={0.08} />
              </filter>
            </defs>

            {/* Body silhouette */}
            <g filter="url(#bodyShadow)">
              <path d={FRONT_BODY_PATH}
                fill={view === 'front' ? '#FFF5F5' : '#F1F5F9'}
                stroke={view === 'front' ? '#E0C0C0' : '#94A3B8'}
                strokeWidth={2}
                strokeLinejoin="round"
              />
            </g>

            {/* Face details (front only) */}
            {view === 'front' && (
              <>
                <circle cx="122" cy="28" r={3} fill="#CBD5E1" />
                <circle cx="143" cy="28" r={3} fill="#CBD5E1" />
                <path d="M108,42 Q118,46 132,44" fill="none" stroke="#CBD5E1" strokeWidth={1.5} strokeLinecap="round" />
                <line x1="130" y1="62" x2="130" y2="68" stroke="#CBD5E1" strokeWidth={1} />
              </>
            )}
            {/* Spine (back only) */}
            {view === 'back' && (
              <path d="M130,85 L130,220" fill="none" stroke="#CBD5E1" strokeWidth={1.5} strokeDasharray="4 5" opacity={0.7} />
            )}

            {/* Clickable zones */}
            {zones.map(z => {
              const has = zoneCounts[z.id]
              return (
                <polygon key={z.id} points={z.points}
                  fill={hoverZone === z.id ? 'rgba(15,76,129,0.08)' : has ? `${CONDITION_COLORS[viewEntries.find(e => e.body_zone === z.id)!.condition_type]}08` : 'transparent'}
                  stroke={hoverZone === z.id ? '#0F4C81' : has ? CONDITION_COLORS[viewEntries.find(e => e.body_zone === z.id)!.condition_type] : 'transparent'}
                  strokeWidth={hoverZone === z.id ? 2 : has ? 1 : 0}
                  strokeDasharray={has && !hoverZone ? '2 2' : 'none'}
                  style={{ cursor: 'pointer', transition: 'all 0.1s' }}
                  onMouseEnter={() => setHoverZone(z.id)}
                  onMouseLeave={() => setHoverZone(null)}
                  onClick={() => openCreate(z)}
                />
              )
            })}

            {/* Hover tooltip */}
            {zones.map(z => {
              if (hoverZone !== z.id) return null
              const c = zoneCenter(z)
              return (
                <g key={`tt-${z.id}`}>
                  <rect x={c.cx - 35} y={c.cy - 16} width={70} height={18} rx={4} fill="#0F4C81" opacity={0.9} />
                  <text x={c.cx} y={c.cy - 3} textAnchor="middle" fontSize={9} fill="white" fontWeight={600}>{z.label}</text>
                </g>
              )
            })}

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
        <Paper sx={{ p: 4, textAlign: 'center', borderRadius: 2, border: '1px solid #E5E7EB' }}>
          <Typography color="#9CA3AF">No body map entries yet. Click a body zone above to add one.</Typography>
        </Paper>
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
            {selectedEntry && <IconButton onClick={() => { if (window.confirm('Delete?')) deleteM.mutate(selectedEntry.id) }} color="error" sx={{ mr: 'auto' }}><DeleteIcon /></IconButton>}
            <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={createM.isPending || updateM.isPending} sx={{ bgcolor: '#0F4C81', textTransform: 'none' }}>
              {createM.isPending || updateM.isPending ? <CircularProgress size={20} /> : 'Save'}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>
    </Box>
  )
}
