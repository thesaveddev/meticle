import { useEffect, useRef } from 'react'
import { Box } from '@mui/material'

interface Props {
  src: string
  alt: string
  sx?: any
}

export default function SecureImg({ src, alt, sx }: Props) {
  const imgRef = useRef<HTMLImageElement>(null)
  const blobRef = useRef('')

  useEffect(() => {
    let cancelled = false
    const token = localStorage.getItem('accessToken')
    fetch(src, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then(r => r.blob())
      .then(blob => {
        if (cancelled) { URL.revokeObjectURL(URL.createObjectURL(blob)); return }
        blobRef.current = URL.createObjectURL(blob)
        if (imgRef.current) imgRef.current.src = blobRef.current
      })
      .catch(() => { if (!cancelled && imgRef.current) imgRef.current.src = src })
    return () => {
      cancelled = true
      if (blobRef.current) { URL.revokeObjectURL(blobRef.current); blobRef.current = '' }
    }
  }, [src])

  return <Box component="img" ref={imgRef} alt={alt} sx={sx} onError={(e: any) => { e.target.style.display = 'none' }} />
}
