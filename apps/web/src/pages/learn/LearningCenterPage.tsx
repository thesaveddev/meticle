import { useState, useMemo, useEffect } from 'react'
import {
  Box, Typography, TextField, Button, Dialog, DialogContent, DialogActions,
  Alert, CircularProgress, FormControlLabel, Checkbox, InputAdornment,
} from '@mui/material'
import { Search as SearchIcon, ChevronRight as ChevronRightIcon } from '@mui/icons-material'
import { getLearnSections } from '../../data/learn-content'
import PageMeta from '../../components/PageMeta'
import FigDialogHeader from '../people/dialogHeader'
import { useSearchParams } from 'react-router-dom'
import api from '../../services/api'
import './learn.css'

function readMinutes(html: string) {
  const words = html.replace(/<[^>]+>/g, ' ').trim().split(/\s+/).filter(Boolean).length
  return Math.max(1, Math.ceil(words / 200))
}

export default function LearningCenterPage() {
  const sections = useMemo(() => getLearnSections(), [])
  const [search, setSearch] = useState('')
  const [activeSection, setActiveSection] = useState<string | null>(null)
  const [activeSubsection, setActiveSubsection] = useState<string | null>(null)
  const [searchDialog, setSearchDialog] = useState(false)
  const [searchDraft, setSearchDraft] = useState('')
  const [supportDialog, setSupportDialog] = useState(false)
  const [searchParams] = useSearchParams()

  useEffect(() => {
    const topic = searchParams.get('topic')
    if (!topic) return
    const match = sections.find(section => section.subsections.some(subsection => subsection.id === topic))
    if (match) {
      setActiveSection(match.id)
      setActiveSubsection(topic)
    }
  }, [searchParams, sections])

  // Open the first guide when the page is reached without a topic, rather than
  // asking the visitor to choose before they can see what a guide looks like.
  useEffect(() => {
    if (activeSection || sections.length === 0) return
    setActiveSection(sections[0].id)
    setActiveSubsection(sections[0].subsections[0]?.id || null)
  }, [activeSection, sections])

  const filtered = useMemo(() => {
    if (!search.trim()) return sections
    const q = search.toLowerCase()
    return sections
      .map(section => ({
        ...section,
        subsections: section.subsections.filter(
          subsection => subsection.title.toLowerCase().includes(q) || subsection.content.toLowerCase().includes(q) || section.title.toLowerCase().includes(q),
        ),
      }))
      .filter(section => section.subsections.length > 0)
  }, [search, sections])

  const currentSection = sections.find(s => s.id === activeSection)
  const currentSubsection = currentSection?.subsections.find(ss => ss.id === activeSubsection)
  const currentCategory = currentSection?.category || ''

  const selectSection = (sectionId: string, subsectionId: string) => {
    setActiveSection(sectionId)
    setActiveSubsection(subsectionId)
  }

  const openGuide = (section: typeof sections[number]) => {
    const firstMatch = filtered.find(s => s.id === section.id)?.subsections[0]
    selectSection(section.id, firstMatch?.id || section.subsections[0].id)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const applySearch = () => {
    setSearch(searchDraft.trim())
    setSearchDialog(false)
  }

  const clearSearch = () => {
    setSearch('')
    setSearchDraft('')
  }

  const previous = (() => {
    if (!currentSection || !currentSubsection) return null
    const index = currentSection.subsections.findIndex(ss => ss.id === currentSubsection.id)
    return index > 0 ? currentSection.subsections[index - 1] : null
  })()
  const next = (() => {
    if (!currentSection || !currentSubsection) return null
    const index = currentSection.subsections.findIndex(ss => ss.id === currentSubsection.id)
    return index < currentSection.subsections.length - 1 ? currentSection.subsections[index + 1] : null
  })()

  return (
    <>
      <PageMeta title="Learning Center | Meticle Care" description="Learn how to use Meticle Care for care planning, staff management, medication records, compliance and daily operations. Guides and resources for care providers." canonicalPath="/learn" />
      <Box className="learn-page">
        <div className="learn-inner">
          <Typography className="learn-crumbs">
            Learn{currentCategory ? ` / ${currentCategory}` : ''}
          </Typography>

          <header className="learn-header">
            <Box sx={{ minWidth: 0 }}>
              <Typography component="h1" className="learn-header__title">Learning Center</Typography>
              <Typography className="learn-header__copy">Step-by-step help for every part of MeticleCare.</Typography>
            </Box>
            <Box className="learn-header__actions">
              <Button variant="outlined" className="learn-button learn-button--quiet" onClick={() => { setSearchDraft(search); setSearchDialog(true) }}>
                Search guides
              </Button>
              <Button variant="contained" className="learn-button learn-button--primary" onClick={() => setSupportDialog(true)}>
                Contact support
              </Button>
            </Box>
          </header>

          <Box className="learn-layout">
            <aside className="learn-rail" aria-label="Guides">
              <div className="learn-rail__head">
                <Typography component="h2" className="learn-rail__title">Guides</Typography>
                <Typography className="learn-rail__count">
                  {search ? `${filtered.length} of ${sections.length} modules` : `${sections.length} modules`}
                </Typography>
              </div>
              <div className="learn-rail__list">
                {filtered.map(section => (
                  <button
                    key={section.id}
                    type="button"
                    className={`learn-rail__row${activeSection === section.id ? ' learn-rail__row--active' : ''}`}
                    aria-current={activeSection === section.id ? 'true' : undefined}
                    onClick={() => openGuide(section)}
                  >
                    <span className="learn-rail__icon" aria-hidden="true">{section.icon}</span>
                    <span className="learn-rail__label">{section.title}</span>
                    <ChevronRightIcon className="learn-rail__chevron" />
                  </button>
                ))}
                {filtered.length === 0 && (
                  <div className="learn-rail__empty">
                    <Typography className="learn-rail__empty-title">No guides match “{search}”</Typography>
                    <Typography className="learn-rail__empty-copy">Try a shorter word, or browse every module.</Typography>
                    <Button className="learn-button learn-button--quiet" variant="outlined" onClick={clearSearch}>Clear search</Button>
                  </div>
                )}
              </div>
            </aside>

            <main className="learn-main">
              {currentSection && currentSubsection ? (
                <article className="learn-card">
                  <Typography component="h2" className="learn-card__title">{currentSubsection.title}</Typography>
                  <Typography className="learn-card__meta">
                    {currentCategory} · {readMinutes(currentSubsection.content)} min read
                  </Typography>

                  {currentSection.subsections.length > 1 && (
                    <Box className="learn-topics" aria-label="In this module">
                      {currentSection.subsections.map(subsection => (
                        <button
                          key={subsection.id}
                          type="button"
                          className={`learn-topic${subsection.id === currentSubsection.id ? ' learn-topic--on' : ''}`}
                          aria-pressed={subsection.id === currentSubsection.id}
                          onClick={() => selectSection(currentSection.id, subsection.id)}
                        >
                          {subsection.title}
                        </button>
                      ))}
                    </Box>
                  )}

                  <div className="learn-divider" />
                  <div className="learn-content" dangerouslySetInnerHTML={{ __html: currentSubsection.content }} />

                  {(previous || next) && (
                    <div className="learn-pager">
                      {previous ? (
                        <button type="button" className="learn-pager__link" onClick={() => selectSection(currentSection.id, previous.id)}>
                          ← {previous.title}
                        </button>
                      ) : <span />}
                      {next ? (
                        <button type="button" className="learn-pager__link" onClick={() => selectSection(currentSection.id, next.id)}>
                          {next.title} →
                        </button>
                      ) : <span />}
                    </div>
                  )}
                </article>
              ) : (
                <article className="learn-card">
                  <Typography component="h2" className="learn-card__title">Welcome to MeticleCare</Typography>
                  <div className="learn-content">
                    <p>Pick a guide from the list and it opens here. Each one walks through the screens, the buttons and the rules behind them.</p>
                    <p>Use <strong>Search guides</strong> to find a topic by name instead of browsing.</p>
                  </div>
                </article>
              )}
            </main>
          </Box>

          <Typography className="learn-footnote">Content summarised from the live Learning Center.</Typography>
        </div>
      </Box>

      <Dialog className="learn-dialog" open={searchDialog} onClose={() => setSearchDialog(false)} maxWidth="sm" fullWidth>
        <FigDialogHeader
          eyebrow="LEARN"
          title="Search guides"
          subtitle="Search every guide."
          onClose={() => setSearchDialog(false)}
        />
        <DialogContent>
          <Typography className="learn-field-label" component="label" htmlFor="learn-search">Search</Typography>
          <TextField
            id="learn-search"
            fullWidth
            autoFocus
            placeholder="For example, rota, medication, leave"
            value={searchDraft}
            onChange={e => setSearchDraft(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') applySearch() }}
            InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSearchDialog(false)}>Cancel</Button>
          <Button variant="contained" className="learn-button learn-button--primary" onClick={applySearch}>Search</Button>
        </DialogActions>
      </Dialog>

      <ContactSupportDialog open={supportDialog} onClose={() => setSupportDialog(false)} />
    </>
  )
}

function ContactSupportDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [consent, setConsent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  const close = () => {
    onClose()
    setTimeout(() => { setSent(false); setError('') }, 200)
  }

  const send = async () => {
    setBusy(true)
    setError('')
    try {
      await api.post('/contact', {
        name,
        email,
        message,
        source: 'learning_center',
        privacyConsent: consent,
      })
      setSent(true)
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Could not send your message. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog className="learn-dialog" open={open} onClose={close} maxWidth="sm" fullWidth>
      <FigDialogHeader
        eyebrow="LEARN"
        title={sent ? 'Message sent' : 'Contact support'}
        subtitle={sent ? undefined : 'Tell us where you are stuck and we’ll reply within one business day.'}
        onClose={close}
      />
      <DialogContent>
        {error && <Alert severity="error">{error}</Alert>}
        {sent ? (
          <Typography className="learn-consent">
            Thanks — your message is with the team. A reply goes to {email || 'the address you gave us'}.
          </Typography>
        ) : (
          <>
            <Box sx={{ mt: 1 }}>
              <Typography className="learn-field-label" component="label" htmlFor="learn-support-name">Your name</Typography>
              <TextField id="learn-support-name" fullWidth size="small" value={name} onChange={e => setName(e.target.value)} />
            </Box>
            <Box sx={{ mt: 2 }}>
              <Typography className="learn-field-label" component="label" htmlFor="learn-support-email">Email</Typography>
              <TextField id="learn-support-email" fullWidth size="small" type="email" value={email} onChange={e => setEmail(e.target.value)} />
            </Box>
            <Box sx={{ mt: 2 }}>
              <Typography className="learn-field-label" component="label" htmlFor="learn-support-message">What do you need help with?</Typography>
              <TextField id="learn-support-message" fullWidth multiline minRows={4} value={message} onChange={e => setMessage(e.target.value)} />
            </Box>
            <FormControlLabel
              sx={{ mt: 1 }}
              control={<Checkbox checked={consent} onChange={e => setConsent(e.target.checked)} size="small" />}
              label={<span className="learn-consent">You can store this message and reply to me by email.</span>}
            />
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={close}>{sent ? 'Close' : 'Cancel'}</Button>
        {!sent && (
          <Button
            variant="contained"
            className="learn-button learn-button--primary"
            onClick={send}
            disabled={busy || !name.trim() || !email.trim() || !message.trim() || !consent}
          >
            {busy ? <CircularProgress size={18} color="inherit" /> : 'Send message'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  )
}
