import { Request, Response } from 'express';
import { AIRepository } from './ai.repository';
import { getProvider } from './ai.provider';
import { renderPrompt } from './ai.prompts';
import { AIConfig } from './ai.types';
import logger from '../../shared/utils/logger';

export class AIController {
  static async getConfig(req: Request, res: Response) {
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(400).json({ error: { message: 'Organization ID required' } });
    const config = await AIRepository.getConfig(orgId);
    const sanitized = config ? { ...config, apiKey: config.apiKey ? '••••••••' + config.apiKey.slice(-4) : '' } : null;
    res.json({ config: sanitized });
  }

  static async updateConfig(req: Request, res: Response) {
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(400).json({ error: { message: 'Organization ID required' } });

    const { provider, model, enabledFeatures, apiKey } = req.body;
    const update: Partial<AIConfig> = {};
    if (provider !== undefined) update.provider = provider;
    if (model !== undefined) update.model = model;
    if (enabledFeatures !== undefined) update.enabledFeatures = enabledFeatures;
    if (apiKey !== undefined) {
      const trimmed = typeof apiKey === 'string' ? apiKey.trim() : apiKey;
      if (trimmed === '') {
        update.apiKey = '';
      } else if (typeof trimmed === 'string' && !trimmed.includes('••')) {
        update.apiKey = trimmed;
      }
    }
    if (req.body.enabled !== undefined) update.enabled = req.body.enabled;

    const config = await AIRepository.updateConfig(orgId, update);
    const sanitized = { ...config, apiKey: config.apiKey ? '••••••••' + config.apiKey.slice(-4) : '' };
    res.json({ config: sanitized });
  }

  static async analyzeComplianceGap(req: Request, res: Response) {
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(400).json({ error: { message: 'Organization ID required' } });

    const config = await AIRepository.getConfig(orgId);
    if (!config || !config.enabled || !config.apiKey) {
      return res.status(400).json({ error: { message: 'AI not configured. Configure AI provider in Settings first.' } });
    }
    if (!config.enabledFeatures?.includes('compliance_gap_analysis')) {
      return res.status(403).json({ error: { message: 'Compliance Gap Analysis is not enabled for your organization.' } });
    }

    const { orgName, regulator, overallRate, domainScores, keyIssues } = req.body;
    const { system, user } = renderPrompt('compliance_gap_analysis', {
      org_name: orgName || 'Unknown',
      regulator: regulator || 'CQC',
      overall_rate: String(overallRate || '0'),
      domain_scores: domainScores || 'No data',
      key_issues: keyIssues || 'No issues provided',
    });

    const start = Date.now();
    try {
      const provider = getProvider(config);
      const result = await provider.chatCompletion(
        [{ role: 'system', content: system }, { role: 'user', content: user }],
        { model: config.model, temperature: 0.3 }
      );

      let parsed;
      try { parsed = JSON.parse(result.content); }
      catch { parsed = { raw: result.content }; }

      try {
        await AIRepository.logAudit({
          organizationId: orgId,
          feature: 'compliance_gap_analysis',
          promptKey: 'compliance_gap_analysis',
          promptTokens: result.promptTokens,
          completionTokens: result.completionTokens,
          totalTokens: result.totalTokens,
          model: config.model,
          provider: provider.name,
          durationMs: Date.now() - start,
          createdBy: req.user?.userId,
          requestData: { regulator, overallRate },
          responseSummary: typeof parsed === 'object' ? parsed.overall_assessment || 'Completed' : result.content.slice(0, 200),
        });
      } catch { /* audit logging non-critical */ }

      res.json({ analysis: parsed, usage: { promptTokens: result.promptTokens, completionTokens: result.completionTokens, totalTokens: result.totalTokens } });
    } catch (err: any) {
      try {
        await AIRepository.logAudit({
          organizationId: orgId,
          feature: 'compliance_gap_analysis',
          promptKey: 'compliance_gap_analysis',
          success: false,
          errorMessage: err.message,
          durationMs: Date.now() - start,
          createdBy: req.user?.userId,
        });
      } catch { /* audit logging non-critical */ }
      logger.error(err, 'Compliance gap analysis failed');
      res.status(500).json({ error: { message: 'AI analysis failed' } });
    }
  }

