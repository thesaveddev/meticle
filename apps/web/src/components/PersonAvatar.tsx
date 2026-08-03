import { useEffect, useState } from 'react'
import { Avatar, AvatarProps } from '@mui/material'

interface Props extends AvatarProps {
  photoUrl?: string | null
  name?: string | null
}

export default function PersonAvatar({ photoUrl, name, children, ...rest }: Props) {
  const [src, setSrc] = useState<string | null>(null)

  useEffect(() => {
    let objectUrl: string | null = null
    let cancelled = false
    if (!photoUrl) { setSrc(null); return }
    const load = async () => {
      try {
        const token = localStorage.getItem('accessToken')
        const res = await fetch(photoUrl, { headers: { Authorization: `Bearer ${token}` } })
        if (!res.ok) throw new Error('Failed to load photo')
        const blob = await res.blob()
        if (cancelled) return
        objectUrl = URL.createObjectURL(blob)
        setSrc(objectUrl)
      } catch { if (!cancelled) setSrc(null) }
    }
    load()
    return () => { cancelled = true; if (objectUrl) URL.revokeObjectURL(objectUrl) }
  }, [photoUrl])

  return (
    <Avatar src={src || undefined} {...rest}>
      {src ? undefined : (children || (name ? name.trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase()).join('') : undefined))}
    </Avatar>
  )
}
