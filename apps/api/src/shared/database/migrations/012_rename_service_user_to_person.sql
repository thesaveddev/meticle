DO $$
DECLARE
  cnt INTEGER;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'service_user_access_log' AND relkind = 'r') THEN
    IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'person_access_log' AND relkind = 'r') THEN
      EXECUTE 'SELECT count(*) FROM ONLY person_access_log' INTO cnt;
      IF cnt = 0 THEN
        EXECUTE 'DROP TABLE person_access_log';
      END IF;
    END IF;
    EXECUTE 'ALTER TABLE service_user_access_log RENAME TO person_access_log';
  END IF;
END $$;

DO $$
DECLARE
  cnt INTEGER;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'service_users' AND relkind = 'r') THEN
    IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'people' AND relkind = 'r') THEN
      EXECUTE 'SELECT count(*) FROM ONLY people' INTO cnt;
      IF cnt = 0 THEN
        EXECUTE 'DROP TABLE people';
      END IF;
    END IF;
    EXECUTE 'ALTER TABLE service_users RENAME TO people';
  END IF;
END $$;

DO $$
DECLARE
  cnt INTEGER;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'service_user_expenses' AND relkind = 'r') THEN
    IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'person_expenses' AND relkind = 'r') THEN
      EXECUTE 'SELECT count(*) FROM ONLY person_expenses' INTO cnt;
      IF cnt = 0 THEN
        EXECUTE 'DROP TABLE person_expenses';
      END IF;
    END IF;
    EXECUTE 'ALTER TABLE service_user_expenses RENAME TO person_expenses';
  END IF;
END $$;

DO $$
DECLARE
  cnt INTEGER;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'su_discharge_checklist' AND relkind = 'r') THEN
    IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'person_discharge_checklist' AND relkind = 'r') THEN
      EXECUTE 'SELECT count(*) FROM ONLY person_discharge_checklist' INTO cnt;
      IF cnt = 0 THEN
        EXECUTE 'DROP TABLE person_discharge_checklist';
      END IF;
    END IF;
    EXECUTE 'ALTER TABLE su_discharge_checklist RENAME TO person_discharge_checklist';
  END IF;
END $$;

DO $$
DECLARE
  cnt INTEGER;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'service_user_goals' AND relkind = 'r') THEN
    IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'person_goals' AND relkind = 'r') THEN
      EXECUTE 'SELECT count(*) FROM ONLY person_goals' INTO cnt;
      IF cnt = 0 THEN
        EXECUTE 'DROP TABLE person_goals';
      END IF;
    END IF;
    EXECUTE 'ALTER TABLE service_user_goals RENAME TO person_goals';
  END IF;
END $$;

DO $$
DECLARE
  cnt INTEGER;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'service_user_documents' AND relkind = 'r') THEN
    IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'person_documents' AND relkind = 'r') THEN
      EXECUTE 'SELECT count(*) FROM ONLY person_documents' INTO cnt;
      IF cnt = 0 THEN
        EXECUTE 'DROP TABLE person_documents';
      END IF;
    END IF;
    EXECUTE 'ALTER TABLE service_user_documents RENAME TO person_documents';
  END IF;
END $$;

DO $$
DECLARE
  cnt INTEGER;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'su_wellbeing' AND relkind = 'r') THEN
    IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'person_wellbeing' AND relkind = 'r') THEN
      EXECUTE 'SELECT count(*) FROM ONLY person_wellbeing' INTO cnt;
      IF cnt = 0 THEN
        EXECUTE 'DROP TABLE person_wellbeing';
      END IF;
    END IF;
    EXECUTE 'ALTER TABLE su_wellbeing RENAME TO person_wellbeing';
  END IF;
END $$;

DO $$
DECLARE
  cnt INTEGER;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'su_communication_log' AND relkind = 'r') THEN
    IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'person_communication_log' AND relkind = 'r') THEN
      EXECUTE 'SELECT count(*) FROM ONLY person_communication_log' INTO cnt;
      IF cnt = 0 THEN
        EXECUTE 'DROP TABLE person_communication_log';
      END IF;
    END IF;
    EXECUTE 'ALTER TABLE su_communication_log RENAME TO person_communication_log';
  END IF;
END $$;

DO $$
DECLARE
  cnt INTEGER;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'su_capacity_assessments' AND relkind = 'r') THEN
    IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'person_capacity_assessments' AND relkind = 'r') THEN
      EXECUTE 'SELECT count(*) FROM ONLY person_capacity_assessments' INTO cnt;
      IF cnt = 0 THEN
        EXECUTE 'DROP TABLE person_capacity_assessments';
      END IF;
    END IF;
    EXECUTE 'ALTER TABLE su_capacity_assessments RENAME TO person_capacity_assessments';
  END IF;
END $$;