  static async triageIncident(req: Request, res: Response) {
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(400).json({ error: { message: 'Organization ID required' } });

    const config = await AIRepository.getConfig(orgId);
    if (!config || !config.enabled || !config.apiKey) {
      return res.status(400).json({ error: { message: 'AI not configured.' } });
    }
    if (!config.enabledFeatures?.includes('incident_severity_triage')) {
      return res.status(403).json({ error: { message: 'Incident Severity Triage is not enabled.' } });
    }

    const { title, description, category, date, location, involved } = req.body;
    const { system, user } = renderPrompt('incident_severity_triage', {
      title: title || 'Untitled',
      description: description || '',
      category: category || 'Uncategorized',
      date: date || new Date().toISOString().split('T')[0],
      location: location || 'Unknown',
      involved: involved || 'None specified',
    });

    const start = Date.now();
    try {
      const provider = getProvider(config);
      const result = await provider.chatCompletion(
        [{ role: 'system', content: system }, { role: 'user', content: user }],
        { model: config.model, temperature: 0.3 }
      );

      let parsed;
      try { parsed = JSON.parse(result.content); }
      catch { parsed = { raw: result.content }; }

      try {
        await AIRepository.logAudit({
          organizationId: orgId,
          feature: 'incident_severity_triage',
          promptKey: 'incident_severity_triage',
          promptTokens: result.promptTokens,
          completionTokens: result.completionTokens,
          totalTokens: result.totalTokens,
          model: config.model,
          provider: provider.name,
          durationMs: Date.now() - start,
          createdBy: req.user?.userId,
          responseSummary: typeof parsed === 'object' ? `${parsed.severity} (${Math.round((parsed.confidence || 0) * 100)}%)` : result.content.slice(0, 200),
        });
      } catch { /* audit logging non-critical */ }

      res.json({ triage: parsed, usage: { promptTokens: result.promptTokens, completionTokens: result.completionTokens, totalTokens: result.totalTokens } });
    } catch (err: any) {
      try {
        await AIRepository.logAudit({
          organizationId: orgId,
          feature: 'incident_severity_triage',
          promptKey: 'incident_severity_triage',
          success: false,
          errorMessage: err.message,
          durationMs: Date.now() - start,
          createdBy: req.user?.userId,
        });
      } catch { /* audit logging non-critical */ }
      logger.error(err, 'Incident triage failed');
      res.status(500).json({ error: { message: 'AI triage failed' } });
    }
  }

  static async analyzeRota(req: Request, res: Response) {
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(400).json({ error: { message: 'Organization ID required' } });

    const config = await AIRepository.getConfig(orgId);
    if (!config || !config.enabled || !config.apiKey) {
      return res.status(400).json({ error: { message: 'AI not configured. Configure AI provider in Settings first.' } });
    }
    if (!config.enabledFeatures?.includes('rota_optimization')) {
      return res.status(403).json({ error: { message: 'Rota Optimization is not enabled for your organization.' } });
    }

    const { weekRange, locationName, minStaffPerDay, minDayStaff, minNightStaff, minSleepStaff, staffRoster, shifts, openShifts, staffCompliance, overtimeHours } = req.body;
    const { system, user } = renderPrompt('rota_optimization', {
      week_range: weekRange || 'This week',
      location_name: locationName || 'Unknown',
      min_staff_per_day: String(minStaffPerDay ?? 1),
      min_day_staff: String(minDayStaff ?? 1),
      min_night_staff: String(minNightStaff ?? 1),
      min_sleep_staff: String(minSleepStaff ?? 0),
      staff_roster: staffRoster || 'No data',
      shifts: shifts || 'No data',
      open_shifts: openShifts || 'No data',
      staff_compliance: staffCompliance || 'No data',
      overtime_hours: overtimeHours || 'No data',
    });

    const start = Date.now();
    try {
      const provider = getProvider(config);
      const result = await provider.chatCompletion(
        [{ role: 'system', content: system }, { role: 'user', content: user }],
        { model: config.model, temperature: 0.3 }
      );

      let parsed;
      try { parsed = JSON.parse(result.content); }
      catch { parsed = { raw: result.content }; }

      try {
        await AIRepository.logAudit({
          organizationId: orgId,
          feature: 'rota_optimization',
          promptKey: 'rota_optimization',
          promptTokens: result.promptTokens,
          completionTokens: result.completionTokens,
          totalTokens: result.totalTokens,
          model: config.model,
          provider: provider.name,
          durationMs: Date.now() - start,
          createdBy: req.user?.userId,
          requestData: { weekRange, locationName },
          responseSummary: typeof parsed === 'object' ? parsed.overall_assessment || 'Completed' : result.content.slice(0, 200),
        });
      } catch { /* audit logging non-critical */ }

      res.json({ analysis: parsed, usage: { promptTokens: result.promptTokens, completionTokens: result.completionTokens, totalTokens: result.totalTokens } });
    } catch (err: any) {
      try {
        await AIRepository.logAudit({
          organizationId: orgId,
          feature: 'rota_optimization',
          promptKey: 'rota_optimization',
          success: false,
          errorMessage: err.message,
          durationMs: Date.now() - start,
          createdBy: req.user?.userId,
        });
      } catch { /* audit logging non-critical */ }
      logger.error(err, 'Rota analysis failed');
      res.status(500).json({ error: { message: 'AI rota analysis failed' } });
    }
  }

