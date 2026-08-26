import { useState } from 'react'
import {
  Box, Typography, Paper, Stack, Button, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Select, MenuItem, FormControl, InputLabel, Chip,
  IconButton, CircularProgress, Tabs, Tab,
  LinearProgress, Switch, FormControlLabel, Divider,
} from '@mui/material'
import {
  Add as AddIcon, Delete as DeleteIcon, Edit as EditIcon, Close as CloseIcon,
  Restaurant as MealIcon, LocalDrink as WaterIcon,  Warning as WarningIcon, CheckCircle as CheckIcon, Cancel as CancelIcon,
  CalendarMonth as CalendarIcon,
} from '@mui/icons-material'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../../services/api'
import { SectionHeader, ConfirmDialog, EmptyRow } from '../../components/ui'

const today = () => new Date().toISOString().split('T')[0]

const MEAL_TYPES = [
  { value: 'breakfast', label: 'Breakfast', color: '#F59E0B' },
  { value: 'morning_snack', label: 'Morning Snack', color: '#FB923C' },
  { value: 'lunch', label: 'Lunch', color: '#10B981' },
  { value: 'afternoon_snack', label: 'Afternoon Snack', color: '#8B5CF6' },
  { value: 'dinner', label: 'Dinner', color: '#3B82F6' },
  { value: 'evening_snack', label: 'Evening Snack', color: '#EC4899' },
  { value: 'supplement', label: 'Supplement', color: '#6366F1' },
]

const APPETITE_LEVELS = [
  { value: 'poor', label: 'Poor', color: '#DC2626', icon: '😟' },
  { value: 'fair', label: 'Fair', color: '#D97706', icon: '😐' },
  { value: 'good', label: 'Good', color: '#16A34A', icon: '🙂' },
  { value: 'excellent', label: 'Excellent', color: '#059669', icon: '😊' },
]

const CONSUMED_COLORS = {
  red: { bg: '#FEE2E2', text: '#991B1B', label: '0-25%' },
  orange: { bg: '#FFF7ED', text: '#9A3412', label: '26-50%' },
  yellow: { bg: '#FEF9C3', text: '#854D0E', label: '51-75%' },
  green: { bg: '#DCFCE7', text: '#166534', label: '76-100%' },
}

function getConsumedColor(pct?: number) {
  if (!pct || pct <= 25) return CONSUMED_COLORS.red
  if (pct <= 50) return CONSUMED_COLORS.orange
  if (pct <= 75) return CONSUMED_COLORS.yellow
  return CONSUMED_COLORS.green
}

function getMealTypeInfo(type: string) {
  return MEAL_TYPES.find(m => m.value === type) || { label: type, color: '#6B7280' }
}

function getMealTypeColor(type: string) {
  return getMealTypeInfo(type).color
}

