import { useState } from 'react';
import {
  Box, Typography, Paper, Grid, Card, CardContent, CardActions, Button, Chip, Dialog,
  DialogTitle, DialogContent, DialogActions, TextField, MenuItem, IconButton, Stack,
  Divider, List, ListItem, ListItemText, ListItemSecondaryAction,
  Switch, FormControlLabel, Tooltip
} from '@mui/material';
import {
  Restaurant as MealIcon, Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon,
  ContentCopy as CloneIcon, ExpandMore as ExpandIcon, ExpandLess as CollapseIcon,
  LocalDining as FoodIcon, AccessTime as TimeIcon
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../services/api';

const MEAL_TYPES = [
  { value: 'breakfast', label: 'Breakfast', color: '#F59E0B', icon: '🌅' },
  { value: 'morning_snack', label: 'Morning Snack', color: '#10B981', icon: '🍎' },
  { value: 'lunch', label: 'Lunch', color: '#3B82F6', icon: '🍽️' },
  { value: 'afternoon_snack', label: 'Afternoon Snack', color: '#8B5CF6', icon: '🥤' },
  { value: 'dinner', label: 'Dinner', color: '#EF4444', icon: '🌙' },
  { value: 'evening_snack', label: 'Evening Snack', color: '#EC4899', icon: '🍪' },
  { value: 'supplement', label: 'Supplement', color: '#6366F1', icon: '💊' },
];

const DAYS = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'];

function dayLabel(d: string): string { return d.charAt(0).toUpperCase() + d.slice(1); }

interface MealTypeMeta { value: string; label: string; color: string; icon: string; }
interface MealGroup extends MealTypeMeta { items: any[] }

function groupByMeal(templates: any[]): MealGroup[] {
  const acc: MealGroup[] = [];
  for (const mt of MEAL_TYPES) {
    const items = templates.filter((t: any) => t.meal_type === mt.value);
    if (items.length > 0) acc.push({ ...mt, items });
  }
  return acc;
}

function useCurrentUser() {
  try { return JSON.parse(localStorage.getItem('user') || '{}'); } catch { return {}; }
}

export default function MealPlanPage() {
  const qc = useQueryClient();
  const currentUser = useCurrentUser();
  const isAdmin = currentUser.role === 'ORG_ADMIN' || currentUser.role === 'MANAGER';

  const [tmplDlg, setTmplDlg] = useState<{ open: boolean; edit?: any }>({ open: false });
  const [itemDlg, setItemDlg] = useState<{ open: boolean; tplId: string; edit?: any }>({ open: false, tplId: '' });
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [fType, setFType] = useState('');
  const [fDay, setFDay] = useState('');
  const [tf, setTf] = useState({ name: '', description: '', meal_type: 'breakfast', day_of_week: '', is_active: true });
  const [itf, setItf] = useState({ food_name: '', portion_size: '', allergens: '', notes: '' });

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['meal-plans', fType, fDay],
    queryFn: () => {
      const p = new URLSearchParams();
      if (fType) p.set('meal_type', fType);
      if (fDay) p.set('day_of_week', fDay);
      return api.get('/nutrition/meal-plans?' + p).then((r: any) => r.data);
    }
  });

  const { data: tplDetail, isLoading: loadingDetail } = useQuery({
    queryKey: ['meal-plan', expandedId],
    queryFn: () => api.get('/nutrition/meal-plans/' + expandedId).then((r: any) => r.data),
    enabled: !!expandedId,
  });

  const mkTmpl = useMutation({ mutationFn: (d: any) => api.post('/nutrition/meal-plans', d), onSuccess: () => { qc.invalidateQueries({ queryKey: ['meal-plans'] }); setTmplDlg({ open: false }); } });
  const updTmpl = useMutation({ mutationFn: (vars: any) => api.put('/nutrition/meal-plans/' + vars.id, vars.d), onSuccess: () => { qc.invalidateQueries({ queryKey: ['meal-plans'] }); setTmplDlg({ open: false }); } });
  const delTmpl = useMutation({ mutationFn: (id: string) => api.delete('/nutrition/meal-plans/' + id), onSuccess: () => qc.invalidateQueries({ queryKey: ['meal-plans'] }) });
  const cloneTmpl = useMutation({ mutationFn: (id: string) => api.post('/nutrition/meal-plans/' + id + '/clone'), onSuccess: () => qc.invalidateQueries({ queryKey: ['meal-plans'] }) });
  const addFood = useMutation({ mutationFn: (vars: any) => api.post('/nutrition/meal-plans/' + vars.tplId + '/items', vars.d), onSuccess: () => { qc.invalidateQueries({ queryKey: ['meal-plans'] }); qc.invalidateQueries({ queryKey: ['meal-plan', expandedId] }); setItemDlg({ open: false, tplId: '' }); } });
  const rmFood = useMutation({ mutationFn: (id: string) => api.delete('/nutrition/meal-plans/items/' + id), onSuccess: () => { qc.invalidateQueries({ queryKey: ['meal-plans'] }); qc.invalidateQueries({ queryKey: ['meal-plan', expandedId] }); } });

  const groups = groupByMeal(templates as any[]);

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800 }}>Meal Plans</Typography>
          <Typography variant="body2" color="text.secondary">Create and manage meal templates for your residents.</Typography>
        </Box>
        {isAdmin && (
          <Button variant="contained" startIcon={<AddIcon />}
            onClick={() => { setTf({ name: '', description: '', meal_type: 'breakfast', day_of_week: '', is_active: true }); setTmplDlg({ open: true }); }}
            sx={{ borderRadius: 2 }}>New Meal Plan</Button>
        )}
      </Stack>

      <Paper sx={{ p: 2, mb: 3, display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
        <MealIcon color="primary" />
        <Typography variant="subtitle2">Filter:</Typography>
        <TextField select size="small" label="Meal Type" value={fType} onChange={e => setFType(e.target.value)} sx={{ minWidth: 160 }}>
          <MenuItem value="">All Types</MenuItem>
          {MEAL_TYPES.map(m => <MenuItem key={m.value} value={m.value}>{m.icon} {m.label}</MenuItem>)}
        </TextField>
        <TextField select size="small" label="Day" value={fDay} onChange={e => setFDay(e.target.value)} sx={{ minWidth: 140 }}>
          <MenuItem value="">All Days</MenuItem>
          {DAYS.map(d => <MenuItem key={d} value={d}>{dayLabel(d)}</MenuItem>)}
        </TextField>
        {(fType || fDay) && <Button size="small" onClick={() => { setFType(''); setFDay(''); }}>Clear</Button>}
      </Paper>

      {isLoading ? (
        <Typography sx={{ textAlign: 'center', py: 8, color: 'text.secondary' }}>Loading meal plans...</Typography>
      ) : groups.length === 0 ? (
        <Paper sx={{ p: 8, textAlign: 'center' }}>
          <MealIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
          <Typography variant="h6" color="text.secondary" sx={{ mb: 1 }}>No meal plans yet</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>Create your first meal plan to get started.</Typography>
          {isAdmin && <Button variant="contained" startIcon={<AddIcon />} onClick={() => setTmplDlg({ open: true })}>Create Meal Plan</Button>}
        </Paper>
      ) : (
        <Box>
          {groups.map(g => (
            <Box key={g.value} sx={{ mb: 4 }}>
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
                <Typography variant="h6" sx={{ fontWeight: 700 }}>{g.icon} {g.label}</Typography>
                <Chip label={g.items.length} size="small" />
              </Stack>
              <Grid container spacing={2}>
                {g.items.map((tpl: any) => (
                  <Grid item xs={12} md={6} lg={4} key={tpl.id}>
                    <Card elevation={0} variant="outlined" sx={{
                      borderColor: expandedId === tpl.id ? g.color : 'divider',
                      borderWidth: expandedId === tpl.id ? 2 : 1,
                      transition: 'all 0.2s',
                      '&:hover': { boxShadow: '0 4px 12px rgba(0,0,0,0.08)', borderColor: g.color + '80' },
                    }}>
                      <CardContent sx={{ pb: 1 }}>
                        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5 }}>
                          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>{tpl.name}</Typography>
                          {!tpl.is_active && <Chip label="Inactive" size="small" />}
                        </Stack>
                        {tpl.description && (
                          <Typography variant="body2" color="text.secondary">
                            {tpl.description.length > 80 ? tpl.description.slice(0, 80) + '...' : tpl.description}
                          </Typography>
                        )}
                        <Stack direction="row" spacing={1} sx={{ mt: 1 }} flexWrap="wrap" useFlexGap>
                          {tpl.day_of_week && <Chip icon={<TimeIcon sx={{ fontSize: 14 }} />} label={dayLabel(tpl.day_of_week)} size="small" variant="outlined" />}
                          <Chip label={`${tpl.item_count || 0} items`} size="small" variant="outlined" />
                        </Stack>
                      </CardContent>
                      <CardActions sx={{ px: 2, pb: 1.5, justifyContent: 'space-between' }}>
                        <Button size="small" startIcon={expandedId === tpl.id ? <CollapseIcon /> : <ExpandIcon />}
                          onClick={() => setExpandedId(expandedId === tpl.id ? null : tpl.id)}>
                          {expandedId === tpl.id ? 'Collapse' : 'View Items'}
                        </Button>
                        <Stack direction="row" spacing={0.5}>
                          {isAdmin && <Tooltip title="Clone"><IconButton size="small" onClick={() => cloneTmpl.mutate(tpl.id)} color="primary"><CloneIcon fontSize="small" /></IconButton></Tooltip>}
                          {isAdmin && <Tooltip title="Edit"><IconButton size="small" onClick={() => { setTf({ name: tpl.name, description: tpl.description || '', meal_type: tpl.meal_type, day_of_week: tpl.day_of_week || '', is_active: tpl.is_active }); setTmplDlg({ open: true, edit: tpl }); }}><EditIcon fontSize="small" /></IconButton></Tooltip>}
                          {isAdmin && <Tooltip title="Delete"><IconButton size="small" onClick={() => { if (window.confirm('Delete this meal plan?')) delTmpl.mutate(tpl.id); }}><DeleteIcon fontSize="small" color="error" /></IconButton></Tooltip>}
                        </Stack>
                      </CardActions>
                      {expandedId === tpl.id && (
                        <>
                          <Divider />
                          <Box sx={{ p: 2 }}>
                            {loadingDetail ? <Typography variant="body2" color="text.secondary">Loading...</Typography> : (tplDetail?.items?.length > 0 ? (
                              <>
                                <List dense>
                                  {tplDetail.items.map((item: any) => (
                                    <ListItem key={item.id} sx={{ py: 0.5 }}>
                                      <FoodIcon sx={{ mr: 1, fontSize: 16, color: g.color }} />
                                      <ListItemText
                                        primary={<Typography variant="body2" fontWeight={600}>{item.food_name}</Typography>}
                                        secondary={<Stack direction="row" spacing={1} sx={{ mt: 0.25 }} useFlexGap>
                                          {item.portion_size && <Chip label={item.portion_size} size="small" variant="outlined" sx={{ height: 20, fontSize: '0.7rem' }} />}
                                          {item.allergens && <Chip label={`Allergens: ${item.allergens}`} size="small" variant="outlined" color="warning" sx={{ height: 20, fontSize: '0.7rem' }} />}
                                        </Stack>}
                                      />
                                      {isAdmin && <ListItemSecondaryAction>
                                        <IconButton size="small" onClick={() => { setItf({ food_name: item.food_name, portion_size: item.portion_size || '', allergens: item.allergens || '', notes: item.notes || '' }); setItemDlg({ open: true, tplId: tpl.id, edit: item }); }}><EditIcon fontSize="small" /></IconButton>
                                        <IconButton size="small" onClick={() => { if (window.confirm('Remove?')) rmFood.mutate(item.id); }}><DeleteIcon fontSize="small" color="error" /></IconButton>
                                      </ListItemSecondaryAction>}
                                    </ListItem>
                                  ))}
                                </List>
                                {isAdmin && <Button size="small" startIcon={<AddIcon />} sx={{ mt: 1 }} onClick={() => { setItf({ food_name: '', portion_size: '', allergens: '', notes: '' }); setItemDlg({ open: true, tplId: tpl.id }); }}>Add Item</Button>}
                              </>
                            ) : (
                              <Box sx={{ textAlign: 'center', py: 2 }}>
                                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>No items yet</Typography>
                                {isAdmin && <Button size="small" startIcon={<AddIcon />} onClick={() => { setItf({ food_name: '', portion_size: '', allergens: '', notes: '' }); setItemDlg({ open: true, tplId: tpl.id }); }}>Add First Item</Button>}
                              </Box>
                            ))}
                          </Box>
                        </>
                      )}
                    </Card>
                  </Grid>
                ))}
              </Grid>
            </Box>
          ))}
        </Box>
      )}

      {/* Template Dialog */}
      <Dialog open={tmplDlg.open} onClose={() => setTmplDlg({ open: false })} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>{tmplDlg.edit ? 'Edit Meal Plan' : 'New Meal Plan'}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <TextField label="Name" value={tf.name} onChange={e => setTf(p => ({ ...p, name: e.target.value }))} fullWidth required placeholder="e.g. Monday Breakfast Menu" />
            <TextField label="Description" value={tf.description} onChange={e => setTf(p => ({ ...p, description: e.target.value }))} fullWidth multiline rows={2} placeholder="Optional description" />
            <TextField select label="Meal Type" value={tf.meal_type} onChange={e => setTf(p => ({ ...p, meal_type: e.target.value }))} fullWidth>
              {MEAL_TYPES.map(m => <MenuItem key={m.value} value={m.value}>{m.icon} {m.label}</MenuItem>)}
            </TextField>
            <TextField select label="Day of Week (optional)" value={tf.day_of_week} onChange={e => setTf(p => ({ ...p, day_of_week: e.target.value }))} fullWidth>
              <MenuItem value="">Any day</MenuItem>
              {DAYS.map(d => <MenuItem key={d} value={d}>{dayLabel(d)}</MenuItem>)}
            </TextField>
            <FormControlLabel control={<Switch checked={tf.is_active} onChange={e => setTf(p => ({ ...p, is_active: e.target.checked }))} />} label="Active" />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTmplDlg({ open: false })}>Cancel</Button>
          <Button variant="contained" onClick={tmplDlg.edit ? () => updTmpl.mutate({ id: tmplDlg.edit.id, d: tf }) : () => mkTmpl.mutate(tf)} disabled={!tf.name.trim() || mkTmpl.isPending || updTmpl.isPending}>{tmplDlg.edit ? 'Save' : 'Create'}</Button>
        </DialogActions>
      </Dialog>

      {/* Item Dialog */}
      <Dialog open={itemDlg.open} onClose={() => setItemDlg({ open: false, tplId: '' })} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>{itemDlg.edit ? 'Edit Food Item' : 'Add Food Item'}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <TextField label="Food Name" value={itf.food_name} onChange={e => setItf(p => ({ ...p, food_name: e.target.value }))} fullWidth required placeholder="e.g. Chicken Pie" />
            <TextField label="Portion Size" value={itf.portion_size} onChange={e => setItf(p => ({ ...p, portion_size: e.target.value }))} fullWidth placeholder="e.g. Standard, Half" />
            <TextField label="Allergens" value={itf.allergens} onChange={e => setItf(p => ({ ...p, allergens: e.target.value }))} fullWidth placeholder="e.g. Gluten, Dairy" />
            <TextField label="Notes" value={itf.notes} onChange={e => setItf(p => ({ ...p, notes: e.target.value }))} fullWidth multiline rows={2} placeholder="Preparation notes" />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setItemDlg({ open: false, tplId: '' })}>Cancel</Button>
          <Button variant="contained" onClick={() => { if (!itf.food_name.trim() || !itemDlg.tplId) return; addFood.mutate({ tplId: itemDlg.tplId, d: itf }); }} disabled={!itf.food_name.trim() || addFood.isPending}>{itemDlg.edit ? 'Save' : 'Add'}</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