  static async generateRota(req: Request, res: Response) {
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(400).json({ error: { message: 'Organization ID required' } });

    const config = await AIRepository.getConfig(orgId);
    if (!config || !config.enabled || !config.apiKey) {
      return res.status(400).json({ error: { message: 'AI not configured. Configure AI provider in Settings first.' } });
    }
    if (!config.enabledFeatures?.includes('rota_optimization')) {
      return res.status(403).json({ error: { message: 'Rota Optimization is not enabled for your organization.' } });
    }

    const { generatePeriod, locationName, minStaffPerDay, minDayStaff, minNightStaff, minSleepStaff, staffRoster, existingShifts, staffOnLeave, people, staffingNeeds, contractedHours, mandatoryStartTimes, minEndTime, allSameEnd } = req.body;
    const { system, user } = renderPrompt('rota_generation', {
      generate_period: generatePeriod || 'This week',
      location_name: locationName || 'Unknown',
      min_staff_per_day: minStaffPerDay || '1',
      min_day_staff: minDayStaff || '1',
      min_night_staff: minNightStaff || '1',
      min_sleep_staff: minSleepStaff || '0',
      staff_roster: staffRoster || 'No data',
      existing_shifts: existingShifts || 'No existing shifts',
      staff_on_leave: staffOnLeave || 'None on leave',
      people: people || 'No people requiring care',
      staffing_needs: staffingNeeds || 'No staffing needs data',
      contracted_hours: contractedHours || 'No contracted hours data',
      mandatory_start_times: mandatoryStartTimes || '07:00, 10:00, 14:00, 21:00',
      min_end_time: minEndTime || '22:00',
      all_same_end: allSameEnd || 'false',
    });

    const start = Date.now();
    try {
      const provider = getProvider(config);
      const result = await provider.chatCompletion(
        [{ role: 'system', content: system }, { role: 'user', content: user }],
        { model: config.model, temperature: 0.3 }
      );

      let parsed;
      try { parsed = JSON.parse(result.content); }
      catch { parsed = { raw: result.content }; }

      try {
        await AIRepository.logAudit({
          organizationId: orgId,
          feature: 'rota_generation',
          promptKey: 'rota_generation',
          promptTokens: result.promptTokens,
          completionTokens: result.completionTokens,
          totalTokens: result.totalTokens,
          model: config.model,
          provider: provider.name,
          durationMs: Date.now() - start,
          createdBy: req.user?.userId,
          requestData: { generatePeriod, locationName },
          responseSummary: typeof parsed === 'object' ? `${parsed?.coverage_summary?.total_shifts || 0} shifts generated` : result.content.slice(0, 200),
        });
      } catch { /* audit logging non-critical */ }

      res.json({ rota: parsed, usage: { promptTokens: result.promptTokens, completionTokens: result.completionTokens, totalTokens: result.totalTokens } });
    } catch (err: any) {
      try {
        await AIRepository.logAudit({
          organizationId: orgId,
          feature: 'rota_generation',
          promptKey: 'rota_generation',
          success: false,
          errorMessage: err.message,
          durationMs: Date.now() - start,
          createdBy: req.user?.userId,
        });
      } catch { /* audit logging non-critical */ }
      logger.error(err, 'Rota generation failed');
      res.status(500).json({ error: { message: 'AI rota generation failed' } });
    }
  }

  static async auditLogs(req: Request, res: Response) {
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(400).json({ error: { message: 'Organization ID required' } });
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    const offset = parseInt(req.query.offset as string) || 0;
    const logs = await AIRepository.getAuditLogs(orgId, limit, offset);
    res.json({ logs });
  }

  static async usageStats(req: Request, res: Response) {
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(400).json({ error: { message: 'Organization ID required' } });
    const stats = await AIRepository.getUsageStats(orgId);
    res.json({ stats });
  }