// ─── Dietary Profile Section ───
function DietaryProfileSection({ personId }: { personId: string }) {
  const qc = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState<any>({})

  const { data: profile, isLoading } = useQuery({
    queryKey: ['dietary-profile', personId],
    queryFn: () => api.get(`/nutrition/${personId}/dietary-profile`).then(r => r.data),
  })

  const saveMutation = useMutation({
    mutationFn: (data: any) => api.post(`/nutrition/${personId}/dietary-profile`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['dietary-profile', personId] })
      setEditing(false)
    },
  })

  const startEdit = () => {
    setForm({
      dietary_type: profile?.dietary_type || '',
      texture_modified: profile?.texture_modified || '',
      vegetarian: profile?.vegetarian || false,
      vegan: profile?.vegan || false,
      halal: profile?.halal || false,
      kosher: profile?.kosher || false,
      gluten_free: profile?.gluten_free || false,
      dairy_free: profile?.dairy_free || false,
      nut_allergy: profile?.nut_allergy || false,
      other_allergies: profile?.other_allergies || '',
      food_preferences: profile?.food_preferences || '',
      food_dislikes: profile?.food_dislikes || '',
      appetite_level: profile?.appetite_level || '',
      eating_abilities: profile?.eating_abilities || '',
      additional_notes: profile?.additional_notes || '',
    })
    setEditing(true)
  }

  if (isLoading) return <Box sx={{ py: 3 }}><CircularProgress size={24} /></Box>

  const hasProfile = profile && (profile.dietary_type || profile.food_preferences || profile.vegetarian || profile.vegan || profile.halal || profile.kosher || profile.gluten_free || profile.dairy_free || profile.nut_allergy)

  return (
    <Box>
      <SectionHeader
        title="Dietary Profile"
        action={
          <Button size="small" variant="contained" startIcon={<EditIcon />} onClick={startEdit} sx={{ bgcolor: '#0F4C81', textTransform: 'none' }}>
            {hasProfile ? 'Edit Profile' : 'Set Up Profile'}
          </Button>
        }
      />

      {!hasProfile ? (
        <Paper sx={{ p: 4, textAlign: 'center', borderRadius: 2, border: '1px solid #E5E7EB', bgcolor: '#F0FDF4' }}>
          <MealIcon sx={{ fontSize: 48, color: '#16A34A', mb: 1 }} />
          <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 0.5 }}>No dietary profile yet</Typography>
          <Typography variant="body2" color="#6B7280" sx={{ mb: 2 }}>
            Set up this person's dietary requirements, preferences, and allergies to ensure safe and person-centred nutrition care.
          </Typography>
          <Button variant="contained" startIcon={<AddIcon />} onClick={startEdit} sx={{ bgcolor: '#16A34A', textTransform: 'none' }}>
            Set Up Dietary Profile
          </Button>
        </Paper>
      ) : (
        <Paper sx={{ p: 2.5, borderRadius: 2, border: '1px solid #E5E7EB' }}>
          <Stack spacing={2}>
            {/* Dietary Requirements */}
            {(profile.dietary_type || profile.texture_modified) && (
              <Box>
                <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1, color: '#374151' }}>Dietary Requirements</Typography>
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  {profile.dietary_type && <Chip label={profile.dietary_type} size="small" sx={{ bgcolor: '#ECFDF5', color: '#065F46', fontWeight: 600 }} />}
                  {profile.texture_modified && <Chip label={`Texture: ${profile.texture_modified}`} size="small" sx={{ bgcolor: '#FEF3C7', color: '#92400E', fontWeight: 600 }} />}
                </Stack>
              </Box>
            )}

            {/* Dietary Flags */}
            <Box>
              <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1, color: '#374151' }}>Dietary Flags</Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                {profile.vegetarian && <Chip label="Vegetarian" size="small" color="success" variant="outlined" />}
                {profile.vegan && <Chip label="Vegan" size="small" color="success" variant="outlined" />}
                {profile.halal && <Chip label="Halal" size="small" color="info" variant="outlined" />}
                {profile.kosher && <Chip label="Kosher" size="small" color="info" variant="outlined" />}
                {profile.gluten_free && <Chip label="Gluten Free" size="small" color="warning" variant="outlined" />}
                {profile.dairy_free && <Chip label="Dairy Free" size="small" color="warning" variant="outlined" />}
                {profile.nut_allergy && <Chip icon={<WarningIcon sx={{ fontSize: 14 }} />} label="Nut Allergy" size="small" color="error" variant="filled" />}
                {!profile.vegetarian && !profile.vegan && !profile.halal && !profile.kosher && !profile.gluten_free && !profile.dairy_free && !profile.nut_allergy && (
                  <Typography variant="body2" color="#9CA3AF">No dietary flags set</Typography>
                )}
              </Stack>
            </Box>

            {profile.other_allergies && (
              <Box>
                <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 0.5, color: '#991B1B' }}>Other Allergies / Intolerances</Typography>
                <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', bgcolor: '#FEF2F2', p: 1.5, borderRadius: 1, border: '1px solid #FECACA' }}>
                  {profile.other_allergies}
                </Typography>
              </Box>
            )}

            {/* Preferences & Dislikes */}
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              {profile.food_preferences && (
                <Box sx={{ flex: 1 }}>
                  <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 0.5, color: '#166534' }}>Favourite Foods</Typography>
                  <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{profile.food_preferences}</Typography>
                </Box>
              )}
              {profile.food_dislikes && (
                <Box sx={{ flex: 1 }}>
                  <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 0.5, color: '#9A3412' }}>Foods Disliked</Typography>
                  <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{profile.food_dislikes}</Typography>
                </Box>
              )}
            </Stack>

            {/* Appetite & Abilities */}
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              {profile.appetite_level && (
                <Box>
                  <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 0.5 }}>Appetite</Typography>
                  <Chip
                    label={`${APPETITE_LEVELS.find(a => a.value === profile.appetite_level)?.icon || ''} ${profile.appetite_level}`}
                    size="small"
                    sx={{ bgcolor: APPETITE_LEVELS.find(a => a.value === profile.appetite_level)?.color + '20', color: APPETITE_LEVELS.find(a => a.value === profile.appetite_level)?.color, fontWeight: 600 }}
                  />
                </Box>
              )}
              {profile.eating_abilities && (
                <Box sx={{ flex: 1 }}>
                  <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 0.5 }}>Eating Abilities / Needs</Typography>
                  <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{profile.eating_abilities}</Typography>
                </Box>
              )}
            </Stack>

            {profile.additional_notes && (
              <Box>
                <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 0.5 }}>Additional Notes</Typography>
                <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', bgcolor: '#F9FAFB', p: 1.5, borderRadius: 1 }}>
                  {profile.additional_notes}
                </Typography>
              </Box>
            )}

            {profile.recorded_by_name && (
              <Typography variant="caption" color="#9CA3AF">
                Last updated by {profile.recorded_by_name}{profile.updated_at ? ` on ${new Date(profile.updated_at).toLocaleDateString('en-GB')}` : ''}
              </Typography>
            )}
          </Stack>
        </Paper>
      )}

      {/* Edit Dialog */}
      <Dialog open={editing} onClose={() => setEditing(false)} maxWidth="sm" fullWidth>
        <Box component="form" onSubmit={e => { e.preventDefault(); saveMutation.mutate(form) }}>
          <DialogTitle sx={{ fontWeight: 800 }}>Dietary Profile</DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ mt: 1 }}>
              <TextField label="Dietary Type" fullWidth value={form.dietary_type || ''} onChange={e => setForm((f: any) => ({ ...f, dietary_type: e.target.value }))} placeholder="e.g., Regular, Soft, Pureed, Fortified" />
              <TextField label="Texture Modification" fullWidth value={form.texture_modified || ''} onChange={e => setForm((f: any) => ({ ...f, texture_modified: e.target.value }))} placeholder="e.g., Soft, Minced & Moist, Pureed, Thickened fluids" />

              <Divider />
              <Typography variant="subtitle2" fontWeight={700}>Dietary Requirements</Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                {[{ key: 'vegetarian', label: 'Vegetarian' }, { key: 'vegan', label: 'Vegan' }, { key: 'halal', label: 'Halal' }, { key: 'kosher', label: 'Kosher' }, { key: 'gluten_free', label: 'Gluten Free' }, { key: 'dairy_free', label: 'Dairy Free' }].map(f => (
                  <FormControlLabel key={f.key} control={<Switch size="small" checked={!!form[f.key]} onChange={e => setForm((prev: any) => ({ ...prev, [f.key]: e.target.checked }))} />} label={f.label} />
                ))}
              </Stack>

              <Divider />
              <Typography variant="subtitle2" fontWeight={700}>Allergies & Intolerances</Typography>
              <FormControlLabel control={<Switch size="small" checked={!!form.nut_allergy} onChange={e => setForm((f: any) => ({ ...f, nut_allergy: e.target.checked }))} />} label={<Stack direction="row" spacing={0.5} alignItems="center"><WarningIcon sx={{ fontSize: 16, color: '#DC2626' }} /><span>Nut Allergy</span></Stack>} />
              <TextField label="Other Allergies / Intolerances" fullWidth multiline rows={2} value={form.other_allergies || ''} onChange={e => setForm((f: any) => ({ ...f, other_allergies: e.target.value }))} placeholder="e.g., Soya, Shellfish, Eggs, Coeliac" />

              <Divider />
              <Typography variant="subtitle2" fontWeight={700}>Preferences & Likes</Typography>
              <TextField label="Favourite Foods" fullWidth multiline rows={2} value={form.food_preferences || ''} onChange={e => setForm((f: any) => ({ ...f, food_preferences: e.target.value }))} placeholder="e.g., Roast chicken, shepherd's pie, custard" />
              <TextField label="Foods Disliked" fullWidth multiline rows={2} value={form.food_dislikes || ''} onChange={e => setForm((f: any) => ({ ...f, food_dislikes: e.target.value }))} placeholder="e.g., Fish, mushrooms, spicy food" />

              <Divider />
              <Typography variant="subtitle2" fontWeight={700}>Clinical & Support</Typography>
              <FormControl fullWidth>
                <InputLabel>Typical Appetite Level</InputLabel>
                <Select value={form.appetite_level || ''} label="Typical Appetite Level" onChange={e => setForm((f: any) => ({ ...f, appetite_level: e.target.value }))}>
                  <MenuItem value="">Not specified</MenuItem>
                  {APPETITE_LEVELS.map(a => <MenuItem key={a.value} value={a.value}>{a.icon} {a.label}</MenuItem>)}
                </Select>
              </FormControl>
              <TextField label="Eating Abilities / Support Needs" fullWidth multiline rows={2} value={form.eating_abilities || ''} onChange={e => setForm((f: any) => ({ ...f, eating_abilities: e.target.value }))} placeholder="e.g., Requires assistance with cutlery, needs food cut up, needs reminding to eat" />
              <TextField label="Additional Notes" fullWidth multiline rows={2} value={form.additional_notes || ''} onChange={e => setForm((f: any) => ({ ...f, additional_notes: e.target.value }))} placeholder="e.g., Prefers small portions, eats slowly, likes meals at regular times" />
            </Stack>
          </DialogContent>
          <DialogActions sx={{ p: 3 }}>
            <Button onClick={() => setEditing(false)}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={saveMutation.isPending} sx={{ bgcolor: '#16A34A' }}>
              {saveMutation.isPending ? <CircularProgress size={20} /> : 'Save Profile'}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>
    </Box>
  )
}

