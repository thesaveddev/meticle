import { query } from '../../shared/database';

export class OutcomesRepository {
  // ─── Scales ───

  static async findScales(orgId: string) {
    const result = await query(
      `SELECT os.*,
        (SELECT COUNT(*)::int FROM outcome_scale_results osr WHERE osr.scale_id = os.id) AS total_assessments
       FROM outcome_scales os WHERE os.organization_id = $1 ORDER BY os.name`,
      [orgId]
    );
    return result.rows;
  }

  static async findScaleById(scaleId: string, orgId: string) {
    const result = await query(
      `SELECT os.* FROM outcome_scales os WHERE os.id = $1 AND os.organization_id = $2`,
      [scaleId, orgId]
    );
    return result.rows[0] || null;
  }

  static async createScale(orgId: string, data: any) {
    const { name, shortcode, description, min_score, max_score, questions, score_bands } = data;
    const result = await query(
      `INSERT INTO outcome_scales (organization_id, name, shortcode, description, min_score, max_score, questions, score_bands)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [orgId, name, shortcode, description || null, min_score ?? 0, max_score ?? 100, JSON.stringify(questions), JSON.stringify(score_bands)]
    );
    return result.rows[0];
  }

  static async updateScale(scaleId: string, data: any, orgId: string) {
    const fields: string[] = []; const params: any[] = []; let idx = 1;
    for (const [k, v] of Object.entries(data)) {
      if (v === undefined) continue;
      const val = (k === 'questions' || k === 'score_bands') ? JSON.stringify(v) : v;
      fields.push(`${k} = $${idx++}`);
      params.push(val);
    }
    if (fields.length === 0) return null;
    fields.push('updated_at = CURRENT_TIMESTAMP');
    params.push(scaleId, orgId);
    const result = await query(
      `UPDATE outcome_scales SET ${fields.join(', ')} WHERE id = $${idx} AND organization_id = $${idx + 1} RETURNING *`,
      params
    );
    return result.rows[0] || null;
  }

  static async deleteScale(scaleId: string, orgId: string) {
    await query('DELETE FROM outcome_scales WHERE id = $1 AND organization_id = $2', [scaleId, orgId]);
  }

  // ─── Assessments ───

  static async recordAssessment(data: any) {
    const { scale_id, person_id, scores, total_score, band_label, assessed_by, notes } = data;
    const result = await query(
      `INSERT INTO outcome_scale_results (scale_id, person_id, scores, total_score, band_label, assessed_by, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [scale_id, person_id, JSON.stringify(scores), total_score, band_label || null, assessed_by || null, notes || null]
    );
    return result.rows[0];
  }

  static async findResults(scaleId: string, filters: { person_id?: string; date_from?: string; date_to?: string }) {
    let sql = `
      SELECT osr.*,
        (SELECT first_name || ' ' || last_name FROM people WHERE id = osr.person_id) AS person_name,
        (SELECT first_name || ' ' || last_name FROM staff_profiles WHERE user_id = osr.assessed_by) AS assessed_by_name,
        os.name AS scale_name, os.shortcode AS scale_shortcode
      FROM outcome_scale_results osr
      JOIN outcome_scales os ON osr.scale_id = os.id
      WHERE osr.scale_id = $1`;
    const params: any[] = [scaleId];
    let idx = 2;
    if (filters.person_id) { sql += ` AND osr.person_id = $${idx++}`; params.push(filters.person_id); }
    if (filters.date_from) { sql += ` AND osr.assessed_at >= $${idx++}`; params.push(filters.date_from); }
    if (filters.date_to) { sql += ` AND osr.assessed_at <= $${idx++}`; params.push(filters.date_to); }
    sql += ' ORDER BY osr.assessed_at DESC';
    const result = await query(sql, params);
    return result.rows;
  }

  static async findResultById(resultId: string) {
    const result = await query(
      `SELECT osr.*,
        (SELECT first_name || ' ' || last_name FROM people WHERE id = osr.person_id) AS person_name,
        (SELECT first_name || ' ' || last_name FROM staff_profiles WHERE user_id = osr.assessed_by) AS assessed_by_name,
        os.name AS scale_name, os.shortcode AS scale_shortcode
       FROM outcome_scale_results osr
       JOIN outcome_scales os ON osr.scale_id = os.id
       WHERE osr.id = $1`,
      [resultId]
    );
    return result.rows[0] || null;
  }

  static async deleteResult(resultId: string) {
    await query('DELETE FROM outcome_scale_results WHERE id = $1', [resultId]);
  }

  static async findAllResults(orgId: string, filters: { person_id?: string }) {
    let sql = `
      SELECT osr.*,
        (SELECT first_name || ' ' || last_name FROM people WHERE id = osr.person_id) AS person_name,
        (SELECT first_name || ' ' || last_name FROM staff_profiles WHERE user_id = osr.assessed_by) AS assessor_name,
        os.name AS scale_name, os.shortcode AS scale_code
      FROM outcome_scale_results osr
      JOIN outcome_scales os ON osr.scale_id = os.id
      WHERE os.organization_id = $1`;
    const params: any[] = [orgId];
    let idx = 2;
    if (filters.person_id) { sql += ` AND osr.person_id = $${idx++}`; params.push(filters.person_id); }
    sql += ' ORDER BY osr.assessed_at DESC';
    const result = await query(sql, params);
    return result.rows;
  }

  // ─── Analytics ───

  static async getPersonSummary(personId: string) {
    const byScale = await query(`
      SELECT os.name, os.shortcode, os.id AS scale_id,
        COUNT(*)::int AS assessment_count,
        ROUND(AVG(osr.total_score), 1)::numeric AS avg_score,
        (SELECT osr2.band_label FROM outcome_scale_results osr2
         WHERE osr2.scale_id = os.id AND osr2.person_id = $1
         ORDER BY osr2.assessed_at DESC LIMIT 1) AS latest_band,
        (SELECT osr2.total_score FROM outcome_scale_results osr2
         WHERE osr2.scale_id = os.id AND osr2.person_id = $1
         ORDER BY osr2.assessed_at DESC LIMIT 1) AS latest_score
      FROM outcome_scale_results osr
      JOIN outcome_scales os ON osr.scale_id = os.id
      WHERE osr.person_id = $1
      GROUP BY os.id, os.name, os.shortcode
      ORDER BY os.name
    `, [personId]);
    return byScale.rows;
  }

  static async getPersonTrend(personId: string, scaleId?: string, days = 90) {
    let sql = `
      SELECT osr.assessed_at AS date, osr.total_score, osr.band_label, os.name AS scale_name
      FROM outcome_scale_results osr
      JOIN outcome_scales os ON osr.scale_id = os.id
      WHERE osr.person_id = $1
        AND osr.assessed_at >= CURRENT_DATE - $2::int`;
    const params: any[] = [personId, days];
    let idx = 3;
    if (scaleId) { sql += ` AND osr.scale_id = $${idx++}`; params.push(scaleId); }
    sql += ' ORDER BY osr.assessed_at ASC';
    const result = await query(sql, params);
    return result.rows;
  }

  static async getOrgSummary(orgId: string) {
    const total = await query(`
      SELECT COUNT(*)::int AS total_assessments,
        COUNT(DISTINCT osr.person_id)::int AS people_assessed
      FROM outcome_scale_results osr
      JOIN outcome_scales os ON osr.scale_id = os.id
      WHERE os.organization_id = $1
    `, [orgId]);

    const byScale = await query(`
      SELECT os.name, os.shortcode,
        COUNT(*)::int AS total,
        ROUND(AVG(osr.total_score), 1)::numeric AS avg_score
      FROM outcome_scale_results osr
      JOIN outcome_scales os ON osr.scale_id = os.id
      WHERE os.organization_id = $1
      GROUP BY os.id, os.name, os.shortcode
      ORDER BY os.name
    `, [orgId]);

    const byBand = await query(`
      SELECT osr.band_label, COUNT(*)::int AS count
      FROM outcome_scale_results osr
      JOIN outcome_scales os ON osr.scale_id = os.id
      WHERE os.organization_id = $1 AND osr.band_label IS NOT NULL
      GROUP BY osr.band_label
      ORDER BY count DESC
    `, [orgId]);

    return {
      total_assessments: total.rows[0]?.total_assessments ?? 0,
      people_assessed: total.rows[0]?.people_assessed ?? 0,
      by_scale: byScale.rows,
      by_band: byBand.rows,
    };
  }
}