  static async generateDailyNote(req: Request, res: Response) {
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(400).json({ error: { message: 'Organization ID required' } });

    const config = await AIRepository.getConfig(orgId);
    if (!config || !config.enabled || !config.apiKey) {
      return res.status(400).json({ error: { message: 'AI not configured. Configure AI provider in Settings first.' } });
    }
    if (!config.enabledFeatures?.includes('daily_note_generation')) {
      return res.status(403).json({ error: { message: 'Daily Note Generation is not enabled for your organization.' } });
    }

    const { personId, staffInput, shift, noteDate } = req.body;

    // Fetch person context
    const pool = (await import('../../shared/database')).default;
    const suResult = await pool.query(
      `SELECT su.*, 
              json_agg(DISTINCT jsonb_build_object('title', cp.title, 'category', cp.category, 'description', cp.description)) FILTER (WHERE cp.id IS NOT NULL) as care_plans,
              json_agg(DISTINCT jsonb_build_object('title', sg.title, 'description', sg.description, 'status', sg.status, 'target_value', sg.target_value, 'value_unit', sg.value_unit)) FILTER (WHERE sg.id IS NOT NULL) as recent_goals
       FROM people su
       LEFT JOIN care_plans cp ON cp.person_id = su.id AND cp.status = 'active'
       LEFT JOIN person_goals sg ON sg.person_id = su.id AND sg.status != 'completed'
       WHERE su.id = $1 AND su.organization_id = $2
       GROUP BY su.id`,
      [personId, orgId]
    );

    if (suResult.rows.length === 0) {
      return res.status(404).json({ error: { message: 'Person not found' } });
    }

    const su = suResult.rows[0];

    // Fetch recent mood/baseline data
    const baselineResult = await pool.query(
      `SELECT content, category, note_date FROM daily_notes 
       WHERE person_id = $1 AND note_date >= CURRENT_DATE - INTERVAL '7 days'
       ORDER BY note_date DESC LIMIT 5`,
      [personId]
    );

    const carePlans = (su.care_plans || []).filter((cp: any) => cp.title).map((cp: any) => 
      `- ${cp.title} (${cp.category}): ${cp.description || 'No description'}`
    ).join('\n') || 'No active care plans';

    const recentGoals = (su.recent_goals || []).filter((g: any) => g.title).map((g: any) => 
      `- ${g.title}: ${g.description || 'No description'} (Status: ${g.status}${g.target_value ? `, Target: ${g.target_value}${g.value_unit || ''}` : ''})`
    ).join('\n') || 'No active goals';

    const baselineData = baselineResult.rows.map((r: any) => 
      `[${r.note_date}] (${r.category}): ${r.content.slice(0, 150)}...`
    ).join('\n') || 'No recent notes';

    const { system, user } = renderPrompt('daily_note_generation', {
      person_name: `${su.first_name} ${su.last_name}`,
      date_of_birth: su.date_of_birth || 'Unknown',
      room_number: su.room_number || 'N/A',
      allergies: Array.isArray(su.allergies) ? su.allergies.join(', ') || 'None known' : 'None known',
      dietary_requirements: su.dietary_requirements || 'None noted',
      gp_name: su.gp_name || 'Unknown',
      gp_surgery: su.gp_surgery || 'Unknown',
      care_plans: carePlans,
      recent_goals: recentGoals,
      baseline_data: baselineData,
      staff_input: staffInput,
      shift: shift || 'day',
      note_date: noteDate || new Date().toISOString().split('T')[0],
    });

    const start = Date.now();
    try {
      const provider = getProvider(config);
      const result = await provider.chatCompletion(
        [{ role: 'system', content: system }, { role: 'user', content: user }],
        { model: config.model, temperature: 0.3 }
      );

      let parsed;
      try { parsed = JSON.parse(result.content); }
      catch { parsed = { raw: result.content }; }

      try {
        await AIRepository.logAudit({
          organizationId: orgId,
          feature: 'daily_note_generation',
          promptKey: 'daily_note_generation',
          promptTokens: result.promptTokens,
          completionTokens: result.completionTokens,
          totalTokens: result.totalTokens,
          model: config.model,
          provider: provider.name,
          durationMs: Date.now() - start,
          createdBy: req.user?.userId,
          requestData: { personId, shift, noteDate },
          responseSummary: typeof parsed === 'object' ? `Risk: ${parsed.risk_level || 'unknown'}, Safeguarding flags: ${parsed.safeguarding_flags?.length || 0}` : result.content.slice(0, 200),
        });
      } catch { /* audit logging non-critical */ }

      res.json({ 
        result: parsed, 
        person: { id: su.id, name: `${su.first_name} ${su.last_name}` },
        usage: { promptTokens: result.promptTokens, completionTokens: result.completionTokens, totalTokens: result.totalTokens } 
      });
    } catch (err: any) {
      try {
        await AIRepository.logAudit({
          organizationId: orgId,
          feature: 'daily_note_generation',
          promptKey: 'daily_note_generation',
          success: false,
          errorMessage: err.message,
          durationMs: Date.now() - start,
          createdBy: req.user?.userId,
        });
      } catch { /* audit logging non-critical */ }
      logger.error(err, 'Daily note generation failed');
      res.status(500).json({ error: { message: 'AI daily note generation failed' } });
    }
  }