// ─── Daily Summary Card ───
function DailySummaryCard({ personId, fluidTarget = 2000 }: { personId: string; fluidTarget?: number }) {
  const [date, setDate] = useState(today())

  const { data: summary, isLoading } = useQuery({
    queryKey: ['meal-summary', personId, date],
    queryFn: () => api.get(`/nutrition/${personId}/meals/summary?date=${date}`).then(r => r.data),
  })

  if (isLoading) return <Box sx={{ py: 2 }}><CircularProgress size={20} /></Box>

  const totalFluid = summary?.total_fluid_ml || 0
  const fluidTargetMl = fluidTarget || 2000
  const fluidPercent = Math.min((totalFluid / fluidTargetMl) * 100, 100)
  const mealCount = summary?.meal_count || 0
  const refusedCount = summary?.refused_count || 0
  const avgConsumed = summary?.avg_consumed_percent || 0
  const consumedColor = getConsumedColor(avgConsumed)

  return (
    <Paper sx={{ p: 2.5, borderRadius: 2, border: '1px solid #E5E7EB', bgcolor: '#FAFBFC' }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <CalendarIcon sx={{ fontSize: 18, color: '#0F4C81' }} />
          <Typography variant="subtitle2" fontWeight={700}>Daily Summary</Typography>
        </Stack>
        <TextField type="date" size="small" value={date} onChange={e => setDate(e.target.value)} sx={{ width: 160 }} InputLabelProps={{ shrink: true }} />
      </Stack>

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
        {/* Meals */}
        <Box sx={{ flex: 1, p: 1.5, bgcolor: 'white', borderRadius: 1.5, border: '1px solid #E5E7EB' }}>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
            <MealIcon sx={{ fontSize: 18, color: '#059669' }} />
            <Typography variant="subtitle2" fontWeight={700}>Meals</Typography>
          </Stack>
          <Stack direction="row" spacing={2} alignItems="baseline">
            <Typography variant="h4" fontWeight={800} color="#059669">{mealCount}</Typography>
            {refusedCount > 0 && (
              <Stack direction="row" alignItems="center" spacing={0.5}>
                <CancelIcon sx={{ fontSize: 14, color: '#DC2626' }} />
                <Typography variant="body2" color="#DC2626" fontWeight={600}>{refusedCount} refused</Typography>
              </Stack>
            )}
          </Stack>
        </Box>

        {/* Consumed */}
        <Box sx={{ flex: 1, p: 1.5, bgcolor: 'white', borderRadius: 1.5, border: '1px solid #E5E7EB' }}>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
            <CheckIcon sx={{ fontSize: 18, color: '#16A34A' }} />
            <Typography variant="subtitle2" fontWeight={700}>Avg Consumed</Typography>
          </Stack>
          <Stack alignItems="flex-start">
            <Stack direction="row" alignItems="baseline" spacing={1}>
              <Typography variant="h4" fontWeight={800} sx={{ color: consumedColor.text }}>{avgConsumed}%</Typography>
              <Chip label={consumedColor.label} size="small" sx={{ bgcolor: consumedColor.bg, color: consumedColor.text, fontWeight: 600 }} />
            </Stack>
          </Stack>
        </Box>

        {/* Fluid */}
        <Box sx={{ flex: 1, p: 1.5, bgcolor: 'white', borderRadius: 1.5, border: '1px solid #E5E7EB' }}>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
            <WaterIcon sx={{ fontSize: 18, color: '#0284C7' }} />
            <Typography variant="subtitle2" fontWeight={700}>Fluid Intake</Typography>
          </Stack>
          <Stack>
            <Stack direction="row" alignItems="baseline" spacing={1}>
              <Typography variant="h4" fontWeight={800} color="#0284C7">{totalFluid}<span style={{ fontSize: '0.7em', fontWeight: 600 }}>ml</span></Typography>
              <Typography variant="caption" color="#64748B">of {fluidTargetMl}ml</Typography>
            </Stack>
            <Box sx={{ width: '100%', bgcolor: '#E2E8F0', borderRadius: 1, height: 6, mt: 0.5, overflow: 'hidden' }}>
              <Box sx={{ width: `${fluidPercent}%`, bgcolor: fluidPercent >= 75 ? '#0284C7' : fluidPercent >= 50 ? '#F59E0B' : '#EF4444', height: 6, borderRadius: 1, transition: 'width 0.3s' }} />
            </Box>
          </Stack>
        </Box>
      </Stack>
    </Paper>
  )
}

// ─── Meal Records Section ───
function MealRecordsSection({ personId }: { personId: string }) {
  const qc = useQueryClient()
  const [addOpen, setAddOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [viewMeal, setViewMeal] = useState<any>(null)
  const [dateFilter, setDateFilter] = useState(today())
  const { deleteTarget, setDeleteTarget } = useDeleteConfirm()
  const [mealForm, setMealForm] = useState({
    meal_date: today(),
    meal_time: '',
    meal_type: 'lunch',
    notes: '',
    appetite_level: '',
    amount_offered: '',
    amount_consumed: '',
    consumed_percent: 50,
    refused: false,
    refusal_reason: '',
    staff_concerns: '',
    fluid_ml: 0,
    items: [] as Array<{ food_name: string; portion_size: string; allergens: string; preparation_notes: string }>,
  })

  const { data: meals = [], isLoading } = useQuery({
    queryKey: ['meals', personId, dateFilter],
    queryFn: () => api.get(`/nutrition/${personId}/meals?date=${dateFilter}`).then(r => r.data),
  })

  const { data: mealDetail } = useQuery({
    queryKey: ['meal-detail', viewMeal?.id],
    queryFn: () => viewMeal ? api.get(`/nutrition/meal/${viewMeal.id}`).then(r => r.data) : null,
    enabled: !!viewMeal?.id,
  })

  const addMealMut = useMutation({
    mutationFn: (data: any) => api.post(`/nutrition/${personId}/meals`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['meals'] })
      qc.invalidateQueries({ queryKey: ['meal-summary'] })
      setAddOpen(false)
      resetForm()
    },
  })

  const updateMealMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.patch(`/nutrition/meal/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['meals'] })
      qc.invalidateQueries({ queryKey: ['meal-summary'] })
      setAddOpen(false)
      setEditId(null)
      resetForm()
    },
  })

  const deleteMealMut = useMutation({
    mutationFn: (id: string) => api.delete(`/nutrition/meal/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['meals'] })
      qc.invalidateQueries({ queryKey: ['meal-summary'] })
      setDeleteTarget(null)
    },
  })

  const resetForm = () => {
    setMealForm({
      meal_date: today(),
      meal_time: '',
      meal_type: 'lunch',
      notes: '',
      appetite_level: '',
      amount_offered: '',
      amount_consumed: '',
      consumed_percent: 50,
      refused: false,
      refusal_reason: '',
      staff_concerns: '',
      fluid_ml: 0,
      items: [],
    })
  }

  const addFoodItem = () => {
    setMealForm(f => ({
      ...f,
      items: [...f.items, { food_name: '', portion_size: '', allergens: '', preparation_notes: '' }],
    }))
  }

  const updateFoodItem = (index: number, field: string, value: string) => {
    setMealForm(f => ({
      ...f,
      items: f.items.map((item, i) => i === index ? { ...item, [field]: value } : item),
    }))
  }

  const removeFoodItem = (index: number) => {
    setMealForm(f => ({
      ...f,
      items: f.items.filter((_, i) => i !== index),
    }))
  }

  if (isLoading) return <Box sx={{ py: 3 }}><CircularProgress size={24} /></Box>

  return (
    <Box>
      <SectionHeader
        title="Meal Records"
        action={
          <Stack direction="row" spacing={1}>
            <TextField type="date" size="small" value={dateFilter} onChange={e => setDateFilter(e.target.value)} sx={{ width: 160 }} />
            <Button size="small" variant="contained" startIcon={<AddIcon />} onClick={() => { resetForm(); setEditId(null); setAddOpen(true) }} sx={{ bgcolor: '#059669', textTransform: 'none' }}>
              Log Meal
            </Button>
          </Stack>
        }
      />

      {meals.length === 0 ? (
        <EmptyRow message="No meals logged for this date" />
      ) : (
        <Stack spacing={1.5}>
          {meals.map((meal: any) => {
            const typeInfo = getMealTypeInfo(meal.meal_type)
            const pct = meal.consumed_percent
            const pctColor = getConsumedColor(pct)
            return (
              <Paper
                key={meal.id}
                onClick={() => setViewMeal(meal)}
                sx={{
                  p: 2, borderRadius: 2, border: '1px solid #E5E7EB',
                  borderLeft: 4, borderLeftColor: meal.refused ? '#DC2626' : typeInfo.color,
                  cursor: 'pointer', transition: 'box-shadow 0.15s',
                  '&:hover': { borderColor: typeInfo.color, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' },
                }}
              >
                <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                  <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap">
                    <Chip
                      label={typeInfo.label}
                      size="small"
                      sx={{ bgcolor: typeInfo.color + '20', color: typeInfo.color, fontWeight: 700 }}
                    />
                    {meal.meal_time && <Typography variant="caption" color="#6B7280">{meal.meal_time.slice(0, 5)}</Typography>}
                    {meal.refused && (
                      <Chip icon={<CancelIcon sx={{ fontSize: 14 }} />} label="Refused" size="small" color="error" variant="filled" sx={{ fontWeight: 700 }} />
                    )}
                    {meal.appetite_level && (
                      <Chip
                        size="small"
                        label={`${APPETITE_LEVELS.find(a => a.value === meal.appetite_level)?.icon || ''} ${meal.appetite_level}`}
                        sx={{ bgcolor: APPETITE_LEVELS.find(a => a.value === meal.appetite_level)?.color + '20', color: APPETITE_LEVELS.find(a => a.value === meal.appetite_level)?.color, fontWeight: 600 }}
                      />
                    )}
                    {pct != null && (
                      <Chip
                        size="small"
                        label={`${pct}% eaten`}
                        sx={{ bgcolor: pctColor.bg, color: pctColor.text, fontWeight: 700 }}
                      />
                    )}
                    {meal.fluid_ml > 0 && (
                      <Chip icon={<WaterIcon sx={{ fontSize: 12 }} />} label={`${meal.fluid_ml}ml`} size="small" sx={{ bgcolor: '#E0F2FE', color: '#0284C7' }} />
                    )}
                  </Stack>
                  <Stack direction="row" spacing={0} onClick={e => e.stopPropagation()}>
                    <IconButton size="small" onClick={() => { setMealForm({ meal_date: meal.meal_date?.split('T')[0] || meal.meal_date, meal_time: meal.meal_time || '', meal_type: meal.meal_type, notes: meal.notes || '', appetite_level: meal.appetite_level || '', amount_offered: meal.amount_offered || '', amount_consumed: meal.amount_consumed || '', consumed_percent: meal.consumed_percent ?? 50, refused: meal.refused || false, refusal_reason: meal.refusal_reason || '', staff_concerns: meal.staff_concerns || '', fluid_ml: meal.fluid_ml ?? 0, items: [] }); setEditId(meal.id); setAddOpen(true) }}>
                      <EditIcon fontSize="small" />
                    </IconButton>
                    <IconButton size="small" onClick={() => setDeleteTarget({ id: meal.id, label: 'this meal record' })} color="error">
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Stack>
                </Stack>
                {(meal.amount_consumed || meal.notes) && (
                  <Stack sx={{ mt: 1 }} spacing={0.5}>
                    {meal.amount_consumed && <Typography variant="body2" color="#6B7280"><strong>Consumed:</strong> {meal.amount_consumed}</Typography>}
                    {meal.notes && <Typography variant="body2" color="#6B7280" sx={{ fontStyle: 'italic' }}>{meal.notes}</Typography>}
                  </Stack>
                )}
              </Paper>
            )
          })}
        </Stack>
      )}

      {/* Add/Edit Meal Dialog */}
      <Dialog open={addOpen} onClose={() => { setAddOpen(false); setEditId(null) }} maxWidth="sm" fullWidth>
        <Box component="form" onSubmit={e => { e.preventDefault(); if (editId) updateMealMut.mutate({ id: editId, data: mealForm }); else addMealMut.mutate(mealForm) }}>
          <DialogTitle sx={{ fontWeight: 800, display: 'flex', alignItems: 'center' }}>
            {editId ? 'Edit Meal' : 'Log Meal'}
            <Box sx={{ flex: 1 }} />
            <IconButton size="small" onClick={() => { setAddOpen(false); setEditId(null) }}><CloseIcon fontSize="small" /></IconButton>
          </DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ mt: 1 }}>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <TextField label="Date" type="date" fullWidth InputLabelProps={{ shrink: true }} value={mealForm.meal_date} onChange={e => setMealForm(f => ({ ...f, meal_date: e.target.value }))} />
                <TextField label="Time" type="time" fullWidth InputLabelProps={{ shrink: true }} value={mealForm.meal_time} onChange={e => setMealForm(f => ({ ...f, meal_time: e.target.value }))} />
              </Stack>

              <FormControl fullWidth>
                <InputLabel>Meal Type</InputLabel>
                <Select value={mealForm.meal_type} label="Meal Type" onChange={e => setMealForm(f => ({ ...f, meal_type: e.target.value }))}>
                  {MEAL_TYPES.map(m => <MenuItem key={m.value} value={m.value}><Stack direction="row" spacing={1} alignItems="center"><Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: m.color }} /><span>{m.label}</span></Stack></MenuItem>)}
                </Select>
              </FormControl>

              <FormControl fullWidth>
                <InputLabel>Appetite</InputLabel>
                <Select value={mealForm.appetite_level} label="Appetite" onChange={e => setMealForm(f => ({ ...f, appetite_level: e.target.value }))}>
                  <MenuItem value="">Not recorded</MenuItem>
                  {APPETITE_LEVELS.map(a => <MenuItem key={a.value} value={a.value}>{a.icon} {a.label}</MenuItem>)}
                </Select>
              </FormControl>

              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <TextField label="Amount Offered" fullWidth value={mealForm.amount_offered} onChange={e => setMealForm(f => ({ ...f, amount_offered: e.target.value }))} placeholder="e.g., Full plate, half portion" />
                <TextField label="Amount Consumed" fullWidth value={mealForm.amount_consumed} onChange={e => setMealForm(f => ({ ...f, amount_consumed: e.target.value }))} placeholder="e.g., Most of it, a few bites" />
              </Stack>

              <Box>
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.5 }}>
                  <Typography variant="body2" fontWeight={600}>Consumed: {mealForm.consumed_percent}%</Typography>
                  <Chip size="small" label={getConsumedColor(mealForm.consumed_percent).label} sx={{ bgcolor: getConsumedColor(mealForm.consumed_percent).bg, color: getConsumedColor(mealForm.consumed_percent).text }} />
                </Stack>
                <input type="range" min={0} max={100} value={mealForm.consumed_percent} onChange={e => setMealForm(f => ({ ...f, consumed_percent: Number(e.target.value) }))} style={{ width: '100%' }} />
              </Box>

              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <TextField label="Fluid with meal (ml)" type="number" fullWidth value={mealForm.fluid_ml || ''} onChange={e => setMealForm(f => ({ ...f, fluid_ml: Number(e.target.value) }))} inputProps={{ min: 0 }} />
              </Stack>

              <FormControlLabel
                control={<Switch checked={mealForm.refused} onChange={e => setMealForm(f => ({ ...f, refused: e.target.checked }))} color="error" />}
                label="Meal was refused"
              />

              {mealForm.refused && (
                <TextField label="Reason for refusal" fullWidth value={mealForm.refusal_reason} onChange={e => setMealForm(f => ({ ...f, refusal_reason: e.target.value }))} placeholder="e.g., not hungry, did not like the food" />
              )}

              {/* Food Items */}
              <Divider />
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Typography variant="subtitle2" fontWeight={700}>Food Items</Typography>
                <Button size="small" startIcon={<AddIcon />} onClick={addFoodItem} sx={{ textTransform: 'none' }}>Add Item</Button>
              </Stack>
              {mealForm.items.map((item, idx) => (
                <Paper key={idx} variant="outlined" sx={{ p: 1.5, position: 'relative' }}>
                  <IconButton size="small" onClick={() => removeFoodItem(idx)} sx={{ position: 'absolute', top: 4, right: 4 }} color="error"><CloseIcon fontSize="small" /></IconButton>
                  <Stack spacing={1}>
                    <TextField label="Food Name" fullWidth size="small" value={item.food_name} onChange={e => updateFoodItem(idx, 'food_name', e.target.value)} placeholder="e.g., Chicken pie, mashed potato" />
                    <Stack direction="row" spacing={1}>
                      <TextField label="Portion" size="small" value={item.portion_size} onChange={e => updateFoodItem(idx, 'portion_size', e.target.value)} placeholder="e.g., Half plate" sx={{ flex: 1 }} />
                      <TextField label="Allergens" size="small" value={item.allergens} onChange={e => updateFoodItem(idx, 'allergens', e.target.value)} placeholder="e.g., Gluten" sx={{ flex: 1 }} />
                    </Stack>
                  </Stack>
                </Paper>
              ))}

              <TextField label="Staff Notes / Concerns" fullWidth multiline rows={2} value={mealForm.staff_concerns || mealForm.notes} onChange={e => setMealForm(f => ({ ...f, staff_concerns: e.target.value, notes: e.target.value }))} placeholder="e.g., Person needed encouragement, swallowing appeared normal, referred to SALT" />
            </Stack>
          </DialogContent>
          <DialogActions sx={{ p: 3 }}>
            <Button onClick={() => { setAddOpen(false); setEditId(null) }}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={addMealMut.isPending || updateMealMut.isPending} sx={{ bgcolor: '#059669' }}>
              {(addMealMut.isPending || updateMealMut.isPending) ? <CircularProgress size={20} /> : (editId ? 'Update Meal' : 'Log Meal')}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>

      {/* View Meal Detail Dialog */}
      <Dialog open={!!viewMeal} onClose={() => setViewMeal(null)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 800, display: 'flex', alignItems: 'center' }}>
          {viewMeal && `${getMealTypeInfo(viewMeal.meal_type).label} — ${new Date(viewMeal.meal_date).toLocaleDateString('en-GB')}`}
          <Box sx={{ flex: 1 }} />
          <IconButton size="small" onClick={() => setViewMeal(null)}><CloseIcon fontSize="small" /></IconButton>
        </DialogTitle>
        <DialogContent>
          {mealDetail && (
            <Stack spacing={2}>
              <Stack direction="row" spacing={1} flexWrap="wrap">
                <Chip label={getMealTypeInfo(mealDetail.meal_type).label} size="small" sx={{ bgcolor: getMealTypeColor(mealDetail.meal_type) + '20', color: getMealTypeColor(mealDetail.meal_type), fontWeight: 700 }} />
                {mealDetail.meal_time && <Chip label={mealDetail.meal_time.slice(0, 5)} size="small" variant="outlined" />}
                {mealDetail.refused && <Chip label="Refused" size="small" color="error" variant="filled" />}
                {mealDetail.appetite_level && <Chip label={`Appetite: ${mealDetail.appetite_level}`} size="small" variant="outlined" />}
              </Stack>

              {mealDetail.consumed_percent != null && (
                <Box>
                  <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.5 }}>
                    <Typography variant="body2" fontWeight={600}>Consumed</Typography>
                    <Typography variant="body2" fontWeight={700} sx={{ color: getConsumedColor(mealDetail.consumed_percent).text }}>{mealDetail.consumed_percent}%</Typography>
                  </Stack>
                  <LinearProgress variant="determinate" value={mealDetail.consumed_percent} sx={{ height: 8, borderRadius: 4, bgcolor: '#E5E7EB', '& .MuiLinearProgress-bar': { bgcolor: getConsumedColor(mealDetail.consumed_percent).text } }} />
                </Box>
              )}

              <Stack spacing={1}>
                {mealDetail.amount_offered && <Stack direction="row" spacing={1}><Typography variant="body2" fontWeight={600}>Offered:</Typography><Typography variant="body2">{mealDetail.amount_offered}</Typography></Stack>}
                {mealDetail.amount_consumed && <Stack direction="row" spacing={1}><Typography variant="body2" fontWeight={600}>Consumed:</Typography><Typography variant="body2">{mealDetail.amount_consumed}</Typography></Stack>}
                {mealDetail.fluid_ml > 0 && <Stack direction="row" spacing={1}><WaterIcon sx={{ fontSize: 16, color: '#0284C7' }} /><Typography variant="body2" fontWeight={600}>{mealDetail.fluid_ml}ml fluid</Typography></Stack>}
              </Stack>

              {mealDetail.items && mealDetail.items.length > 0 && (
                <Box>
                  <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>Food Items</Typography>
                  <Stack spacing={0.5}>
                    {mealDetail.items.map((item: any) => (
                      <Paper key={item.id} variant="outlined" sx={{ p: 1.5, bgcolor: '#F9FAFB' }}>
                        <Stack direction="row" justifyContent="space-between" alignItems="center">
                          <Typography variant="body2" fontWeight={600}>{item.food_name}</Typography>
                          {item.portion_size && <Chip label={item.portion_size} size="small" variant="outlined" />}
                        </Stack>
                        {item.allergens && <Typography variant="caption" color="#92400E">Allergens: {item.allergens}</Typography>}
                        {item.preparation_notes && <Typography variant="caption" color="#6B7280" sx={{ display: 'block' }}>{item.preparation_notes}</Typography>}
                      </Paper>
                    ))}
                  </Stack>
                </Box>
              )}

              {mealDetail.refusal_reason && (
                <Box>
                  <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 0.5, color: '#991B1B' }}>Refusal Reason</Typography>
                  <Typography variant="body2">{mealDetail.refusal_reason}</Typography>
                </Box>
              )}

              {mealDetail.staff_concerns && (
                <Box>
                  <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 0.5 }}>Staff Notes / Concerns</Typography>
                  <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', bgcolor: '#FFF7ED', p: 1.5, borderRadius: 1, border: '1px solid #FED7AA' }}>{mealDetail.staff_concerns}</Typography>
                </Box>
              )}

              {mealDetail.recorded_by_name && (
                <Typography variant="caption" color="#9CA3AF">
                  Recorded by {mealDetail.recorded_by_name}
                </Typography>
              )}
            </Stack>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete meal record?"
        message={<>This will permanently delete {deleteTarget?.label}. This action cannot be undone.</>}
        confirmLabel="Delete"
        danger
        loading={deleteMealMut.isPending}
        onConfirm={() => deleteTarget && deleteMealMut.mutate(deleteTarget.id)}
        onCancel={() => setDeleteTarget(null)}
      />
    </Box>
  )
}

