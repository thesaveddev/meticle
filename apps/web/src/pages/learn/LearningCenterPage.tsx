import { useState, useMemo } from 'react'
import {
  Box, Typography, Paper, Stack, TextField, InputAdornment, IconButton,
  ListItemButton, ListItemText, ListItemIcon, Collapse,
  Chip, Divider, Drawer, AppBar, Toolbar, useMediaQuery, useTheme,
} from '@mui/material'
import {
  Search as SearchIcon, Menu as MenuIcon, Close as CloseIcon,
  ExpandMore, ExpandLess, School as LearnIcon,
} from '@mui/icons-material'
import { getLearnSections, type LearnSection } from '../../data/learn-content'
import PageMeta from '../../components/PageMeta'

const DRAWER_WIDTH = 300

export default function LearningCenterPage() {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))
  const [drawerOpen, setDrawerOpen] = useState(!isMobile)
  const [search, setSearch] = useState('')
  const [activeSection, setActiveSection] = useState<string | null>(null)
  const [activeSubsection, setActiveSubsection] = useState<string | null>(null)
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({})

  const sections = useMemo(() => getLearnSections(), [])

  const filtered = useMemo(() => {
    if (!search.trim()) return sections
    const q = search.toLowerCase()
    return sections
      .map(s => ({
        ...s,
        subsections: s.subsections.filter(
          ss => ss.title.toLowerCase().includes(q) || ss.content.toLowerCase().includes(q) || s.title.toLowerCase().includes(q)
        )
      }))
      .filter(s => s.subsections.length > 0)
  }, [search, sections])

  const toggleCategory = (id: string) => {
    setExpandedCategories(p => ({ ...p, [id]: !p[id] }))
  }

  const selectSection = (sectionId: string, subsectionId: string) => {
    setActiveSection(sectionId)
    setActiveSubsection(subsectionId)
    if (!expandedCategories[sectionId]) {
      setExpandedCategories(p => ({ ...p, [sectionId]: true }))
    }
    if (isMobile) setDrawerOpen(false)
  }

  const currentSection = sections.find(s => s.id === activeSection)
  const currentSubsection = currentSection?.subsections.find(ss => ss.id === activeSubsection)
  const currentCategory = currentSection?.category || ''

  const groupedByCategory = useMemo(() => {
    const map: Record<string, LearnSection[]> = {}
    filtered.forEach(s => {
      if (!map[s.category]) map[s.category] = []
      map[s.category].push(s)
    })
    return map
  }, [filtered])

  const sidebar = (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ p: 2 }}>
        <TextField
          fullWidth size="small" placeholder="Search modules..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          InputProps={{
            startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment>,
            endAdornment: search ? (
              <InputAdornment position="end">
                <IconButton size="small" onClick={() => setSearch('')}><CloseIcon fontSize="small" /></IconButton>
              </InputAdornment>
            ) : null,
          }}
        />
      </Box>

      <Box sx={{ flex: 1, overflow: 'auto', pb: 12 }}>
        {Object.entries(groupedByCategory).map(([category, cats]) => (
          <Box key={category}>
            <Typography variant="caption" sx={{ px: 2, py: 1, display: 'block', color: '#9CA3AF', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, fontSize: '0.65rem' }}>
              {category}
            </Typography>
            {cats.map(section => {
              const isExpanded = expandedCategories[section.id] !== false // default expanded
              const isSelected = activeSection === section.id
              return (
                <Box key={section.id}>
                  <ListItemButton
                    onClick={() => toggleCategory(section.id)}
                    sx={{
                      px: 2, py: 0.5,
                      borderLeft: isSelected ? '3px solid #0F4C81' : '3px solid transparent',
                      bgcolor: isSelected ? '#EEF2FF' : 'transparent',
                      '&:hover': { bgcolor: '#F3F4F6' },
                    }}
                  >
                    <ListItemIcon sx={{ minWidth: 28, fontSize: 18 }}>{section.icon}</ListItemIcon>
                    <ListItemText
                      primary={section.title}
                      primaryTypographyProps={{ fontSize: '0.85rem', fontWeight: isSelected ? 700 : 500 }}
                    />
                    {isExpanded ? <ExpandLess fontSize="small" sx={{ color: '#9CA3AF' }} /> : <ExpandMore fontSize="small" sx={{ color: '#9CA3AF' }} />}
                  </ListItemButton>
                  <Collapse in={isExpanded}>
                    {section.subsections.map(ss => {
                      const subSelected = activeSection === section.id && activeSubsection === ss.id
                      return (
                        <ListItemButton
                          key={ss.id}
                          onClick={() => selectSection(section.id, ss.id)}
                          sx={{
                            pl: 5, py: 0.25,
                            borderLeft: subSelected ? '3px solid #0F4C81' : '3px solid transparent',
                            bgcolor: subSelected ? '#EEF2FF' : 'transparent',
                            '&:hover': { bgcolor: '#F3F4F6' },
                          }}
                        >
                          <ListItemText
                            primary={ss.title}
                            primaryTypographyProps={{ fontSize: '0.78rem', fontWeight: subSelected ? 600 : 400, color: subSelected ? '#0F4C81' : '#374151' }}
                          />
                        </ListItemButton>
                      )
                    })}
                  </Collapse>
                </Box>
              )
            })}
          </Box>
        ))}
      </Box>
    </Box>
  )

  // Default to first section if none selected
  if (!activeSection && sections.length > 0 && sections[0].subsections.length > 0) {
    setTimeout(() => selectSection(sections[0].id, sections[0].subsections[0].id), 0)
  }

  return (
    <>
      <PageMeta title="Learning Center | MeticleCare" description="Learn how to use MeticleCare for care planning, staff management, medication records, compliance and daily operations. Guides and resources for care providers." canonicalPath="/learn" />
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: '#F9FAFB' }}>
      {/* Mobile app bar */}
      {isMobile && (
        <AppBar position="fixed" sx={{ bgcolor: '#0F4C81', zIndex: 1201 }}>
          <Toolbar>
            <IconButton edge="start" color="inherit" onClick={() => setDrawerOpen(true)} sx={{ mr: 1 }}>
              <MenuIcon />
            </IconButton>
            <Typography variant="h6" sx={{ flex: 1, fontSize: '1rem' }}>Meticle Learning Center</Typography>
          </Toolbar>
        </AppBar>
      )}

      {/* Sidebar Drawer */}
      {isMobile ? (
        <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} sx={{ '& .MuiDrawer-paper': { width: DRAWER_WIDTH } }}>
          <Box sx={{ p: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #E5E7EB' }}>
            <Stack direction="row" spacing={1} alignItems="center">
              <LearnIcon sx={{ color: '#0F4C81' }} />
              <Typography fontWeight={800} fontSize="0.95rem">Learning Center</Typography>
            </Stack>
            <IconButton size="small" onClick={() => setDrawerOpen(false)}><CloseIcon /></IconButton>
          </Box>
          {sidebar}
        </Drawer>
      ) : (
        <Paper sx={{ width: DRAWER_WIDTH, flexShrink: 0, borderRadius: 0, borderRight: '1px solid #E5E7EB', height: '100vh', position: 'sticky', top: 0, overflow: 'hidden' }}>
          <Box sx={{ p: 2, borderBottom: '1px solid #E5E7EB', display: 'flex', alignItems: 'center', gap: 1 }}>
            <LearnIcon sx={{ color: '#0F4C81' }} />
            <Typography fontWeight={800} fontSize="0.95rem">Learning Center</Typography>
          </Box>
          {sidebar}
        </Paper>
      )}

      {/* Main Content */}
      <Box sx={{ flex: 1, pt: isMobile ? 8 : 3, px: isMobile ? 2 : 4, pb: 8, maxWidth: 900, mx: 'auto', width: '100%' }}>
        {currentSection && currentSubsection ? (
          <>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
              <Chip label={currentCategory} size="small" variant="outlined" sx={{ fontSize: '0.7rem' }} />
              <Chip label={currentSection.title} size="small" color="primary" variant="outlined" />
            </Stack>

            <Typography variant="h4" sx={{ fontWeight: 800, mb: 1, color: '#0F4C81' }}>
              {currentSubsection.title}
            </Typography>

            <Divider sx={{ mb: 3 }} />

            <Paper sx={{ p: 4, borderRadius: 2, border: '1px solid #E5E7EB' }}>
              <Box
                className="learn-content"
                dangerouslySetInnerHTML={{ __html: currentSubsection.content }}
                sx={{
                  '& h2': { fontSize: '1.3rem', fontWeight: 700, color: '#0F4C81', mt: 4, mb: 1.5 },
                  '& h3': { fontSize: '1.1rem', fontWeight: 700, mt: 3, mb: 1 },
                  '& p': { lineHeight: 1.8, mb: 1.5, color: '#374151', fontSize: '0.95rem' },
                  '& strong': { color: '#111827' },
                  '& ul, & ol': { pl: 2.5, mb: 2 },
                  '& li': { mb: 0.5, lineHeight: 1.7, color: '#374151', fontSize: '0.95rem' },
                  '& ul li strong': { color: '#0F4C81' },
                  '& code': { bgcolor: '#F3F4F6', px: 0.75, py: 0.25, borderRadius: 0.5, fontSize: '0.85rem', fontFamily: 'monospace' },
                  '& em': { fontStyle: 'italic', color: '#6B7280' },
                }}
              />
            </Paper>

            {/* Previous / Next navigation */}
            {currentSection && (
              <Stack direction="row" justifyContent="space-between" sx={{ mt: 3 }}>
                {(() => {
                  const idx = currentSection.subsections.findIndex(ss => ss.id === currentSubsection.id)
                  const prev = idx > 0 ? currentSection.subsections[idx - 1] : null
                  const next = idx < currentSection.subsections.length - 1 ? currentSection.subsections[idx + 1] : null
                  return (
                    <>
                      {prev ? (
                        <Chip
                          label={`← ${prev.title}`}
                          variant="outlined"
                          clickable
                          onClick={() => selectSection(currentSection.id, prev.id)}
                        />
                      ) : <Box />}
                      {next ? (
                        <Chip
                          label={`${next.title} →`}
                          variant="outlined"
                          clickable
                          onClick={() => selectSection(currentSection.id, next.id)}
                        />
                      ) : <Box />}
                    </>
                  )
                })()}
              </Stack>
            )}
          </>
        ) : (
          <Box sx={{ textAlign: 'center', py: 10 }}>
            <LearnIcon sx={{ fontSize: 64, color: '#D1D5DB', mb: 2 }} />
            <Typography variant="h5" fontWeight={700} color="#0F4C81" sx={{ mb: 1 }}>
              Welcome to the Meticle Learning Center
            </Typography>
            <Typography color="#6B7280" sx={{ maxWidth: 500, mx: 'auto' }}>
              Select a topic from the sidebar to learn about Meticle features, workflows, and best practices.
              Use the search bar to quickly find what you're looking for.
            </Typography>
          </Box>
        )}
      </Box>
    </Box>
    </>
  )
}