  static async approveDailyNote(req: Request, res: Response) {
    const orgId = req.user?.organizationId;
    const userId = req.user?.userId;
    if (!orgId || !userId) return res.status(400).json({ error: { message: 'Organization and user required' } });

    const pool = (await import('../../shared/database')).default;
    const { personId, dailyNote, moodAnalysis, safeguardingFlags, carePlanUpdates, interventionsSuggested, riskLevel, followUpRequired, followUpDetails, linkedGoalId, noteDate } = req.body;

    // Verify person belongs to org
    const suCheck = await pool.query('SELECT id FROM people WHERE id = $1 AND organization_id = $2', [personId, orgId]);
    if (suCheck.rows.length === 0) {
      return res.status(404).json({ error: { message: 'Person not found' } });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Insert the daily note with AI analysis metadata
      const noteResult = await client.query(
        `INSERT INTO daily_notes (person_id, author_id, note_date, shift, category, content, support_level, generated_by_ai,
         ai_mood_analysis, ai_safeguarding_flags, ai_care_plan_updates, ai_interventions, ai_risk_level, ai_follow_up_required, ai_follow_up_details)
         VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE, $8, $9, $10, $11, $12, $13, $14) RETURNING *`,
        [
          personId, userId, noteDate || new Date().toISOString().split('T')[0],
          dailyNote.shift, dailyNote.category, dailyNote.content, dailyNote.support_level || null,
          moodAnalysis ? JSON.stringify(moodAnalysis) : null,
          safeguardingFlags && safeguardingFlags.length > 0 ? JSON.stringify(safeguardingFlags) : null,
          carePlanUpdates && carePlanUpdates.length > 0 ? JSON.stringify(carePlanUpdates) : null,
          interventionsSuggested && interventionsSuggested.length > 0 ? JSON.stringify(interventionsSuggested) : null,
          riskLevel || null,
          followUpRequired || false,
          followUpDetails || null,
        ]
      );

      // 2. Create safeguarding alerts if flagged
      if (safeguardingFlags && safeguardingFlags.length > 0) {
        for (const flag of safeguardingFlags) {
          if (flag.severity !== 'low') {
            await client.query(
              `INSERT INTO notifications (user_id, title, message, type)
               SELECT u.id, $1, $2, 'warning'
               FROM users u WHERE u.organization_id = $3 AND u.role IN ('ORG_ADMIN', 'MANAGER')
               LIMIT 5`,
              [
                `Safeguarding Alert: ${flag.concern_type}`,
                `${flag.description}. Action: ${flag.action_required}. Severity: ${flag.severity.toUpperCase()}`,
                orgId,
              ]
            );
          }
        }
      }

      // 4. Log AI usage in audit trail
      await client.query(
        `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_data)
         VALUES ($1, $2, 'daily_note', $3, $4)`,
        [
          userId,
          'ai_daily_note_approved',
          noteResult.rows[0].id,
          JSON.stringify({
            mood_score: moodAnalysis?.mood_score,
            safeguarding_flags: safeguardingFlags?.length || 0,
            care_plan_updates: carePlanUpdates?.length || 0,
            risk_level: riskLevel,
            follow_up_required: followUpRequired,
          })
        ]
      );

      await client.query('COMMIT');

      res.status(201).json({
        dailyNote: noteResult.rows[0],
        message: 'Daily note saved successfully',
        safeguardingAlerts: safeguardingFlags?.filter((f: any) => f.severity !== 'low').length || 0,
      });
    } catch (err: any) {
      await client.query('ROLLBACK');
      logger.error(err, 'Failed to approve daily note');
      res.status(500).json({ error: { message: 'Failed to save daily note' } });
    } finally {
      client.release();
    }
  }

