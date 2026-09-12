import { useEffect, useState, useRef, useMemo } from 'react'
import { Box, Button, Chip, CircularProgress, Paper, Stack, Typography } from '@mui/material'
import { Refresh as RefreshIcon, MyLocation as LocationIcon } from '@mui/icons-material'
import { useQuery } from '@tanstack/react-query'
import api from '../../services/api'
import 'leaflet/dist/leaflet.css'

interface MapVisit {
  id: string
  label: string
  person_name: string
  person_address: string | null
  carer_name: string | null
  carer_id: string | null
  status: string
  scheduled_start: string
  scheduled_end: string
  check_in_at: string | null
  latitude: number | null
  longitude: number | null
  last_updated: string
  is_active: boolean
}

interface LiveMapData {
  active_visits: MapVisit[]
  scheduled_visits: MapVisit[]
  completed_today: number
  total_today: number
  centre: { lat: number; lng: number } | null
}

const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
  en_route: { label: 'En route', color: '#7C3AED', bg: '#EDE9FE' },
  checked_in: { label: 'At client', color: '#047857', bg: '#E9F7F0' },
  scheduled: { label: 'Upcoming', color: '#6B7280', bg: '#F3F4F6' },
}

const time = (d: string) => new Date(d).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })

// Simple map using OpenStreetMap tiles — no API key needed
function SimpleMap({ visits, centre }: { visits: MapVisit[]; centre: { lat: number; lng: number } | null }) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<any>(null)
  const markersRef = useRef<any[]>([])

  const mapCentre = centre || { lat: 51.5074, lng: -0.1278 } // London default

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return

    // Dynamic import for Leaflet (client-only)
    import('leaflet').then((L) => {
      if (!mapRef.current || mapInstanceRef.current) return

      const map = L.map(mapRef.current!, {
        center: [mapCentre.lat, mapCentre.lng],
        zoom: 13,
        zoomControl: true,
        attributionControl: true,
      })

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map)

      mapInstanceRef.current = map

      // Add markers for visits with GPS
      const markerIcon = (color: string) => L.divIcon({
        className: '',
        html: `<div style="width:24px;height:24px;border-radius:50%;background:${color};border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center"><div style="width:8px;height:8px;border-radius:50%;background:white"></div></div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      })

      const activeIcon = markerIcon('#047857')
      const enRouteIcon = markerIcon('#7C3AED')
      const scheduledIcon = markerIcon('#6B7280')

      visits.forEach(v => {
        if (v.latitude == null || v.longitude == null) return
        const icon = v.status === 'checked_in' ? activeIcon : v.status === 'en_route' ? enRouteIcon : scheduledIcon
        const marker = L.marker([v.latitude, v.longitude], { icon }).addTo(map)
        marker.bindPopup(`
          <div style="font-family:system-ui;min-width:180px">
            <strong style="font-size:14px">${v.person_name}</strong><br/>
            <span style="color:#6B7280;font-size:12px">${v.label}</span><br/>
            ${v.carer_name ? `<span style="font-size:12px">Carer: <strong>${v.carer_name}</strong></span><br/>` : '<span style="font-size:12px;color:#D97706">No carer assigned</span><br/>'}
            <span style="font-size:12px;color:#6B7280">${time(v.scheduled_start)} – ${time(v.scheduled_end)}</span><br/>
            <span style="font-size:11px;color:#9CA3AF">Updated ${time(v.last_updated)}</span>
          </div>
        `)
        markersRef.current.push(marker)
      })

      // Fit bounds if we have markers
      if (markersRef.current.length > 1) {
        const group = L.featureGroup(markersRef.current)
        map.fitBounds(group.getBounds().pad(0.15))
      }
    })

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove()
        mapInstanceRef.current = null
        markersRef.current = []
      }
    }
  }, []) // Mount only

  // Update markers when visits change
  useEffect(() => {
    if (!mapInstanceRef.current) return

    import('leaflet').then((L) => {
      if (!mapInstanceRef.current) return
      const map = mapInstanceRef.current

      // Clear existing markers
      markersRef.current.forEach(m => m.remove())
      markersRef.current = []

      const markerIcon = (color: string) => L.divIcon({
        className: '',
        html: `<div style="width:24px;height:24px;border-radius:50%;background:${color};border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center"><div style="width:8px;height:8px;border-radius:50%;background:white"></div></div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      })

      const activeIcon = markerIcon('#047857')
      const enRouteIcon = markerIcon('#7C3AED')

      visits.forEach(v => {
        if (v.latitude == null || v.longitude == null) return
        const icon = v.status === 'checked_in' ? activeIcon : enRouteIcon
        const marker = L.marker([v.latitude, v.longitude], { icon }).addTo(map)
        marker.bindPopup(`
          <div style="font-family:system-ui;min-width:180px">
            <strong style="font-size:14px">${v.person_name}</strong><br/>
            <span style="color:#6B7280;font-size:12px">${v.label}</span><br/>
            ${v.carer_name ? `<span style="font-size:12px">Carer: <strong>${v.carer_name}</strong></span><br/>` : '<span style="font-size:12px;color:#D97706">No carer assigned</span><br/>'}
            <span style="font-size:12px;color:#6B7280">${time(v.scheduled_start)} – ${time(v.scheduled_end)}</span>
          </div>
        `)
        markersRef.current.push(marker)
      })
    })
  }, [visits])

  return <div ref={mapRef} style={{ width: '100%', height: 480, borderRadius: 8, border: '1px solid #E5E7EB' }} />
}

