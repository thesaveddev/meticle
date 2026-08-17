import { useState, useEffect } from 'react'
import { Box, Typography } from '@mui/material'
import api from '../../../services/api'
import { BONE, HAIRLINE, INK, MIST, WHITE } from '../utils'

interface Props {
  url: string
  isMine: boolean
}

export default function LinkPreview({ url, isMine }: Props) {
  const [data, setData] = useState<{ title: string; description: string; image: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setFailed(false)
    api.get('/chat/link-preview', { params: { url } })
      .then(r => { if (!cancelled) setData(r.data) })
      .catch(() => { if (!cancelled) { setData(null); setFailed(true) } })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [url])

  if (loading || failed) return null

  const hostname = (() => { try { return new URL(url).hostname } catch { return url } })()
  const title = data?.title || hostname || url
  const description = data?.description || ''
  const image = data?.image || ''

  return (
    <Box
      component="a" href={url} target="_blank" rel="noopener noreferrer"
      onClick={e => e.stopPropagation()}
      sx={{
        display: 'flex', flexDirection: 'row', mt: 0.75, borderRadius: 2, overflow: 'hidden',
        border: `1px solid ${isMine ? 'rgba(255,255,255,0.2)' : HAIRLINE}`,
        textDecoration: 'none', color: 'inherit', maxWidth: 340,
        '&:hover': { opacity: 0.9 },
      }}
    >
      {image && (
        <Box sx={{ width: 96, minHeight: 72, bgcolor: isMine ? 'rgba(255,255,255,0.08)' : BONE, flexShrink: 0, overflow: 'hidden' }}>
          <Box component="img" src={image} alt="" sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
            onError={(e: any) => { e.target.style.display = 'none' }} />
        </Box>
      )}
      <Box sx={{ p: 0.75, flex: 1, minWidth: 0 }}>
        <Typography variant="caption" fontWeight={700} sx={{ display: 'block', lineHeight: 1.3, fontSize: 12, color: isMine ? WHITE : INK }} noWrap>{title}</Typography>
        {description && (
          <Typography variant="caption" sx={{ display: 'block', lineHeight: 1.3, mt: 0.25, fontSize: 11, color: isMine ? 'rgba(255,255,255,0.7)' : MIST }} noWrap>{description}</Typography>
        )}
        <Typography variant="caption" sx={{ display: 'block', mt: 0.25, fontSize: 10, color: isMine ? 'rgba(255,255,255,0.5)' : MIST }} noWrap>{hostname}</Typography>
      </Box>
    </Box>
  )
}