  static async analyzeExistingNote(req: Request, res: Response) {
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(400).json({ error: { message: 'Organization required' } });

    const pool = (await import('../../shared/database')).default;
    const { noteId } = req.params;

    const noteResult = await pool.query(
      'SELECT n.*, su.first_name, su.last_name FROM daily_notes n JOIN people su ON su.id = n.person_id WHERE n.id = $1 AND su.organization_id = $2',
      [noteId, orgId]
    );
    if (noteResult.rows.length === 0) {
      return res.status(404).json({ error: { message: 'Note not found' } });
    }

    const note = noteResult.rows[0];
    const config = await AIRepository.getConfig(orgId);
    if (!config || !config.enabled || !config.apiKey) {
      return res.status(400).json({ error: { message: 'AI not configured. Add API keys in Settings > AI.' } });
    }

    const provider = getProvider(config);
    const { system, user: userTemplate } = renderPrompt('daily_note_generation', {});
    const staffInput = note.content;

    const start = Date.now();
    try {
      const personRes = await pool.query(
        'SELECT first_name, last_name, date_of_birth, room_number FROM people WHERE id = $1',
        [note.person_id]
      );
      const su = personRes.rows[0];

      const carePlansRes = await pool.query(
        'SELECT title FROM care_plans WHERE person_id = $1 AND status = $2',
        [note.person_id, 'active']
      );

      const goalsRes = await pool.query(
        'SELECT title, target_date, status FROM person_goals WHERE person_id = $1',
        [note.person_id]
      );

      const userPrompt = userTemplate
        .replace('{{person_name}}', `${su.first_name} ${su.last_name}`)
        .replace('{{date_of_birth}}', su.date_of_birth ? new Date(su.date_of_birth).toLocaleDateString('en-GB') : 'Unknown')
        .replace('{{room_number}}', su.room_number || 'Unknown')
        .replace('{{allergies}}', 'None on file')
        .replace('{{dietary_requirements}}', 'None on file')
        .replace('{{gp_name}}', 'Unknown')
        .replace('{{gp_surgery}}', 'Unknown')
        .replace('{{care_plans}}', carePlansRes.rows.map(cp => cp.title).join(', ') || 'No active care plans')
        .replace('{{recent_goals}}', goalsRes.rows.map(g => `${g.title} (${g.status}, due ${g.target_date || 'no date'})`).join('\n') || 'No goals set')
        .replace('{{staff_observations}}', staffInput)
        .replace('{{shift}}', note.shift)
        .replace('{{date}}', note.note_date);

      const result = await provider.chatCompletion(
        [{ role: 'system', content: system }, { role: 'user', content: userPrompt }],
        { model: config.model, temperature: 0.3, maxTokens: 1500 }
      );

      let parsed: any;
      try {
        const jsonMatch = result.content.match(/\{[\s\S]*\}/);
        parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : { daily_note: { content: result.content } };
      } catch {
        parsed = { daily_note: { content: result.content } };
      }

      await pool.query(
        `UPDATE daily_notes SET
          generated_by_ai = TRUE,
          ai_mood_analysis = $1,
          ai_safeguarding_flags = $2,
          ai_care_plan_updates = $3,
          ai_interventions = $4,
          ai_risk_level = $5,
          ai_follow_up_required = $6,
          ai_follow_up_details = $7
         WHERE id = $8`,
        [
          parsed.mood_analysis ? JSON.stringify(parsed.mood_analysis) : null,
          parsed.safeguarding_flags?.length > 0 ? JSON.stringify(parsed.safeguarding_flags) : null,
          parsed.care_plan_updates?.length > 0 ? JSON.stringify(parsed.care_plan_updates) : null,
          parsed.interventions_suggested?.length > 0 ? JSON.stringify(parsed.interventions_suggested) : null,
          parsed.risk_level || null,
          parsed.follow_up_required || false,
          parsed.follow_up_details || null,
          noteId,
        ]
      );

      try {
        await AIRepository.logAudit({
          organizationId: orgId,
          feature: 'daily_note_generation',
          promptKey: 'daily_note_generation',
          success: true,
          promptTokens: result.promptTokens,
          completionTokens: result.completionTokens,
          totalTokens: result.totalTokens,
          model: config.model,
          provider: provider.name,
          durationMs: Date.now() - start,
          createdBy: req.user?.userId,
          requestData: { noteId, personId: note.person_id },
          responseSummary: `Risk: ${parsed.risk_level || 'unknown'}, Safeguarding flags: ${parsed.safeguarding_flags?.length || 0}`,
        });
      } catch { /* audit non-critical */ }

      res.json({ result: parsed, usage: { promptTokens: result.promptTokens, completionTokens: result.completionTokens, totalTokens: result.totalTokens } });
    } catch (err: any) {
      logger.error(err, 'Note analysis failed');
      res.status(500).json({ error: { message: 'Analysis failed' } });
    }
  }

