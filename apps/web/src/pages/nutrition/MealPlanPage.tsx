import { useMemo, useRef, useState } from 'react';
import {
  Box, Typography, Paper, Grid, Card, CardContent, CardActions, Button, Chip, Dialog,
  DialogTitle, DialogContent, DialogActions, TextField, MenuItem, IconButton, Stack, Tabs, Tab,
  Divider, List, ListItem, ListItemText, Checkbox, FormControlLabel,
  Tooltip, CircularProgress, Alert, Avatar, Select, FormControl, InputLabel, Table,
  TableBody, TableCell, TableContainer, TableHead, TableRow,
} from '@mui/material';
import PageContainer from '../../components/design/PageContainer'
import {
  Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon,
  ContentCopy as CloneIcon, LocalDining as FoodIcon, AutoAwesome as AIIcon,
  Save as SaveIcon, Description as DocIcon, CalendarMonth as PlannerIcon,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../services/api';
import { useSnackbar } from '../../context/SnackbarContext';
import FigDialogHeader from '../people/dialogHeader';
import PreparingReportDialog from '../reporting/dialogs/PreparingReportDialog';

const MEAL_TYPES = [
  { value: 'breakfast', label: 'Breakfast', color: '#F59E0B', icon: '🌅' },
  { value: 'morning_snack', label: 'Morning Snack', color: '#10B981', icon: '🍎' },
  { value: 'lunch', label: 'Lunch', color: '#0164C8', icon: '🍽️' },
  { value: 'afternoon_snack', label: 'Afternoon Snack', color: '#8B7CF6', icon: '🥤' },
  { value: 'dinner', label: 'Dinner', color: '#EF4444', icon: '🌙' },
  { value: 'evening_snack', label: 'Evening Snack', color: '#8B7CF6', icon: '🍪' },
  { value: 'supplement', label: 'Supplement', color: '#6B8AFD', icon: '💊' },
];

const MAIN_MEALS = ['breakfast', 'lunch', 'dinner'];
const SNACK_MEALS = ['morning_snack', 'afternoon_snack', 'evening_snack'];
const DAY_ORDER = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

function dayLabel(d: string): string { return d.charAt(0).toUpperCase() + d.slice(1); }
function mealLabel(v: string): string { return MEAL_TYPES.find(m => m.value === v)?.label || v; }

/** Canonical dietary tags (mirrors the API whitelist in meal-plan.controller). */
const DIETARY_TAG_LABELS: Record<string, string> = {
  vegetarian: 'Vegetarian', vegan: 'Vegan', 'gluten-free': 'Gluten-free', 'dairy-free': 'Dairy-free',
  'nut-free': 'Nut-free', halal: 'Halal', kosher: 'Kosher', soft: 'Soft and bite-sized',
  'low-sugar': 'Low sugar', 'diabetic-friendly': 'Diabetic-friendly',
};
const tagLabel = (t: string) => DIETARY_TAG_LABELS[t] || t;

/** The four Figma 11.1 "Dietary" checkboxes for the New dialog. */
const NEW_DIETARY = [
  { value: 'soft', label: 'Soft and bite-sized' },
  { value: 'low-sugar', label: 'Low sugar' },
  { value: 'vegetarian', label: 'Vegetarian options' },
  { value: 'halal', label: 'Halal options' },
];

const BUDGETS = [10, 15, 20];

function mondayOfThisWeek(): Date {
  const d = new Date();
  const diff = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - diff);
  return d;
}

interface MenuGroup {
  name: string;
  rows: any[];
  meals: number;
  snacks: number;
  supplements: number;
  tags: string[];
  locationIds: string[];
}

function groupMenus(templates: any[]): MenuGroup[] {
  const byName = new Map<string, any[]>();
  for (const t of templates) {
    if (!byName.has(t.name)) byName.set(t.name, []);
    byName.get(t.name)!.push(t);
  }
  return Array.from(byName.entries()).map(([name, rows]) => {
    const tags = Array.from(new Set(rows.flatMap(r => [...(r.dietary_tags || []), ...((r.itemsTags as string[]) || [])])));
    return {
      name, rows,
      meals: rows.filter(r => MAIN_MEALS.includes(r.meal_type)).length,
      snacks: rows.filter(r => SNACK_MEALS.includes(r.meal_type)).length,
      supplements: rows.filter(r => r.meal_type === 'supplement').length,
      tags: tags.slice(0, 3),
      locationIds: Array.from(new Set(rows.map(r => r.location_id).filter(Boolean))),
    };
  }).sort((a, b) => a.name.localeCompare(b.name));
}

function useCurrentUser() {
  try { return JSON.parse(localStorage.getItem('user') || '{}'); } catch { return {}; }
}

interface AIMealPlanMeal {
  name: string;
  description: string;
  items: Array<{ name: string; portion: string; allergens: string; prep_notes: string }>;
  fluid_suggestion: string;
  estimated_calories: number;
  estimated_fluid_ml: number;
}

interface AIMealPlanResult {
  plan_name: string;
  description: string;
  person_context: {
    name: string;
    dietary_summary: string;
    allergens: string[];
    texture_modification: string;
    appetite_level: string;
    fluid_target_ml: number;
  };
  daily_plan: {
    breakfast?: AIMealPlanMeal;
    morning_snack?: AIMealPlanMeal;
    lunch?: AIMealPlanMeal;
    afternoon_snack?: AIMealPlanMeal;
    dinner?: AIMealPlanMeal;
    evening_snack?: AIMealPlanMeal;
  };
  daily_totals: {
    total_calories: number;
    total_fluid_ml: number;
    protein_estimate_grams: number;
    fibre_estimate_grams: number;
  };
  nutritional_notes: string[];
  allergen_warnings: string[];
  suggestions: string[];
}

interface TrendDay {
  date: string; meals: number; refused: number; avg_consumed: number;
  total_fluid: number; people_fed: number; total_people: number; avg_fluid_target: number;
}

