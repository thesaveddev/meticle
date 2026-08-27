import { useState, useRef } from 'react'
import {
  Box, Typography, Paper, Grid, Button, Chip, Stack,
  CircularProgress, Alert,
} from '@mui/material'
import {
  AutoAwesome as AIIcon, Print as PrintIcon,
  Restaurant as MealIcon, Download as DownloadIcon,
  CompareArrows as CompareIcon, ViewModule as GridIcon,
} from '@mui/icons-material'
import api from '../../services/api'
import ShoppingList from './ShoppingList'

const MEAL_TYPES = [
  { value: 'breakfast', label: 'Breakfast', color: '#F59E0B', icon: '🌅' },
  { value: 'morning_snack', label: 'Morning Snack', color: '#10B981', icon: '🍎' },
  { value: 'lunch', label: 'Lunch', color: '#3B82F6', icon: '🍽️' },
  { value: 'afternoon_snack', label: 'Afternoon Snack', color: '#8B5CF6', icon: '🥤' },
  { value: 'dinner', label: 'Dinner', color: '#EF4444', icon: '🌙' },
  { value: 'evening_snack', label: 'Evening Snack', color: '#EC4899', icon: '🍪' },
]

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
const DAY_LABELS: Record<string, string> = {
  monday: 'Monday', tuesday: 'Tuesday', wednesday: 'Wednesday',
  thursday: 'Thursday', friday: 'Friday', saturday: 'Saturday', sunday: 'Sunday',
}

interface WeeklyMeal {
  name: string
  items: Array<{ name: string; portion: string }>
  estimated_calories: number
  description?: string
}

interface MealSlot {
  option_a?: WeeklyMeal
  option_b?: WeeklyMeal
  // Legacy single-option support
  name?: string
  items?: Array<{ name: string; portion: string }>
  estimated_calories?: number
}

interface WeeklyPlan {
  plan_name: string
  description: string
  person_context: {
    name: string
    dietary_summary: string
    allergens: string[]
    texture_modification: string
    fluid_target_ml: number
  }
  week: Record<string, Record<string, MealSlot>>
  weekly_totals: {
    avg_daily_calories: number
    avg_daily_fluid_ml: number
    total_unique_meals: number
  }
  nutritional_notes: string[]
  allergen_warnings: string[]
}

// Helper to get meal data whether it's dual-option or legacy single
function getMealDisplay(slot: MealSlot | undefined): { primary: WeeklyMeal | null; secondary: WeeklyMeal | null } {
  if (!slot) return { primary: null, secondary: null }
  if (slot.option_a) {
    return { primary: slot.option_a, secondary: slot.option_b || null }
  }
  // Legacy single-option format
  if (slot.name) {
    return { primary: { name: slot.name, items: slot.items || [], estimated_calories: slot.estimated_calories || 0 }, secondary: null }
  }
  return { primary: null, secondary: null }
}

interface Props {
  personId: string
  personName: string
}

const PRINT_STYLES = `
  @media print {
    @page {
      size: A4 landscape;
      margin: 12mm;
    }
    body * {
      visibility: hidden !important;
    }
    .print-weekly-meal-plan,
    .print-weekly-meal-plan * {
      visibility: visible !important;
    }
    .print-weekly-meal-plan {
      position: absolute;
      left: 0;
      top: 0;
      width: 100%;
      padding: 0 !important;
      margin: 0 !important;
      background: white !important;
    }
    .no-print {
      display: none !important;
    }
    .print-break-before {
      page-break-before: always;
    }
    .meal-cell {
      border: 1px solid #D1D5DB !important;
      box-shadow: none !important;
    }
    .meal-cell:hover {
      border-color: #D1D5DB !important;
      box-shadow: none !important;
    }
    .meal-card {
      border: 1px solid #E5E7EB !important;
      box-shadow: none !important;
    }
    .print-header {
      margin-bottom: 8px !important;
    }
    .print-header h2 {
      font-size: 18px !important;
      margin: 0 !important;
    }
    .allergen-chip {
      border: 1px solid #DC2626 !important;
      background: #FEE2E2 !important;
    }
    .day-header {
      border-bottom: 2px solid #0F4C81 !important;
    }
  }
`