DO $$
DECLARE
  cnt INTEGER;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'su_care_pathways' AND relkind = 'r') THEN
    IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'person_care_pathways' AND relkind = 'r') THEN
      EXECUTE 'SELECT count(*) FROM ONLY person_care_pathways' INTO cnt;
      IF cnt = 0 THEN
        EXECUTE 'DROP TABLE person_care_pathways';
      END IF;
    END IF;
    EXECUTE 'ALTER TABLE su_care_pathways RENAME TO person_care_pathways';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'appointments' AND column_name = 'service_user_id')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'appointments' AND column_name = 'person_id') THEN
    ALTER TABLE appointments RENAME COLUMN service_user_id TO person_id;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'body_map_entries' AND column_name = 'service_user_id')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'body_map_entries' AND column_name = 'person_id') THEN
    ALTER TABLE body_map_entries RENAME COLUMN service_user_id TO person_id;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bowel_movements' AND column_name = 'service_user_id')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bowel_movements' AND column_name = 'person_id') THEN
    ALTER TABLE bowel_movements RENAME COLUMN service_user_id TO person_id;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'care_assessments' AND column_name = 'service_user_id')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'care_assessments' AND column_name = 'person_id') THEN
    ALTER TABLE care_assessments RENAME COLUMN service_user_id TO person_id;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'care_plans' AND column_name = 'service_user_id')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'care_plans' AND column_name = 'person_id') THEN
    ALTER TABLE care_plans RENAME COLUMN service_user_id TO person_id;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'clinical_scores' AND column_name = 'service_user_id')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'clinical_scores' AND column_name = 'person_id') THEN
    ALTER TABLE clinical_scores RENAME COLUMN service_user_id TO person_id;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'daily_notes' AND column_name = 'service_user_id')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'daily_notes' AND column_name = 'person_id') THEN
    ALTER TABLE daily_notes RENAME COLUMN service_user_id TO person_id;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'dental_records' AND column_name = 'service_user_id')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'dental_records' AND column_name = 'person_id') THEN
    ALTER TABLE dental_records RENAME COLUMN service_user_id TO person_id;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'emedication_daily_counts' AND column_name = 'service_user_id')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'emedication_daily_counts' AND column_name = 'person_id') THEN
    ALTER TABLE emedication_daily_counts RENAME COLUMN service_user_id TO person_id;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'emedication_records' AND column_name = 'service_user_id')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'emedication_records' AND column_name = 'person_id') THEN
    ALTER TABLE emedication_records RENAME COLUMN service_user_id TO person_id;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'emedication_stock' AND column_name = 'service_user_id')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'emedication_stock' AND column_name = 'person_id') THEN
    ALTER TABLE emedication_stock RENAME COLUMN service_user_id TO person_id;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'family_contacts' AND column_name = 'service_user_id')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'family_contacts' AND column_name = 'person_id') THEN
    ALTER TABLE family_contacts RENAME COLUMN service_user_id TO person_id;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'family_members' AND column_name = 'service_user_id')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'family_members' AND column_name = 'person_id') THEN
    ALTER TABLE family_members RENAME COLUMN service_user_id TO person_id;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'fluid_intake' AND column_name = 'service_user_id')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'fluid_intake' AND column_name = 'person_id') THEN
    ALTER TABLE fluid_intake RENAME COLUMN service_user_id TO person_id;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'hazards' AND column_name = 'service_user_id')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'hazards' AND column_name = 'person_id') THEN
    ALTER TABLE hazards RENAME COLUMN service_user_id TO person_id;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'health_observations' AND column_name = 'service_user_id')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'health_observations' AND column_name = 'person_id') THEN
    ALTER TABLE health_observations RENAME COLUMN service_user_id TO person_id;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'incident_involved_residents' AND column_name = 'service_user_id')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'incident_involved_residents' AND column_name = 'person_id') THEN
    ALTER TABLE incident_involved_residents RENAME COLUMN service_user_id TO person_id;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'memory_book_entries' AND column_name = 'service_user_id')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'memory_book_entries' AND column_name = 'person_id') THEN
    ALTER TABLE memory_book_entries RENAME COLUMN service_user_id TO person_id;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'outcome_scale_results' AND column_name = 'service_user_id')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'outcome_scale_results' AND column_name = 'person_id') THEN
    ALTER TABLE outcome_scale_results RENAME COLUMN service_user_id TO person_id;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'risk_assessments' AND column_name = 'service_user_id')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'risk_assessments' AND column_name = 'person_id') THEN
    ALTER TABLE risk_assessments RENAME COLUMN service_user_id TO person_id;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'satisfaction_surveys' AND column_name = 'service_user_id')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'satisfaction_surveys' AND column_name = 'person_id') THEN
    ALTER TABLE satisfaction_surveys RENAME COLUMN service_user_id TO person_id;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'person_access_log' AND column_name = 'service_user_id')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'person_access_log' AND column_name = 'person_id') THEN
    ALTER TABLE person_access_log RENAME COLUMN service_user_id TO person_id;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'person_documents' AND column_name = 'service_user_id')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'person_documents' AND column_name = 'person_id') THEN
    ALTER TABLE person_documents RENAME COLUMN service_user_id TO person_id;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'person_expenses' AND column_name = 'service_user_id')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'person_expenses' AND column_name = 'person_id') THEN
    ALTER TABLE person_expenses RENAME COLUMN service_user_id TO person_id;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'person_goals' AND column_name = 'service_user_id')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'person_goals' AND column_name = 'person_id') THEN
    ALTER TABLE person_goals RENAME COLUMN service_user_id TO person_id;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shifts' AND column_name = 'service_user_id')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shifts' AND column_name = 'person_id') THEN
    ALTER TABLE shifts RENAME COLUMN service_user_id TO person_id;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'person_capacity_assessments' AND column_name = 'service_user_id')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'person_capacity_assessments' AND column_name = 'person_id') THEN
    ALTER TABLE person_capacity_assessments RENAME COLUMN service_user_id TO person_id;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'person_care_pathways' AND column_name = 'service_user_id')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'person_care_pathways' AND column_name = 'person_id') THEN
    ALTER TABLE person_care_pathways RENAME COLUMN service_user_id TO person_id;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'person_communication_log' AND column_name = 'service_user_id')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'person_communication_log' AND column_name = 'person_id') THEN
    ALTER TABLE person_communication_log RENAME COLUMN service_user_id TO person_id;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'person_discharge_checklist' AND column_name = 'service_user_id')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'person_discharge_checklist' AND column_name = 'person_id') THEN
    ALTER TABLE person_discharge_checklist RENAME COLUMN service_user_id TO person_id;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'person_wellbeing' AND column_name = 'service_user_id')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'person_wellbeing' AND column_name = 'person_id') THEN
    ALTER TABLE person_wellbeing RENAME COLUMN service_user_id TO person_id;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'survey_invitations' AND column_name = 'service_user_name')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'survey_invitations' AND column_name = 'person_name') THEN
    ALTER TABLE survey_invitations RENAME COLUMN service_user_name TO person_name;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'survey_invitations' AND column_name = 'service_user_id')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'survey_invitations' AND column_name = 'person_id') THEN
    ALTER TABLE survey_invitations RENAME COLUMN service_user_id TO person_id;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tasks' AND column_name = 'service_user_id')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tasks' AND column_name = 'person_id') THEN
    ALTER TABLE tasks RENAME COLUMN service_user_id TO person_id;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_service_users_org') THEN
    ALTER INDEX idx_service_users_org RENAME TO idx_people_org;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_service_users_status') THEN
    ALTER INDEX idx_service_users_status RENAME TO idx_people_status;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_care_plans_service_user') THEN
    ALTER INDEX idx_care_plans_service_user RENAME TO idx_care_plans_person;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_daily_notes_service_user') THEN
    ALTER INDEX idx_daily_notes_service_user RENAME TO idx_daily_notes_person;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_risk_assessments_service_user') THEN
    ALTER INDEX idx_risk_assessments_service_user RENAME TO idx_risk_assessments_person;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_family_contacts_service_user') THEN
    ALTER INDEX idx_family_contacts_service_user RENAME TO idx_family_contacts_person;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_emedr_service_user') THEN
    ALTER INDEX idx_emedr_service_user RENAME TO idx_emedr_person;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_body_map_su') THEN
    ALTER INDEX idx_body_map_su RENAME TO idx_body_map_person;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_memory_book_su') THEN
    ALTER INDEX idx_memory_book_su RENAME TO idx_memory_book_person;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_emed_daily_counts_su') THEN
    ALTER INDEX idx_emed_daily_counts_su RENAME TO idx_emed_daily_counts_person;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_expenses_su') THEN
    ALTER INDEX idx_expenses_su RENAME TO idx_expenses_person;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_satisfaction_surveys_service_user') THEN
    ALTER INDEX idx_satisfaction_surveys_service_user RENAME TO idx_satisfaction_surveys_person;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_health_obs_su') THEN
    ALTER INDEX idx_health_obs_su RENAME TO idx_health_obs_person;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_bowel_su') THEN
    ALTER INDEX idx_bowel_su RENAME TO idx_bowel_person;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_dental_su') THEN
    ALTER INDEX idx_dental_su RENAME TO idx_dental_person;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_fluid_su') THEN
    ALTER INDEX idx_fluid_su RENAME TO idx_fluid_person;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_service_user_goals_org') THEN
    ALTER INDEX idx_service_user_goals_org RENAME TO idx_person_goals_org;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_service_user_goals_su') THEN
    ALTER INDEX idx_service_user_goals_su RENAME TO idx_person_goals_person;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_care_assessments_su') THEN
    ALTER INDEX idx_care_assessments_su RENAME TO idx_care_assessments_person;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_su_access_user') THEN
    ALTER INDEX idx_su_access_user RENAME TO idx_person_access_user;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_su_access_accessed_by') THEN
    ALTER INDEX idx_su_access_accessed_by RENAME TO idx_person_access_accessed_by;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_shifts_service_user') THEN
    ALTER INDEX idx_shifts_service_user RENAME TO idx_shifts_person;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_clinical_scores_su') THEN
    ALTER INDEX idx_clinical_scores_su RENAME TO idx_clinical_scores_person;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_su_documents_su') THEN
    ALTER INDEX idx_su_documents_su RENAME TO idx_person_documents_person;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_wellbeing_su_date') THEN
    ALTER INDEX idx_wellbeing_su_date RENAME TO idx_wellbeing_person_date;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_commlog_su') THEN
    ALTER INDEX idx_commlog_su RENAME TO idx_commlog_person;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_capacity_su') THEN
    ALTER INDEX idx_capacity_su RENAME TO idx_capacity_person;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_carepathways_su') THEN
    ALTER INDEX idx_carepathways_su RENAME TO idx_carepathways_person;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_discharge_checklist_su') THEN
    ALTER INDEX idx_discharge_checklist_su RENAME TO idx_discharge_checklist_person;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_outcome_results_su') THEN
    ALTER INDEX idx_outcome_results_su RENAME TO idx_outcome_results_person;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_service_users_location') THEN
    ALTER INDEX idx_service_users_location RENAME TO idx_people_location;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_hazards_service_user') THEN
    ALTER INDEX idx_hazards_service_user RENAME TO idx_hazards_person;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE connamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public') AND conname = 'service_users_status_check') THEN
    ALTER TABLE people RENAME CONSTRAINT service_users_status_check TO people_status_check;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE connamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public') AND conname = 'service_users_id_not_null') THEN
    ALTER TABLE people RENAME CONSTRAINT service_users_id_not_null TO people_id_not_null;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE connamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public') AND conname = 'service_users_first_name_not_null') THEN
    ALTER TABLE people RENAME CONSTRAINT service_users_first_name_not_null TO people_first_name_not_null;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE connamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public') AND conname = 'service_users_last_name_not_null') THEN
    ALTER TABLE people RENAME CONSTRAINT service_users_last_name_not_null TO people_last_name_not_null;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE connamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public') AND conname = 'service_users_pkey') THEN
    ALTER TABLE people RENAME CONSTRAINT service_users_pkey TO people_pkey;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE connamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public') AND conname = 'service_users_organization_id_fkey') THEN
    ALTER TABLE people RENAME CONSTRAINT service_users_organization_id_fkey TO people_organization_id_fkey;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE connamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public') AND conname = 'care_plans_service_user_id_not_null') THEN
    ALTER TABLE care_plans RENAME CONSTRAINT care_plans_service_user_id_not_null TO care_plans_person_id_not_null;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE connamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public') AND conname = 'care_plans_service_user_id_fkey') THEN
    ALTER TABLE care_plans RENAME CONSTRAINT care_plans_service_user_id_fkey TO care_plans_person_id_fkey;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE connamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public') AND conname = 'daily_notes_service_user_id_not_null') THEN
    ALTER TABLE daily_notes RENAME CONSTRAINT daily_notes_service_user_id_not_null TO daily_notes_person_id_not_null;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE connamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public') AND conname = 'daily_notes_service_user_id_fkey') THEN
    ALTER TABLE daily_notes RENAME CONSTRAINT daily_notes_service_user_id_fkey TO daily_notes_person_id_fkey;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE connamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public') AND conname = 'risk_assessments_service_user_id_not_null') THEN
    ALTER TABLE risk_assessments RENAME CONSTRAINT risk_assessments_service_user_id_not_null TO risk_assessments_person_id_not_null;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE connamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public') AND conname = 'risk_assessments_service_user_id_fkey') THEN
    ALTER TABLE risk_assessments RENAME CONSTRAINT risk_assessments_service_user_id_fkey TO risk_assessments_person_id_fkey;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE connamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public') AND conname = 'family_contacts_service_user_id_not_null') THEN
    ALTER TABLE family_contacts RENAME CONSTRAINT family_contacts_service_user_id_not_null TO family_contacts_person_id_not_null;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE connamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public') AND conname = 'family_contacts_service_user_id_fkey') THEN
    ALTER TABLE family_contacts RENAME CONSTRAINT family_contacts_service_user_id_fkey TO family_contacts_person_id_fkey;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE connamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public') AND conname = 'incident_involved_residents_service_user_id_fkey') THEN
    ALTER TABLE incident_involved_residents RENAME CONSTRAINT incident_involved_residents_service_user_id_fkey TO incident_involved_residents_person_id_fkey;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE connamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public') AND conname = 'emedication_records_service_user_id_not_null') THEN
    ALTER TABLE emedication_records RENAME CONSTRAINT emedication_records_service_user_id_not_null TO emedication_records_person_id_not_null;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE connamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public') AND conname = 'emedication_records_service_user_id_fkey') THEN
    ALTER TABLE emedication_records RENAME CONSTRAINT emedication_records_service_user_id_fkey TO emedication_records_person_id_fkey;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE connamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public') AND conname = 'body_map_entries_service_user_id_not_null') THEN
    ALTER TABLE body_map_entries RENAME CONSTRAINT body_map_entries_service_user_id_not_null TO body_map_entries_person_id_not_null;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE connamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public') AND conname = 'body_map_entries_service_user_id_fkey') THEN
    ALTER TABLE body_map_entries RENAME CONSTRAINT body_map_entries_service_user_id_fkey TO body_map_entries_person_id_fkey;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE connamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public') AND conname = 'memory_book_entries_service_user_id_not_null') THEN
    ALTER TABLE memory_book_entries RENAME CONSTRAINT memory_book_entries_service_user_id_not_null TO memory_book_entries_person_id_not_null;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE connamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public') AND conname = 'memory_book_entries_service_user_id_fkey') THEN
    ALTER TABLE memory_book_entries RENAME CONSTRAINT memory_book_entries_service_user_id_fkey TO memory_book_entries_person_id_fkey;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE connamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public') AND conname = 'emedication_daily_counts_service_user_id_not_null') THEN
    ALTER TABLE emedication_daily_counts RENAME CONSTRAINT emedication_daily_counts_service_user_id_not_null TO emedication_daily_counts_person_id_not_null;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE connamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public') AND conname = 'emedication_daily_counts_service_user_id_count_date_key') THEN
    ALTER TABLE emedication_daily_counts RENAME CONSTRAINT emedication_daily_counts_service_user_id_count_date_key TO emedication_daily_counts_person_id_count_date_key;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE connamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public') AND conname = 'emedication_daily_counts_service_user_id_fkey') THEN
    ALTER TABLE emedication_daily_counts RENAME CONSTRAINT emedication_daily_counts_service_user_id_fkey TO emedication_daily_counts_person_id_fkey;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE connamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public') AND conname = 'service_user_expenses_category_check') THEN
    ALTER TABLE person_expenses RENAME CONSTRAINT service_user_expenses_category_check TO person_expenses_category_check;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE connamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public') AND conname = 'service_user_expenses_amount_pence_check') THEN
    ALTER TABLE person_expenses RENAME CONSTRAINT service_user_expenses_amount_pence_check TO person_expenses_amount_pence_check;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE connamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public') AND conname = 'service_user_expenses_id_not_null') THEN
    ALTER TABLE person_expenses RENAME CONSTRAINT service_user_expenses_id_not_null TO person_expenses_id_not_null;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE connamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public') AND conname = 'service_user_expenses_organization_id_not_null') THEN
    ALTER TABLE person_expenses RENAME CONSTRAINT service_user_expenses_organization_id_not_null TO person_expenses_organization_id_not_null;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE connamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public') AND conname = 'service_user_expenses_service_user_id_not_null') THEN
    ALTER TABLE person_expenses RENAME CONSTRAINT service_user_expenses_service_user_id_not_null TO person_expenses_person_id_not_null;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE connamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public') AND conname = 'service_user_expenses_category_not_null') THEN
    ALTER TABLE person_expenses RENAME CONSTRAINT service_user_expenses_category_not_null TO person_expenses_category_not_null;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE connamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public') AND conname = 'service_user_expenses_amount_pence_not_null') THEN
    ALTER TABLE person_expenses RENAME CONSTRAINT service_user_expenses_amount_pence_not_null TO person_expenses_amount_pence_not_null;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE connamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public') AND conname = 'service_user_expenses_incurred_date_not_null') THEN
    ALTER TABLE person_expenses RENAME CONSTRAINT service_user_expenses_incurred_date_not_null TO person_expenses_incurred_date_not_null;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE connamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public') AND conname = 'service_user_expenses_pkey') THEN
    ALTER TABLE person_expenses RENAME CONSTRAINT service_user_expenses_pkey TO person_expenses_pkey;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE connamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public') AND conname = 'service_user_expenses_organization_id_fkey') THEN
    ALTER TABLE person_expenses RENAME CONSTRAINT service_user_expenses_organization_id_fkey TO person_expenses_organization_id_fkey;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE connamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public') AND conname = 'service_user_expenses_service_user_id_fkey') THEN
    ALTER TABLE person_expenses RENAME CONSTRAINT service_user_expenses_service_user_id_fkey TO person_expenses_person_id_fkey;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE connamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public') AND conname = 'service_user_expenses_location_id_fkey') THEN
    ALTER TABLE person_expenses RENAME CONSTRAINT service_user_expenses_location_id_fkey TO person_expenses_location_id_fkey;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE connamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public') AND conname = 'service_user_expenses_created_by_fkey') THEN
    ALTER TABLE person_expenses RENAME CONSTRAINT service_user_expenses_created_by_fkey TO person_expenses_created_by_fkey;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE connamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public') AND conname = 'shifts_service_user_id_fkey') THEN
    ALTER TABLE shifts RENAME CONSTRAINT shifts_service_user_id_fkey TO shifts_person_id_fkey;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE connamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public') AND conname = 'satisfaction_surveys_service_user_id_fkey') THEN
    ALTER TABLE satisfaction_surveys RENAME CONSTRAINT satisfaction_surveys_service_user_id_fkey TO satisfaction_surveys_person_id_fkey;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE connamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public') AND conname = 'tasks_service_user_id_fkey') THEN
    ALTER TABLE tasks RENAME CONSTRAINT tasks_service_user_id_fkey TO tasks_person_id_fkey;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE connamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public') AND conname = 'survey_invitations_service_user_id_fkey') THEN
    ALTER TABLE survey_invitations RENAME CONSTRAINT survey_invitations_service_user_id_fkey TO survey_invitations_person_id_fkey;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE connamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public') AND conname = 'bowel_movements_service_user_id_fkey') THEN
    ALTER TABLE bowel_movements RENAME CONSTRAINT bowel_movements_service_user_id_fkey TO bowel_movements_person_id_fkey;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE connamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public') AND conname = 'dental_records_service_user_id_not_null') THEN
    ALTER TABLE dental_records RENAME CONSTRAINT dental_records_service_user_id_not_null TO dental_records_person_id_not_null;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE connamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public') AND conname = 'health_observations_service_user_id_not_null') THEN
    ALTER TABLE health_observations RENAME CONSTRAINT health_observations_service_user_id_not_null TO health_observations_person_id_not_null;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE connamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public') AND conname = 'health_observations_service_user_id_fkey') THEN
    ALTER TABLE health_observations RENAME CONSTRAINT health_observations_service_user_id_fkey TO health_observations_person_id_fkey;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE connamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public') AND conname = 'bowel_movements_service_user_id_not_null') THEN
    ALTER TABLE bowel_movements RENAME CONSTRAINT bowel_movements_service_user_id_not_null TO bowel_movements_person_id_not_null;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE connamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public') AND conname = 'dental_records_service_user_id_fkey') THEN
    ALTER TABLE dental_records RENAME CONSTRAINT dental_records_service_user_id_fkey TO dental_records_person_id_fkey;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE connamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public') AND conname = 'fluid_intake_service_user_id_not_null') THEN
    ALTER TABLE fluid_intake RENAME CONSTRAINT fluid_intake_service_user_id_not_null TO fluid_intake_person_id_not_null;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE connamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public') AND conname = 'fluid_intake_service_user_id_fkey') THEN
    ALTER TABLE fluid_intake RENAME CONSTRAINT fluid_intake_service_user_id_fkey TO fluid_intake_person_id_fkey;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE connamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public') AND conname = 'appointments_service_user_id_fkey') THEN
    ALTER TABLE appointments RENAME CONSTRAINT appointments_service_user_id_fkey TO appointments_person_id_fkey;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE connamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public') AND conname = 'service_user_goals_status_check') THEN
    ALTER TABLE person_goals RENAME CONSTRAINT service_user_goals_status_check TO person_goals_status_check;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE connamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public') AND conname = 'service_user_goals_progress_check') THEN
    ALTER TABLE person_goals RENAME CONSTRAINT service_user_goals_progress_check TO person_goals_progress_check;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE connamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public') AND conname = 'service_user_goals_id_not_null') THEN
    ALTER TABLE person_goals RENAME CONSTRAINT service_user_goals_id_not_null TO person_goals_id_not_null;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE connamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public') AND conname = 'service_user_goals_organization_id_not_null') THEN
    ALTER TABLE person_goals RENAME CONSTRAINT service_user_goals_organization_id_not_null TO person_goals_organization_id_not_null;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE connamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public') AND conname = 'service_user_goals_service_user_id_not_null') THEN
    ALTER TABLE person_goals RENAME CONSTRAINT service_user_goals_service_user_id_not_null TO person_goals_person_id_not_null;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE connamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public') AND conname = 'service_user_goals_title_not_null') THEN
    ALTER TABLE person_goals RENAME CONSTRAINT service_user_goals_title_not_null TO person_goals_title_not_null;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE connamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public') AND conname = 'service_user_goals_pkey') THEN
    ALTER TABLE person_goals RENAME CONSTRAINT service_user_goals_pkey TO person_goals_pkey;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE connamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public') AND conname = 'service_user_goals_organization_id_fkey') THEN
    ALTER TABLE person_goals RENAME CONSTRAINT service_user_goals_organization_id_fkey TO person_goals_organization_id_fkey;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE connamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public') AND conname = 'service_user_goals_service_user_id_fkey') THEN
    ALTER TABLE person_goals RENAME CONSTRAINT service_user_goals_service_user_id_fkey TO person_goals_person_id_fkey;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE connamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public') AND conname = 'service_user_goals_created_by_fkey') THEN
    ALTER TABLE person_goals RENAME CONSTRAINT service_user_goals_created_by_fkey TO person_goals_created_by_fkey;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE connamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public') AND conname = 'emedication_stock_service_user_id_fkey') THEN
    ALTER TABLE emedication_stock RENAME CONSTRAINT emedication_stock_service_user_id_fkey TO emedication_stock_person_id_fkey;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE connamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public') AND conname = 'service_user_access_log_accessed_by_fkey') THEN
    ALTER TABLE person_access_log RENAME CONSTRAINT service_user_access_log_accessed_by_fkey TO person_access_log_accessed_by_fkey;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE connamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public') AND conname = 'service_user_goals_frequency_check') THEN
    ALTER TABLE person_goals RENAME CONSTRAINT service_user_goals_frequency_check TO person_goals_frequency_check;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE connamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public') AND conname = 'care_assessments_service_user_id_not_null') THEN
    ALTER TABLE care_assessments RENAME CONSTRAINT care_assessments_service_user_id_not_null TO care_assessments_person_id_not_null;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE connamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public') AND conname = 'care_assessments_service_user_id_fkey') THEN
    ALTER TABLE care_assessments RENAME CONSTRAINT care_assessments_service_user_id_fkey TO care_assessments_person_id_fkey;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE connamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public') AND conname = 'service_user_access_log_id_not_null') THEN
    ALTER TABLE person_access_log RENAME CONSTRAINT service_user_access_log_id_not_null TO person_access_log_id_not_null;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE connamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public') AND conname = 'service_user_access_log_service_user_id_not_null') THEN
    ALTER TABLE person_access_log RENAME CONSTRAINT service_user_access_log_service_user_id_not_null TO person_access_log_person_id_not_null;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE connamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public') AND conname = 'service_user_access_log_accessed_by_not_null') THEN
    ALTER TABLE person_access_log RENAME CONSTRAINT service_user_access_log_accessed_by_not_null TO person_access_log_accessed_by_not_null;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE connamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public') AND conname = 'service_user_access_log_action_not_null') THEN
    ALTER TABLE person_access_log RENAME CONSTRAINT service_user_access_log_action_not_null TO person_access_log_action_not_null;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE connamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public') AND conname = 'service_user_access_log_pkey') THEN
    ALTER TABLE person_access_log RENAME CONSTRAINT service_user_access_log_pkey TO person_access_log_pkey;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE connamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public') AND conname = 'service_user_access_log_service_user_id_fkey') THEN
    ALTER TABLE person_access_log RENAME CONSTRAINT service_user_access_log_service_user_id_fkey TO person_access_log_person_id_fkey;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE connamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public') AND conname = 'family_members_service_user_id_not_null') THEN
    ALTER TABLE family_members RENAME CONSTRAINT family_members_service_user_id_not_null TO family_members_person_id_not_null;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE connamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public') AND conname = 'family_members_service_user_id_fkey') THEN
    ALTER TABLE family_members RENAME CONSTRAINT family_members_service_user_id_fkey TO family_members_person_id_fkey;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE connamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public') AND conname = 'clinical_scores_service_user_id_not_null') THEN
    ALTER TABLE clinical_scores RENAME CONSTRAINT clinical_scores_service_user_id_not_null TO clinical_scores_person_id_not_null;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE connamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public') AND conname = 'clinical_scores_service_user_id_fkey') THEN
    ALTER TABLE clinical_scores RENAME CONSTRAINT clinical_scores_service_user_id_fkey TO clinical_scores_person_id_fkey;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE connamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public') AND conname = 'service_user_documents_id_not_null') THEN
    ALTER TABLE person_documents RENAME CONSTRAINT service_user_documents_id_not_null TO person_documents_id_not_null;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE connamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public') AND conname = 'service_user_documents_service_user_id_not_null') THEN
    ALTER TABLE person_documents RENAME CONSTRAINT service_user_documents_service_user_id_not_null TO person_documents_person_id_not_null;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE connamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public') AND conname = 'service_user_documents_title_not_null') THEN
    ALTER TABLE person_documents RENAME CONSTRAINT service_user_documents_title_not_null TO person_documents_title_not_null;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE connamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public') AND conname = 'service_user_documents_document_type_not_null') THEN
    ALTER TABLE person_documents RENAME CONSTRAINT service_user_documents_document_type_not_null TO person_documents_document_type_not_null;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE connamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public') AND conname = 'service_user_documents_file_url_not_null') THEN
    ALTER TABLE person_documents RENAME CONSTRAINT service_user_documents_file_url_not_null TO person_documents_file_url_not_null;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE connamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public') AND conname = 'service_user_documents_pkey') THEN
    ALTER TABLE person_documents RENAME CONSTRAINT service_user_documents_pkey TO person_documents_pkey;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE connamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public') AND conname = 'service_user_documents_service_user_id_fkey') THEN
    ALTER TABLE person_documents RENAME CONSTRAINT service_user_documents_service_user_id_fkey TO person_documents_person_id_fkey;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE connamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public') AND conname = 'service_user_documents_uploaded_by_fkey') THEN
    ALTER TABLE person_documents RENAME CONSTRAINT service_user_documents_uploaded_by_fkey TO person_documents_uploaded_by_fkey;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE connamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public') AND conname = 'su_wellbeing_domain_check') THEN
    ALTER TABLE person_wellbeing RENAME CONSTRAINT su_wellbeing_domain_check TO person_wellbeing_domain_check;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE connamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public') AND conname = 'su_wellbeing_score_check') THEN
    ALTER TABLE person_wellbeing RENAME CONSTRAINT su_wellbeing_score_check TO person_wellbeing_score_check;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE connamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public') AND conname = 'su_wellbeing_id_not_null') THEN
    ALTER TABLE person_wellbeing RENAME CONSTRAINT su_wellbeing_id_not_null TO person_wellbeing_id_not_null;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE connamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public') AND conname = 'su_wellbeing_service_user_id_not_null') THEN
    ALTER TABLE person_wellbeing RENAME CONSTRAINT su_wellbeing_service_user_id_not_null TO person_wellbeing_person_id_not_null;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE connamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public') AND conname = 'su_wellbeing_domain_not_null') THEN
    ALTER TABLE person_wellbeing RENAME CONSTRAINT su_wellbeing_domain_not_null TO person_wellbeing_domain_not_null;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE connamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public') AND conname = 'su_wellbeing_score_not_null') THEN
    ALTER TABLE person_wellbeing RENAME CONSTRAINT su_wellbeing_score_not_null TO person_wellbeing_score_not_null;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE connamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public') AND conname = 'su_wellbeing_pkey') THEN
    ALTER TABLE person_wellbeing RENAME CONSTRAINT su_wellbeing_pkey TO person_wellbeing_pkey;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE connamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public') AND conname = 'su_wellbeing_service_user_id_fkey') THEN
    ALTER TABLE person_wellbeing RENAME CONSTRAINT su_wellbeing_service_user_id_fkey TO person_wellbeing_person_id_fkey;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE connamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public') AND conname = 'su_wellbeing_recorded_by_fkey') THEN
    ALTER TABLE person_wellbeing RENAME CONSTRAINT su_wellbeing_recorded_by_fkey TO person_wellbeing_recorded_by_fkey;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE connamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public') AND conname = 'hazards_service_user_id_not_null') THEN
    ALTER TABLE hazards RENAME CONSTRAINT hazards_service_user_id_not_null TO hazards_person_id_not_null;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE connamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public') AND conname = 'hazards_service_user_id_fkey') THEN
    ALTER TABLE hazards RENAME CONSTRAINT hazards_service_user_id_fkey TO hazards_person_id_fkey;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE connamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public') AND conname = 'su_communication_log_contact_method_check') THEN
    ALTER TABLE person_communication_log RENAME CONSTRAINT su_communication_log_contact_method_check TO person_communication_log_contact_method_check;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE connamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public') AND conname = 'su_communication_log_direction_check') THEN
    ALTER TABLE person_communication_log RENAME CONSTRAINT su_communication_log_direction_check TO person_communication_log_direction_check;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE connamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public') AND conname = 'su_communication_log_id_not_null') THEN
    ALTER TABLE person_communication_log RENAME CONSTRAINT su_communication_log_id_not_null TO person_communication_log_id_not_null;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE connamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public') AND conname = 'su_communication_log_service_user_id_not_null') THEN
    ALTER TABLE person_communication_log RENAME CONSTRAINT su_communication_log_service_user_id_not_null TO person_communication_log_person_id_not_null;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE connamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public') AND conname = 'su_communication_log_contact_method_not_null') THEN
    ALTER TABLE person_communication_log RENAME CONSTRAINT su_communication_log_contact_method_not_null TO person_communication_log_contact_method_not_null;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE connamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public') AND conname = 'su_communication_log_direction_not_null') THEN
    ALTER TABLE person_communication_log RENAME CONSTRAINT su_communication_log_direction_not_null TO person_communication_log_direction_not_null;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE connamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public') AND conname = 'su_communication_log_summary_not_null') THEN
    ALTER TABLE person_communication_log RENAME CONSTRAINT su_communication_log_summary_not_null TO person_communication_log_summary_not_null;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE connamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public') AND conname = 'su_communication_log_pkey') THEN
    ALTER TABLE person_communication_log RENAME CONSTRAINT su_communication_log_pkey TO person_communication_log_pkey;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE connamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public') AND conname = 'su_communication_log_service_user_id_fkey') THEN
    ALTER TABLE person_communication_log RENAME CONSTRAINT su_communication_log_service_user_id_fkey TO person_communication_log_person_id_fkey;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE connamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public') AND conname = 'su_communication_log_recorded_by_fkey') THEN
    ALTER TABLE person_communication_log RENAME CONSTRAINT su_communication_log_recorded_by_fkey TO person_communication_log_recorded_by_fkey;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE connamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public') AND conname = 'su_capacity_assessments_capacity_status_check') THEN
    ALTER TABLE person_capacity_assessments RENAME CONSTRAINT su_capacity_assessments_capacity_status_check TO person_capacity_assessments_capacity_status_check;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE connamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public') AND conname = 'su_capacity_assessments_id_not_null') THEN
    ALTER TABLE person_capacity_assessments RENAME CONSTRAINT su_capacity_assessments_id_not_null TO person_capacity_assessments_id_not_null;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE connamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public') AND conname = 'su_capacity_assessments_service_user_id_not_null') THEN
    ALTER TABLE person_capacity_assessments RENAME CONSTRAINT su_capacity_assessments_service_user_id_not_null TO person_capacity_assessments_person_id_not_null;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE connamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public') AND conname = 'su_capacity_assessments_decision_to_be_made_not_null') THEN
    ALTER TABLE person_capacity_assessments RENAME CONSTRAINT su_capacity_assessments_decision_to_be_made_not_null TO person_capacity_assessments_decision_to_be_made_not_null;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE connamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public') AND conname = 'su_capacity_assessments_pkey') THEN
    ALTER TABLE person_capacity_assessments RENAME CONSTRAINT su_capacity_assessments_pkey TO person_capacity_assessments_pkey;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE connamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public') AND conname = 'su_capacity_assessments_service_user_id_fkey') THEN
    ALTER TABLE person_capacity_assessments RENAME CONSTRAINT su_capacity_assessments_service_user_id_fkey TO person_capacity_assessments_person_id_fkey;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE connamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public') AND conname = 'su_capacity_assessments_recorded_by_fkey') THEN
    ALTER TABLE person_capacity_assessments RENAME CONSTRAINT su_capacity_assessments_recorded_by_fkey TO person_capacity_assessments_recorded_by_fkey;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE connamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public') AND conname = 'su_care_pathways_pathway_type_check') THEN
    ALTER TABLE person_care_pathways RENAME CONSTRAINT su_care_pathways_pathway_type_check TO person_care_pathways_pathway_type_check;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE connamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public') AND conname = 'su_care_pathways_status_check') THEN
    ALTER TABLE person_care_pathways RENAME CONSTRAINT su_care_pathways_status_check TO person_care_pathways_status_check;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE connamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public') AND conname = 'su_care_pathways_id_not_null') THEN
    ALTER TABLE person_care_pathways RENAME CONSTRAINT su_care_pathways_id_not_null TO person_care_pathways_id_not_null;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE connamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public') AND conname = 'su_care_pathways_service_user_id_not_null') THEN
    ALTER TABLE person_care_pathways RENAME CONSTRAINT su_care_pathways_service_user_id_not_null TO person_care_pathways_person_id_not_null;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE connamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public') AND conname = 'su_care_pathways_pathway_type_not_null') THEN
    ALTER TABLE person_care_pathways RENAME CONSTRAINT su_care_pathways_pathway_type_not_null TO person_care_pathways_pathway_type_not_null;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE connamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public') AND conname = 'su_care_pathways_title_not_null') THEN
    ALTER TABLE person_care_pathways RENAME CONSTRAINT su_care_pathways_title_not_null TO person_care_pathways_title_not_null;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE connamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public') AND conname = 'su_care_pathways_start_date_not_null') THEN
    ALTER TABLE person_care_pathways RENAME CONSTRAINT su_care_pathways_start_date_not_null TO person_care_pathways_start_date_not_null;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE connamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public') AND conname = 'su_care_pathways_pkey') THEN
    ALTER TABLE person_care_pathways RENAME CONSTRAINT su_care_pathways_pkey TO person_care_pathways_pkey;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE connamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public') AND conname = 'su_care_pathways_service_user_id_fkey') THEN
    ALTER TABLE person_care_pathways RENAME CONSTRAINT su_care_pathways_service_user_id_fkey TO person_care_pathways_person_id_fkey;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE connamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public') AND conname = 'su_care_pathways_recorded_by_fkey') THEN
    ALTER TABLE person_care_pathways RENAME CONSTRAINT su_care_pathways_recorded_by_fkey TO person_care_pathways_recorded_by_fkey;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE connamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public') AND conname = 'su_discharge_checklist_category_check') THEN
    ALTER TABLE person_discharge_checklist RENAME CONSTRAINT su_discharge_checklist_category_check TO person_discharge_checklist_category_check;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE connamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public') AND conname = 'su_discharge_checklist_id_not_null') THEN
    ALTER TABLE person_discharge_checklist RENAME CONSTRAINT su_discharge_checklist_id_not_null TO person_discharge_checklist_id_not_null;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE connamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public') AND conname = 'su_discharge_checklist_service_user_id_not_null') THEN
    ALTER TABLE person_discharge_checklist RENAME CONSTRAINT su_discharge_checklist_service_user_id_not_null TO person_discharge_checklist_person_id_not_null;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE connamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public') AND conname = 'su_discharge_checklist_item_not_null') THEN
    ALTER TABLE person_discharge_checklist RENAME CONSTRAINT su_discharge_checklist_item_not_null TO person_discharge_checklist_item_not_null;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE connamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public') AND conname = 'su_discharge_checklist_category_not_null') THEN
    ALTER TABLE person_discharge_checklist RENAME CONSTRAINT su_discharge_checklist_category_not_null TO person_discharge_checklist_category_not_null;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE connamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public') AND conname = 'su_discharge_checklist_pkey') THEN
    ALTER TABLE person_discharge_checklist RENAME CONSTRAINT su_discharge_checklist_pkey TO person_discharge_checklist_pkey;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE connamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public') AND conname = 'su_discharge_checklist_service_user_id_fkey') THEN
    ALTER TABLE person_discharge_checklist RENAME CONSTRAINT su_discharge_checklist_service_user_id_fkey TO person_discharge_checklist_person_id_fkey;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE connamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public') AND conname = 'su_discharge_checklist_completed_by_fkey') THEN
    ALTER TABLE person_discharge_checklist RENAME CONSTRAINT su_discharge_checklist_completed_by_fkey TO person_discharge_checklist_completed_by_fkey;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE connamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public') AND conname = 'service_user_goals_care_plan_id_fkey') THEN
    ALTER TABLE person_goals RENAME CONSTRAINT service_user_goals_care_plan_id_fkey TO person_goals_care_plan_id_fkey;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE connamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public') AND conname = 'outcome_scale_results_service_user_id_not_null') THEN
    ALTER TABLE outcome_scale_results RENAME CONSTRAINT outcome_scale_results_service_user_id_not_null TO outcome_scale_results_person_id_not_null;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE connamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public') AND conname = 'outcome_scale_results_service_user_id_fkey') THEN
    ALTER TABLE outcome_scale_results RENAME CONSTRAINT outcome_scale_results_service_user_id_fkey TO outcome_scale_results_person_id_fkey;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE connamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public') AND conname = 'service_users_location_id_fkey') THEN
    ALTER TABLE people RENAME CONSTRAINT service_users_location_id_fkey TO people_location_id_fkey;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE connamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public') AND conname = 'service_user_goals_assigned_to_fkey') THEN
    ALTER TABLE person_goals RENAME CONSTRAINT service_user_goals_assigned_to_fkey TO person_goals_assigned_to_fkey;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_service_users_updated' AND NOT tgisinternal) THEN
    ALTER TRIGGER trg_service_users_updated ON people RENAME TO trg_people_updated;
  END IF;
END $$;
