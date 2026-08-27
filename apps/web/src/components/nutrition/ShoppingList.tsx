import { useState } from 'react'
import {
  Box, Typography, Paper, Button, Chip, Stack,
  CircularProgress, Alert, Checkbox, FormGroup, FormControlLabel,
  Collapse, IconButton,
} from '@mui/material'
import {
  ShoppingCart as CartIcon, Print as PrintIcon,
  ExpandMore as ExpandIcon, ExpandLess as CollapseIcon,
} from '@mui/icons-material'
import api from '../../services/api'

interface ShoppingItem {
  name: string
  quantity: string
  unit: string
  used_in: string[]
  allergens: string[]
  notes?: string
}

interface ShoppingCategory {
  name: string
  icon: string
  items: ShoppingItem[]
}

interface ShoppingListData {
  categories: ShoppingCategory[]
  total_items: number
  estimated_prep_time_minutes: number
  storage_notes: string[]
  tips: string[]
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
  week: Record<string, Record<string, any>>
  weekly_totals: any
}

interface Props {
  weeklyPlan: WeeklyPlan
  filteredWeek?: Record<string, Record<string, any>> // Selected options only
  selectionSummary?: string // e.g. "15 of 42 meals selected"
}

const PRINT_STYLES = `
  @media print {
    @page {
      size: A4 portrait;
      margin: 15mm;
    }
    body * {
      visibility: hidden !important;
    }
    .shopping-list-print,
    .shopping-list-print * {
      visibility: visible !important;
    }
    .shopping-list-print {
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
    .shopping-category {
      page-break-inside: avoid;
    }
    .shopping-item {
      border-bottom: 1px solid #E5E7EB !important;
    }
  }
`

const CATEGORY_ICONS: Record<string, string> = {
  Proteins: '🥩',
  'Fresh Vegetables': '🥬',
  'Fresh Fruit': '🍎',
  'Dairy & Eggs': '🥛',
  'Dairy and Eggs': '🥛',
  'Bread & Bakery': '🍞',
  'Bread and Bakery': '🍞',
  'Cereals & Grains': '🌾',
  'Cereals and Grains': '🌾',
  'Tinned & Jarred': '🥫',
  'Tinned and Jarred': '🥫',
  'Frozen Items': '❄️',
  'Herbs & Spices': '🧂',
  'Herbs, Spices': '🧂',
  'Oils & Sauces': '🫒',
  'Oils, Sauces': '🫒',
  Drinks: '🥤',
  'Drinks & Fluids': '🥤',
  'Drinks and Fluids': '🥤',
  Snacks: '🍪',
  'Snacks & Desserts': '🍪',
  'Snacks and Desserts': '🍪',
  Kitchen: '🧴',
  'Kitchen Supplies': '🧴',
  Supplements: '💊',
  'Supplements & Fortifiers': '💊',
  'Supplements and Fortifiers': '💊',
}

function getCategoryIcon(name: string): string {
  for (const [key, icon] of Object.entries(CATEGORY_ICONS)) {
    if (name.toLowerCase().includes(key.toLowerCase())) return icon
  }
  return '📦'
}

