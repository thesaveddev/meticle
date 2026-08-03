import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

const SITE_URL = import.meta.env.VITE_PUBLIC_SITE_URL || 'https://meticlecare.com'
const SITE_NAME = 'MeticleCare'
const DEFAULT_OG_IMAGE = `${SITE_URL}/og-image.png`
const TWITTER_HANDLE = '@meticlecare'

export interface PageMetaProps {
  title: string
  description: string
  canonicalPath?: string
  ogImage?: string
  ogType?: 'website' | 'article'
  noindex?: boolean
  nofollow?: boolean
  structuredData?: Record<string, unknown>
}

const titleTemplate = (title: string) =>
  title.includes('MeticleCare') ? title : `${title} | ${SITE_NAME}`

function upsertMeta(selector: string, attributes: Record<string, string>) {
  let el = document.querySelector(selector) as HTMLMetaElement | null
  if (!el) {
    el = document.createElement('meta')
    Object.entries(attributes).forEach(([k, v]) => el!.setAttribute(k, v))
    document.head.appendChild(el)
  } else {
    Object.entries(attributes).forEach(([k, v]) => el!.setAttribute(k, v))
  }
  return el
}

function upsertLink(selector: string, attributes: Record<string, string>) {
  let el = document.querySelector(selector) as HTMLLinkElement | null
  if (!el) {
    el = document.createElement('link')
    Object.entries(attributes).forEach(([k, v]) => el!.setAttribute(k, v))
    document.head.appendChild(el)
  } else {
    Object.entries(attributes).forEach(([k, v]) => el!.setAttribute(k, v))
  }
  return el
}

function removeMeta(selector: string) {
  const el = document.querySelector(selector)
  if (el) el.remove()
}

export function usePageMeta({
  title,
  description,
  canonicalPath,
  ogImage,
  ogType = 'website',
  noindex = false,
  nofollow = false,
  structuredData,
}: PageMetaProps) {
  const location = useLocation()
  const fullTitle = titleTemplate(title)
  const canonical = canonicalPath ? `${SITE_URL}${canonicalPath}` : `${SITE_URL}${location.pathname}`
  const image = ogImage || DEFAULT_OG_IMAGE

  useEffect(() => {
    const prevTitle = document.title
    document.title = fullTitle

    const robotsContent = [noindex && 'noindex', nofollow && 'nofollow'].filter(Boolean).join(', ')
    upsertMeta('meta[name="robots"]', { name: 'robots', content: robotsContent || 'index, follow' })
    upsertMeta('meta[name="description"]', { name: 'description', content: description })
    upsertMeta('meta[property="og:title"]', { property: 'og:title', content: fullTitle })
    upsertMeta('meta[property="og:description"]', { property: 'og:description', content: description })
    upsertMeta('meta[property="og:url"]', { property: 'og:url', content: canonical })
    upsertMeta('meta[property="og:type"]', { property: 'og:type', content: ogType })
    upsertMeta('meta[property="og:site_name"]', { property: 'og:site_name', content: SITE_NAME })
    upsertMeta('meta[property="og:image"]', { property: 'og:image', content: image })
    upsertMeta('meta[property="og:image:width"]', { property: 'og:image:width', content: '1200' })
    upsertMeta('meta[property="og:image:height"]', { property: 'og:image:height', content: '630' })
    upsertMeta('meta[name="twitter:card"]', { name: 'twitter:card', content: 'summary_large_image' })
    upsertMeta('meta[name="twitter:title"]', { name: 'twitter:title', content: fullTitle })
    upsertMeta('meta[name="twitter:description"]', { name: 'twitter:description', content: description })
    upsertMeta('meta[name="twitter:image"]', { name: 'twitter:image', content: image })
    upsertMeta('meta[name="twitter:site"]', { name: 'twitter:site', content: TWITTER_HANDLE })
    upsertLink('link[rel="canonical"]', { rel: 'canonical', href: canonical })

    if (structuredData) {
      let scriptEl = document.querySelector('script[type="application/ld+json"]')
      if (!scriptEl) {
        scriptEl = document.createElement('script')
        scriptEl.setAttribute('type', 'application/ld+json')
        document.head.appendChild(scriptEl)
      }
      scriptEl.textContent = JSON.stringify(structuredData)
    } else {
      removeMeta('script[type="application/ld+json"]')
    }

    return () => {
      document.title = prevTitle
    }
  }, [fullTitle, description, canonical, ogType, image, noindex, nofollow, structuredData])
}

export default function PageMeta(props: PageMetaProps) {
  usePageMeta(props)
  return null
}
