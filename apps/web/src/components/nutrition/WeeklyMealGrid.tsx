import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box, Typography, Paper, Grid, Button, Chip, Stack,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem,
  CircularProgress, Alert, IconButton, Tooltip,
} from '@mui/material'
import {
  AutoAwesome as AIIcon, Save as SaveIcon, Refresh as RefreshIcon,
  LocalDining as FoodIcon, OpenInNew as OpenInNewIcon,
} from '@mui/icons-material'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../../services/api'

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
  monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed', thursday: 'Thu',
  friday: 'Fri', saturday: 'Sat', sunday: 'Sun',
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
  name?: string
  items?: Array<{ name: string; portion: string }>
  estimated_calories?: number
}

function getMealDisplay(slot: MealSlot | undefined): { primary: WeeklyMeal | null; secondary: WeeklyMeal | null } {
  if (!slot) return { primary: null, secondary: null }
  if (slot.option_a) return { primary: slot.option_a, secondary: slot.option_b || null }
  if (slot.name) return { primary: { name: slot.name, items: slot.items || [], estimated_calories: slot.estimated_calories || 0 }, secondary: null }
  return { primary: null, secondary: null }
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

interface Props {
  people: any[]
}

export default function WeeklyMealGrid({ people }: Props) {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [personId, setPersonId] = useState('')
  const [weeklyPlan, setWeeklyPlan] = useState<WeeklyPlan | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expandedCell, setExpandedCell] = useState<string | null>(null)
  const [saveDlg, setSaveDlg] = useState<{ open: boolean; day: string; mealType: string; meal: WeeklyMeal | null }>({ open: false, day: '', mealType: '', meal: null })

  const generateWeek = async () => {
    if (!personId) return
    setLoading(true)
    setError(null)
    setWeeklyPlan(null)
    try {
      const res = await api.post('/ai/generate/weekly-meal-plan', {
        personId,
        specialRequirements: '',
      })
      setWeeklyPlan(res.data.weeklyPlan)
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to generate weekly plan')
    } finally {
      setLoading(false)
    }
  }

  const saveAsTemplate = useMutation({
    mutationFn: (data: any) => api.post('/nutrition/meal-plans', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['meal-plans'] })
      setSaveDlg({ open: false, day: '', mealType: '', meal: null })
    },
  })

  const handleSave = () => {
    if (!saveDlg.meal || !personId) return
    const dayMap: Record<string, string> = {
      monday: 'monday', tuesday: 'tuesday', wednesday: 'wednesday',
      thursday: 'thursday', friday: 'friday', saturday: 'saturday', sunday: 'sunday',
    }
    saveAsTemplate.mutate({
      name: `${saveDlg.meal.name} — ${DAY_LABELS[saveDlg.day]}`,
      description: '',
      meal_type: saveDlg.mealType,
      day_of_week: dayMap[saveDlg.day],
      items: (saveDlg.meal.items || []).map((item: any) => ({
        food_name: item.name,
        portion_size: item.portion,
      })),
    })
  }

  const cellKey = (day: string, mealType: string) => `${day}-${mealType}`

  return (
    <Box>
      {/* Generator Controls */}
      <Paper variant="outlined" sx={{ p: 2.5, mb: 3, display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
        <AIIcon sx={{ color: '#7C3AED', fontSize: 28 }} />
        <Box sx={{ flex: 1, minWidth: 200 }}>
          <Typography variant="subtitle2" fontWeight={700}>AI Weekly Meal Planner</Typography>
          <Typography variant="caption" color="text.secondary">Generate a complete 7-day plan tailored to a person's dietary needs</Typography>
        </Box>
        <TextField
          select size="small" label="Select Person" value={personId}
          onChange={e => setPersonId(e.target.value)} sx={{ minWidth: 250 }}
        >
          <MenuItem value=""><em>Choose a person</em></MenuItem>
          {people.map((p: any) => (
            <MenuItem key={p.id} value={p.id}>{p.first_name} {p.last_name} ({p.location_name || 'N/A'})</MenuItem>
          ))}
        </TextField>
        <Button
          variant="contained" startIcon={loading ? <CircularProgress size={16} /> : <AIIcon />}
          onClick={generateWeek} disabled={!personId || loading}
          sx={{ bgcolor: '#7C3AED', '&:hover': { bgcolor: '#6D28D9' }, borderRadius: 2 }}
        >
          {loading ? 'Generating...' : 'Generate Weekly Plan'}
        </Button>
        {personId && (
          <Tooltip title="View person profile with printable meal plan">
            <IconButton
              size="small"
              onClick={() => navigate(`/people/${personId}?tab=nutrition`)}
              sx={{ color: '#7C3AED', border: '1px solid #E5E7EB', borderRadius: 2 }}
            >
              <OpenInNewIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
      </Paper>

      {error && <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>{error}</Alert>}

      {/* Weekly Plan Grid */}
      {weeklyPlan && (
        <Box>
          {/* Plan Header */}
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
            <Box>
              <Typography variant="h6" fontWeight={700}>{weeklyPlan.plan_name}</Typography>
              <Typography variant="body2" color="text.secondary">{weeklyPlan.description}</Typography>
            </Box>
            <Stack direction="row" spacing={1}>
              <Button startIcon={<RefreshIcon />} onClick={generateWeek} disabled={loading} variant="outlined" size="small">
                Regenerate
              </Button>
            </Stack>
          </Stack>

          {/* Person Context */}
          {weeklyPlan.person_context && (
            <Paper variant="outlined" sx={{ p: 2, mb: 2, bgcolor: '#F8F9FA' }}>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                <Chip size="small" label={`Diet: ${weeklyPlan.person_context.dietary_summary}`} />
                {weeklyPlan.person_context.texture_modification !== 'None' && (
                  <Chip size="small" label={`Texture: ${weeklyPlan.person_context.texture_modification}`} color="warning" />
                )}
                {weeklyPlan.person_context.allergens?.map((a: string) => (
                  <Chip key={a} size="small" label={`No ${a}`} color="error" variant="outlined" />
                ))}
                <Chip size="small" label={`Fluid: ${weeklyPlan.person_context.fluid_target_ml}ml/day`} />
              </Stack>
            </Paper>
          )}

          {/* Weekly Totals */}
          {weeklyPlan.weekly_totals && (
            <Paper variant="outlined" sx={{ p: 2, mb: 2, bgcolor: '#F0FDF4' }}>
              <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
                <Chip label={`~${weeklyPlan.weekly_totals.avg_daily_calories} kcal/day`} color="primary" size="small" />
                <Chip label={`~${weeklyPlan.weekly_totals.avg_daily_fluid_ml}ml fluid/day`} color="info" size="small" />
                <Chip label={`${weeklyPlan.weekly_totals.total_unique_meals} unique meals`} size="small" />
              </Stack>
            </Paper>
          )}

          {/* Allergen Warnings */}
          {weeklyPlan.allergen_warnings?.length > 0 && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              {weeklyPlan.allergen_warnings.join(' · ')}
            </Alert>
          )}

          {/* 7-Day Grid */}
          <Box sx={{ overflowX: 'auto', pb: 2 }}>
            <Box sx={{ minWidth: 900 }}>
              {/* Day Headers */}
              <Grid container spacing={1} sx={{ mb: 1 }}>
                <Grid item xs={1.5}>
                  <Box sx={{ py: 1 }} />
                </Grid>
                {DAYS.map(day => (
                  <Grid item xs key={day} sx={{ flex: 1 }}>
                    <Paper
                      sx={{
                        py: 1, px: 1.5, textAlign: 'center',
                        bgcolor: day === new Date().toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase() ? '#EFF6FF' : '#F9FAFB',
                        border: day === new Date().toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase() ? '2px solid #3B82F6' : '1px solid #E5E7EB',
                        borderRadius: 2,
                      }}
                    >
                      <Typography variant="subtitle2" fontWeight={700} sx={{ color: day === new Date().toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase() ? '#3B82F6' : 'inherit' }}>
                        {DAY_LABELS[day]}
                      </Typography>
                    </Paper>
                  </Grid>
                ))}
              </Grid>

              {/* Meal Rows */}
              {MEAL_TYPES.map(mt => (
                <Grid container spacing={1} key={mt.value} sx={{ mb: 1 }}>
                  <Grid item xs={1.5}>
                    <Paper sx={{ py: 1.5, px: 1, bgcolor: mt.color + '10', borderLeft: `3px solid ${mt.color}`, borderRadius: 2, height: '100%' }}>
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
                              <Stack direction="row" alignItems="center" spacing={0.5}>
                                <Box sx={{ width: 5, height: 5, borderRadius: '50%', bgcolor: mt.color, flexShrink: 0 }} />
                                <Typography variant="caption" fontWeight={700} sx={{ display: 'block', lineHeight: 1.2, fontSize: '0.7rem' }}>
                                  {primary.name}
                                </Typography>
                              </Stack>
                              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.6rem', display: 'block', ml: 1.25 }}>
                                {primary.estimated_calories} kcal
                              </Typography>
                              {secondary && (
                                <>
                                  <Box sx={{ borderTop: '1px dashed #E5E7EB', my: 0.5 }} />
                                  <Stack direction="row" alignItems="center" spacing={0.5}>
                                    <Box sx={{ width: 5, height: 5, borderRadius: '50%', bgcolor: mt.color + '60', flexShrink: 0 }} />
                                    <Typography variant="caption" fontWeight={600} sx={{ display: 'block', lineHeight: 1.2, fontSize: '0.6rem', color: '#6B7280' }}>
                                      {secondary.name}
                                    </Typography>
                                  </Stack>
                                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.55rem', display: 'block', ml: 1.25 }}>
                                    {secondary.estimated_calories} kcal
                                  </Typography>
                                </>
                              )}
                              {isExpanded && (
                                <Box sx={{ mt: 1, pt: 1, borderTop: '1px solid #E5E7EB' }}>
                                  <Typography variant="caption" fontWeight={700} sx={{ fontSize: '0.6rem', color: mt.color }}>Option A:</Typography>
                                  {primary.items?.slice(0, 4).map((item, i) => (
                                    <Typography key={i} variant="caption" sx={{ display: 'block', fontSize: '0.6rem', color: '#6B7280', lineHeight: 1.4 }}>
                                      • {item.name} ({item.portion})
                                    </Typography>
                                  ))}
                                  {primary.items && primary.items.length > 4 && (
                                    <Typography variant="caption" sx={{ fontSize: '0.55rem', color: '#9CA3AF' }}>
                                      +{primary.items.length - 4} more
                                    </Typography>
                                  )}
                                  {secondary && (
                                    <>
                                      <Typography variant="caption" fontWeight={700} sx={{ fontSize: '0.6rem', color: mt.color + '99', mt: 1, display: 'block' }}>Option B:</Typography>
                                      {secondary.items?.slice(0, 4).map((item, i) => (
                                        <Typography key={i} variant="caption" sx={{ display: 'block', fontSize: '0.6rem', color: '#9CA3AF', lineHeight: 1.4 }}>
                                          • {item.name} ({item.portion})
                                        </Typography>
                                      ))}
                                    </>
                                  )}
                                  <Button
                                    size="small" startIcon={<SaveIcon sx={{ fontSize: 12 }} />}
                                    sx={{ mt: 0.5, fontSize: '0.6rem', p: 0, minWidth: 0, textTransform: 'none' }}
                                    onClick={(e) => { e.stopPropagation(); setSaveDlg({ open: true, day, mealType: mt.value, meal: primary }); }}
                                  >
                                    Save as template
                                  </Button>
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

          {/* Nutritional Notes */}
          {weeklyPlan.nutritional_notes?.length > 0 && (
            <Paper variant="outlined" sx={{ p: 2, mt: 2 }}>
              <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>Nutritional Notes</Typography>
              {weeklyPlan.nutritional_notes.map((n, i) => (
                <Typography key={i} variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>• {n}</Typography>
              ))}
            </Paper>
          )}
        </Box>
      )}

      {/* Save Template Dialog */}
      <Dialog open={saveDlg.open} onClose={() => setSaveDlg({ open: false, day: '', mealType: '', meal: null })} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Save as Meal Plan Template</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Save "{saveDlg.meal?.name}" as a reusable template for {DAY_LABELS[saveDlg.day]} {MEAL_TYPES.find(m => m.value === saveDlg.mealType)?.label}.
          </Typography>
          {saveDlg.meal?.items && (
            <Box>
              <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>Items:</Typography>
              {saveDlg.meal.items.map((item, i) => (
                <Stack key={i} direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
                  <FoodIcon sx={{ fontSize: 14, color: MEAL_TYPES.find(m => m.value === saveDlg.mealType)?.color || 'primary.main' }} />
                  <Typography variant="body2">{item.name}</Typography>
                  <Typography variant="caption" color="text.secondary">({item.portion})</Typography>
                </Stack>
              ))}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSaveDlg({ open: false, day: '', mealType: '', meal: null })}>Cancel</Button>
          <Button variant="contained" onClick={handleSave} disabled={saveAsTemplate.isPending}>
            {saveAsTemplate.isPending ? 'Saving...' : 'Save Template'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