export default function ShoppingList({ weeklyPlan, filteredWeek, selectionSummary }: Props) {
  const [shoppingList, setShoppingList] = useState<ShoppingListData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({})
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({})

  const generateList = async () => {
    setLoading(true)
    setError(null)
    try {
      // Use filtered week (selected options only) if available, otherwise use full week
      const weekData = filteredWeek || weeklyPlan.week
      const res = await api.post('/ai/generate/shopping-list', {
        weeklyPlan: weekData,
        personName: weeklyPlan.person_context?.name || 'Unknown',
        dietarySummary: weeklyPlan.person_context?.dietary_summary || 'Standard',
        allergens: weeklyPlan.person_context?.allergens?.join(', ') || 'None',
        textureModification: weeklyPlan.person_context?.texture_modification || 'None',
      })
      setShoppingList(res.data.shoppingList?.shopping_list || res.data.shoppingList)
      // Expand all categories by default
      const categories = res.data.shoppingList?.shopping_list?.categories || res.data.shoppingList?.categories || []
      const expanded: Record<string, boolean> = {}
      categories.forEach((c: ShoppingCategory) => { expanded[c.name] = true })
      setExpandedCategories(expanded)
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to generate shopping list')
    } finally {
      setLoading(false)
    }
  }

  const toggleItem = (key: string) => {
    setCheckedItems(prev => ({ ...prev, [key]: !prev[key] }))
  }

  const toggleCategory = (name: string) => {
    setExpandedCategories(prev => ({ ...prev, [name]: !prev[name] }))
  }

  const handlePrint = () => {
    window.print()
  }

  const totalChecked = Object.values(checkedItems).filter(Boolean).length
  const totalItems = shoppingList?.total_items || 0
  const categories = shoppingList?.categories || []

  return (
    <Box>
      <style>{PRINT_STYLES}</style>

      {/* Controls */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" className="no-print" sx={{ mb: 2 }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <CartIcon sx={{ color: '#059669', fontSize: 24 }} />
          <Box>
            <Typography variant="subtitle2" fontWeight={700}>Weekly Shopping List</Typography>
            <Typography variant="caption" color="text.secondary">
              {totalItems > 0
                ? `${totalItems} items across ${categories.length} categories`
                : selectionSummary
                  ? `From ${selectionSummary} — select meals above first`
                  : 'Generate a shopping list from the weekly meal plan'}
            </Typography>
          </Box>
        </Stack>
        <Stack direction="row" spacing={1}>
          <Button
            variant="outlined" size="small"
            startIcon={loading ? <CircularProgress size={14} /> : <CartIcon />}
            onClick={generateList} disabled={loading}
            sx={{ textTransform: 'none', borderRadius: 2, borderColor: '#059669', color: '#059669' }}
          >
            {shoppingList ? 'Regenerate' : 'Generate Shopping List'}
          </Button>
          {shoppingList && (
            <Button
              variant="contained" size="small"
              startIcon={<PrintIcon />}
              onClick={handlePrint}
              sx={{ textTransform: 'none', borderRadius: 2, bgcolor: '#059669' }}
            >
              Print
            </Button>
          )}
        </Stack>
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)} className="no-print">
          {error}
        </Alert>
      )}

      {!shoppingList && !loading && (
        <Paper
          sx={{
            p: 4, textAlign: 'center', borderRadius: 2,
            border: '1px solid #E5E7EB', bgcolor: '#F0FDF4',
          }}
          className="no-print"
        >
          <CartIcon sx={{ fontSize: 48, color: '#059669', mb: 1 }} />
          <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 0.5 }}>
            Generate Shopping List
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Create a consolidated shopping list from the weekly meal plan above.
          </Typography>
          <Button
            variant="contained" startIcon={<CartIcon />}
            onClick={generateList}
            sx={{ bgcolor: '#059669', '&:hover': { bgcolor: '#047857' }, borderRadius: 2, textTransform: 'none' }}
          >
            Generate Shopping List
          </Button>
        </Paper>
      )}

      {loading && (
        <Paper sx={{ p: 4, textAlign: 'center', borderRadius: 2, border: '1px solid #E5E7EB' }}>
          <CircularProgress size={36} sx={{ color: '#059669', mb: 2 }} />
          <Typography variant="body1" fontWeight={600}>Generating shopping list...</Typography>
          <Typography variant="body2" color="text.secondary">
            Consolidating ingredients from the weekly plan
          </Typography>
        </Paper>
      )}

      {/* Shopping List Display */}
      {shoppingList && (
        <Box className="shopping-list-print">
          {/* Header */}
          <Paper variant="outlined" sx={{ p: 2.5, mb: 2 }} className="no-print">
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Box>
                <Typography variant="h6" fontWeight={800} color="#059669">
                  Shopping List
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {weeklyPlan.plan_name || 'Weekly Meal Plan'} — {weeklyPlan.person_context?.name}
                </Typography>
              </Box>
              <Stack alignItems="flex-end" spacing={0.5}>
                <Chip
                  label={`${totalChecked}/${totalItems} checked`}
                  size="small"
                  sx={{
                    bgcolor: totalChecked === totalItems && totalItems > 0 ? '#DCFCE7' : '#F3F4F6',
                    color: totalChecked === totalItems && totalItems > 0 ? '#166534' : '#374151',
                    fontWeight: 600,
                  }}
                />
                {shoppingList.estimated_prep_time_minutes && (
                  <Typography variant="caption" color="#6B7280">
                    Est. prep time: {shoppingList.estimated_prep_time_minutes} min
                  </Typography>
                )}
              </Stack>
            </Stack>

            {/* Progress bar */}
            {totalItems > 0 && (
              <Box sx={{ mt: 1.5 }}>
                <Box sx={{ width: '100%', bgcolor: '#E5E7EB', borderRadius: 1, height: 6, overflow: 'hidden' }}>
                  <Box
                    sx={{
                      width: `${(totalChecked / totalItems) * 100}%`,
                      bgcolor: '#059669',
                      height: 6,
                      borderRadius: 1,
                      transition: 'width 0.3s',
                    }}
                  />
                </Box>
              </Box>
            )}
          </Paper>

          {/* Print Header */}
          <Box sx={{ mb: 2, pb: 1, borderBottom: '2px solid #059669' }} className="no-print" style={{ display: 'none' }}>
            <Typography variant="h5" fontWeight={800} color="#059669">
              Shopping List
            </Typography>
            <Typography variant="subtitle1" color="#374151">
              {weeklyPlan.plan_name || 'Weekly Meal Plan'} — {weeklyPlan.person_context?.name}
            </Typography>
          </Box>

          {/* Categories */}
          {categories.map((category) => {
            const catKey = category.name
            const isExpanded = expandedCategories[catKey] !== false
            const checkedInCategory = category.items.filter((_, i) => checkedItems[`${catKey}-${i}`]).length
            const categoryIcon = getCategoryIcon(category.name) || category.icon

            return (
              <Paper
                key={catKey}
                variant="outlined"
                className="shopping-category"
                sx={{ mb: 1.5, overflow: 'hidden', border: '1px solid #E5E7EB' }}
              >
                {/* Category Header */}
                <Stack
                  direction="row"
                  alignItems="center"
                  justifyContent="space-between"
                  sx={{
                    px: 2, py: 1.5,
                    bgcolor: '#F9FAFB',
                    borderBottom: isExpanded ? '1px solid #E5E7EB' : 'none',
                    cursor: 'pointer',
                  }}
                  onClick={() => toggleCategory(catKey)}
                >
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <Typography fontSize="18px">{categoryIcon}</Typography>
                    <Typography variant="subtitle2" fontWeight={700}>
                      {catKey}
                    </Typography>
                    <Chip
                      label={`${checkedInCategory}/${category.items.length}`}
                      size="small"
                      sx={{
                        bgcolor: checkedInCategory === category.items.length ? '#DCFCE7' : '#F3F4F6',
                        color: checkedInCategory === category.items.length ? '#166534' : '#6B7280',
                        fontWeight: 600,
                        height: 20,
                      }}
                    />
                  </Stack>
                  <IconButton size="small">
                    {isExpanded ? <CollapseIcon fontSize="small" /> : <ExpandIcon fontSize="small" />}
                  </IconButton>
                </Stack>

                {/* Items */}
                <Collapse in={isExpanded}>
                  <Box sx={{ px: 2, py: 1 }}>
                    <FormGroup>
                      {category.items.map((item, idx) => {
                        const itemKey = `${catKey}-${idx}`
                        const isChecked = !!checkedItems[itemKey]
                        return (
                          <FormControlLabel
                            key={idx}
                            control={
                              <Checkbox
                                checked={isChecked}
                                onChange={() => toggleItem(itemKey)}
                                size="small"
                                sx={{ color: '#059669', '&.Mui-checked': { color: '#059669' } }}
                              />
                            }
                            label={
                              <Stack direction="row" alignItems="center" spacing={1} sx={{ width: '100%' }}>
                                <Box sx={{ flex: 1 }}>
                                  <Stack direction="row" alignItems="center" spacing={0.5}>
                                    <Typography
                                      variant="body2"
                                      fontWeight={600}
                                      sx={{
                                        textDecoration: isChecked ? 'line-through' : 'none',
                                        color: isChecked ? '#9CA3AF' : '#1F2937',
                                      }}
                                    >
                                      {item.name}
                                    </Typography>
                                    {item.quantity && (
                                      <Chip
                                        label={`${item.quantity} ${item.unit || ''}`}
                                        size="small"
                                        sx={{
                                          height: 18,
                                          bgcolor: '#ECFDF5',
                                          color: '#065F46',
                                          fontWeight: 600,
                                          fontSize: '0.65rem',
                                        }}
                                      />
                                    )}
                                  </Stack>
                                  {item.used_in && item.used_in.length > 0 && (
                                    <Typography variant="caption" color="#9CA3AF" sx={{ fontSize: '0.65rem' }}>
                                      Used in: {item.used_in.join(', ')}
                                    </Typography>
                                  )}
                                  {item.allergens && item.allergens.length > 0 && (
                                    <Stack direction="row" spacing={0.5} sx={{ mt: 0.25 }}>
                                      {item.allergens.map((a, ai) => (
                                        <Chip
                                          key={ai}
                                          label={a}
                                          size="small"
                                          sx={{ height: 16, bgcolor: '#FEE2E2', color: '#991B1B', fontSize: '0.6rem' }}
                                        />
                                      ))}
                                    </Stack>
                                  )}
                                  {item.notes && (
                                    <Typography variant="caption" color="#6B7280" sx={{ fontSize: '0.65rem', fontStyle: 'italic' }}>
                                      {item.notes}
                                    </Typography>
                                  )}
                                </Box>
                              </Stack>
                            }
                            sx={{ mx: 0, my: 0.25 }}
                          />
                        )
                      })}
                    </FormGroup>
                  </Box>
                </Collapse>
              </Paper>
            )
          })}

          {/* Storage Notes */}
          {shoppingList.storage_notes && shoppingList.storage_notes.length > 0 && (
            <Paper variant="outlined" sx={{ p: 2, mt: 2, bgcolor: '#FFF7ED', border: '1px solid #FED7AA' }}>
              <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1, color: '#9A3412' }}>
                🧊 Storage Notes
              </Typography>
              {shoppingList.storage_notes.map((note, i) => (
                <Typography key={i} variant="body2" color="#78350F" sx={{ mb: 0.5 }}>• {note}</Typography>
              ))}
            </Paper>
          )}

          {/* Tips */}
          {shoppingList.tips && shoppingList.tips.length > 0 && (
            <Paper variant="outlined" sx={{ p: 2, mt: 2, bgcolor: '#F0FDF4', border: '1px solid #BBF7D0' }}>
              <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1, color: '#166534' }}>
                💡 Kitchen Tips
              </Typography>
              {shoppingList.tips.map((tip, i) => (
                <Typography key={i} variant="body2" color="#166534" sx={{ mb: 0.5 }}>• {tip}</Typography>
              ))}
            </Paper>
          )}

          {/* Footer */}
          <Box sx={{ mt: 3, pt: 2, borderTop: '1px solid #E5E7EB', display: 'flex', justifyContent: 'space-between' }}>
            <Typography variant="caption" color="#9CA3AF">
              Shopping list generated from {weeklyPlan.plan_name || 'weekly meal plan'} for {weeklyPlan.person_context?.name}.
              Quantities are estimates for a care home kitchen — adjust as needed.
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