export default function LiveMapPage() {
  const [refreshKey, setRefreshKey] = useState(0)
  const [autoRefresh, setAutoRefresh] = useState(true)

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['homecare-live-map', refreshKey],
    queryFn: () => api.get('/dashboard/live-map').then(r => r.data as LiveMapData),
    refetchInterval: autoRefresh ? 30000 : false, // Auto-refresh every 30s
  })

  const allVisits = useMemo(() => {
    if (!data) return []
    return [...data.active_visits, ...data.scheduled_visits]
  }, [data])

  if (isLoading) {
    return (
      <Box sx={{ maxWidth: 1180, mx: 'auto' }}>
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>
      </Box>
    )
  }

  return (
    <Box sx={{ maxWidth: 1180, mx: 'auto' }}>
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ md: 'center' }} spacing={2} sx={{ mb: 3 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 800 }}>Live Visit Map</Typography>
          <Typography variant="body2" sx={{ color: '#6B7280', mt: 0.5 }}>
            Real-time view of active carers and today's scheduled calls
          </Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <Button
            variant="outlined"
            size="small"
            onClick={() => setAutoRefresh(!autoRefresh)}
            sx={{ textTransform: 'none', borderColor: autoRefresh ? '#10b981' : '#E5E7EB', color: autoRefresh ? '#047857' : '#374151' }}
          >
            {autoRefresh ? 'Auto-refresh on' : 'Auto-refresh off'}
          </Button>
          <Button
            variant="outlined"
            size="small"
            startIcon={<RefreshIcon />}
            onClick={() => { setRefreshKey(k => k + 1); refetch() }}
            sx={{ textTransform: 'none', borderColor: '#E5E7EB', color: '#374151' }}
          >
            Refresh
          </Button>
        </Stack>
      </Stack>

      {/* Summary bar */}
      <Stack direction="row" spacing={2} sx={{ mb: 3 }} flexWrap="wrap" useFlexGap>
        <Paper elevation={0} sx={{ p: 2, flex: '1 1 120px', border: '1px solid #E5E7EB', borderRadius: 2, textAlign: 'center' }}>
          <Typography variant="h5" sx={{ fontWeight: 800, color: '#0F4C81' }}>{data?.total_today || 0}</Typography>
          <Typography variant="caption" sx={{ color: '#6B7280' }}>Total calls today</Typography>
        </Paper>
        <Paper elevation={0} sx={{ p: 2, flex: '1 1 120px', border: '1px solid #E5E7EB', borderRadius: 2, textAlign: 'center' }}>
          <Typography variant="h5" sx={{ fontWeight: 800, color: '#047857' }}>{data?.active_visits?.length || 0}</Typography>
          <Typography variant="caption" sx={{ color: '#6B7280' }}>Active now</Typography>
        </Paper>
        <Paper elevation={0} sx={{ p: 2, flex: '1 1 120px', border: '1px solid #E5E7EB', borderRadius: 2, textAlign: 'center' }}>
          <Typography variant="h5" sx={{ fontWeight: 800, color: '#6B7280' }}>{data?.scheduled_visits?.length || 0}</Typography>
          <Typography variant="caption" sx={{ color: '#6B7280' }}>Upcoming</Typography>
        </Paper>
        <Paper elevation={0} sx={{ p: 2, flex: '1 1 120px', border: '1px solid #E5E7EB', borderRadius: 2, textAlign: 'center' }}>
          <Typography variant="h5" sx={{ fontWeight: 800, color: '#10b981' }}>{data?.completed_today || 0}</Typography>
          <Typography variant="caption" sx={{ color: '#6B7280' }}>Completed</Typography>
        </Paper>
      </Stack>

      {/* Map */}
      <Paper elevation={0} sx={{ mb: 3, border: '1px solid #E5E7EB', borderRadius: 2, overflow: 'hidden' }}>
        {allVisits.length === 0 ? (
          <Box sx={{ p: 6, textAlign: 'center' }}>
            <LocationIcon sx={{ fontSize: 48, color: '#D1D5DB', mb: 1 }} />
            <Typography sx={{ color: '#6B7280' }}>No active or scheduled calls today</Typography>
            <Typography variant="caption" sx={{ color: '#9CA3AF' }}>Carer locations appear here once they check in to a call</Typography>
          </Box>
        ) : (
          <SimpleMap visits={allVisits} centre={data?.centre || null} />
        )}
      </Paper>

      {/* Active visits list */}
      {data && data.active_visits.length > 0 && (
        <Paper elevation={0} sx={{ p: 3, border: '1px solid #E5E7EB', borderRadius: 2, mb: 3 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 2 }}>Active carers</Typography>
          <Stack spacing={1}>
            {data.active_visits.map(v => {
              const cfg = statusConfig[v.status] || statusConfig.scheduled
              return (
                <Stack key={v.id} direction="row" alignItems="center" justifyContent="space-between" sx={{ py: 1, borderBottom: '1px solid #F3F4F6' }}>
                  <Box>
                    <Stack direction="row" alignItems="center" gap={1}>
                      <Chip label={cfg.label} size="small" sx={{ bgcolor: cfg.bg, color: cfg.color, fontWeight: 600, height: 20, fontSize: '0.65rem' }} />
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>{v.carer_name || 'Unassigned'}</Typography>
                    </Stack>
                    <Typography variant="caption" sx={{ color: '#6B7280', ml: 7 }}>
                      {v.person_name} · {v.label} · {time(v.scheduled_start)} – {time(v.scheduled_end)}
                    </Typography>
                  </Box>
                  <Stack direction="row" alignItems="center" gap={1}>
                    {v.latitude != null ? (
                      <Chip icon={<LocationIcon sx={{ fontSize: 14 }} />} label="GPS captured" size="small" sx={{ bgcolor: '#E9F7F0', color: '#047857', height: 20, fontSize: '0.65rem' }} />
                    ) : (
                      <Chip label="No GPS" size="small" sx={{ bgcolor: '#FFF5D9', color: '#D97706', height: 20, fontSize: '0.65rem' }} />
                    )}
                    <Typography variant="caption" sx={{ color: '#9CA3AF' }}>{time(v.last_updated)}</Typography>
                  </Stack>
                </Stack>
              )
            })}
          </Stack>
        </Paper>
      )}

      {/* Upcoming visits */}
      {data && data.scheduled_visits.length > 0 && (
        <Paper elevation={0} sx={{ p: 3, border: '1px solid #E5E7EB', borderRadius: 2 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 2 }}>Upcoming calls</Typography>
          <Stack spacing={1}>
            {data.scheduled_visits.slice(0, 10).map(v => (
              <Stack key={v.id} direction="row" alignItems="center" justifyContent="space-between" sx={{ py: 1, borderBottom: '1px solid #F3F4F6' }}>
                <Box>
                  <Stack direction="row" alignItems="center" gap={1}>
                    <Chip label={time(v.scheduled_start)} size="small" sx={{ bgcolor: '#F3F4F6', color: '#6B7280', fontWeight: 600, height: 20, fontSize: '0.65rem' }} />
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>{v.person_name}</Typography>
                  </Stack>
                  <Typography variant="caption" sx={{ color: '#6B7280', ml: 7 }}>
                    {v.label} · {v.carer_name || 'No carer assigned'}
                  </Typography>
                </Box>
                {!v.carer_name && (
                  <Chip label="Unassigned" size="small" sx={{ bgcolor: '#FFF5D9', color: '#D97706', height: 20, fontSize: '0.65rem' }} />
                )}
              </Stack>
            ))}
          </Stack>
        </Paper>
      )}
    </Box>
  )
}