  static async generateMealPlan(req: Request, res: Response) {
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(400).json({ error: { message: 'Organization ID required' } });

    const config = await AIRepository.getConfig(orgId);
    if (!config || !config.enabled || !config.apiKey) {
      return res.status(400).json({ error: { message: 'AI not configured. Configure AI provider in Settings first.' } });
    }
    if (!config.enabledFeatures?.includes('meal_plan_generation')) {
      return res.status(403).json({ error: { message: 'Meal Plan Generation is not enabled for your organization.' } });
    }

    const { personId, mealType, dayOfWeek, specialRequirements } = req.body;
    const pool = (await import('../../shared/database')).default;

    // Fetch person and dietary profile
    const personResult = await pool.query(
      `SELECT p.*, dp.dietary_type, dp.texture_modified, dp.vegetarian, dp.vegan,
              dp.halal, dp.kosher, dp.gluten_free, dp.dairy_free, dp.nut_allergy,
              dp.other_allergies, dp.food_preferences, dp.food_dislikes,
              dp.fluid_daily_target_ml, dp.appetite_level, dp.eating_abilities,
              dp.additional_notes
       FROM people p
       LEFT JOIN dietary_profiles dp ON dp.person_id = p.id
       WHERE p.id = $1 AND p.organization_id = $2`,
      [personId, orgId]
    );

    if (personResult.rows.length === 0) {
      return res.status(404).json({ error: { message: 'Person not found' } });
    }

    const person = personResult.rows[0];
    const { system, user } = renderPrompt('meal_plan_generation', {
      person_name: `${person.first_name} ${person.last_name}`,
      date_of_birth: person.date_of_birth ? new Date(person.date_of_birth).toLocaleDateString('en-GB') : 'Unknown',
      dietary_type: person.dietary_type || 'Standard',
      texture_modified: person.texture_modified || 'None',
      vegetarian: person.vegetarian ? 'Yes' : 'No',
      vegan: person.vegan ? 'Yes' : 'No',
      halal: person.halal ? 'Yes' : 'No',
      kosher: person.kosher ? 'Yes' : 'No',
      gluten_free: person.gluten_free ? 'Yes' : 'No',
      dairy_free: person.dairy_free ? 'Yes' : 'No',
      nut_allergy: person.nut_allergy ? 'Yes' : 'No',
      other_allergies: person.other_allergies || 'None noted',
      food_preferences: person.food_preferences || 'No specific preferences noted',
      food_dislikes: person.food_dislikes || 'No dislikes noted',
      appetite_level: person.appetite_level || 'Good',
      eating_abilities: person.eating_abilities || 'Independent',
      fluid_target_ml: String(person.fluid_daily_target_ml || 2000),
      additional_notes: person.additional_notes || 'None',
      meal_type: mealType || 'lunch',
      day_of_week: dayOfWeek || new Date().toLocaleDateString('en-US', { weekday: 'long' }),
      special_requirements: specialRequirements || 'None',
    });

    const start = Date.now();
    try {
      const provider = getProvider(config);
      const result = await provider.chatCompletion(
        [{ role: 'system', content: system }, { role: 'user', content: user }],
        { model: config.model, temperature: 0.4, maxTokens: 2000 }
      );

      let parsed;
      try {
        const jsonMatch = result.content.match(/\{[\s\S]*\}/);
        parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : { raw: result.content };
      } catch {
        parsed = { raw: result.content };
      }

      try {
        await AIRepository.logAudit({
          organizationId: orgId,
          feature: 'meal_plan_generation',
          promptKey: 'meal_plan_generation',
          promptTokens: result.promptTokens,
          completionTokens: result.completionTokens,
          totalTokens: result.totalTokens,
          model: config.model,
          provider: provider.name,
          durationMs: Date.now() - start,
          createdBy: req.user?.userId,
          requestData: { personId, mealType, dayOfWeek },
          responseSummary: typeof parsed === 'object' && parsed.plan_name ? `${parsed.plan_name} - ${Object.keys(parsed.daily_plan || {}).length} meals` : 'Meal plan generated',
        });
      } catch { /* audit non-critical */ }

      res.json({ mealPlan: parsed, usage: { promptTokens: result.promptTokens, completionTokens: result.completionTokens, totalTokens: result.totalTokens } });
    } catch (err: any) {
      try {
        await AIRepository.logAudit({
          organizationId: orgId,
          feature: 'meal_plan_generation',
          promptKey: 'meal_plan_generation',
          success: false,
          errorMessage: err.message,
          durationMs: Date.now() - start,
          createdBy: req.user?.userId,
        });
      } catch { /* audit non-critical */ }
      logger.error(err, 'AI meal plan generation failed');
      res.status(500).json({ error: { message: 'AI meal plan generation failed' } });
    }
  }