export default function PrintableWeeklyMealPlan({ personId, personName }: Props) {
  const [weeklyPlan, setWeeklyPlan] = useState<WeeklyPlan | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expandedCell, setExpandedCell] = useState<string | null>(null)
  const [pdfLoading, setPdfLoading] = useState(false)
  const [selectedOptions, setSelectedOptions] = useState<Record<string, 'a' | 'b'>>({})
  const [viewMode, setViewMode] = useState<'grid' | 'compare'>('grid')
  const printRef = useRef<HTMLDivElement>(null)

  // Build a filtered week that uses only selected options for the shopping list
  const filteredWeek = weeklyPlan?.week ? buildFilteredWeek(weeklyPlan.week, selectedOptions) : undefined

  function buildFilteredWeek(week: Record<string, Record<string, MealSlot>>, selections: Record<string, 'a' | 'b'>): Record<string, Record<string, WeeklyMeal>> {
    const filtered: Record<string, Record<string, WeeklyMeal>> = {}
    for (const [day, meals] of Object.entries(week)) {
      filtered[day] = {}
      for (const [mealType, slot] of Object.entries(meals)) {
        const key = `${day}-${mealType}`
        const selection = selections[key] || 'a'
        if (slot.option_a && slot.option_b) {
          filtered[day][mealType] = selection === 'b' ? slot.option_b : slot.option_a
        } else if (slot.option_a) {
          filtered[day][mealType] = slot.option_a
        } else if ((slot as any).name) {
          filtered[day][mealType] = { name: (slot as any).name, items: (slot as any).items || [], estimated_calories: (slot as any).estimated_calories || 0 }
        }
      }
    }
    return filtered
  }

  const toggleOption = (day: string, mealType: string, option: 'a' | 'b') => {
    const key = `${day}-${mealType}`
    setSelectedOptions(prev => ({ ...prev, [key]: option }))
  }

  // Count how many slots have been selected
  const totalSlots = weeklyPlan?.week ? Object.values(weeklyPlan.week).reduce((sum, day) => sum + Object.keys(day).length, 0) : 0
  const selectedCount = Object.keys(selectedOptions).length

  const generateWeek = async () => {
    setLoading(true)
    setError(null)
    setWeeklyPlan(null)
    try {
      const res = await api.post('/ai/generate/weekly-meal-plan', {
        personId,
        specialRequirements: '',
      })
      setWeeklyPlan(res.data.weeklyPlan)
      setSelectedOptions({}) // Clear selections on new plan
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to generate weekly plan')
    } finally {
      setLoading(false)
    }
  }

  const handlePrint = () => {
    window.print()
  }

  const handleDownloadPdf = async () => {
    if (!weeklyPlan) return
    setPdfLoading(true)
    try {
      const res = await api.post('/nutrition/export/meal-plan-pdf', {
        weeklyPlan,
      }, { responseType: 'blob' })
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `meal-plan-${personName.replace(/\s+/g, '-').toLowerCase()}.pdf`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to generate PDF')
    } finally {
      setPdfLoading(false)
    }
  }

  const cellKey = (day: string, mealType: string) => `${day}-${mealType}`
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase()

  return (
    <Box>
      {/* Inject print styles */}
      <style>{PRINT_STYLES}</style>

      {/* Controls - hidden when printing */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" className="no-print" sx={{ mb: 2 }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <AIIcon sx={{ color: '#7C3AED', fontSize: 24 }} />
          <Box>
            <Typography variant="subtitle2" fontWeight={700}>Weekly Meal Plan</Typography>
            <Typography variant="caption" color="text.secondary">
              AI-generated 7-day plan for {personName}
            </Typography>
          </Box>
        </Stack>
        <Stack direction="row" spacing={1}>
          <Button
            variant="outlined" size="small"
            startIcon={loading ? <CircularProgress size={14} /> : <AIIcon />}
            onClick={generateWeek} disabled={loading}
            sx={{ textTransform: 'none', borderRadius: 2 }}
          >
            {weeklyPlan ? 'Regenerate' : 'Generate Plan'}
          </Button>
          {weeklyPlan && (
            <>
              <Button
                size="small"
                onClick={() => {
                  // Select all A
                  const allA: Record<string, 'a' | 'b'> = {}
                  for (const [day, meals] of Object.entries(weeklyPlan.week)) {
                    for (const mealType of Object.keys(meals)) {
                      allA[`${day}-${mealType}`] = 'a'
                    }
                  }
                  setSelectedOptions(allA)
                }}
                sx={{ textTransform: 'none', fontSize: '0.7rem', color: '#6B7280' }}
              >
                All A
              </Button>
              <Button
                size="small"
                onClick={() => {
                  // Select all B
                  const allB: Record<string, 'a' | 'b'> = {}
                  for (const [day, meals] of Object.entries(weeklyPlan.week)) {
                    for (const mealType of Object.keys(meals)) {
                      allB[`${day}-${mealType}`] = 'b'
                    }
                  }
                  setSelectedOptions(allB)
                }}
                sx={{ textTransform: 'none', fontSize: '0.7rem', color: '#6B7280' }}
              >
                All B
              </Button>
              {selectedCount > 0 && (
                <Chip
                  label={`${selectedCount}/${totalSlots} selected`}
                  size="small"
                  onDelete={() => setSelectedOptions({})}
                  sx={{ height: 22, bgcolor: '#ECFDF5', color: '#065F46', fontWeight: 600 }}
                />
              )}
              <Button
                size="small"
                startIcon={viewMode === 'grid' ? <CompareIcon sx={{ fontSize: 16 }} /> : <GridIcon sx={{ fontSize: 16 }} />}
                onClick={() => setViewMode(viewMode === 'grid' ? 'compare' : 'grid')}
                sx={{ textTransform: 'none', fontSize: '0.7rem', color: '#7C3AED', border: '1px solid #E5E7EB', borderRadius: 2 }}
              >
                {viewMode === 'grid' ? 'Compare' : 'Grid'}
              </Button>
              <Button
                variant="outlined" size="small"
                startIcon={pdfLoading ? <CircularProgress size={14} /> : <DownloadIcon />}
                onClick={handleDownloadPdf} disabled={pdfLoading}
                sx={{ textTransform: 'none', borderRadius: 2, borderColor: '#059669', color: '#059669' }}
              >
                {pdfLoading ? 'Generating...' : 'Download PDF'}
              </Button>
              <Button
                variant="contained" size="small"
                startIcon={<PrintIcon />}
                onClick={handlePrint}
                sx={{ textTransform: 'none', borderRadius: 2, bgcolor: '#0F4C81' }}
              >
                Print
              </Button>
            </>
          )}
        </Stack>
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)} className="no-print">
          {error}
        </Alert>
      )}

      {!weeklyPlan && !loading && (
        <Paper
          sx={{
            p: 6, textAlign: 'center', borderRadius: 2,
            border: '1px solid #E5E7EB', bgcolor: '#F8FAFC',
          }}
          className="no-print"
        >
          <MealIcon sx={{ fontSize: 56, color: '#7C3AED', mb: 2 }} />
          <Typography variant="h6" fontWeight={700} sx={{ mb: 1 }}>
            Generate a Weekly Meal Plan
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3, maxWidth: 480, mx: 'auto' }}>
            AI will create a complete 7-day meal plan tailored to {personName}'s dietary
            requirements, preferences, and nutritional needs.
          </Typography>
          <Button
            variant="contained" startIcon={<AIIcon />}
            onClick={generateWeek}
            sx={{ bgcolor: '#7C3AED', '&:hover': { bgcolor: '#6D28D9' }, borderRadius: 2, textTransform: 'none', px: 4 }}
          >
            Generate Weekly Plan
          </Button>
        </Paper>
      )}

      {loading && (
        <Paper sx={{ p: 6, textAlign: 'center', borderRadius: 2, border: '1px solid #E5E7EB' }}>
          <CircularProgress size={40} sx={{ color: '#7C3AED', mb: 2 }} />
          <Typography variant="body1" fontWeight={600}>Generating weekly meal plan...</Typography>
          <Typography variant="body2" color="text.secondary">
            Creating personalised meals for {personName}
          </Typography>
        </Paper>
      )}

      {/* Printable Plan */}
      {weeklyPlan && (
        <Box ref={printRef} className="print-weekly-meal-plan">
          {/* Print Header */}
          <Box className="print-header" sx={{ mb: 2, borderBottom: '2px solid #0F4C81', pb: 2 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
              <Box>
                <Typography variant="h5" fontWeight={800} color="#0F4C81">
                  Weekly Meal Plan
                </Typography>
                <Typography variant="subtitle1" color="#374151" sx={{ mt: 0.5 }}>
                  {personName}
                </Typography>
              </Box>
              <Stack alignItems="flex-end" spacing={0.5}>
                <Typography variant="caption" color="#6B7280">
                  Generated: {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                </Typography>
                <Typography variant="caption" color="#6B7280">
                  MeticleCare Nutrition Plan
                </Typography>
              </Stack>
            </Stack>
          </Box>

          {/* Person Context */}
          {weeklyPlan.person_context && (
            <Paper variant="outlined" sx={{ p: 2, mb: 2, bgcolor: '#F8FAFC' }} className="meal-card">
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                <Chip
                  size="small" label={`Diet: ${weeklyPlan.person_context.dietary_summary}`}
                  sx={{ bgcolor: '#ECFDF5', color: '#065F46', fontWeight: 600 }}
                />
                {weeklyPlan.person_context.texture_modification && weeklyPlan.person_context.texture_modification !== 'None' && (
                  <Chip
                    size="small" label={`Texture: ${weeklyPlan.person_context.texture_modification}`}
                    sx={{ bgcolor: '#FEF3C7', color: '#92400E', fontWeight: 600 }}
                  />
                )}
                {weeklyPlan.person_context.allergens?.map((a: string) => (
                  <Chip
                    key={a} size="small" label={`⚠ No ${a}`}
                    className="allergen-chip"
                    sx={{ bgcolor: '#FEE2E2', color: '#991B1B', fontWeight: 600 }}
                  />
                ))}
                <Chip
                  size="small" label={`💧 Fluid target: ${weeklyPlan.person_context.fluid_target_ml}ml/day`}
                  sx={{ bgcolor: '#E0F2FE', color: '#0284C7', fontWeight: 600 }}
                />
              </Stack>
            </Paper>
          )}

          {/* Allergen Warnings */}
          {weeklyPlan.allergen_warnings?.length > 0 && (
            <Alert severity="warning" sx={{ mb: 2 }} className="no-print">
              {weeklyPlan.allergen_warnings.join(' · ')}
            </Alert>
          )}

          {/* 7-Day Grid View */}
          {viewMode === 'grid' && (
          <Box sx={{ overflowX: 'auto' }}>
            <Box sx={{ minWidth: 900 }}>
              {/* Day Headers */}
              <Grid container spacing={1} sx={{ mb: 0.5 }}>
                <Grid item xs={1.5}>
                  <Box sx={{ py: 1 }} />
                </Grid>
                {DAYS.map(day => {
                  const isToday = day === today
                  return (
                    <Grid item xs key={day} sx={{ flex: 1 }}>
                      <Paper
                        className="day-header"
                        sx={{
                          py: 1, px: 1.5, textAlign: 'center',
                          bgcolor: isToday ? '#EFF6FF' : '#F9FAFB',
                          border: isToday ? '2px solid #3B82F6' : '1px solid #E5E7EB',
                          borderRadius: 2,
                        }}
                      >
                        <Typography
                          variant="subtitle2" fontWeight={700}
                          sx={{ color: isToday ? '#3B82F6' : 'inherit' }}
                        >
                          {DAY_LABELS[day]}
                        </Typography>
                      </Paper>
                    </Grid>
                  )
                })}
              </Grid>

              {/* Meal Rows */}
              {MEAL_TYPES.map(mt => (
                <Grid container spacing={1} key={mt.value} sx={{ mb: 1 }}>
                  <Grid item xs={1.5}>
                    <Paper
                      sx={{
                        py: 1.5, px: 1,
                        bgcolor: mt.color + '10',
                        borderLeft: `3px solid ${mt.color}`,
                        borderRadius: 2, height: '100%',
                        display: 'flex', alignItems: 'center',
                      }}
                    >
                      <Stack direction="row" spacing={0.5} alignItems="center">
                        <Typography fontSize="14px">{mt.icon}</Typography>
                        <Typography variant="caption" fontWeight={700} sx={{ color: mt.color, lineHeight: 1.2 }}>
                          {mt.label}
                        </Typography>
                      </Stack>
                    </Paper>
                  </Grid>
                  {DAYS.map(day => {
                    const slot = weeklyPlan.week?.[day]?.[mt.value]
                    const { primary, secondary } = getMealDisplay(slot)
                    const key = cellKey(day, mt.value)
                    const isExpanded = expandedCell === key
                    const hasData = primary || secondary
                    return (
                      <Grid item xs key={day} sx={{ flex: 1 }}>
                        <Paper
                          variant="outlined"
                          className="meal-cell"
                          onClick={() => hasData && setExpandedCell(isExpanded ? null : key)}
                          sx={{
                            py: 1, px: 1, minHeight: 60,
                            borderColor: isExpanded ? mt.color : '#E5E7EB',
                            borderWidth: isExpanded ? 2 : 1,
                            cursor: hasData ? 'pointer' : 'default',
                            transition: 'all 0.15s',
                            '&:hover': hasData ? { borderColor: mt.color + '80', boxShadow: 1 } : {},
                            borderRadius: 2,
                          }}
                        >
                          {primary ? (
                            <>
                              {/* Option A (Recommended) */}
                              <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mb: 0.25 }}>
                                <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: mt.color, flexShrink: 0 }} />
                                <Typography
                                  variant="caption" fontWeight={700}
                                  sx={{ display: 'block', lineHeight: 1.2, fontSize: '0.7rem', color: '#1F2937' }}
                                >
                                  {primary.name}
                                </Typography>
                              </Stack>
                              <Typography
                                variant="caption" color="text.secondary"
                                sx={{ fontSize: '0.6rem', display: 'block', ml: 1.25 }}
                              >
                                {primary.estimated_calories} kcal
                              </Typography>

                              {/* Option B (Alternative) */}
                              {secondary && (
                                <>
                                  <Box sx={{ borderTop: '1px dashed #E5E7EB', my: 0.5 }} />
                                  <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mb: 0.25 }}>
                                    <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: mt.color + '60', flexShrink: 0 }} />
                                    <Typography
                                      variant="caption" fontWeight={600}
                                      sx={{ display: 'block', lineHeight: 1.2, fontSize: '0.65rem', color: '#6B7280' }}
                                    >
                                      {secondary.name}
                                    </Typography>
                                  </Stack>
                                  <Typography
                                    variant="caption" color="text.secondary"
                                    sx={{ fontSize: '0.55rem', display: 'block', ml: 1.25 }}
                                  >
                                    {secondary.estimated_calories} kcal
                                  </Typography>
                                </>
                              )}

                              {isExpanded && (
                                <Box sx={{ mt: 1, pt: 1, borderTop: '1px solid #E5E7EB' }}>
                                  {/* Option A */}
                                  <Box sx={{ p: 0.75, borderRadius: 1, bgcolor: selectedOptions[`${day}-${mt.value}`] === 'a' ? mt.color + '15' : 'transparent', border: selectedOptions[`${day}-${mt.value}`] === 'a' ? `1px solid ${mt.color}40` : '1px solid transparent' }}>
                                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                                      <Typography variant="caption" fontWeight={700} sx={{ fontSize: '0.6rem', color: mt.color }}>Option A (Recommended)</Typography>
                                      <Button
                                        size="small"
                                        onClick={(e) => { e.stopPropagation(); toggleOption(day, mt.value, 'a') }}
                                        sx={{
                                          fontSize: '0.5rem', p: 0, minWidth: 0, textTransform: 'none',
                                          color: selectedOptions[`${day}-${mt.value}`] === 'a' ? mt.color : '#9CA3AF',
                                          fontWeight: selectedOptions[`${day}-${mt.value}`] === 'a' ? 700 : 400,
                                        }}
                                      >
                                        {selectedOptions[`${day}-${mt.value}`] === 'a' ? '✓ Selected' : 'Select'}
                                      </Button>
                                    </Stack>
                                    {primary.items?.map((item, i) => (
                                      <Typography key={i} variant="caption" sx={{ display: 'block', fontSize: '0.6rem', color: '#6B7280', lineHeight: 1.4 }}>
                                        • {item.name} ({item.portion})
                                      </Typography>
                                    ))}
                                    {primary.description && (
                                      <Typography variant="caption" sx={{ display: 'block', fontSize: '0.55rem', color: '#9CA3AF', fontStyle: 'italic', mt: 0.5 }}>
                                        {primary.description}
                                      </Typography>
                                    )}
                                  </Box>

                                  {/* Option B */}
                                  {secondary && (
                                    <Box sx={{ p: 0.75, borderRadius: 1, mt: 0.5, bgcolor: selectedOptions[`${day}-${mt.value}`] === 'b' ? mt.color + '15' : 'transparent', border: selectedOptions[`${day}-${mt.value}`] === 'b' ? `1px solid ${mt.color}40` : '1px solid transparent' }}>
                                      <Stack direction="row" justifyContent="space-between" alignItems="center">
                                        <Typography variant="caption" fontWeight={700} sx={{ fontSize: '0.6rem', color: mt.color + '99' }}>Option B (Alternative)</Typography>
                                        <Button
                                          size="small"
                                          onClick={(e) => { e.stopPropagation(); toggleOption(day, mt.value, 'b') }}
                                          sx={{
                                            fontSize: '0.5rem', p: 0, minWidth: 0, textTransform: 'none',
                                            color: selectedOptions[`${day}-${mt.value}`] === 'b' ? mt.color : '#9CA3AF',
                                            fontWeight: selectedOptions[`${day}-${mt.value}`] === 'b' ? 700 : 400,
                                          }}
                                        >
                                          {selectedOptions[`${day}-${mt.value}`] === 'b' ? '✓ Selected' : 'Select'}
                                        </Button>
                                      </Stack>
                                      {secondary.items?.map((item, i) => (
                                        <Typography key={i} variant="caption" sx={{ display: 'block', fontSize: '0.6rem', color: '#9CA3AF', lineHeight: 1.4 }}>
                                          • {item.name} ({item.portion})
                                        </Typography>
                                      ))}
                                      {secondary.description && (
                                        <Typography variant="caption" sx={{ display: 'block', fontSize: '0.55rem', color: '#D1D5DB', fontStyle: 'italic', mt: 0.5 }}>
                                          {secondary.description}
                                        </Typography>
                                      )}
                                    </Box>
                                  )}
                                </Box>
                              )}
                            </>
                          ) : (
                            <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.7rem' }}>—</Typography>
                          )}
                        </Paper>
                      </Grid>
                    )
                  })}
                </Grid>
              ))}
            </Box>
          </Box>
          )}

          {/* Compare View */}
          {viewMode === 'compare' && (
            <Box>
              {DAYS.map(day => (
                <Paper key={day} variant="outlined" sx={{ mb: 2, overflow: 'hidden' }} className="meal-card">
                  <Box sx={{ bgcolor: '#F9FAFB', px: 2, py: 1, borderBottom: '1px solid #E5E7EB' }}>
                    <Typography variant="subtitle2" fontWeight={700} color="#0F4C81">
                      {DAY_LABELS[day]}{day === today ? ' (Today)' : ''}
                    </Typography>
                  </Box>
                  <Box sx={{ p: 2 }}>
                    <Stack spacing={2}>
                      {MEAL_TYPES.map(mt => {
                        const slot = weeklyPlan.week?.[day]?.[mt.value]
                        const { primary, secondary } = getMealDisplay(slot)
                        if (!primary) return null
                        const key = `${day}-${mt.value}`
                        const selected = selectedOptions[key] || 'a'
                        return (
                          <Box key={mt.value}>
                            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                              <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: mt.color, flexShrink: 0 }} />
                              <Typography variant="caption" fontWeight={700} sx={{ color: mt.color, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                                {mt.label}
                              </Typography>
                            </Stack>
                            <Grid container spacing={2}>
                              {/* Option A */}
                              <Grid item xs={secondary ? 6 : 12}>
                                <Paper
                                  variant="outlined"
                                  onClick={() => toggleOption(day, mt.value, 'a')}
                                  sx={{
                                    p: 1.5, cursor: 'pointer', transition: 'all 0.15s',
                                    border: selected === 'a' ? `2px solid ${mt.color}` : '1px solid #E5E7EB',
                                    bgcolor: selected === 'a' ? mt.color + '08' : 'white',
                                    '&:hover': { borderColor: mt.color + '80' },
                                  }}
                                >
                                  <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.5 }}>
                                    <Typography variant="caption" fontWeight={700} sx={{ color: mt.color }}>Option A (Recommended)</Typography>
                                    <Button
                                      size="small"
                                      onClick={(e) => { e.stopPropagation(); toggleOption(day, mt.value, 'a') }}
                                      sx={{ fontSize: '0.55rem', p: 0, minWidth: 0, textTransform: 'none', color: selected === 'a' ? mt.color : '#9CA3AF', fontWeight: selected === 'a' ? 700 : 400 }}
                                    >
                                      {selected === 'a' ? '✓ Selected' : 'Select'}
                                    </Button>
                                  </Stack>
                                  <Typography variant="body2" fontWeight={600} sx={{ mb: 0.5 }}>{primary.name}</Typography>
                                  {primary.description && (
                                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>{primary.description}</Typography>
                                  )}
                                  <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
                                    <Chip label={`${primary.estimated_calories} kcal`} size="small" sx={{ height: 18, bgcolor: '#FEF3C7', color: '#92400E', fontSize: '0.6rem' }} />
                                    <Chip label={`${primary.items?.length || 0} items`} size="small" sx={{ height: 18, bgcolor: '#F3F4F6', color: '#374151', fontSize: '0.6rem' }} />
                                  </Stack>
                                  {primary.items && primary.items.length > 0 && (
                                    <Box>
                                      {primary.items.map((item, i) => (
                                        <Stack key={i} direction="row" spacing={0.5} sx={{ mb: 0.25 }}>
                                          <Typography variant="caption" sx={{ color: '#6B7280', fontSize: '0.65rem' }}>•</Typography>
                                          <Typography variant="caption" sx={{ color: '#374151', fontSize: '0.65rem', fontWeight: 500 }}>{item.name}</Typography>
                                          <Typography variant="caption" sx={{ color: '#9CA3AF', fontSize: '0.6rem' }}>({item.portion})</Typography>
                                        </Stack>
                                      ))}
                                    </Box>
                                  )}
                                </Paper>
                              </Grid>

                              {/* Option B */}
                              {secondary && (
                                <Grid item xs={6}>
                                  <Paper
                                    variant="outlined"
                                    onClick={() => toggleOption(day, mt.value, 'b')}
                                    sx={{
                                      p: 1.5, cursor: 'pointer', transition: 'all 0.15s',
                                      border: selected === 'b' ? `2px solid ${mt.color}` : '1px solid #E5E7EB',
                                      bgcolor: selected === 'b' ? mt.color + '08' : 'white',
                                      '&:hover': { borderColor: mt.color + '80' },
                                    }}
                                  >
                                    <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.5 }}>
                                      <Typography variant="caption" fontWeight={700} sx={{ color: mt.color + '99' }}>Option B (Alternative)</Typography>
                                      <Button
                                        size="small"
                                        onClick={(e) => { e.stopPropagation(); toggleOption(day, mt.value, 'b') }}
                                        sx={{ fontSize: '0.55rem', p: 0, minWidth: 0, textTransform: 'none', color: selected === 'b' ? mt.color : '#9CA3AF', fontWeight: selected === 'b' ? 700 : 400 }}
                                      >
                                        {selected === 'b' ? '✓ Selected' : 'Select'}
                                      </Button>
                                    </Stack>
                                    <Typography variant="body2" fontWeight={600} sx={{ mb: 0.5, color: '#374151' }}>{secondary.name}</Typography>
                                    {secondary.description && (
                                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>{secondary.description}</Typography>
                                    )}
                                    <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
                                      <Chip label={`${secondary.estimated_calories} kcal`} size="small" sx={{ height: 18, bgcolor: '#F3F4F6', color: '#6B7280', fontSize: '0.6rem' }} />
                                      <Chip label={`${secondary.items?.length || 0} items`} size="small" sx={{ height: 18, bgcolor: '#F9FAFB', color: '#9CA3AF', fontSize: '0.6rem' }} />
                                    </Stack>
                                    {secondary.items && secondary.items.length > 0 && (
                                      <Box>
                                        {secondary.items.map((item, i) => (
                                          <Stack key={i} direction="row" spacing={0.5} sx={{ mb: 0.25 }}>
                                            <Typography variant="caption" sx={{ color: '#D1D5DB', fontSize: '0.65rem' }}>•</Typography>
                                            <Typography variant="caption" sx={{ color: '#6B7280', fontSize: '0.65rem' }}>{item.name}</Typography>
                                            <Typography variant="caption" sx={{ color: '#D1D5DB', fontSize: '0.6rem' }}>({item.portion})</Typography>
                                          </Stack>
                                        ))}
                                      </Box>
                                    )}
                                  </Paper>
                                </Grid>
                              )}
                            </Grid>
                          </Box>
                        )
                      })}
                    </Stack>
                  </Box>
                </Paper>
              ))}
            </Box>
          )}

          {/* Weekly Totals */}
          {weeklyPlan.weekly_totals && (
            <Paper variant="outlined" sx={{ p: 2, mt: 2, bgcolor: '#F0FDF4' }} className="meal-card">
              <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1, color: '#166534' }}>
                Weekly Summary
              </Typography>
              <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
                <Chip
                  label={`~${weeklyPlan.weekly_totals.avg_daily_calories} kcal/day average`}
                  size="small" sx={{ bgcolor: '#DCFCE7', color: '#166534', fontWeight: 600 }}
                />
                <Chip
                  label={`~${weeklyPlan.weekly_totals.avg_daily_fluid_ml}ml fluid/day average`}
                  size="small" sx={{ bgcolor: '#E0F2FE', color: '#0284C7', fontWeight: 600 }}
                />
                <Chip
                  label={`${weeklyPlan.weekly_totals.total_unique_meals} unique meals`}
                  size="small" sx={{ bgcolor: '#F3F4F6', color: '#374151', fontWeight: 600 }}
                />
              </Stack>
            </Paper>
          )}

          {/* Nutritional Notes */}
          {weeklyPlan.nutritional_notes?.length > 0 && (
            <Paper variant="outlined" sx={{ p: 2, mt: 2 }} className="meal-card">
              <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1, color: '#374151' }}>
                Nutritional Notes
              </Typography>
              {weeklyPlan.nutritional_notes.map((n, i) => (
                <Typography key={i} variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                  • {n}
                </Typography>
              ))}
            </Paper>
          )}

          {/* Shopping List Section */}
          <Box sx={{ mt: 4 }} className="print-break-before">
            <ShoppingList
              weeklyPlan={weeklyPlan}
              filteredWeek={filteredWeek}
              selectionSummary={selectedCount > 0 ? `${selectedCount} of ${totalSlots} meals selected` : undefined}
            />
          </Box>

          {/* Footer - visible only when printing */}
          <Box sx={{ mt: 3, pt: 2, borderTop: '1px solid #E5E7EB', display: 'flex', justifyContent: 'space-between' }}>
            <Typography variant="caption" color="#9CA3AF">
              This meal plan was generated by MeticleCare AI. It should be reviewed by a qualified care professional
              before implementation. Always consider individual preferences, cultural needs, and clinical requirements.
            </Typography>
            <Typography variant="caption" color="#9CA3AF" sx={{ whiteSpace: 'nowrap', ml: 2 }}>
              MeticleCare © {new Date().getFullYear()}
            </Typography>
          </Box>
        </Box>
      )}
    </Box>
  )
}
