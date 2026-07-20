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
      res.status(500).json({ error: { message: err.message || 'AI analysis failed' } });
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
      res.status(500).json({ error: { message: err.message || 'AI triage failed' } });
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
      res.status(500).json({ error: { message: err.message || 'AI rota analysis failed' } });
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

    const { generatePeriod, locationName, minStaffPerDay, minDayStaff, minNightStaff, minSleepStaff, staffRoster, existingShifts, staffOnLeave, serviceUsers, contractedHours, mandatoryStartTimes, minEndTime } = req.body;
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
      service_users: serviceUsers || 'No service users',
      contracted_hours: contractedHours || 'No contracted hours data',
      mandatory_start_times: mandatoryStartTimes || '07:00, 10:00, 14:00, 21:00',
      min_end_time: minEndTime || '22:00',
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
      res.status(500).json({ error: { message: err.message || 'AI rota generation failed' } });
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
}