  static async generateWeeklyMealPlan(req: Request, res: Response) {
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(400).json({ error: { message: 'Organization ID required' } });

    const config = await AIRepository.getConfig(orgId);
    if (!config || !config.enabled || !config.apiKey) {
      return res.status(400).json({ error: { message: 'AI not configured. Configure AI provider in Settings first.' } });
    }
    if (!config.enabledFeatures?.includes('meal_plan_generation')) {
      return res.status(403).json({ error: { message: 'Meal Plan Generation is not enabled for your organization.' } });
    }

    const { personId, specialRequirements } = req.body;
    const pool = (await import('../../shared/database')).default;

    const personResult = await pool.query(
      `SELECT p.*, dp.dietary_type, dp.texture_modified, dp.vegetarian, dp.vegan,
              dp.halal, dp.kosher, dp.gluten_free, dp.dairy_free, dp.nut_allergy,
              dp.other_allergies, dp.food_preferences, dp.food_dislikes,
              dp.fluid_daily_target_ml, dp.appetite_level, dp.eating_abilities,
              dp.additional_notes
       FROM people p
       LEFT JOIN dietary_profiles dp ON dp.person_id = p.id
       WHERE p.id = $1 AND p.organization_id = $2`,
      [personId, orgId]
    );

    if (personResult.rows.length === 0) {
      return res.status(404).json({ error: { message: 'Person not found' } });
    }

    const person = personResult.rows[0];
    const { system, user } = renderPrompt('weekly_meal_plan', {
      person_name: `${person.first_name} ${person.last_name}`,
      date_of_birth: person.date_of_birth ? new Date(person.date_of_birth).toLocaleDateString('en-GB') : 'Unknown',
      dietary_type: person.dietary_type || 'Standard',
      texture_modified: person.texture_modified || 'None',
      vegetarian: person.vegetarian ? 'Yes' : 'No',
      vegan: person.vegan ? 'Yes' : 'No',
      halal: person.halal ? 'Yes' : 'No',
      kosher: person.kosher ? 'Yes' : 'No',
      gluten_free: person.gluten_free ? 'Yes' : 'No',
      dairy_free: person.dairy_free ? 'Yes' : 'No',
      nut_allergy: person.nut_allergy ? 'Yes' : 'No',
      other_allergies: person.other_allergies || 'None noted',
      food_preferences: person.food_preferences || 'No specific preferences',
      food_dislikes: person.food_dislikes || 'No dislikes noted',
      appetite_level: person.appetite_level || 'Good',
      eating_abilities: person.eating_abilities || 'Independent',
      fluid_target_ml: String(person.fluid_daily_target_ml || 2000),
      additional_notes: person.additional_notes || 'None',
    });

    const start = Date.now();
    try {
      const provider = getProvider(config);
      const result = await provider.chatCompletion(
        [{ role: 'system', content: system }, { role: 'user', content: user }],
        { model: config.model, temperature: 0.4, maxTokens: 4000 }
      );

      let parsed;
      try {
        const jsonMatch = result.content.match(/\{[\s\S]*\}/);
        parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : { raw: result.content };
      } catch {
        parsed = { raw: result.content };
      }

      try {
        await AIRepository.logAudit({
          organizationId: orgId,
          feature: 'meal_plan_generation',
          promptKey: 'weekly_meal_plan',
          promptTokens: result.promptTokens,
          completionTokens: result.completionTokens,
          totalTokens: result.totalTokens,
          model: config.model,
          provider: provider.name,
          durationMs: Date.now() - start,
          createdBy: req.user?.userId,
          requestData: { personId },
          responseSummary: typeof parsed === 'object' && parsed.plan_name ? `Weekly plan: ${parsed.plan_name}` : 'Weekly plan generated',
        });
      } catch { /* audit non-critical */ }

      res.json({ weeklyPlan: parsed, usage: { promptTokens: result.promptTokens, completionTokens: result.completionTokens, totalTokens: result.totalTokens } });
    } catch (err: any) {
      try {
        await AIRepository.logAudit({
          organizationId: orgId,
          feature: 'meal_plan_generation',
          promptKey: 'weekly_meal_plan',
          success: false,
          errorMessage: err.message,
          durationMs: Date.now() - start,
          createdBy: req.user?.userId,
        });
      } catch { /* audit non-critical */ }
      logger.error(err, 'AI weekly meal plan generation failed');
      res.status(500).json({ error: { message: 'AI weekly meal plan generation failed' } });
    }
  }
}
