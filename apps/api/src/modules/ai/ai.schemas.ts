import { z } from 'zod';

/**
 * Zod schemas for AI-generated structured outputs.
 * Every AI call should validate its response through these schemas
 * before saving to the database or returning to the client.
 */

// --- Compliance Gap Analysis ---
export const ComplianceGapAnalysisSchema = z.object({
  overall_assessment: z.string().min(1),
  estimated_timeline: z.string().optional(),
  critical_gaps: z.array(z.object({
    area: z.string(),
    statement: z.string().optional(),
    current_state: z.string().optional(),
    recommended_action: z.string(),
    priority: z.enum(['critical', 'high', 'medium', 'low']).optional(),
    domain: z.string().optional(),
    effort: z.string().optional(),
  })).default([]),
  quick_wins: z.array(z.object({
    area: z.string(),
    action: z.string(),
    effort: z.string().optional(),
  })).default([]),
  overall_score: z.number().min(0).max(100).optional(),
});

// --- Incident Triage ---
export const IncidentTriageSchema = z.object({
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  confidence: z.number().min(0).max(1),
  reasoning: z.string().min(1),
  actions: z.array(z.string()).default([]),
  cqc_notification_required: z.boolean().default(false),
  category: z.string().optional(),
  follow_up_required: z.boolean().default(false),
});

// --- Rota Analysis ---
export const RotaAnalysisSchema = z.object({
  overall_assessment: z.string().min(1),
  coverage_summary: z.object({
    total_shifts: z.number(),
    filled_shifts: z.number(),
    coverage_percent: z.number(),
  }).optional(),
  issues: z.array(z.object({
    type: z.string(),
    description: z.string(),
    severity: z.enum(['low', 'medium', 'high', 'critical']).optional(),
    recommendation: z.string().optional(),
  })).default([]),
  recommendations: z.array(z.string()).default([]),
});

// --- Rota Generation ---
export const RotaGenerationSchema = z.object({
  shifts: z.array(z.object({
    day: z.string(),
    start_time: z.string(),
    end_time: z.string(),
    role: z.string().optional(),
    location: z.string().optional(),
    notes: z.string().optional(),
  })).default([]),
  notes: z.string().optional(),
});

// --- Daily Note ---
export const DailyNoteSchema = z.object({
  daily_note: z.object({
    content: z.string().min(1),
    mood_score: z.number().min(1).max(10).optional(),
    mood_description: z.string().optional(),
    risk_level: z.enum(['low', 'medium', 'high', 'critical']).optional(),
    safeguarding_flags: z.array(z.string()).default([]),
    follow_up_required: z.boolean().default(false),
    follow_up_notes: z.string().optional(),
    care_plan_updates: z.array(z.string()).default([]),
    support_level: z.enum(['independent', ' prompting', 'physical', 'full']).optional(),
  }).optional(),
  // Fallback: plain content
  content: z.string().optional(),
});

// --- Meal Plan ---
export const MealPlanSchema = z.object({
  plan_name: z.string().min(1),
  description: z.string().optional(),
  daily_plan: z.record(z.object({
    name: z.string(),
    description: z.string().optional(),
    items: z.array(z.object({
      name: z.string(),
      portion: z.string().optional(),
      allergens: z.string().optional(),
      prep_notes: z.string().optional(),
    })).default([]),
    fluid_suggestion: z.string().optional(),
    estimated_calories: z.number().optional(),
    estimated_fluid_ml: z.number().optional(),
  })).default({}),
  nutritional_notes: z.array(z.string()).default([]),
  allergen_warnings: z.array(z.string()).default([]),
  suggestions: z.array(z.string()).default([]),
});

// --- Weekly Meal Plan ---
export const WeeklyMealPlanSchema = z.object({
  week_start: z.string(),
  days: z.record(z.object({
    breakfast: z.object({
      option_a: z.object({ name: z.string(), description: z.string().optional(), items: z.array(z.any()).default([]), estimated_calories: z.number().optional() }).optional(),
      option_b: z.object({ name: z.string(), description: z.string().optional(), items: z.array(z.any()).default([]), estimated_calories: z.number().optional() }).optional(),
    }).optional(),
    lunch: z.object({
      option_a: z.object({ name: z.string(), description: z.string().optional(), items: z.array(z.any()).default([]), estimated_calories: z.number().optional() }).optional(),
      option_b: z.object({ name: z.string(), description: z.string().optional(), items: z.array(z.any()).default([]), estimated_calories: z.number().optional() }).optional(),
    }).optional(),
    dinner: z.object({
      option_a: z.object({ name: z.string(), description: z.string().optional(), items: z.array(z.any()).default([]), estimated_calories: z.number().optional() }).optional(),
      option_b: z.object({ name: z.string(), description: z.string().optional(), items: z.array(z.any()).default([]), estimated_calories: z.number().optional() }).optional(),
    }).optional(),
  })).default({}),
  weekly_totals: z.object({
    avg_calories: z.number().optional(),
    avg_fluid_ml: z.number().optional(),
  }).optional(),
});

// --- Shopping List ---
export const ShoppingListSchema = z.object({
  shopping_list: z.object({
    categories: z.array(z.object({
      name: z.string(),
      icon: z.string().optional(),
      items: z.array(z.object({
        name: z.string(),
        quantity: z.string().optional(),
        unit: z.string().optional(),
        used_in: z.array(z.string()).default([]),
        allergens: z.array(z.string()).default([]),
        notes: z.string().optional(),
      })).default([]),
    })).default([]),
    total_items: z.number().optional(),
    estimated_prep_time_minutes: z.number().optional(),
    storage_notes: z.array(z.string()).default([]),
    tips: z.array(z.string()).default([]),
  }),
});

/**
 * Safely parse and validate an AI response.
 * Returns the validated data on success, or null + error on failure.
 */
export function validateAIResponse<T extends z.ZodTypeAny>(
  schema: T,
  raw: string,
  context: string,
): { data: z.infer<T>; error: null } | { data: null; error: string } {
  let parsed: unknown;
  try {
    // Try to extract JSON from the response (AI sometimes wraps in markdown code blocks)
    const jsonMatch = raw.match(/```json\s*([\s\S]*?)```/) || raw.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      parsed = JSON.parse(jsonMatch[1] || jsonMatch[0]);
    } else {
      parsed = JSON.parse(raw);
    }
  } catch {
    return { data: null, error: `${context}: AI response is not valid JSON` };
  }

  const result = schema.safeParse(parsed);
  if (!result.success) {
    const issues = result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ');
    return { data: null, error: `${context}: Validation failed — ${issues}` };
  }
  return { data: result.data, error: null };
}