function useDeleteConfirm() {
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; label: string } | null>(null)
  return { deleteTarget, setDeleteTarget }
}

// ─── Main Nutrition Tab ───
const TABS = [
  { label: 'Dietary Profile', Component: DietaryProfileSection },
  { label: 'Meals', Component: MealRecordsSection },
]

export default function NutritionTab({ personId }: { personId: string; fluidTarget?: number }) {
  const [innerTab, setInnerTab] = useState(0)

  // Pass fluidTarget from profile to summary
  const { data: profile } = useQuery({
    queryKey: ['dietary-profile', personId],
    queryFn: () => api.get(`/nutrition/${personId}/dietary-profile`).then(r => r.data),
  })
  const fluidTarget = profile?.fluid_daily_target_ml || 2000

  // Inline component that uses fluidTarget
  function DailySummaryWithTarget() {
    return <DailySummaryCard personId={personId} fluidTarget={fluidTarget} />
  }

  return (
    <Box>
      {/* Daily Summary always visible */}
      <Box sx={{ mb: 3 }}>
        <DailySummaryWithTarget />
      </Box>

      {/* Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
        <Tabs value={innerTab} onChange={(_, v) => setInnerTab(v)} sx={{ '& .MuiTab-root': { textTransform: 'none', fontWeight: 700, minHeight: 40 }, '& .MuiTabs-indicator': { bgcolor: '#059669' } }}>
          {TABS.map((t) => <Tab key={t.label} label={t.label} />)}
        </Tabs>
      </Box>

      {/* Tab Content */}
      {innerTab === 0 && <DietaryProfileSection personId={personId} />}
      {innerTab === 1 && <MealRecordsSection personId={personId} />}
    </Box>
  )
}
