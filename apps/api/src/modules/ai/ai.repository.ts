import { query } from '../../shared/database';
import { AIConfig } from './ai.types';

export class AIRepository {
  static async getConfig(organizationId: string): Promise<AIConfig | null> {
    const res = await query(
      `SELECT ai_config FROM organizations WHERE id = $1`,
      [organizationId]
    );
    if (!res.rows.length) return null;
    return res.rows[0].ai_config as AIConfig;
  }

  static async updateConfig(organizationId: string, config: Partial<AIConfig>): Promise<AIConfig> {
    const existing = await this.getConfig(organizationId);
    const merged = { ...(existing || {}), ...config };
    const res = await query(
      `UPDATE organizations SET ai_config = $1::jsonb, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING ai_config`,
      [JSON.stringify(merged), organizationId]
    );
    return res.rows[0].ai_config as AIConfig;
  }

  static async logAudit(params: {
    organizationId: string;
    feature: string;
    promptKey?: string;
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
    model?: string;
    provider?: string;
    durationMs?: number;
    success?: boolean;
    errorMessage?: string;
    createdBy?: string;
    requestData?: any;
    responseSummary?: string;
  }) {
    await query(
      `INSERT INTO ai_audit_logs (organization_id, feature, prompt_key, prompt_tokens, completion_tokens, total_tokens, model, provider, duration_ms, success, error_message, created_by, request_data, response_summary)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
      [
        params.organizationId,
        params.feature,
        params.promptKey || null,
        params.promptTokens || 0,
        params.completionTokens || 0,
        params.totalTokens || 0,
        params.model || null,
        params.provider || null,
        params.durationMs || null,
        params.success !== false,
        params.errorMessage || null,
        params.createdBy || null,
        params.requestData ? JSON.stringify(params.requestData) : null,
        params.responseSummary || null,
      ]
    );
  }

  static async getAuditLogs(organizationId: string, limit = 50, offset = 0) {
    const res = await query(
      `SELECT aal.*, u.email as user_email
       FROM ai_audit_logs aal
       LEFT JOIN users u ON u.id = aal.created_by
       WHERE aal.organization_id = $1
       ORDER BY aal.created_at DESC
       LIMIT $2 OFFSET $3`,
      [organizationId, limit, offset]
    );
    return res.rows;
  }

  static async getUsageStats(organizationId: string) {
    const res = await query(
      `SELECT
         COUNT(*) as total_requests,
         COALESCE(SUM(total_tokens), 0) as total_tokens,
         COALESCE(SUM(CASE WHEN success THEN 1 ELSE 0 END), 0) as successful_requests,
         COALESCE(SUM(CASE WHEN NOT success THEN 1 ELSE 0 END), 0) as failed_requests,
         COALESCE(SUM(duration_ms), 0) as total_duration_ms,
         COUNT(DISTINCT feature) as features_used
       FROM ai_audit_logs
       WHERE organization_id = $1`,
      [organizationId]
    );
    return res.rows[0] || {};
  }
}