export default function MealPlanPage() {
  const qc = useQueryClient();
  const currentUser = useCurrentUser();
  const isAdmin = currentUser.role === 'ORG_ADMIN' || currentUser.role === 'MANAGER';
  const { showSnackbar } = useSnackbar();

  const [tab, setTab] = useState<'templates' | 'planner'>('templates');
  const [locationFilter, setLocationFilter] = useState('');
  const [expandedMenu, setExpandedMenu] = useState<string | null>(null);
  const [expandedSlot, setExpandedSlot] = useState<string | null>(null);

  // Template create/edit dialog (Figma 11.1 New meal plan on create)
  const [tmplDlg, setTmplDlg] = useState<{ open: boolean; edit?: any }>({ open: false });
  const [itemDlg, setItemDlg] = useState<{ open: boolean; tplId: string; edit?: any }>({ open: false, tplId: '' });
  const [tf, setTf] = useState({ name: '', description: '', meal_type: 'lunch', day_of_week: '', is_active: true, location_ids: [] as string[], dietary: [] as string[] });
  const [itf, setItf] = useState({ food_name: '', portion_size: '', allergens: '', notes: '' });

  // Suggest-a-plan dialog (Figma 11.1: location draft from profiles + templates)
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [suggestLoc, setSuggestLoc] = useState('');
  const [budget, setBudget] = useState(10);
  const [drafting, setDrafting] = useState(false);
  const draftAbort = useRef<AbortController | null>(null);

  // Per-person AI generator (existing feature, kept alongside Suggest)
  const [aiDlg, setAiDlg] = useState(false);
  const [aiForm, setAiForm] = useState({ personId: '', mealType: 'lunch', dayOfWeek: '', specialRequirements: '' });
  const [aiResult, setAiResult] = useState<AIMealPlanResult | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);

  const { data: people } = useQuery({
    queryKey: ['people-list'],
    queryFn: () => api.get('/nutrition/people').then((r: any) => r.data),
  });

  const { data: locations = [] } = useQuery({
    queryKey: ['meal-plan-locations'],
    queryFn: () => api.get('/settings/locations').then((r: any) => r.data as { id: string; name: string }[]),
  });

  const { data: trend = [] } = useQuery({
    queryKey: ['nutrition-trend-7d'],
    queryFn: () => api.get('/nutrition/trend').then((r: any) => r.data as TrendDay[]),
  });

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['meal-plans'],
    queryFn: () => api.get('/nutrition/meal-plans').then((r: any) => r.data),
  });

  const { data: tplDetail, isLoading: loadingDetail } = useQuery({
    queryKey: ['meal-plan', expandedSlot],
    queryFn: () => api.get('/nutrition/meal-plans/' + expandedSlot).then((r: any) => r.data),
    enabled: !!expandedSlot,
  });

  const invalidatePlans = () => qc.invalidateQueries({ queryKey: ['meal-plans'] });

  const mkTmpl = useMutation({
    mutationFn: (d: any) => api.post('/nutrition/meal-plans', d),
    onSuccess: () => { invalidatePlans(); setTmplDlg({ open: false }); showSnackbar('Meal plan saved.', 'success'); },
    onError: (e: any) => showSnackbar(e.response?.data?.message || 'Could not save this meal plan.', 'error'),
  });
  const updTmpl = useMutation({
    mutationFn: (vars: any) => api.put('/nutrition/meal-plans/' + vars.id, vars.d),
    onSuccess: () => { invalidatePlans(); setTmplDlg({ open: false }); showSnackbar('Meal plan saved.', 'success'); },
    onError: (e: any) => showSnackbar(e.response?.data?.message || 'Could not save this meal plan.', 'error'),
  });
  const delTmpl = useMutation({
    mutationFn: (id: string) => api.delete('/nutrition/meal-plans/' + id),
    onSuccess: () => { invalidatePlans(); showSnackbar('Meal plan deleted.', 'success'); },
    onError: (e: any) => showSnackbar(e.response?.data?.message || 'Could not delete this meal plan.', 'error'),
  });
  const cloneTmpl = useMutation({
    mutationFn: (id: string) => api.post('/nutrition/meal-plans/' + id + '/clone'),
    onSuccess: () => { invalidatePlans(); showSnackbar('Meal plan saved.', 'success'); },
    onError: (e: any) => showSnackbar(e.response?.data?.message || 'Could not copy this meal plan.', 'error'),
  });
  const addFood = useMutation({
    mutationFn: (vars: any) => api.post('/nutrition/meal-plans/' + vars.tplId + '/items', vars.d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['meal-plans'] }); qc.invalidateQueries({ queryKey: ['meal-plan', expandedSlot] }); setItemDlg({ open: false, tplId: '' }); showSnackbar('Dish added.', 'success'); },
    onError: (e: any) => showSnackbar(e.response?.data?.message || 'Could not add this dish.', 'error'),
  });
  const rmFood = useMutation({
    mutationFn: (id: string) => api.delete('/nutrition/meal-plans/items/' + id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['meal-plans'] }); qc.invalidateQueries({ queryKey: ['meal-plan', expandedSlot] }); showSnackbar('Dish removed.', 'success'); },
    onError: (e: any) => showSnackbar(e.response?.data?.message || 'Could not remove this dish.', 'error'),
  });

  const generateMealPlan = useMutation({
    mutationFn: (data: any) => api.post('/ai/generate/meal-plan', data).then(r => r.data),
    onSuccess: (data) => { setAiResult(data.mealPlan); setAiError(null); },
    onError: (err: any) => { setAiError(err.response?.data?.error?.message || 'Failed to generate meal plan'); setAiResult(null); },
  });

  const mkTmplFromAI = useMutation({
    mutationFn: (data: any) => api.post('/nutrition/meal-plans', data),
    onSuccess: () => { invalidatePlans(); setAiResult(null); setAiDlg(false); showSnackbar('Meal plan saved.', 'success'); },
  });

  // ─── Metrics (Figma 11.1 cards, from the 7-day trend) ───
  const metrics = useMemo(() => {
    const days = trend as TrendDay[];
    const weekMeals = days.reduce((s, d) => s + (Number(d.meals) || 0), 0);
    const weekRefused = days.reduce((s, d) => s + (Number(d.refused) || 0), 0);
    const fluid = days.reduce((s, d) => s + (Number(d.total_fluid) || 0), 0);
    const fluidTarget = days.reduce((s, d) => s + (Number(d.avg_fluid_target) || 0) * (Number(d.total_people) || 0), 0);
    const avgWater = fluidTarget > 0 ? Math.round((fluid / fluidTarget) * 100) : 0;
    const drinksPerDay = days.length > 0 ? fluid / days.length / 1000 : 0;
    const target = days.length > 0 ? (Number(days[days.length - 1].avg_fluid_target) || 2000) / 1000 : 2;
    return [
      { label: 'Meals recorded', value: String(weekMeals), sub: 'This week' },
      { label: 'Refusal', value: String(weekRefused), sub: 'This week' },
      { label: 'Average water', value: `${avgWater}%`, sub: 'This week' },
      { label: 'Drinks per day', value: `${drinksPerDay.toFixed(1)} L`, sub: `Target ${target.toFixed(target >= 10 ? 0 : 1)}L` },
    ];
  }, [trend]);

  const locationName = (id: string) => locations.find((l: any) => l.id === id)?.name || 'All locations';

  // ─── Menus (Fig 11.1 template cards group rows that share a name) ───
  const menus = useMemo(() => {
    const list = (templates as any[]).filter(t => !locationFilter || !t.location_id || t.location_id === locationFilter);
    return groupMenus(list);
  }, [templates, locationFilter]);

  const plannerRows = useMemo(() => {
    const list = (templates as any[]).filter(t => t.day_of_week && (!locationFilter || !t.location_id || t.location_id === locationFilter));
    // Attach location names for the cell labels.
    return list.map(t => ({ ...t, location_name: t.location_id ? locationName(t.location_id) : null }));
  }, [templates, locationFilter, locations]);

  const weekStart = mondayOfThisWeek();
  const weekLabel = `week of ${weekStart.getDate()} ${weekStart.toLocaleString('en-GB', { month: 'long' })}`;
  const plannerTitle = locationFilter ? `${locationName(locationFilter)} — ${weekLabel}` : `All locations — ${weekLabel}`;

  const cellFor = (day: string, meal: string) => plannerRows.filter(t => t.day_of_week === day && t.meal_type === meal);

  const openMenu = (name: string) => {
    setTab('templates');
    setExpandedMenu(name);
  };

  // ─── Suggest-a-plan draft (rule-based: profiles + approved templates) ───
  const suggestPeople = useMemo(() => {
    if (!suggestLoc) return [];
    const loc = locations.find((l: any) => l.id === suggestLoc);
    return ((people as any[]) || []).filter(p => p.location_name && loc && p.location_name === loc.name);
  }, [suggestLoc, people, locations]);

  const profileSummary = useMemo(() => {
    const isDiabetic = (p: any) => (p.dietary_type || '').toLowerCase().includes('diabet');
    const isSoft = (p: any) => p.texture_modified && !['none', ''].includes(String(p.texture_modified).toLowerCase());
    return {
      diabetic: suggestPeople.filter(isDiabetic).length,
      soft: suggestPeople.filter(isSoft).length,
      vegetarian: suggestPeople.filter((p: any) => p.vegetarian).length,
    };
  }, [suggestPeople]);

  const draftTags = useMemo(() => {
    const tags: string[] = [];
    if (profileSummary.diabetic > 0) tags.push('diabetic-friendly');
    if (profileSummary.soft > 0) tags.push('soft');
    if (profileSummary.vegetarian > 0) tags.push('vegetarian');
    if (suggestPeople.some((p: any) => p.halal)) tags.push('halal');
    if (suggestPeople.some((p: any) => p.gluten_free)) tags.push('gluten-free');
    if (suggestPeople.some((p: any) => p.dairy_free)) tags.push('dairy-free');
    return tags;
  }, [suggestPeople, profileSummary]);

  const pickSource = (meal: string, day: string) => {
    const cands = (templates as any[]).filter(t => t.meal_type === meal && t.day_of_week === day);
    if (!cands.length) return null;
    const score = (t: any) => (t.location_id === suggestLoc ? 100 : 0) +
      (t.dietary_tags || []).filter((tag: string) => draftTags.includes(tag)).length;
    return cands.slice().sort((a, b) => score(b) - score(a))[0];
  };

  const createDraft = async () => {
    if (!suggestLoc || drafting) return;
    const controller = new AbortController();
    draftAbort.current = controller;
    setDrafting(true);
    try {
      const locName = locationName(suggestLoc);
      for (const day of DAY_ORDER) {
        for (const meal of MAIN_MEALS) {
          if (controller.signal.aborted) return;
          const created = await api.post('/nutrition/meal-plans', {
            name: `${locName} draft week`,
            description: `Draft · £${budget} per person per day`,
            meal_type: meal, day_of_week: day,
            location_id: suggestLoc, dietary_tags: draftTags,
          }, { signal: controller.signal });
          const source = pickSource(meal, day);
          if (source && !controller.signal.aborted) {
            const detail = await api.get('/nutrition/meal-plans/' + source.id, { signal: controller.signal });
            for (const item of detail.data.items || []) {
              if (controller.signal.aborted) break;
              await api.post(`/nutrition/meal-plans/${created.data.id}/items`, {
                food_name: item.food_name, portion_size: item.portion_size,
                allergens: item.allergens, dietary_flags: item.dietary_flags, notes: item.notes,
              }, { signal: controller.signal });
            }
          }
        }
      }
      invalidatePlans();
      setSuggestOpen(false);
      setLocationFilter(suggestLoc);
      setTab('planner');
      showSnackbar('Draft ready.', 'success');
    } catch (e: any) {
      if (e?.code !== 'ERR_CANCELED') showSnackbar(e.response?.data?.message || 'Could not create this draft.', 'error');
    } finally {
      setDrafting(false);
      draftAbort.current = null;
    }
  };

  const openNew = () => {
    setTf({ name: '', description: '', meal_type: 'lunch', day_of_week: '', is_active: true, location_ids: locationFilter ? [locationFilter] : [], dietary: [] });
    setTmplDlg({ open: true });
  };

  const saveTemplate = () => {
    if (!tf.name.trim()) return;
    if (tmplDlg.edit) {
      const existing: string[] = tmplDlg.edit.dietary_tags || [];
      const keep = existing.filter(t => !NEW_DIETARY.some(n => n.value === t));
      updTmpl.mutate({
        id: tmplDlg.edit.id,
        d: {
          name: tf.name.trim(), description: tf.description, meal_type: tf.meal_type,
          day_of_week: tf.day_of_week || null, is_active: tf.is_active,
          location_id: tf.location_ids[0] || null, dietary_tags: [...keep, ...tf.dietary],
        },
      });
      return;
    }
    const targets = tf.location_ids.length > 0 ? tf.location_ids : [null];
    (async () => {
      try {
        for (const loc of targets) {
          await api.post('/nutrition/meal-plans', {
            name: tf.name.trim(), meal_type: tf.meal_type, day_of_week: tf.day_of_week || null,
            location_id: loc, dietary_tags: tf.dietary,
          });
        }
        invalidatePlans();
        setTmplDlg({ open: false });
        showSnackbar('Meal plan saved.', 'success');
      } catch (e: any) {
        showSnackbar(e.response?.data?.message || 'Could not save this meal plan.', 'error');
      }
    })();
  };

  const deleteMenu = (menu: MenuGroup) => {
    if (!window.confirm(`Delete "${menu.name}" (${menu.rows.length} meal slots)?`)) return;
    (async () => {
      try {
        for (const row of menu.rows) await api.delete('/nutrition/meal-plans/' + row.id);
        if (expandedMenu === menu.name) setExpandedMenu(null);
        invalidatePlans();
        showSnackbar('Meal plan deleted.', 'success');
      } catch (e: any) {
        showSnackbar(e.response?.data?.message || 'Could not delete this menu.', 'error');
      }
    })();
  };

  return (
    <PageContainer>
      <Typography variant="caption" sx={{ color: '#0164C8', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
        Home / Meal plans
      </Typography>
      <Stack direction={{ xs: 'column', md: 'row' }} alignItems={{ xs: 'flex-start', md: 'center' }} spacing={2} sx={{ mt: 0.5, mb: 3 }}>
        <Box sx={{ flex: 1 }}>
          <Typography variant="h4" sx={{ fontWeight: 600 }}>Meal Plans</Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mt: 0.5 }}>
            Plan menus, and see how much people eat and drink.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          <TextField select size="small" value={locationFilter} onChange={e => setLocationFilter(e.target.value)}
            aria-label="Location" sx={{ minWidth: 150, bgcolor: '#FFFFFF', '& .MuiOutlinedInput-root': { borderRadius: 2 } }}>
            <MenuItem value="">All locations</MenuItem>
            {locations.map((l: any) => <MenuItem key={l.id} value={l.id}>{l.name}</MenuItem>)}
          </TextField>
          {isAdmin && (
            <>
              <Button variant="outlined" size="small" onClick={() => { setSuggestLoc(locationFilter); setSuggestOpen(true); }}
                sx={{ textTransform: 'none', fontWeight: 600, whiteSpace: 'nowrap' }}>
                Suggest a plan
              </Button>
              <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={openNew}
                sx={{ textTransform: 'none', fontWeight: 600, whiteSpace: 'nowrap' }}>
                New meal plan
              </Button>
            </>
          )}
        </Stack>
      </Stack>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3, borderBottom: 1, borderColor: 'divider' }}>
        <Tab value="templates" label="Templates" sx={{ textTransform: 'none', fontWeight: 600 }} />
        <Tab value="planner" label="Weekly planner" sx={{ textTransform: 'none', fontWeight: 600 }} />
      </Tabs>

      {/* Metric cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {metrics.map(m => (
          <Grid item xs={6} md={3} key={m.label}>
            <Paper elevation={0} sx={{ p: 2, borderRadius: 2, border: '1px solid', borderColor: 'divider', height: '100%' }}>
              <Typography variant="body2" color="text.secondary">{m.label}</Typography>
              <Typography variant="h4" sx={{ fontWeight: 600, mt: 0.5 }}>{m.value}</Typography>
              <Typography variant="caption" color="text.secondary">{m.sub}</Typography>
            </Paper>
          </Grid>
        ))}
      </Grid>

      {tab === 'templates' ? (
        isLoading ? (
          <Typography sx={{ textAlign: 'center', py: 8, color: 'text.secondary' }}>Loading meal plans...</Typography>
        ) : menus.length === 0 ? (
          <Paper elevation={0} sx={{ p: { xs: 4, md: 8 }, textAlign: 'center', borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
            <Avatar sx={{ width: 56, height: 56, mx: 'auto', mb: 2, bgcolor: 'notice.info.bg', color: 'notice.info.fg' }}>
              <FoodIcon />
            </Avatar>
            <Typography variant="h6" sx={{ fontWeight: 600 }}>No meal plans yet</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1, mb: 3, maxWidth: 440, mx: 'auto' }}>
              Create a menu plan and assign it to each week. Template dishes taken from that profile are shown as you plan.
            </Typography>
            {isAdmin && <Button variant="contained" startIcon={<AddIcon />} onClick={openNew} sx={{ textTransform: 'none' }}>Create a meal plan</Button>}
          </Paper>
        ) : (
          <>
            <Typography variant="h6" sx={{ fontWeight: 600 }}>Meal plan templates</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>Reusable templates you can use to create a weekly plan.</Typography>
            <Grid container spacing={2.5}>
              {menus.map(menu => {
                const open = expandedMenu === menu.name;
                const countLine = `${menu.meals} meal${menu.meals === 1 ? '' : 's'} • ${menu.snacks} snack${menu.snacks === 1 ? '' : 's'}` +
                  (menu.supplements > 0 ? ` • ${menu.supplements} supplement${menu.supplements === 1 ? '' : 's'}` : '');
                return (
                  <Grid item xs={12} md={6} lg={4} key={menu.name}>
                    <Card elevation={0} variant="outlined"
                      sx={{ height: '100%', borderRadius: 2, cursor: 'pointer', transition: 'border-color 120ms ease, box-shadow 120ms ease', '&:hover': { borderColor: '#0164C8', boxShadow: '0 2px 8px rgba(1,100,200,0.15)' } }}
                      onClick={() => setExpandedMenu(open ? null : menu.name)}>
                      <CardContent>
                        <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 1 }}>
                          <Avatar sx={{ width: 36, height: 36, bgcolor: 'notice.info.bg', color: 'notice.info.fg' }}>
                            <DocIcon fontSize="small" />
                          </Avatar>
                          <Typography variant="subtitle1" sx={{ fontWeight: 600, flex: 1 }}>{menu.name}</Typography>
                        </Stack>
                        <Typography variant="body2" color="text.secondary">{countLine}</Typography>
                        {menu.tags.length > 0 && (
                          <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap sx={{ mt: 1 }}>
                            {menu.tags.map(t => <Chip key={t} label={tagLabel(t)} size="small" variant="outlined" />)}
                          </Stack>
                        )}
                        {menu.locationIds.length > 0 && (
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                            {menu.locationIds.map(locationName).join(', ')}
                          </Typography>
                        )}
                      </CardContent>
                      <CardActions sx={{ px: 2, pb: 2 }}>
                        <Button size="small" sx={{ textTransform: 'none', fontWeight: 600, color: '#0164C8' }}
                          onClick={e => { e.stopPropagation(); setExpandedMenu(open ? null : menu.name); }}>
                          {open ? 'Close template' : 'Open template'}
                        </Button>
                        <Box sx={{ flexGrow: 1 }} />
                        {isAdmin && (
                          <Tooltip title="Delete menu">
                            <IconButton size="small" onClick={e => { e.stopPropagation(); deleteMenu(menu); }}>
                              <DeleteIcon fontSize="small" color="error" />
                            </IconButton>
                          </Tooltip>
                        )}
                      </CardActions>
                      {open && (
                        <Box sx={{ px: 2, pb: 2 }} onClick={e => e.stopPropagation()}>
                          <Divider sx={{ mb: 1.5 }} />
                          {menu.rows
                            .slice().sort((a, b) => DAY_ORDER.indexOf(a.day_of_week || 'monday') - DAY_ORDER.indexOf(b.day_of_week || 'monday'))
                            .map(row => (
                              <Box key={row.id} sx={{ mb: 1.5, p: 1.5, borderRadius: 1.5, bgcolor: 'action.hover' }}>
                                <Stack direction="row" alignItems="center" spacing={1}>
                                  <Typography variant="body2" sx={{ fontWeight: 600, flex: 1 }}>
                                    {row.day_of_week ? `${dayLabel(row.day_of_week)} · ` : ''}{mealLabel(row.meal_type)}
                                  </Typography>
                                  <Typography variant="caption" color="text.secondary">{row.item_count || 0} dishes</Typography>
                                  <Button size="small" sx={{ textTransform: 'none' }}
                                    onClick={() => setExpandedSlot(expandedSlot === row.id ? null : row.id)}>
                                    {expandedSlot === row.id ? 'Hide' : 'Dishes'}
                                  </Button>
                                  {isAdmin && (
                                    <>
                                      <Tooltip title="Clone slot">
                                        <IconButton size="small" onClick={() => cloneTmpl.mutate(row.id)}><CloneIcon fontSize="small" /></IconButton>
                                      </Tooltip>
                                      <Tooltip title="Edit slot">
                                        <IconButton size="small" onClick={() => {
                                          setTf({
                                            name: row.name, description: row.description || '', meal_type: row.meal_type,
                                            day_of_week: row.day_of_week || '', is_active: row.is_active,
                                            location_ids: row.location_id ? [row.location_id] : [],
                                            dietary: (row.dietary_tags || []).filter((t: string) => NEW_DIETARY.some(n => n.value === t)),
                                          });
                                          setTmplDlg({ open: true, edit: row });
                                        }}><EditIcon fontSize="small" /></IconButton>
                                      </Tooltip>
                                      <Tooltip title="Delete slot">
                                        <IconButton size="small" onClick={() => { if (window.confirm('Delete this meal slot?')) delTmpl.mutate(row.id); }}>
                                          <DeleteIcon fontSize="small" color="error" />
                                        </IconButton>
                                      </Tooltip>
                                    </>
                                  )}
                                </Stack>
                                {expandedSlot === row.id && (
                                  <Box sx={{ mt: 1 }}>
                                    {loadingDetail ? <Typography variant="caption" color="text.secondary">Loading...</Typography> : (tplDetail?.items?.length > 0 ? (
                                      <List dense disablePadding>
                                        {tplDetail.items.map((item: any) => (
                                          <ListItem key={item.id} sx={{ py: 0.5, px: 0 }} secondaryAction={isAdmin ? (
                                            <IconButton edge="end" size="small" onClick={() => { if (window.confirm('Remove this dish?')) rmFood.mutate(item.id); }}>
                                              <DeleteIcon fontSize="small" color="error" />
                                            </IconButton>
                                          ) : undefined}>
                                            <FoodIcon sx={{ mr: 1, fontSize: 16, color: 'text.secondary' }} />
                                            <ListItemText
                                              primary={<Typography variant="body2" fontWeight={600}>{item.food_name}</Typography>}
                                              secondary={
                                                <Stack direction="row" spacing={0.5} sx={{ mt: 0.25 }} flexWrap="wrap" useFlexGap>
                                                  {item.portion_size && <Chip label={item.portion_size} size="small" variant="outlined" sx={{ height: 20, fontSize: '0.7rem' }} />}
                                                  {item.allergens && <Chip label={`Allergens: ${item.allergens}`} size="small" variant="outlined" color="warning" sx={{ height: 20, fontSize: '0.7rem' }} />}
                                                  {(item.dietary_flags || []).map((f: string) => <Chip key={f} label={tagLabel(f)} size="small" sx={{ height: 20, fontSize: '0.7rem' }} />)}
                                                </Stack>
                                              }
                                            />
                                          </ListItem>
                                        ))}
                                      </List>
                                    ) : (
                                      <Typography variant="caption" color="text.secondary">No dishes yet.</Typography>
                                    ))}
                                    {isAdmin && (
                                      <Button size="small" startIcon={<AddIcon />} sx={{ mt: 0.5, textTransform: 'none' }}
                                        onClick={() => { setItf({ food_name: '', portion_size: '', allergens: '', notes: '' }); setItemDlg({ open: true, tplId: row.id }); }}>
                                        Add dish
                                      </Button>
                                    )}
                                  </Box>
                                )}
                              </Box>
                            ))}
                        </Box>
                      )}
                    </Card>
                  </Grid>
                );
              })}
            </Grid>
          </>
        )
      ) : (
        <Box>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
            <PlannerIcon color="action" />
            <Typography variant="h6" sx={{ fontWeight: 600 }}>{plannerTitle}</Typography>
          </Stack>
          <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700 }}>Day</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Breakfast</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Lunch</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Dinner</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {DAY_ORDER.map(day => (
                  <TableRow key={day} hover>
                    <TableCell sx={{ fontWeight: 600 }}>{dayLabel(day)}</TableCell>
                    {MAIN_MEALS.map(meal => {
                      const slots = cellFor(day, meal);
                      return (
                        <TableCell key={meal}>
                          {slots.length === 0 ? (
                            <Typography variant="body2" color="text.disabled">—</Typography>
                          ) : (
                            slots.map(s => (
                              <Box key={s.id} onClick={() => openMenu(s.name)}
                                sx={{ cursor: 'pointer', borderRadius: 1, px: 0.5, '&:hover': { bgcolor: 'action.hover' } }}>
                                <Typography variant="body2" sx={{ fontWeight: 500 }}>{s.name}</Typography>
                                <Typography variant="caption" color="text.secondary">
                                  {s.item_count || 0} dishes{s.location_name ? ` · ${s.location_name}` : ''}
                                </Typography>
                              </Box>
                            ))
                          )}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
            The planner reads the menus above: give a meal slot a day to place it in the week. Select a cell's menu to open it.
          </Typography>
        </Box>
      )}

      {/* ─── New / edit meal plan (Figma 11.1 New meal plan) ─── */}
      <Dialog open={tmplDlg.open} onClose={() => setTmplDlg({ open: false })} fullWidth maxWidth="xs">
        <FigDialogHeader eyebrow="MEAL PLANS" title={tmplDlg.edit ? 'Edit meal plan' : 'New meal plan'}
          subtitle={tmplDlg.edit ? undefined : 'Build a week of meals that you need.'} onClose={() => setTmplDlg({ open: false })} />
        <DialogContent sx={{ pt: 1.5 }}>
          <Stack spacing={2.5}>
            <Box>
              <Typography variant="caption" sx={{ fontWeight: 700, letterSpacing: '0.04em' }}>NAME</Typography>
              <TextField fullWidth size="small" sx={{ mt: 1 }} value={tf.name}
                onChange={e => setTf(p => ({ ...p, name: e.target.value }))} inputProps={{ maxLength: 255 }}
                placeholder="Autumn menu - week A" />
            </Box>
            <Box>
              <Typography variant="caption" sx={{ fontWeight: 700, letterSpacing: '0.04em' }}>USE FOR</Typography>
              <FormControl fullWidth size="small" sx={{ mt: 1 }}>
                <InputLabel id="meal-usefor-label">Locations</InputLabel>
                {tmplDlg.edit ? (
                  <Select label="Locations" labelId="meal-usefor-label" value={tf.location_ids[0] || ''}
                    onChange={e => setTf(p => ({ ...p, location_ids: e.target.value ? [e.target.value] : [] }))}>
                    <MenuItem value="">All locations</MenuItem>
                    {locations.map((l: any) => <MenuItem key={l.id} value={l.id}>{l.name}</MenuItem>)}
                  </Select>
                ) : (
                  <Select label="Locations" labelId="meal-usefor-label" multiple value={tf.location_ids}
                    onChange={e => setTf(p => ({ ...p, location_ids: typeof e.target.value === 'string' ? [e.target.value] : e.target.value }))}
                    renderValue={ids => (ids as string[]).map(id => locations.find((l: any) => l.id === id)?.name || id).join(', ') || 'All locations'}>
                    {locations.map((l: any) => (
                      <MenuItem key={l.id} value={l.id}>
                        <Checkbox size="small" checked={tf.location_ids.includes(l.id)} />
                        {l.name}
                      </MenuItem>
                    ))}
                  </Select>
                )}
              </FormControl>
            </Box>
            <Box>
              <Typography variant="caption" sx={{ fontWeight: 700, letterSpacing: '0.04em' }}>DIETARY (OPTIONAL)</Typography>
              <Stack spacing={0.5} sx={{ mt: 0.5 }}>
                {NEW_DIETARY.map(o => (
                  <FormControlLabel key={o.value} control={
                    <Checkbox size="small" checked={tf.dietary.includes(o.value)}
                      onChange={e => setTf(p => ({ ...p, dietary: e.target.checked ? [...p.dietary, o.value] : p.dietary.filter(d => d !== o.value) }))} />
                  } label={<Typography variant="body2">{o.label}</Typography>} sx={{ mx: 0 }} />
                ))}
              </Stack>
              {!tmplDlg.edit && (
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                  After saving, use ready for each day in the weekly planner.
                </Typography>
              )}
            </Box>
            <Stack direction="row" spacing={1.5}>
              <TextField select fullWidth size="small" label="Meal" value={tf.meal_type}
                onChange={e => setTf(p => ({ ...p, meal_type: e.target.value }))}>
                {MEAL_TYPES.map(m => <MenuItem key={m.value} value={m.value}>{m.icon} {m.label}</MenuItem>)}
              </TextField>
              <TextField select fullWidth size="small" label="Day (optional)" value={tf.day_of_week}
                onChange={e => setTf(p => ({ ...p, day_of_week: e.target.value }))}>
                <MenuItem value="">Any day</MenuItem>
                {DAY_ORDER.map(d => <MenuItem key={d} value={d}>{dayLabel(d)}</MenuItem>)}
              </TextField>
            </Stack>
            {tmplDlg.edit && (
              <TextField label="Description" fullWidth size="small" multiline rows={2} value={tf.description}
                onChange={e => setTf(p => ({ ...p, description: e.target.value }))} />
            )}
          </Stack>
        </DialogContent>
        <Divider />
        <DialogActions sx={{ px: 3, py: 2, justifyContent: 'space-between' }}>
          <Button onClick={() => setTmplDlg({ open: false })} sx={{ textTransform: 'none' }}>Cancel</Button>
          <Button variant="contained" onClick={saveTemplate} disabled={!tf.name.trim() || mkTmpl.isPending || updTmpl.isPending}
            sx={{ textTransform: 'none' }}>
            {(mkTmpl.isPending || updTmpl.isPending) ? <CircularProgress size={18} color="inherit" /> : tmplDlg.edit ? 'Save meal plan' : 'Save meal plan'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ─── Suggest a meal plan (Figma 11.1) ─── */}
      <Dialog open={suggestOpen} onClose={() => setSuggestOpen(false)} fullWidth maxWidth="xs">
        <FigDialogHeader eyebrow="MEAL PLANS" title="Suggest a meal plan"
          subtitle="A draft week built from this location's dietary profiles and your approved templates. You can change anything."
          onClose={() => setSuggestOpen(false)} />
        <DialogContent sx={{ pt: 1.5 }}>
          <Stack spacing={2.5}>
            <Box>
              <Typography variant="caption" sx={{ fontWeight: 700, letterSpacing: '0.04em' }}>FOR</Typography>
              <TextField select fullWidth size="small" sx={{ mt: 1 }} value={suggestLoc}
                onChange={e => setSuggestLoc(e.target.value)}>
                {locations.map((l: any) => {
                  const count = ((people as any[]) || []).filter(p => p.location_name === l.name).length;
                  return <MenuItem key={l.id} value={l.id}>{l.name} ({count} {count === 1 ? 'person' : 'people'})</MenuItem>;
                })}
              </TextField>
              {suggestLoc && (
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                  Results found in profiles: {profileSummary.diabetic} diabetic plan{profileSummary.diabetic === 1 ? '' : 's'}, {profileSummary.soft} soft diet{profileSummary.soft === 1 ? '' : 's'}, {profileSummary.vegetarian} vegetarian.
                </Typography>
              )}
            </Box>
            <Box>
              <Typography variant="caption" sx={{ fontWeight: 700, letterSpacing: '0.04em' }}>BUDGET PER PERSON PER DAY</Typography>
              <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                {BUDGETS.map(b => (
                  <Chip key={b} label={`£${b}`} clickable onClick={() => setBudget(b)}
                    color={budget === b ? 'primary' : 'default'} variant={budget === b ? 'filled' : 'outlined'}
                    sx={budget === b ? { fontWeight: 600, bgcolor: '#0164C8', color: '#FFFFFF', '&:hover': { bgcolor: '#0164C8' } } : { fontWeight: 500 }} />
                ))}
              </Stack>
            </Box>
          </Stack>
        </DialogContent>
        <Divider />
        <DialogActions sx={{ px: 3, py: 2, justifyContent: 'space-between' }}>
          <Button onClick={() => setSuggestOpen(false)} sx={{ textTransform: 'none' }}>Cancel</Button>
          <Button variant="contained" onClick={createDraft} disabled={!suggestLoc || drafting} sx={{ textTransform: 'none' }}>
            {drafting ? <CircularProgress size={18} color="inherit" /> : 'Create draft'}
          </Button>
        </DialogActions>
      </Dialog>

      <PreparingReportDialog open={drafting}
        title={suggestLoc ? `${locationName(suggestLoc)} draft week` : 'Draft week'}
        subtitle="Copying matching dishes from your approved templates…"
        cancelLabel="Cancel draft"
        onCancel={() => draftAbort.current?.abort()} />

      {/* ─── Add dish ─── */}
      <Dialog open={itemDlg.open} onClose={() => setItemDlg({ open: false, tplId: '' })} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 600 }}>{itemDlg.edit ? 'Edit Food Item' : 'Add Food Item'}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 'var(--card-gap)', pt: 1 }}>
            <TextField label="Food Name" value={itf.food_name} onChange={e => setItf(p => ({ ...p, food_name: e.target.value }))} fullWidth required placeholder="e.g. Chicken Pie" />
            <TextField label="Portion Size" value={itf.portion_size} onChange={e => setItf(p => ({ ...p, portion_size: e.target.value }))} fullWidth placeholder="e.g. Standard, Half" />
            <TextField label="Allergens" value={itf.allergens} onChange={e => setItf(p => ({ ...p, allergens: e.target.value }))} fullWidth placeholder="e.g. Gluten, Dairy" />
            <TextField label="Notes" value={itf.notes} onChange={e => setItf(p => ({ ...p, notes: e.target.value }))} fullWidth multiline rows={2} placeholder="Preparation notes" />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setItemDlg({ open: false, tplId: '' })}>Cancel</Button>
          <Button variant="contained"
            onClick={() => {
              if (!itf.food_name.trim() || !itemDlg.tplId) return;
              if (itemDlg.edit) {
                api.put(`/nutrition/meal-plans/items/${itemDlg.edit.id}`, itf)
                  .then(() => { qc.invalidateQueries({ queryKey: ['meal-plans'] }); qc.invalidateQueries({ queryKey: ['meal-plan', expandedSlot] }); setItemDlg({ open: false, tplId: '' }); showSnackbar('Dish updated.', 'success'); })
                  .catch((e: any) => showSnackbar(e.response?.data?.message || 'Could not update this dish.', 'error'));
                return;
              }
              addFood.mutate({ tplId: itemDlg.tplId, d: itf });
            }}
            disabled={!itf.food_name.trim() || addFood.isPending}>
            {itemDlg.edit ? 'Save' : 'Add'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ─── Per-person AI generator (existing feature) ─── */}
      <Dialog open={aiDlg} onClose={() => setAiDlg(false)} maxWidth="lg" fullWidth>
        <DialogTitle sx={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
          <AIIcon sx={{ color: '#8B7CF6' }} /> AI Meal Plan Generator
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mb: 3 }}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Generate a person-centred meal plan based on dietary requirements, allergies, and texture modifications.
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <TextField select label="Person" fullWidth value={aiForm.personId}
                  onChange={e => setAiForm(p => ({ ...p, personId: e.target.value }))}>
                  <MenuItem value=""><em>Select a person</em></MenuItem>
                  {(people || []).map((p: any) => (
                    <MenuItem key={p.id} value={p.id}>{p.first_name} {p.last_name} ({p.location_name || 'No location'})</MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField select label="Meal Type Focus" fullWidth value={aiForm.mealType}
                  onChange={e => setAiForm(p => ({ ...p, mealType: e.target.value }))}>
                  {MEAL_TYPES.map(m => <MenuItem key={m.value} value={m.value}>{m.icon} {m.label}</MenuItem>)}
                </TextField>
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField select label="Day of Week" fullWidth value={aiForm.dayOfWeek}
                  onChange={e => setAiForm(p => ({ ...p, dayOfWeek: e.target.value }))}>
                  <MenuItem value=""><em>Current day</em></MenuItem>
                  {DAY_ORDER.map(d => <MenuItem key={d} value={d}>{dayLabel(d)}</MenuItem>)}
                </TextField>
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField label="Special Requirements" fullWidth value={aiForm.specialRequirements}
                  onChange={e => setAiForm(p => ({ ...p, specialRequirements: e.target.value }))}
                  placeholder="e.g., soft diet only, high protein, low sodium" />
              </Grid>
            </Grid>
            <Button variant="contained" startIcon={generateMealPlan.isPending ? <CircularProgress size={16} /> : <AIIcon />}
              onClick={() => generateMealPlan.mutate(aiForm)}
              disabled={!aiForm.personId || generateMealPlan.isPending}
              sx={{ mt: 2, bgcolor: '#8B7CF6', '&:hover': { bgcolor: '#8B7CF6' } }}>
              {generateMealPlan.isPending ? 'Generating...' : 'Generate Meal Plan'}
            </Button>
          </Box>
          {aiError && <Alert severity="error" sx={{ mb: 2 }}>{aiError}</Alert>}
          {aiResult && (
            <Box>
              <Divider sx={{ mb: 2 }} />
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                <AIIcon sx={{ color: '#8B7CF6', fontSize: 20 }} />
                <Typography variant="h6" sx={{ fontWeight: 600 }}>{aiResult.plan_name}</Typography>
                <Chip label="AI-generated draft" size="small" sx={{ bgcolor: 'notice.subtle.bg', color: '#8B7CF6', fontWeight: 600 }} />
              </Stack>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                A dietitian or manager must review allergen, texture and portion decisions before use.
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>{aiResult.description}</Typography>
              {aiResult.person_context && (
                <Paper variant="outlined" sx={{ p: 2, mb: 2, bgcolor: 'notice.subtle.bg' }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>Person Context</Typography>
                  <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
                    <Chip size="small" label={`Diet: ${aiResult.person_context.dietary_summary}`} />
                    {aiResult.person_context.texture_modification !== 'None' && (
                      <Chip size="small" label={`Texture: ${aiResult.person_context.texture_modification}`} color="warning" />
                    )}
                    {aiResult.person_context.allergens?.map((a: string) => (
                      <Chip key={a} size="small" label={`No ${a}`} color="error" variant="outlined" />
                    ))}
                    <Chip size="small" label={`Fluid target: ${aiResult.person_context.fluid_target_ml}ml`} />
                  </Stack>
                </Paper>
              )}
              <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>Daily Plan</Typography>
              <Grid container spacing={2} sx={{ mb: 2 }}>
                {Object.entries(aiResult.daily_plan || {}).map(([mealKey, meal]) => {
                  if (!meal) return null;
                  const meta = MEAL_TYPES.find(m => m.value === mealKey);
                  return (
                    <Grid item xs={12} md={6} key={mealKey}>
                      <Card variant="outlined" sx={{ height: '100%' }}>
                        <CardContent>
                          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                            <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>{meta?.icon || '🍽️'} {meta?.label || mealKey}</Typography>
                            <Chip label={`${meal.estimated_calories} kcal`} size="small" color="primary" variant="outlined" />
                            <Chip label={`${meal.estimated_fluid_ml}ml`} size="small" color="info" variant="outlined" />
                          </Stack>
                          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>{meal.name}</Typography>
                          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>{meal.description}</Typography>
                          {meal.items?.map((item, i) => (
                            <Stack key={i} direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
                              <FoodIcon sx={{ fontSize: 14, color: meta?.color || 'primary.main' }} />
                              <Typography variant="body2" sx={{ fontWeight: 500 }}>{item.name}</Typography>
                              <Typography variant="caption" color="text.secondary">({item.portion})</Typography>
                              {item.allergens && <Chip label={item.allergens} size="small" color="warning" sx={{ height: 18, fontSize: '0.65rem' }} />}
                            </Stack>
                          ))}
                          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>🥤 {meal.fluid_suggestion}</Typography>
                        </CardContent>
                      </Card>
                    </Grid>
                  );
                })}
              </Grid>
              {aiResult.daily_totals && (
                <Paper variant="outlined" sx={{ p: 2, mb: 2, bgcolor: 'notice.success.bg' }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>Daily Totals</Typography>
                  <Stack direction="row" spacing={2}>
                    <Chip label={`${aiResult.daily_totals.total_calories} kcal`} color="primary" />
                    <Chip label={`${aiResult.daily_totals.total_fluid_ml}ml fluid`} color="info" />
                    <Chip label={`~${aiResult.daily_totals.protein_estimate_grams}g protein`} />
                    <Chip label={`~${aiResult.daily_totals.fibre_estimate_grams}g fibre`} />
                  </Stack>
                </Paper>
              )}
              {aiResult.allergen_warnings?.length > 0 && (
                <Alert severity="warning" sx={{ mb: 2 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>Allergen Warnings</Typography>
                  {aiResult.allergen_warnings.map((w: string, i: number) => (
                    <Typography key={i} variant="body2">• {w}</Typography>
                  ))}
                </Alert>
              )}
              {aiResult.nutritional_notes?.length > 0 && (
                <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>Nutritional Notes</Typography>
                  {aiResult.nutritional_notes.map((n: string, i: number) => (
                    <Typography key={i} variant="body2" color="text.secondary">• {n}</Typography>
                  ))}
                </Paper>
              )}
              {aiResult.suggestions?.length > 0 && (
                <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>Suggestions</Typography>
                  {aiResult.suggestions.map((s: string, i: number) => (
                    <Typography key={i} variant="body2" color="text.secondary">• {s}</Typography>
                  ))}
                </Paper>
              )}
              {isAdmin && aiResult.plan_name && (
                <Button variant="contained" startIcon={<SaveIcon />} sx={{ mt: 1 }}
                  onClick={() => {
                    const meals = MEAL_TYPES.filter(m => aiResult.daily_plan[m.value as keyof typeof aiResult.daily_plan]);
                    const allItems = meals.flatMap(m => {
                      const meal = aiResult.daily_plan[m.value as keyof typeof aiResult.daily_plan];
                      return (meal?.items || []).map((item: any) => ({
                        food_name: item.name,
                        portion_size: item.portion,
                        allergens: item.allergens,
                        notes: item.prep_notes,
                      }));
                    });
                    mkTmplFromAI.mutate({
                      name: aiResult.plan_name,
                      description: aiResult.description,
                      meal_type: aiForm.mealType,
                      day_of_week: aiForm.dayOfWeek || undefined,
                      items: allItems,
                      // Provenance travels with the plan. Without this the saved
                      // template is indistinguishable from a dietitian's work —
                      // the flag exists in the database precisely so that the
                      // plan an inspector asks about stays labelled (T1-11).
                      generated_by_ai: true,
                    });
                  }}
                  disabled={mkTmplFromAI.isPending}
                >
                  {mkTmplFromAI.isPending ? 'Saving...' : 'Save as Meal Plan Template'}
                </Button>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAiDlg(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </PageContainer>
  );
}
