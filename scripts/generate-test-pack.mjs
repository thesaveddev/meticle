import XLSX from 'xlsx';

const tests = [
  // === 1. AUTHENTICATION & ACCOUNT ===
  { module: 'Authentication & Account', id: 'AUTH-001', title: 'Register new organisation', steps: '1. Navigate to /register\n2. Enter org name, admin email, password\n3. Submit', expected: 'Account created, verification email sent, redirect to login', priority: 'Critical' },
  { module: 'Authentication & Account', id: 'AUTH-002', title: 'Email verification flow', steps: '1. Check inbox for verification link\n2. Click link', expected: 'Email verified, can now log in', priority: 'Critical' },
  { module: 'Authentication & Account', id: 'AUTH-003', title: 'Login with valid credentials', steps: '1. Navigate to /login\n2. Enter email + password\n3. Click Login', expected: 'Redirect to dashboard, user session created', priority: 'Critical' },
  { module: 'Authentication & Account', id: 'AUTH-004', title: 'Login with invalid password', steps: '1. Enter wrong password\n2. Click Login', expected: 'Error: "Invalid email or password"', priority: 'Critical' },
  { module: 'Authentication & Account', id: 'AUTH-005', title: 'Login with non-existent email', steps: '1. Enter unregistered email\n2. Click Login', expected: 'Error: "Invalid email or password" (no email enumeration)', priority: 'High' },
  { module: 'Authentication & Account', id: 'AUTH-006', title: 'Forgot password flow', steps: '1. Click "Forgot password"\n2. Enter email\n3. Check inbox\n4. Click reset link\n5. Enter new password', expected: 'Password reset email received, password updated, can log in with new password', priority: 'Critical' },
  { module: 'Authentication & Account', id: 'AUTH-007', title: 'Session persistence', steps: '1. Log in\n2. Close browser tab\n3. Reopen app', expected: 'Session persists, user still logged in', priority: 'High' },
  { module: 'Authentication & Account', id: 'AUTH-008', title: 'Logout', steps: '1. Click logout', expected: 'Session destroyed, redirect to login page', priority: 'Critical' },
  { module: 'Authentication & Account', id: 'AUTH-009', title: 'Unauthorised access', steps: '1. Log out\n2. Navigate to /dashboard directly', expected: 'Redirect to login page', priority: 'Critical' },
  { module: 'Authentication & Account', id: 'AUTH-010', title: 'Role-based access — Care Worker', steps: '1. Log in as CARE_WORKER\n2. Try accessing /settings', expected: 'Redirect to unauthorised page or limited view', priority: 'High' },
  { module: 'Authentication & Account', id: 'AUTH-011', title: 'Role-based access — Manager', steps: '1. Log in as MANAGER\n2. Access /settings', expected: 'Can access, limited to relevant tabs', priority: 'High' },
  { module: 'Authentication & Account', id: 'AUTH-012', title: 'Role-based access — Org Admin', steps: '1. Log in as ORG_ADMIN\n2. Access all modules', expected: 'Full access to all admin features', priority: 'High' },

  // === 2. MFA ===
  { module: 'Multi-Factor Authentication', id: 'MFA-001', title: 'Enable MFA', steps: '1. Go to Settings > Security\n2. Click "Enable MFA"\n3. Scan QR code\n4. Enter 6-digit code\n5. Click Verify', expected: 'MFA enabled, backup codes displayed', priority: 'Critical' },
  { module: 'Multi-Factor Authentication', id: 'MFA-002', title: 'Login with MFA', steps: '1. Log out\n2. Log in with email + password\n3. Enter authenticator code', expected: 'Login successful with MFA verification', priority: 'Critical' },
  { module: 'Multi-Factor Authentication', id: 'MFA-003', title: 'Login with wrong MFA code', steps: '1. Enter incorrect 6-digit code', expected: 'Error: "Invalid token"', priority: 'High' },
  { module: 'Multi-Factor Authentication', id: 'MFA-004', title: 'Login with backup code', steps: '1. Enter backup code instead of authenticator', expected: 'Login successful', priority: 'High' },
  { module: 'Multi-Factor Authentication', id: 'MFA-005', title: 'Disable MFA', steps: '1. Go to Settings > Security\n2. Click "Disable MFA"\n3. Enter authenticator code', expected: 'MFA disabled', priority: 'Medium' },
  { module: 'Multi-Factor Authentication', id: 'MFA-006', title: 'Force MFA (admin)', steps: '1. Settings > Org > Security\n2. Enable "Force all staff to set up MFA"\n3. Save\n4. Log in as staff without MFA', expected: 'Staff forced to set up MFA before accessing app', priority: 'High' },

  // === 3. ONBOARDING ===
  { module: 'Onboarding', id: 'ONBOARD-001', title: 'Onboarding checklist visible', steps: '1. Log in as new ORG_ADMIN\n2. View dashboard', expected: 'Onboarding checklist shows with 4 steps', priority: 'Medium' },
  { module: 'Onboarding', id: 'ONBOARD-002', title: 'Step 1 — Add location', steps: '1. Click "Add your location"\n2. Create a location', expected: 'Step marked complete, progress bar updates', priority: 'Medium' },
  { module: 'Onboarding', id: 'ONBOARD-003', title: 'Step 2 — Invite team', steps: '1. Click "Invite your team"\n2. Add staff member', expected: 'Step marked complete', priority: 'Medium' },
  { module: 'Onboarding', id: 'ONBOARD-004', title: 'Step 3 — Add people', steps: '1. Click "Add people in your care"\n2. Add a person', expected: 'Step marked complete', priority: 'Medium' },
  { module: 'Onboarding', id: 'ONBOARD-005', title: 'Step 4 — Choose plan', steps: '1. Click "Choose your plan"\n2. Select a plan', expected: 'Step marked complete', priority: 'Medium' },
  { module: 'Onboarding', id: 'ONBOARD-006', title: 'Dismiss onboarding', steps: '1. Click "I\'m all set, don\'t show again"', expected: 'Onboarding hidden, persists across sessions', priority: 'Low' },

  // === 4. DASHBOARD ===
  { module: 'Dashboard', id: 'DASH-001', title: 'Dashboard loads', steps: '1. Log in\n2. View dashboard', expected: 'Greeting with user name, stat cards visible', priority: 'Critical' },
  { module: 'Dashboard', id: 'DASH-002', title: 'Stat cards — Total Staff', steps: '1. Check Total Staff card', expected: 'Shows correct count matching staff directory', priority: 'High' },
  { module: 'Dashboard', id: 'DASH-003', title: 'Stat cards — Active People', steps: '1. Check Active People card', expected: 'Shows correct count', priority: 'High' },
  { module: 'Dashboard', id: 'DASH-004', title: 'Stat cards — Compliance Rate', steps: '1. Check Compliance Rate card', expected: 'Shows percentage matching compliance module', priority: 'High' },
  { module: 'Dashboard', id: 'DASH-005', title: 'Stat cards — Open Shifts', steps: '1. Check Open Shifts card', expected: 'Shows count of unfilled shifts', priority: 'High' },
  { module: 'Dashboard', id: 'DASH-006', title: 'Stat cards — Alerts', steps: '1. Check Alerts card', expected: 'Shows open incident count', priority: 'High' },
  { module: 'Dashboard', id: 'DASH-007', title: 'Widget — DBS Expiring', steps: '1. Check Staff with Expiring Docs widget', expected: 'Shows count, links to /compliance/identity', priority: 'Medium' },
  { module: 'Dashboard', id: 'DASH-008', title: 'Widget — Training Expiring', steps: '1. Check Training Expiring widget', expected: 'Shows count, links to /compliance/training', priority: 'Medium' },
  { module: 'Dashboard', id: 'DASH-009', title: 'Widget — Pending Leave', steps: '1. Check Pending Leave widget', expected: 'Shows count of pending leave requests', priority: 'Medium' },
  { module: 'Dashboard', id: 'DASH-010', title: 'Widget — Overdue Medications', steps: '1. Check Overdue Medications widget', expected: 'Shows count, links to /emedication', priority: 'Critical' },
  { module: 'Dashboard', id: 'DASH-011', title: 'Compliance Snapshot', steps: '1. Check Compliance Snapshot section', expected: 'Shows progress bars for training, DBS, identity', priority: 'Medium' },
  { module: 'Dashboard', id: 'DASH-012', title: 'Today\'s Rota', steps: '1. Check Today\'s Rota section', expected: 'Shows shifts scheduled for today', priority: 'High' },
  { module: 'Dashboard', id: 'DASH-013', title: 'Today\'s Appointments', steps: '1. Check Today\'s Appointments section', expected: 'Shows appointments for today', priority: 'High' },
  { module: 'Dashboard', id: 'DASH-014', title: 'Stat card navigation', steps: '1. Click on "Total Staff" card', expected: 'Navigates to /staff', priority: 'Medium' },
  { module: 'Dashboard', id: 'DASH-015', title: 'Widget navigation', steps: '1. Click on "Training Expiring" widget', expected: 'Navigates to /compliance/training', priority: 'Medium' },

  // === 5. PEOPLE ===
  { module: 'People Directory', id: 'PEOPLE-001', title: 'People directory loads', steps: '1. Navigate to /people', expected: 'List of people displayed with search', priority: 'Critical' },
  { module: 'People Directory', id: 'PEOPLE-002', title: 'Search people', steps: '1. Type a name in search', expected: 'Filtered results appear', priority: 'High' },
  { module: 'People Directory', id: 'PEOPLE-003', title: 'Add new person', steps: '1. Click "Add Person"\n2. Enter name, DOB, location\n3. Save', expected: 'Person created, appears in directory', priority: 'Critical' },
  { module: 'People Directory', id: 'PEOPLE-004', title: 'View person profile', steps: '1. Click on a person', expected: 'Profile page loads with tabs', priority: 'Critical' },
  { module: 'People Directory', id: 'PEOPLE-005', title: 'Edit person details', steps: '1. Edit name/DOB/address\n2. Save', expected: 'Changes persisted', priority: 'High' },
  { module: 'People Directory', id: 'PEOPLE-006', title: 'Person profile tabs', steps: '1. View a person profile\n2. Check each tab', expected: 'Health, Nutrition, Goals, Body Map, Memory Book tabs visible', priority: 'High' },
  { module: 'People Directory', id: 'PEOPLE-007', title: 'Deactivate person', steps: '1. Deactivate a person\n2. Confirm', expected: 'Person marked inactive, no longer in active list', priority: 'Medium' },
  { module: 'People Directory', id: 'PEOPLE-008', title: 'Filter by location', steps: '1. Select location filter', expected: 'Only people from that location shown', priority: 'Medium' },
  { module: 'People Directory', id: 'PEOPLE-009', title: 'Person audit trail', steps: '1. View person profile\n2. Check audit log', expected: 'All changes logged with timestamps', priority: 'Medium' },

  // === 6. HEALTH ===
  { module: 'Health Tab', id: 'HEALTH-001', title: 'Health tab loads', steps: '1. Open person profile\n2. Click Health tab', expected: 'Health overview displayed', priority: 'High' },
  { module: 'Health Tab', id: 'HEALTH-002', title: 'Record vital signs', steps: '1. Add vitals (BP, temperature, weight)\n2. Save', expected: 'Vitals recorded with timestamp', priority: 'High' },
  { module: 'Health Tab', id: 'HEALTH-003', title: 'View vitals history', steps: '1. Check vitals history', expected: 'All recorded vitals in chronological order', priority: 'Medium' },
  { module: 'Health Tab', id: 'HEALTH-004', title: 'Fluid intake tracking', steps: '1. Record fluid intake\n2. Enter amount in ml', expected: 'Fluid intake recorded, appears on daily summary', priority: 'High' },
  { module: 'Health Tab', id: 'HEALTH-005', title: 'Fluid target warning', steps: '1. Set fluid daily target\n2. Record intake below target', expected: 'Warning when intake below 70% of target', priority: 'High' },
  { module: 'Health Tab', id: 'HEALTH-006', title: 'Allergies', steps: '1. Add allergies to person profile', expected: 'Allergies visible on profile and flagged in medication', priority: 'Critical' },
  { module: 'Health Tab', id: 'HEALTH-007', title: 'Medical conditions', steps: '1. Add medical conditions', expected: 'Conditions recorded and visible', priority: 'High' },
  { module: 'Health Tab', id: 'HEALTH-008', title: 'Dietary requirements', steps: '1. Add dietary requirements', expected: 'Requirements visible on nutrition tab', priority: 'Medium' },

  // === 7. NUTRITION ===
  { module: 'Nutrition & Meals', id: 'NUTR-001', title: 'Nutrition tab loads', steps: '1. Open person profile\n2. Click Nutrition tab', expected: 'Nutrition overview displayed', priority: 'High' },
  { module: 'Nutrition & Meals', id: 'NUTR-002', title: 'Record meal', steps: '1. Add meal record\n2. Select type\n3. Enter details\n4. Save', expected: 'Meal recorded with timestamp', priority: 'High' },
  { module: 'Nutrition & Meals', id: 'NUTR-003', title: 'Record meal consumption', steps: '1. Enter consumed percentage\n2. Save', expected: 'Consumption percentage saved', priority: 'High' },
  { module: 'Nutrition & Meals', id: 'NUTR-004', title: 'Record refused meal', steps: '1. Mark meal as refused\n2. Enter refusal reason', expected: 'Refusal recorded with reason', priority: 'High' },
  { module: 'Nutrition & Meals', id: 'NUTR-005', title: 'Add meal items', steps: '1. Add individual food items to a meal', expected: 'Items listed with portions and allergens', priority: 'Medium' },
  { module: 'Nutrition & Meals', id: 'NUTR-006', title: 'Appetite tracking', steps: '1. Set appetite level (good/fair/poor)', expected: 'Appetite level recorded', priority: 'Medium' },
  { module: 'Nutrition & Meals', id: 'NUTR-007', title: 'Nutrition trends chart', steps: '1. View nutrition trends', expected: '30-day chart shows intake, refusal rates, fluid', priority: 'Medium' },
  { module: 'Nutrition & Meals', id: 'NUTR-008', title: 'AI meal plan generation', steps: '1. Go to Meal Plans\n2. Click "AI Generate"\n3. Select person and parameters\n4. Generate', expected: 'AI-generated meal plan displayed', priority: 'High' },
  { module: 'Nutrition & Meals', id: 'NUTR-009', title: 'Weekly meal planner', steps: '1. Switch to Weekly view\n2. Generate weekly plan', expected: '7-day grid with meals for each day', priority: 'High' },
  { module: 'Nutrition & Meals', id: 'NUTR-010', title: 'Meal plan options (A/B)', steps: '1. View a generated plan\n2. Click a cell to expand', expected: 'Two options shown (A and B)', priority: 'Medium' },
  { module: 'Nutrition & Meals', id: 'NUTR-011', title: 'Select meal option', steps: '1. Click "Select" on an option', expected: 'Option highlighted as selected', priority: 'Medium' },
  { module: 'Nutrition & Meals', id: 'NUTR-012', title: 'All A / All B buttons', steps: '1. Click "All A"', expected: 'All recommended options selected', priority: 'Low' },
  { module: 'Nutrition & Meals', id: 'NUTR-013', title: 'Compare view', steps: '1. Click "Compare" toggle', expected: 'Side-by-side comparison of both options', priority: 'Medium' },
  { module: 'Nutrition & Meals', id: 'NUTR-014', title: 'Generate shopping list', steps: '1. Select options\n2. Click "Generate Shopping List"', expected: 'Categorized shopping list from selected meals', priority: 'High' },
  { module: 'Nutrition & Meals', id: 'NUTR-015', title: 'Print meal plan', steps: '1. Click print/download', expected: 'PDF generated with selected options', priority: 'Medium' },
  { module: 'Nutrition & Meals', id: 'NUTR-016', title: 'Meal plan settings toggle', steps: '1. Go to Settings > AI\n2. Toggle "AI Meal Plans" on', expected: 'Toggle stays on after save', priority: 'High' },
  { module: 'Nutrition & Meals', id: 'NUTR-017', title: 'Dietary profile', steps: '1. Create dietary profile for a person', expected: 'Profile saved with allergies, texture mods, preferences', priority: 'High' },

  // === 8. BODY MAPPING ===
  { module: 'Body Mapping', id: 'BODY-001', title: 'Body map loads', steps: '1. Open person profile\n2. Click Body Map tab', expected: 'Body map diagram displayed', priority: 'High' },
  { module: 'Body Mapping', id: 'BODY-002', title: 'Add observation', steps: '1. Click on body area\n2. Enter wound/mark details\n3. Save', expected: 'Observation recorded with location', priority: 'High' },
  { module: 'Body Mapping', id: 'BODY-003', title: 'View body map history', steps: '1. Check body map history', expected: 'All observations shown chronologically', priority: 'Medium' },
  { module: 'Body Mapping', id: 'BODY-004', title: 'Body map images', steps: '1. Upload photo of wound/mark', expected: 'Image attached to observation', priority: 'Medium' },
  { module: 'Body Mapping', id: 'BODY-005', title: 'Body map status tracking', steps: '1. Update observation status', expected: 'Status updated on body map', priority: 'Medium' },

  // === 9. GOALS ===
  { module: 'Goals & Progress', id: 'GOALS-001', title: 'Goals page loads', steps: '1. Navigate to /goals', expected: 'Goals list displayed', priority: 'High' },
  { module: 'Goals & Progress', id: 'GOALS-002', title: 'Add goal for person', steps: '1. Click "Add Goal"\n2. Enter goal details\n3. Assign to person\n4. Save', expected: 'Goal created', priority: 'High' },
  { module: 'Goals & Progress', id: 'GOALS-003', title: 'Record goal progress', steps: '1. Open a goal\n2. Add progress update\n3. Save', expected: 'Progress recorded with date', priority: 'Medium' },
  { module: 'Goals & Progress', id: 'GOALS-004', title: 'View goal timeline', steps: '1. Open a goal\n2. Check timeline', expected: 'All progress updates shown in order', priority: 'Medium' },
  { module: 'Goals & Progress', id: 'GOALS-005', title: 'Complete goal', steps: '1. Mark goal as completed', expected: 'Goal status changed to completed', priority: 'Medium' },
  { module: 'Goals & Progress', id: 'GOALS-006', title: 'Goal metrics', steps: '1. Set target metric\n2. Record current value', expected: 'Progress bar reflects actual vs target', priority: 'Low' },

  // === 10. MEMORY BOOK ===
  { module: 'Memory Book', id: 'MEM-001', title: 'Memory book loads', steps: '1. Open person profile\n2. Click Memory Book tab', expected: 'Memory book displayed', priority: 'Medium' },
  { module: 'Memory Book', id: 'MEM-002', title: 'Add memory entry', steps: '1. Add entry with title, description, photo\n2. Save', expected: 'Entry saved with timestamp', priority: 'Medium' },
  { module: 'Memory Book', id: 'MEM-003', title: 'View memory entries', steps: '1. Check memory book', expected: 'All entries in reverse chronological order', priority: 'Low' },
  { module: 'Memory Book', id: 'MEM-004', title: 'Share with family', steps: '1. Mark entry as "Share with family"', expected: 'Entry visible in family portal', priority: 'Medium' },

  // === 11. EMAR ===
  { module: 'eMAR & Medication', id: 'EMAR-001', title: 'eMAR page loads', steps: '1. Navigate to /emedication', expected: '31-day medication chart displayed', priority: 'Critical' },
  { module: 'eMAR & Medication', id: 'EMAR-002', title: 'Add medication record', steps: '1. Add new medication\n2. Enter name, dosage, frequency, time\n3. Save', expected: 'Medication record created', priority: 'Critical' },
  { module: 'eMAR & Medication', id: 'EMAR-003', title: 'Administer medication', steps: '1. Click on scheduled dose\n2. Record administration\n3. Save', expected: 'Dose marked as administered with timestamp', priority: 'Critical' },
  { module: 'eMAR & Medication', id: 'EMAR-004', title: 'Mark dose as refused', steps: '1. Click on scheduled dose\n2. Mark as refused\n3. Enter reason', expected: 'Dose marked as refused', priority: 'High' },
  { module: 'eMAR & Medication', id: 'EMAR-005', title: 'Mark dose as missed', steps: '1. Click on scheduled dose\n2. Mark as missed', expected: 'Dose marked as missed, alert generated', priority: 'Critical' },
  { module: 'eMAR & Medication', id: 'EMAR-006', title: 'PRN medication', steps: '1. Add PRN medication\n2. Administer as needed', expected: 'PRN doses recorded separately', priority: 'High' },
  { module: 'eMAR & Medication', id: 'EMAR-007', title: 'Stock count', steps: '1. Go to stock tab\n2. Record current stock level', expected: 'Stock count saved', priority: 'High' },
  { module: 'eMAR & Medication', id: 'EMAR-008', title: 'Daily medication count', steps: '1. Perform end-of-day count\n2. Enter physical count', expected: 'Count recorded, discrepancy flagged if any', priority: 'High' },
  { module: 'eMAR & Medication', id: 'EMAR-009', title: 'Reorder alert', steps: '1. Stock drops below reorder level', expected: 'Alert generated for low stock', priority: 'High' },
  { module: 'eMAR & Medication', id: 'EMAR-010', title: 'Medication audit trail', steps: '1. View medication history', expected: 'All administrations logged with staff name and time', priority: 'High' },
  { module: 'eMAR & Medication', id: 'EMAR-011', title: 'Archived MAR', steps: '1. Navigate to /emedication/archived', expected: 'Past month records viewable', priority: 'Medium' },
  { module: 'eMAR & Medication', id: 'EMAR-012', title: 'Late medication alert', steps: '1. Medication not administered within 30 min', expected: 'High-severity alert in Mission Control', priority: 'Critical' },
  { module: 'eMAR & Medication', id: 'EMAR-013', title: 'Missed medication event', steps: '1. Medication marked as missed', expected: 'Critical alert generated, outbox notification drafted', priority: 'Critical' },

  // === 12. STAFF ===
  { module: 'Staff Directory', id: 'STAFF-001', title: 'Staff directory loads', steps: '1. Navigate to /staff', expected: 'Staff list displayed', priority: 'Critical' },
  { module: 'Staff Directory', id: 'STAFF-002', title: 'Search staff', steps: '1. Type name in search', expected: 'Filtered results appear', priority: 'High' },
  { module: 'Staff Directory', id: 'STAFF-003', title: 'Add staff member', steps: '1. Click "Add Staff"\n2. Enter details\n3. Invite', expected: 'Staff member created, invitation sent', priority: 'Critical' },
  { module: 'Staff Directory', id: 'STAFF-004', title: 'View staff profile', steps: '1. Click on a staff member', expected: 'Profile loads with compliance status', priority: 'High' },
  { module: 'Staff Directory', id: 'STAFF-005', title: 'Edit staff details', steps: '1. Edit role, contact info\n2. Save', expected: 'Changes saved', priority: 'High' },
  { module: 'Staff Directory', id: 'STAFF-006', title: 'Deactivate staff', steps: '1. Deactivate a staff member', expected: 'Staff marked inactive', priority: 'Medium' },
  { module: 'Staff Directory', id: 'STAFF-007', title: 'Staff compliance overview', steps: '1. View staff profile', expected: 'Compliance percentage shown with breakdown', priority: 'High' },

  // === 13. TRAINING ===
  { module: 'Training & Competency', id: 'TRAIN-001', title: 'Training matrix loads', steps: '1. Navigate to /compliance/training', expected: 'Training matrix displayed', priority: 'High' },
  { module: 'Training & Competency', id: 'TRAIN-002', title: 'Add training module', steps: '1. Create training module\n2. Set expiry period', expected: 'Module created', priority: 'High' },
  { module: 'Training & Competency', id: 'TRAIN-003', title: 'Record training completion', steps: '1. Mark staff as completed\n2. Enter date and expiry', expected: 'Record saved', priority: 'High' },
  { module: 'Training & Competency', id: 'TRAIN-004', title: 'Training expiry tracking', steps: '1. View training matrix', expected: 'Expiring items highlighted (30-day warning)', priority: 'High' },
  { module: 'Training & Competency', id: 'TRAIN-005', title: 'Training expiry alert', steps: '1. Training expires', expected: 'Alert generated in Mission Control', priority: 'High' },
  { module: 'Training & Competency', id: 'TRAIN-006', title: 'Competency assessments', steps: '1. Navigate to /compliance/competency', expected: 'Assessment list displayed', priority: 'Medium' },
  { module: 'Training & Competency', id: 'TRAIN-007', title: 'Create competency assessment', steps: '1. Create assessment\n2. Assign to staff', expected: 'Assessment created', priority: 'Medium' },
  { module: 'Training & Competency', id: 'TRAIN-008', title: 'Complete competency assessment', steps: '1. Record assessment results\n2. Save', expected: 'Results saved with evidence', priority: 'Medium' },

  // === 14. DBS ===
  { module: 'DBS & Identity', id: 'DBS-001', title: 'Identity monitoring loads', steps: '1. Navigate to /compliance/identity', expected: 'Staff identity status displayed', priority: 'High' },
  { module: 'DBS & Identity', id: 'DBS-002', title: 'Record DBS check', steps: '1. Add DBS record\n2. Enter type, date, expiry', expected: 'Record saved', priority: 'High' },
  { module: 'DBS & Identity', id: 'DBS-003', title: 'DBS expiry tracking', steps: '1. View identity monitoring', expected: 'Expiring DBS checks highlighted', priority: 'High' },
  { module: 'DBS & Identity', id: 'DBS-004', title: 'DBS expiry alert', steps: '1. DBS check expires', expected: 'Critical alert in Mission Control', priority: 'Critical' },
  { module: 'DBS & Identity', id: 'DBS-005', title: 'Upload identity document', steps: '1. Upload ID document\n2. Set type and expiry', expected: 'Document uploaded, tracked', priority: 'Medium' },

  // === 15. COMPLIANCE RECORDS ===
  { module: 'Compliance Records', id: 'COMP-001', title: 'Compliance records loads', steps: '1. Navigate to /compliance/records', expected: 'Compliance records displayed', priority: 'High' },
  { module: 'Compliance Records', id: 'COMP-002', title: 'Add compliance record', steps: '1. Create record\n2. Assign to staff', expected: 'Record created', priority: 'High' },
  { module: 'Compliance Records', id: 'COMP-003', title: 'Mark record complete', steps: '1. Mark record as complete\n2. Upload evidence', expected: 'Record updated with completion date', priority: 'High' },
  { module: 'Compliance Records', id: 'COMP-004', title: 'Compliance profiles', steps: '1. Go to Settings > Compliance Profiles', expected: 'Profiles listed', priority: 'Medium' },
  { module: 'Compliance Records', id: 'COMP-005', title: 'Create compliance profile', steps: '1. Create profile\n2. Add requirements', expected: 'Profile created', priority: 'Medium' },
  { module: 'Compliance Records', id: 'COMP-006', title: 'Auto-assign profiles', steps: '1. Click "Auto-assign profiles"', expected: 'Profiles assigned to staff based on role', priority: 'Medium' },
  { module: 'Compliance Records', id: 'COMP-007', title: 'Seed compliance records', steps: '1. Click "Seed Records"', expected: 'Records auto-created for all staff', priority: 'Low' },

  // === 16. ROTA ===
  { module: 'Rota Planner', id: 'ROTA-001', title: 'Rota planner loads', steps: '1. Navigate to /scheduling', expected: 'Week grid displayed', priority: 'Critical' },
  { module: 'Rota Planner', id: 'ROTA-002', title: 'Create shift', steps: '1. Click on empty slot\n2. Enter shift details\n3. Save', expected: 'Shift created on grid', priority: 'Critical' },
  { module: 'Rota Planner', id: 'ROTA-003', title: 'Assign staff to shift', steps: '1. Click shift\n2. Select staff member', expected: 'Staff assigned, status changes to "filled"', priority: 'Critical' },
  { module: 'Rota Planner', id: 'ROTA-004', title: 'Unassign staff', steps: '1. Click assigned shift\n2. Remove staff', expected: 'Staff removed, shift becomes "open"', priority: 'High' },
  { module: 'Rota Planner', id: 'ROTA-005', title: 'Safe staffing rules', steps: '1. Try assigning staff below compliance threshold', expected: 'Assignment blocked with warning', priority: 'High' },
  { module: 'Rota Planner', id: 'ROTA-006', title: 'Copy shift', steps: '1. Right-click shift\n2. Copy to another day', expected: 'Shift copied', priority: 'Medium' },
  { module: 'Rota Planner', id: 'ROTA-007', title: 'Delete shift', steps: '1. Delete a shift', expected: 'Shift removed from grid', priority: 'Medium' },
  { module: 'Rota Planner', id: 'ROTA-008', title: 'Weekly view', steps: '1. View weekly rota', expected: 'Full week grid visible', priority: 'High' },
  { module: 'Rota Planner', id: 'ROTA-009', title: 'Unfilled shift alert', steps: '1. Shift has no staff assigned', expected: 'Alert generated in Mission Control', priority: 'High' },

  // === 17. DAY BOARD ===
  { module: 'Day Board & Timeline', id: 'DAYBOARD-001', title: 'Day board loads', steps: '1. Navigate to Day Board view', expected: 'Current day shifts displayed as cards', priority: 'High' },
  { module: 'Day Board & Timeline', id: 'DAYBOARD-002', title: 'Shift details', steps: '1. Click on a shift card', expected: 'Detail dialog opens with full info', priority: 'Medium' },
  { module: 'Day Board & Timeline', id: 'DAYBOARD-003', title: 'Timeline view', steps: '1. Switch to Timeline view', expected: 'Shifts displayed on timeline', priority: 'Medium' },
  { module: 'Day Board & Timeline', id: 'DAYBOARD-004', title: 'Filter by location', steps: '1. Select location filter', expected: 'Only shifts for that location shown', priority: 'Medium' },

  // === 18. SHIFT MARKETPLACE ===
  { module: 'Shift Marketplace', id: 'MKT-001', title: 'Marketplace loads', steps: '1. Navigate to /shift-marketplace', expected: 'Open shifts listed', priority: 'High' },
  { module: 'Shift Marketplace', id: 'MKT-002', title: 'Claim shift', steps: '1. Click "Claim" on an open shift', expected: 'Shift assigned to current user', priority: 'High' },
  { module: 'Shift Marketplace', id: 'MKT-003', title: 'View claimed shifts', steps: '1. Check "My Shifts"', expected: 'Claimed shifts listed', priority: 'Medium' },
  { module: 'Shift Marketplace', id: 'MKT-004', title: 'Release shift', steps: '1. Release a claimed shift', expected: 'Shift becomes open again', priority: 'Medium' },

  // === 19. OVERTIME ===
  { module: 'Overtime Claims', id: 'OT-001', title: 'Overtime page loads', steps: '1. Navigate to /scheduling/overtime', expected: 'Overtime claims listed', priority: 'Medium' },
  { module: 'Overtime Claims', id: 'OT-002', title: 'Submit overtime claim', steps: '1. Submit claim\n2. Enter hours and reason', expected: 'Claim submitted for approval', priority: 'Medium' },
  { module: 'Overtime Claims', id: 'OT-003', title: 'Approve overtime claim', steps: '1. Manager approves claim', expected: 'Claim approved, shift updated', priority: 'Medium' },
  { module: 'Overtime Claims', id: 'OT-004', title: 'Reject overtime claim', steps: '1. Manager rejects claim', expected: 'Claim rejected with reason', priority: 'Medium' },

  // === 20. LEAVE ===
  { module: 'Leave Management', id: 'LEAVE-001', title: 'Leave manager loads', steps: '1. Navigate to /leave', expected: 'Leave calendar and requests displayed', priority: 'High' },
  { module: 'Leave Management', id: 'LEAVE-002', title: 'Request leave', steps: '1. Click "Request Leave"\n2. Select dates\n3. Submit', expected: 'Leave request created', priority: 'High' },
  { module: 'Leave Management', id: 'LEAVE-003', title: 'Approve leave', steps: '1. Manager approves request', expected: 'Leave approved, calendar updated', priority: 'High' },
  { module: 'Leave Management', id: 'LEAVE-004', title: 'Reject leave', steps: '1. Manager rejects request', expected: 'Leave rejected with reason', priority: 'High' },
  { module: 'Leave Management', id: 'LEAVE-005', title: 'Cancel leave request', steps: '1. Staff cancels pending request (before approval)', expected: 'Request cancelled', priority: 'High' },
  { module: 'Leave Management', id: 'LEAVE-006', title: 'Leave balance', steps: '1. Check leave balance', expected: 'Correct balance shown', priority: 'Medium' },
  { module: 'Leave Management', id: 'LEAVE-007', title: 'Leave types', steps: '1. Go to Settings > Leave Types', expected: 'Custom leave types listed', priority: 'Medium' },
  { module: 'Leave Management', id: 'LEAVE-008', title: 'Add leave type', steps: '1. Create leave type\n2. Set colour and duration', expected: 'Type created', priority: 'Medium' },
  { module: 'Leave Management', id: 'LEAVE-009', title: 'Delegation on leave', steps: '1. Manager on leave sets delegate', expected: 'Delegate receives notifications', priority: 'Medium' },

  // === 21. INCIDENTS ===
  { module: 'Incidents & Safeguarding', id: 'INC-001', title: 'Incident directory loads', steps: '1. Navigate to /incidents', expected: 'Incident list displayed', priority: 'Critical' },
  { module: 'Incidents & Safeguarding', id: 'INC-002', title: 'Report incident', steps: '1. Click "Report Incident"\n2. Enter details\n3. Set severity\n4. Save', expected: 'Incident created', priority: 'Critical' },
  { module: 'Incidents & Safeguarding', id: 'INC-003', title: 'Incident detail', steps: '1. Click on incident', expected: 'Full incident detail page loads', priority: 'High' },
  { module: 'Incidents & Safeguarding', id: 'INC-004', title: 'Add action to incident', steps: '1. Add action item\n2. Assign to staff\n3. Set due date', expected: 'Action created', priority: 'High' },
  { module: 'Incidents & Safeguarding', id: 'INC-005', title: 'Complete action', steps: '1. Mark action as complete\n2. Add notes', expected: 'Action completed', priority: 'High' },
  { module: 'Incidents & Safeguarding', id: 'INC-006', title: 'Overdue action alert', steps: '1. Action due date passes', expected: 'High-severity alert in Mission Control', priority: 'High' },
  { module: 'Incidents & Safeguarding', id: 'INC-007', title: 'Incident status tracking', steps: '1. Update incident status', expected: 'Status changes logged', priority: 'Medium' },
  { module: 'Incidents & Safeguarding', id: 'INC-008', title: 'Incident categories', steps: '1. Go to Settings > Incident Categories', expected: 'Categories listed', priority: 'Medium' },
  { module: 'Incidents & Safeguarding', id: 'INC-009', title: 'Add incident category', steps: '1. Create category', expected: 'Category created', priority: 'Low' },
  { module: 'Incidents & Safeguarding', id: 'INC-010', title: 'Incident audit trail', steps: '1. View incident', expected: 'All changes logged', priority: 'Medium' },

  // === 22. ROOM CHECKS ===
  { module: 'Room Checks', id: 'ROOM-001', title: 'Room checks page loads', steps: '1. Navigate to /room-checks', expected: 'Room check schedule displayed', priority: 'Medium' },
  { module: 'Room Checks', id: 'ROOM-002', title: 'Perform room check', steps: '1. Select room\n2. Complete checklist\n3. Submit', expected: 'Check recorded', priority: 'Medium' },
  { module: 'Room Checks', id: 'ROOM-003', title: 'Room check history', steps: '1. View check history', expected: 'Past checks listed', priority: 'Low' },
  { module: 'Room Checks', id: 'ROOM-004', title: 'Missed room check', steps: '1. Room check not completed on time', expected: 'Alert generated', priority: 'Medium' },

  // === 23. TASKS ===
  { module: 'Tasks', id: 'TASK-001', title: 'Tasks page loads', steps: '1. Navigate to /tasks', expected: 'Task list displayed', priority: 'High' },
  { module: 'Tasks', id: 'TASK-002', title: 'Create task', steps: '1. Click "Create Task"\n2. Enter title, description\n3. Assign to staff\n4. Set due date\n5. Save', expected: 'Task created', priority: 'High' },
  { module: 'Tasks', id: 'TASK-003', title: 'Task frequency', steps: '1. Set task frequency (daily/weekly/monthly/yearly)', expected: 'Recurrence set', priority: 'High' },
  { module: 'Tasks', id: 'TASK-004', title: 'Complete task', steps: '1. Open task\n2. Mark as completed\n3. Add notes', expected: 'Task marked complete with timestamp', priority: 'High' },
  { module: 'Tasks', id: 'TASK-005', title: 'Task detail view', steps: '1. Click on a task', expected: 'Full task detail shown with notes', priority: 'Medium' },
  { module: 'Tasks', id: 'TASK-006', title: 'Add note to task', steps: '1. Open task\n2. Add note', expected: 'Note saved with author and timestamp', priority: 'Medium' },
  { module: 'Tasks', id: 'TASK-007', title: 'Task filtering', steps: '1. Filter by status/assignee/date', expected: 'Filtered results shown', priority: 'Medium' },
  { module: 'Tasks', id: 'TASK-008', title: 'Delete task', steps: '1. Delete a task', expected: 'Task removed', priority: 'Low' },

  // === 24. APPOINTMENTS ===
  { module: 'Appointments', id: 'APT-001', title: 'Appointments page loads', steps: '1. Navigate to /appointments', expected: 'Appointment list/calendar displayed', priority: 'High' },
  { module: 'Appointments', id: 'APT-002', title: 'Create appointment', steps: '1. Click "New Appointment"\n2. Enter details\n3. Save', expected: 'Appointment created', priority: 'High' },
  { module: 'Appointments', id: 'APT-003', title: 'Appointment frequency', steps: '1. Set frequency (once/daily/weekly/monthly/yearly)', expected: 'Recurrence set', priority: 'High' },
  { module: 'Appointments', id: 'APT-004', title: 'Complete appointment', steps: '1. Open appointment\n2. Mark as completed\n3. Add notes', expected: 'Appointment completed with notes', priority: 'High' },
  { module: 'Appointments', id: 'APT-005', title: 'Follow-up appointment', steps: '1. Complete appointment\n2. Add follow-up', expected: 'Follow-up appointment created', priority: 'Medium' },
  { module: 'Appointments', id: 'APT-006', title: 'Cancel appointment', steps: '1. Cancel an appointment', expected: 'Status changed to cancelled', priority: 'Medium' },
  { module: 'Appointments', id: 'APT-007', title: 'Appointment detail', steps: '1. Click on appointment', expected: 'Full detail shown with person and staff info', priority: 'Medium' },
  { module: 'Appointments', id: 'APT-008', title: 'Add note to appointment', steps: '1. Add note', expected: 'Note saved', priority: 'Medium' },
  { module: 'Appointments', id: 'APT-009', title: 'View by date', steps: '1. Filter by specific date', expected: 'Appointments for that date shown', priority: 'Medium' },

  // === 25. CHAT ===
  { module: 'Chat & Messaging', id: 'CHAT-001', title: 'Chat page loads', steps: '1. Navigate to /chat', expected: 'Channel list and messages displayed', priority: 'High' },
  { module: 'Chat & Messaging', id: 'CHAT-002', title: 'Send message', steps: '1. Select a channel\n2. Type message\n3. Send', expected: 'Message sent and displayed', priority: 'Critical' },
  { module: 'Chat & Messaging', id: 'CHAT-003', title: 'Create group channel', steps: '1. Click "Create Group"\n2. Enter name\n3. Add members\n4. Save', expected: 'Group created', priority: 'High' },
  { module: 'Chat & Messaging', id: 'CHAT-004', title: 'Start DM', steps: '1. Click "Start DM"\n2. Select staff member', expected: 'DM channel created', priority: 'High' },
  { module: 'Chat & Messaging', id: 'CHAT-005', title: 'Share file', steps: '1. Attach file to message\n2. Send', expected: 'File shared with preview', priority: 'High' },
  { module: 'Chat & Messaging', id: 'CHAT-006', title: 'View shared files', steps: '1. Click "Shared Files" in channel', expected: 'All shared files listed', priority: 'Medium' },
  { module: 'Chat & Messaging', id: 'CHAT-007', title: 'Message read receipts', steps: '1. Send message\n2. Other user reads it', expected: 'Read status shown', priority: 'Medium' },
  { module: 'Chat & Messaging', id: 'CHAT-008', title: 'Member management', steps: '1. Open member list\n2. Add/remove members', expected: 'Members updated', priority: 'Medium' },
  { module: 'Chat & Messaging', id: 'CHAT-009', title: 'Link preview', steps: '1. Paste URL in message', expected: 'Link preview generated', priority: 'Low' },
  { module: 'Chat & Messaging', id: 'CHAT-010', title: 'Message reply', steps: '1. Reply to a specific message', expected: 'Thread shown', priority: 'Medium' },

  // === 26. NOTIFICATIONS ===
  { module: 'Notifications', id: 'NOTIF-001', title: 'Notifications bell', steps: '1. Check notification icon', expected: 'Badge shows unread count', priority: 'High' },
  { module: 'Notifications', id: 'NOTIF-002', title: 'View notifications', steps: '1. Click notification bell', expected: 'Notification list displayed', priority: 'High' },
  { module: 'Notifications', id: 'NOTIF-003', title: 'Mark as read', steps: '1. Click notification', expected: 'Marked as read, count decreases', priority: 'Medium' },
  { module: 'Notifications', id: 'NOTIF-004', title: 'Notification preferences', steps: '1. Go to Settings > Notifications', expected: 'Preferences displayed', priority: 'Medium' },
  { module: 'Notifications', id: 'NOTIF-005', title: 'Update preferences', steps: '1. Toggle notification types\n2. Save', expected: 'Preferences saved', priority: 'Medium' },
  { module: 'Notifications', id: 'NOTIF-006', title: 'Missed medication notification', steps: '1. Medication missed', expected: 'On-duty staff notified', priority: 'Critical' },

  // === 27. EXPENSES ===
  { module: 'Expenses', id: 'EXP-001', title: 'Expenses page loads', steps: '1. Navigate to /expenses', expected: 'Expense list displayed', priority: 'High' },
  { module: 'Expenses', id: 'EXP-002', title: 'Add expense', steps: '1. Click "Add Expense"\n2. Enter amount, category, description\n3. Save', expected: 'Expense recorded', priority: 'High' },
  { module: 'Expenses', id: 'EXP-003', title: 'Expense categories', steps: '1. View expense categories', expected: 'Categories listed', priority: 'Medium' },
  { module: 'Expenses', id: 'EXP-004', title: 'Top-up house', steps: '1. Click "Top-up"\n2. Select "House"\n3. Select location\n4. Enter amount', expected: 'House top-up recorded', priority: 'High' },
  { module: 'Expenses', id: 'EXP-005', title: 'Top-up person', steps: '1. Click "Top-up"\n2. Select "Person"\n3. Select person\n4. Enter amount', expected: 'Person top-up recorded', priority: 'High' },
  { module: 'Expenses', id: 'EXP-006', title: 'Reconcile location', steps: '1. Select location\n2. Enter physical cash amount\n3. Reconcile', expected: 'Cash balance reconciled', priority: 'High' },
  { module: 'Expenses', id: 'EXP-007', title: 'Reconcile person', steps: '1. Select person\n2. Enter physical cash amount\n3. Reconcile', expected: 'Person cash reconciled', priority: 'High' },
  { module: 'Expenses', id: 'EXP-008', title: 'Daily cash balance check', steps: '1. View daily cash check', expected: 'Date, expected amount, physical cash for each person/location shown', priority: 'High' },
  { module: 'Expenses', id: 'EXP-009', title: 'Download expenses report', steps: '1. Click "Download Report"', expected: 'PDF/CSV generated', priority: 'Medium' },
  { module: 'Expenses', id: 'EXP-010', title: 'Expense filtering', steps: '1. Filter by date/category/location', expected: 'Filtered results shown', priority: 'Medium' },

  // === 28. POLICIES ===
  { module: 'Policies & Procedures', id: 'POL-001', title: 'Policies page loads', steps: '1. Navigate to /policies', expected: 'Policy list displayed', priority: 'High' },
  { module: 'Policies & Procedures', id: 'POL-002', title: 'View policy', steps: '1. Click on a policy', expected: 'Full policy content displayed', priority: 'High' },
  { module: 'Policies & Procedures', id: 'POL-003', title: 'Create policy', steps: '1. Click "Create Policy"\n2. Enter title, content, category\n3. Save', expected: 'Policy created', priority: 'High' },
  { module: 'Policies & Procedures', id: 'POL-004', title: 'Edit policy', steps: '1. Edit policy content\n2. Save', expected: 'Policy updated (version tracked)', priority: 'High' },
  { module: 'Policies & Procedures', id: 'POL-005', title: 'Policy review due', steps: '1. Policy review date arrives', expected: 'Alert generated in Mission Control', priority: 'High' },
  { module: 'Policies & Procedures', id: 'POL-006', title: 'Download policy', steps: '1. Click download', expected: 'PDF generated', priority: 'Medium' },
  { module: 'Policies & Procedures', id: 'POL-007', title: 'Share policy', steps: '1. Share policy with staff', expected: 'Notification sent', priority: 'Medium' },
  { module: 'Policies & Procedures', id: 'POL-008', title: 'Policy categories', steps: '1. Filter by category', expected: 'Policies filtered', priority: 'Low' },
  { module: 'Policies & Procedures', id: 'POL-009', title: 'Default policies loaded', steps: '1. View policies page', expected: 'Default policies loaded (not blank page)', priority: 'High' },
  { module: 'Policies & Procedures', id: 'POL-010', title: 'Delete policy', steps: '1. Delete a policy', expected: 'Policy removed', priority: 'Low' },

  // === 29. AGENCIES ===
  { module: 'Agencies Management', id: 'AG-001', title: 'Agencies page loads', steps: '1. Navigate to /agencies', expected: 'Agency list displayed', priority: 'High' },
  { module: 'Agencies Management', id: 'AG-002', title: 'Add agency', steps: '1. Click "Add Agency"\n2. Enter name, contact, rates\n3. Save', expected: 'Agency created', priority: 'High' },
  { module: 'Agencies Management', id: 'AG-003', title: 'Agency detail', steps: '1. Click on agency', expected: 'Agency detail page loads', priority: 'High' },
  { module: 'Agencies Management', id: 'AG-004', title: 'Agency rates', steps: '1. View/edit agency rates', expected: 'Rates displayed and editable', priority: 'Medium' },
  { module: 'Agencies Management', id: 'AG-005', title: 'Agency workers', steps: '1. View agency workers', expected: 'Workers from agency listed', priority: 'Medium' },
  { module: 'Agencies Management', id: 'AG-006', title: 'Agency location', steps: '1. Set agency location', expected: 'Location saved', priority: 'Medium' },
  { module: 'Agencies Management', id: 'AG-007', title: 'Agency ratings', steps: '1. Rate an agency', expected: 'Rating saved', priority: 'Low' },
  { module: 'Agencies Management', id: 'AG-008', title: 'Delete agency', steps: '1. Delete an agency', expected: 'Agency removed', priority: 'Low' },

  // === 30. COMPLIANCE DASHBOARD ===
  { module: 'Compliance Dashboard', id: 'CDASH-001', title: 'Compliance dashboard loads', steps: '1. Navigate to /compliance', expected: 'Overall compliance score displayed', priority: 'Critical' },
  { module: 'Compliance Dashboard', id: 'CDASH-002', title: 'Domain scores', steps: '1. View CQC domain scores', expected: 'Scores for Safe, Effective, Caring, Responsive, Well-led', priority: 'High' },
  { module: 'Compliance Dashboard', id: 'CDASH-003', title: 'Staff compliance breakdown', steps: '1. View staff breakdown', expected: 'Per-staff compliance status shown', priority: 'High' },
  { module: 'Compliance Dashboard', id: 'CDASH-004', title: 'Compliance trends', steps: '1. View compliance trends', expected: 'Score trends over time displayed', priority: 'Medium' },
  { module: 'Compliance Dashboard', id: 'CDASH-005', title: 'Nutrition compliance', steps: '1. View nutrition section', expected: 'Dietary compliance data shown', priority: 'Medium' },

  // === 31-34. CQC, EVIDENCE, SURVEYS, DSPT ===
  { module: 'CQC Readiness', id: 'CQC-001', title: 'CQC readiness page loads', steps: '1. Navigate to /compliance/cqc', expected: 'CQC readiness score displayed', priority: 'High' },
  { module: 'CQC Readiness', id: 'CQC-002', title: 'KLOE assessment', steps: '1. View KLOE assessments', expected: 'All key lines of enquiry scored', priority: 'High' },
  { module: 'CQC Readiness', id: 'CQC-003', title: 'Evidence gaps', steps: '1. View evidence gaps', expected: 'Missing evidence highlighted', priority: 'Medium' },
  { module: 'Evidence Packs', id: 'EP-001', title: 'Evidence packs page loads', steps: '1. Navigate to /compliance/evidence-packs', expected: 'Pack list displayed', priority: 'High' },
  { module: 'Evidence Packs', id: 'EP-002', title: 'Generate evidence pack', steps: '1. Click "Generate Pack"\n2. Select parameters', expected: 'Pack generated', priority: 'High' },
  { module: 'Evidence Packs', id: 'EP-003', title: 'Download evidence pack', steps: '1. Download generated pack', expected: 'PDF downloaded with evidence', priority: 'High' },
  { module: 'Evidence Packs', id: 'EP-004', title: 'Auto-generated pack', steps: '1. Enable auto-generation in Settings', expected: 'Pack generated on schedule', priority: 'Medium' },
  { module: 'Satisfaction Surveys', id: 'SURV-001', title: 'Surveys page loads', steps: '1. Navigate to /compliance/surveys', expected: 'Survey list displayed', priority: 'Medium' },
  { module: 'Satisfaction Surveys', id: 'SURV-002', title: 'Create survey', steps: '1. Create survey with questions', expected: 'Survey created', priority: 'Medium' },
  { module: 'Satisfaction Surveys', id: 'SURV-003', title: 'Send survey', steps: '1. Send survey to people/families', expected: 'Survey sent via email', priority: 'Medium' },
  { module: 'Satisfaction Surveys', id: 'SURV-004', title: 'Complete survey', steps: '1. Open survey link\n2. Answer questions\n3. Submit', expected: 'Survey submitted', priority: 'Medium' },
  { module: 'Satisfaction Surveys', id: 'SURV-005', title: 'View results', steps: '1. View survey results', expected: 'Results displayed with averages', priority: 'Medium' },
  { module: 'DSPT', id: 'DSPT-001', title: 'DSPT page loads', steps: '1. Navigate to /dspt', expected: 'DSPT assessment displayed', priority: 'High' },
  { module: 'DSPT', id: 'DSPT-002', title: 'Answer DSPT questions', steps: '1. Answer each of the 10 data security standards', expected: 'Answers saved', priority: 'High' },
  { module: 'DSPT', id: 'DSPT-003', title: 'Submit DSPT', steps: '1. Submit assessment', expected: 'Assessment submitted', priority: 'High' },
  { module: 'DSPT', id: 'DSPT-004', title: 'DSPT status', steps: '1. View DSPT status', expected: 'Status shown (Not Started / In Progress / Submitted / Standards Met)', priority: 'Medium' },

  // === 35. REPORTING ===
  { module: 'Reporting & Analytics', id: 'RPT-001', title: 'Reporting page loads', steps: '1. Navigate to /reporting', expected: 'Report list displayed', priority: 'High' },
  { module: 'Reporting & Analytics', id: 'RPT-002', title: 'Generate staff report', steps: '1. Select "Staff Report"\n2. Set parameters\n3. Generate', expected: 'Report generated', priority: 'High' },
  { module: 'Reporting & Analytics', id: 'RPT-003', title: 'Generate compliance report', steps: '1. Select "Compliance Report"\n2. Generate', expected: 'Report generated with compliance data', priority: 'High' },
  { module: 'Reporting & Analytics', id: 'RPT-004', title: 'Generate medication report', steps: '1. Select "Medication Report"\n2. Generate', expected: 'Report generated', priority: 'High' },
  { module: 'Reporting & Analytics', id: 'RPT-005', title: 'Generate incident report', steps: '1. Select "Incident Report"\n2. Generate', expected: 'Report generated', priority: 'High' },
  { module: 'Reporting & Analytics', id: 'RPT-006', title: 'Generate nutrition report', steps: '1. Select "Nutrition Report"\n2. Generate', expected: 'Report generated with dietary compliance', priority: 'Medium' },
  { module: 'Reporting & Analytics', id: 'RPT-007', title: 'Download report as PDF', steps: '1. Click download', expected: 'PDF downloaded', priority: 'Medium' },
  { module: 'Reporting & Analytics', id: 'RPT-008', title: 'Report builder', steps: '1. Go to Report Builder\n2. Customise columns\n3. Generate', expected: 'Custom report generated', priority: 'Medium' },
  { module: 'Reporting & Analytics', id: 'RPT-009', title: 'Care outcome reports', steps: '1. Generate care outcome report', expected: 'Report with care outcome data generated', priority: 'Medium' },

  // === 36. INSIGHTS ===
  { module: 'Insights', id: 'INS-001', title: 'Insights page loads', steps: '1. Navigate to /insights', expected: 'Analytics dashboard displayed', priority: 'High' },
  { module: 'Insights', id: 'INS-002', title: 'Staff analytics', steps: '1. View staff analytics', expected: 'Headcount trends, turnover rates shown', priority: 'Medium' },
  { module: 'Insights', id: 'INS-003', title: 'People analytics', steps: '1. View people analytics', expected: 'Admissions, discharges, active counts shown', priority: 'Medium' },
  { module: 'Insights', id: 'INS-004', title: 'Operational metrics', steps: '1. View operational metrics', expected: 'Shift fill rates, leave utilisation, incident frequency', priority: 'Medium' },

  // === 37. MISSION CONTROL ===
  { module: 'Mission Control', id: 'MC-001', title: 'Mission Control loads', steps: '1. Navigate to /mission-control', expected: 'Alert summary and feed displayed', priority: 'Critical' },
  { module: 'Mission Control', id: 'MC-002', title: 'Severity counts', steps: '1. Check severity bar', expected: 'Critical, High, Medium, Low counts correct', priority: 'High' },
  { module: 'Mission Control', id: 'MC-003', title: 'Category cards', steps: '1. Check category cards', expected: 'Medication, Staffing, Compliance, Care counts shown', priority: 'High' },
  { module: 'Mission Control', id: 'MC-004', title: 'Filter by severity', steps: '1. Select "Critical" severity filter', expected: 'Only critical alerts shown', priority: 'High' },
  { module: 'Mission Control', id: 'MC-005', title: 'Filter by category', steps: '1. Select "Medication" category', expected: 'Only medication alerts shown', priority: 'High' },
  { module: 'Mission Control', id: 'MC-006', title: 'Clear filters', steps: '1. Click "Clear"', expected: 'All alerts shown again', priority: 'Medium' },
  { module: 'Mission Control', id: 'MC-007', title: 'Dismiss alert', steps: '1. Click dismiss on an alert', expected: 'Alert removed from feed', priority: 'High' },
  { module: 'Mission Control', id: 'MC-008', title: 'Batch dismiss', steps: '1. Select multiple alerts\n2. Click "Dismiss N"', expected: 'All selected alerts dismissed', priority: 'High' },
  { module: 'Mission Control', id: 'MC-009', title: 'Select all', steps: '1. Click "Select all"', expected: 'All alerts selected', priority: 'Medium' },
  { module: 'Mission Control', id: 'MC-010', title: 'Assign alert', steps: '1. Click assign icon\n2. Select staff member', expected: 'Alert assigned, chip shown', priority: 'High' },
  { module: 'Mission Control', id: 'MC-011', title: 'Navigate to alert', steps: '1. Click "Go to detail" on alert', expected: 'Navigates to relevant module', priority: 'Medium' },
  { module: 'Mission Control', id: 'MC-012', title: 'Alert history tab', steps: '1. Click "History" tab', expected: 'Dismissed alerts shown with timestamps', priority: 'High' },
  { module: 'Mission Control', id: 'MC-013', title: 'Trends tab', steps: '1. Click "Trends" tab', expected: 'This week vs last week comparison shown', priority: 'High' },
  { module: 'Mission Control', id: 'MC-014', title: 'Trend delta', steps: '1. Check change percentages', expected: 'Correct delta calculated', priority: 'Medium' },
  { module: 'Mission Control', id: 'MC-015', title: 'Daily trend chart', steps: '1. Check 14-day chart', expected: 'Daily bar chart with severity breakdown', priority: 'Medium' },
  { module: 'Mission Control', id: 'MC-016', title: 'Refresh', steps: '1. Click refresh button', expected: 'Data reloaded', priority: 'Low' },
  { module: 'Mission Control', id: 'MC-017', title: 'All clear state', steps: '1. No alerts present', expected: '"All clear" message displayed', priority: 'Low' },

  // === 38. BILLING ===
  { module: 'Billing & Subscriptions', id: 'BILL-001', title: 'Billing page loads', steps: '1. Navigate to /billing', expected: 'Current plan and billing info displayed', priority: 'Critical' },
  { module: 'Billing & Subscriptions', id: 'BILL-002', title: 'View plans', steps: '1. View pricing plans', expected: 'Starter, Professional, Enterprise plans shown', priority: 'High' },
  { module: 'Billing & Subscriptions', id: 'BILL-003', title: 'Upgrade plan', steps: '1. Click "Upgrade"\n2. Select plan\n3. Enter payment via Stripe', expected: 'Plan upgraded, Stripe checkout completed', priority: 'Critical' },
  { module: 'Billing & Subscriptions', id: 'BILL-004', title: 'Downgrade plan', steps: '1. Click "Downgrade"\n2. Confirm', expected: 'Plan downgraded at end of billing period', priority: 'High' },
  { module: 'Billing & Subscriptions', id: 'BILL-005', title: 'Cancel subscription', steps: '1. Click "Cancel"\n2. Confirm', expected: 'Subscription cancelled, access until period end', priority: 'High' },
  { module: 'Billing & Subscriptions', id: 'BILL-006', title: 'Payment history', steps: '1. View payment history', expected: 'Past invoices listed', priority: 'Medium' },
  { module: 'Billing & Subscriptions', id: 'BILL-007', title: 'Update payment method', steps: '1. Update card details via Stripe', expected: 'Payment method updated', priority: 'Medium' },
  { module: 'Billing & Subscriptions', id: 'BILL-008', title: 'Invoice download', steps: '1. Download invoice', expected: 'PDF invoice downloaded', priority: 'Medium' },

  // === 39. SETTINGS ===
  { module: 'Settings', id: 'SET-001', title: 'Settings page loads', steps: '1. Navigate to /settings', expected: 'Settings tabs displayed', priority: 'Critical' },
  { module: 'Settings', id: 'SET-002', title: 'Profile tab', steps: '1. View profile tab', expected: 'Personal info displayed', priority: 'High' },
  { module: 'Settings', id: 'SET-003', title: 'Edit profile', steps: '1. Change name/phone/address\n2. Save', expected: 'Profile updated', priority: 'High' },
  { module: 'Settings', id: 'SET-004', title: 'Upload profile picture', steps: '1. Upload photo', expected: 'Photo updated', priority: 'Medium' },
  { module: 'Settings', id: 'SET-005', title: 'Security tab', steps: '1. View security tab', expected: 'MFA options displayed', priority: 'High' },
  { module: 'Settings', id: 'SET-006', title: 'Appearance tab', steps: '1. View appearance tab', expected: 'Theme and zoom options shown', priority: 'Medium' },
  { module: 'Settings', id: 'SET-007', title: 'Toggle dark mode', steps: '1. Click Dark mode', expected: 'Theme switches to dark', priority: 'Medium' },
  { module: 'Settings', id: 'SET-008', title: 'Toggle light mode', steps: '1. Click Light mode', expected: 'Theme switches to light', priority: 'Medium' },
  { module: 'Settings', id: 'SET-009', title: 'Change zoom', steps: '1. Select zoom level', expected: 'Interface scale changes', priority: 'Low' },
  { module: 'Settings', id: 'SET-010', title: 'Org settings tab', steps: '1. View org settings', expected: 'Org details, branding, security shown', priority: 'High' },
  { module: 'Settings', id: 'SET-011', title: 'Edit org details', steps: '1. Change org name\n2. Save', expected: 'Org name updated', priority: 'High' },
  { module: 'Settings', id: 'SET-012', title: 'Branding', steps: '1. Upload logo\n2. Change colours\n3. Save', expected: 'Branding applied', priority: 'Medium' },
  { module: 'Settings', id: 'SET-013', title: 'Security policies', steps: '1. Toggle "Force MFA"\n2. Save', expected: 'Setting saved', priority: 'High' },
  { module: 'Settings', id: 'SET-014', title: 'Staffing rules', steps: '1. Set minimum compliance %\n2. Save', expected: 'Rule applied', priority: 'Medium' },
  { module: 'Settings', id: 'SET-015', title: 'Compliance notifications', steps: '1. Toggle daily digest\n2. Save', expected: 'Setting saved', priority: 'Medium' },
  { module: 'Settings', id: 'SET-016', title: 'Medication alerts', steps: '1. Toggle reorder alerts\n2. Set delay\n3. Save', expected: 'Alerts configured', priority: 'High' },
  { module: 'Settings', id: 'SET-017', title: 'Daily medication counts', steps: '1. Set count convention\n2. Save', expected: 'Convention saved', priority: 'Medium' },
  { module: 'Settings', id: 'SET-018', title: 'AI tab', steps: '1. View AI tab', expected: 'AI configuration displayed', priority: 'Medium' },
  { module: 'Settings', id: 'SET-019', title: 'Enable AI', steps: '1. Toggle "Enable AI Features"\n2. Enter API key\n3. Save', expected: 'AI enabled', priority: 'Medium' },
  { module: 'Settings', id: 'SET-020', title: 'Toggle AI features', steps: '1. Toggle individual features', expected: 'Each toggle auto-saves immediately', priority: 'High' },
  { module: 'Settings', id: 'SET-021', title: 'Compliance config tab', steps: '1. View compliance config', expected: 'Config items listed', priority: 'Medium' },
  { module: 'Settings', id: 'SET-022', title: 'Add compliance config', steps: '1. Add new requirement', expected: 'Requirement created', priority: 'Medium' },
  { module: 'Settings', id: 'SET-023', title: 'Leave types tab', steps: '1. View leave types', expected: 'Custom leave types listed', priority: 'Medium' },
  { module: 'Settings', id: 'SET-024', title: 'Incident categories tab', steps: '1. View incident categories', expected: 'Categories listed', priority: 'Low' },
  { module: 'Settings', id: 'SET-025', title: 'Deactivate account', steps: '1. Click "Deactivate Account"\n2. Confirm', expected: 'Account deactivated, logged out', priority: 'High' },

  // === 40. PERMISSIONS ===
  { module: 'Permissions & Roles', id: 'PERM-001', title: 'View user permissions', steps: '1. Go to staff profile\n2. View permissions', expected: 'Permission matrix displayed', priority: 'High' },
  { module: 'Permissions & Roles', id: 'PERM-002', title: 'Update permissions', steps: '1. Toggle module access\n2. Save', expected: 'Permissions updated', priority: 'High' },
  { module: 'Permissions & Roles', id: 'PERM-003', title: 'Role-based defaults', steps: '1. Create new user with role', expected: 'Default permissions set based on role', priority: 'Medium' },
  { module: 'Permissions & Roles', id: 'PERM-004', title: 'Module access restriction', steps: '1. Restrict module for user\n2. User tries to access', expected: 'Access denied, module hidden from nav', priority: 'High' },

  // === 41. FAMILY PORTAL ===
  { module: 'Family Portal', id: 'FAM-001', title: 'Family portal accessible', steps: '1. Log in as family member', expected: 'Portal dashboard displayed', priority: 'High' },
  { module: 'Family Portal', id: 'FAM-002', title: 'View care notes', steps: '1. View care notes', expected: 'Shared care notes displayed', priority: 'High' },
  { module: 'Family Portal', id: 'FAM-003', title: 'View care plans', steps: '1. View care plans', expected: 'Shared care plans displayed', priority: 'High' },
  { module: 'Family Portal', id: 'FAM-004', title: 'View goals', steps: '1. View goals', expected: 'Person\'s goals shown', priority: 'Medium' },
  { module: 'Family Portal', id: 'FAM-005', title: 'View memory book', steps: '1. View memory book', expected: 'Shared memory entries displayed', priority: 'Medium' },

  // === 42. COMPLIANCE PORTAL ===
  { module: 'Compliance Portal', id: 'CPORT-001', title: 'Compliance portal accessible', steps: '1. Log in as compliance officer', expected: 'Portal dashboard displayed', priority: 'High' },
  { module: 'Compliance Portal', id: 'CPORT-002', title: 'View compliance feed', steps: '1. View compliance feed', expected: 'Recent compliance events shown', priority: 'High' },
  { module: 'Compliance Portal', id: 'CPORT-003', title: 'Nutrition compliance data', steps: '1. View nutrition section', expected: 'Dietary compliance data shown', priority: 'Medium' },
  { module: 'Compliance Portal', id: 'CPORT-004', title: 'Evidence packs view', steps: '1. View evidence packs', expected: 'Generated packs downloadable', priority: 'Medium' },

  // === 43. MOBILE ===
  { module: 'Mobile Features', id: 'MOB-001', title: 'Mobile check-in', steps: '1. Navigate to /mobile/check-in\n2. Check in with GPS', expected: 'Check-in recorded with location', priority: 'High' },
  { module: 'Mobile Features', id: 'MOB-002', title: 'Mobile notes', steps: '1. Navigate to /mobile/notes\n2. Record care note', expected: 'Note saved', priority: 'High' },
  { module: 'Mobile Features', id: 'MOB-003', title: 'Voice note', steps: '1. Record voice note\n2. Save', expected: 'Voice note saved', priority: 'Medium' },
  { module: 'Mobile Features', id: 'MOB-004', title: 'Mobile eMAR', steps: '1. Access eMAR on mobile\n2. Record administration', expected: 'Administration recorded', priority: 'High' },

  // === 44. MARKETING ===
  { module: 'Marketing Pages', id: 'MKT-001', title: 'Landing page loads', steps: '1. Navigate to /', expected: 'Hero, features, trust strip visible', priority: 'Critical' },
  { module: 'Marketing Pages', id: 'MKT-002', title: 'Features page', steps: '1. Navigate to /features', expected: 'All feature sections displayed', priority: 'High' },
  { module: 'Marketing Pages', id: 'MKT-003', title: 'Pricing page', steps: '1. Navigate to /pricing', expected: 'Three pricing tiers shown', priority: 'High' },
  { module: 'Marketing Pages', id: 'MKT-004', title: 'About page', steps: '1. Navigate to /about', expected: 'About content displayed', priority: 'Medium' },
  { module: 'Marketing Pages', id: 'MKT-005', title: 'Contact page', steps: '1. Navigate to /contact', expected: 'Contact form displayed', priority: 'Medium' },
  { module: 'Marketing Pages', id: 'MKT-006', title: 'Contact form submit', steps: '1. Fill form\n2. Submit', expected: 'Form submitted, confirmation shown', priority: 'High' },
  { module: 'Marketing Pages', id: 'MKT-007', title: 'Blog page', steps: '1. Navigate to /blog', expected: 'Blog posts listed', priority: 'Medium' },
  { module: 'Marketing Pages', id: 'MKT-008', title: 'Learning center', steps: '1. Navigate to /learning', expected: 'Learning articles listed', priority: 'Medium' },
  { module: 'Marketing Pages', id: 'MKT-009', title: 'How it works', steps: '1. Navigate to /how-it-works', expected: 'Content displayed', priority: 'Medium' },
  { module: 'Marketing Pages', id: 'MKT-010', title: 'Case studies', steps: '1. Navigate to /case-studies', expected: 'Case studies listed', priority: 'Low' },
  { module: 'Marketing Pages', id: 'MKT-011', title: 'Compliance badges', steps: '1. Navigate to /compliance-badges', expected: 'Regulatory body info displayed', priority: 'Low' },
  { module: 'Marketing Pages', id: 'MKT-012', title: 'Logo section', steps: '1. View trust strip on landing page', expected: 'Regulatory logos displayed on white background', priority: 'Medium' },
  { module: 'Marketing Pages', id: 'MKT-013', title: 'SEO meta tags', steps: '1. View page source', expected: 'Title, description, canonical, structured data present', priority: 'Medium' },
  { module: 'Marketing Pages', id: 'MKT-014', title: 'Responsive layout', steps: '1. View on mobile viewport', expected: 'Layout adapts correctly', priority: 'High' },

  // === 45. API & EVENTS ===
  { module: 'API & Events', id: 'API-001', title: 'Auth endpoint', steps: '1. POST /api/auth/login with valid credentials', expected: 'JWT token returned', priority: 'Critical' },
  { module: 'API & Events', id: 'API-002', title: 'Auth endpoint — invalid', steps: '1. POST /api/auth/login with wrong password', expected: '401 returned', priority: 'Critical' },
  { module: 'API & Events', id: 'API-003', title: 'Protected endpoint', steps: '1. GET /api/dashboard/stats without token', expected: '401 returned', priority: 'Critical' },
  { module: 'API & Events', id: 'API-004', title: 'Rate limiting', steps: '1. Send 100 requests in 1 second', expected: 'Rate limit triggered, 429 returned', priority: 'High' },
  { module: 'API & Events', id: 'API-005', title: 'Event publishing', steps: '1. Miss a medication dose', expected: 'medication.administration_missed event published', priority: 'Critical' },
  { module: 'API & Events', id: 'API-006', title: 'Event consumer — Mission Control', steps: '1. Event published', expected: 'Alert created in mission_control_alerts table', priority: 'Critical' },
  { module: 'API & Events', id: 'API-007', title: 'Event deduplication', steps: '1. Publish same event twice', expected: 'Single alert updated, not duplicated', priority: 'High' },
  { module: 'API & Events', id: 'API-008', title: 'Event — incident action overdue', steps: '1. Incident action past due', expected: 'incident.action_overdue event published', priority: 'High' },
  { module: 'API & Events', id: 'API-009', title: 'Event — shift unfilled', steps: '1. Shift with no staff', expected: 'shift.unfilled event published', priority: 'High' },
  { module: 'API & Events', id: 'API-010', title: 'Event — training expiring', steps: '1. Training within 30 days of expiry', expected: 'training.expiring event published', priority: 'High' },
  { module: 'API & Events', id: 'API-011', title: 'Event — DBS expiring', steps: '1. DBS within 30 days of expiry', expected: 'dbs.expiring event published', priority: 'High' },
  { module: 'API & Events', id: 'API-012', title: 'Event — policy review due', steps: '1. Policy past review date', expected: 'policy.review_due event published', priority: 'High' },
  { module: 'API & Events', id: 'API-013', title: 'Event — care plan review due', steps: '1. Care plan past review date', expected: 'care_plan.review_due event published', priority: 'High' },
  { module: 'API & Events', id: 'API-014', title: 'Event — fluid intake below target', steps: '1. Fluid intake below 70% of target', expected: 'fluid.intake_below_target event published', priority: 'High' },
  { module: 'API & Events', id: 'API-015', title: 'Event — appetite decline', steps: '1. Consecutive poor meals logged', expected: 'nutrition.appetite_decline event published', priority: 'High' },
  { module: 'API & Events', id: 'API-016', title: 'Event — refused meal', steps: '1. Meal refused', expected: 'nutrition.refused_meal event published', priority: 'High' },
  { module: 'API & Events', id: 'API-017', title: 'WebSocket connection', steps: '1. Connect to WebSocket', expected: 'Connection established', priority: 'Medium' },
  { module: 'API & Events', id: 'API-018', title: 'WebSocket — real-time notification', steps: '1. Trigger notification event', expected: 'Notification delivered via WebSocket', priority: 'Medium' },

  // === CROSS-CUTTING ===
  { module: 'Cross-Cutting', id: 'XC-001', title: 'Data isolation', steps: '1. Create data in Org A\n2. Log in as Org B', expected: 'Org B cannot see Org A data', priority: 'Critical' },
  { module: 'Cross-Cutting', id: 'XC-002', title: 'Audit trail', steps: '1. Perform CRUD operations\n2. Check audit log', expected: 'All operations logged', priority: 'High' },
  { module: 'Cross-Cutting', id: 'XC-003', title: 'UK GDPR compliance', steps: '1. Check data processing terms\n2. Check retention', expected: 'Terms accurate, retention periods correct', priority: 'Critical' },
  { module: 'Cross-Cutting', id: 'XC-004', title: 'CQC compliance', steps: '1. Check compliance features', expected: 'All 5 CQC domains covered', priority: 'Critical' },
  { module: 'Cross-Cutting', id: 'XC-005', title: 'Responsive design', steps: '1. Test at 320px, 375px, 768px, 1024px, 1280px', expected: 'Layout adapts at all breakpoints', priority: 'High' },
  { module: 'Cross-Cutting', id: 'XC-006', title: 'Accessibility', steps: '1. Run axe accessibility audit', expected: 'No critical violations', priority: 'High' },
  { module: 'Cross-Cutting', id: 'XC-007', title: 'Error handling', steps: '1. Trigger API errors\n2. Check UI', expected: 'Graceful error messages, no crashes', priority: 'High' },
  { module: 'Cross-Cutting', id: 'XC-008', title: 'Loading states', steps: '1. Observe page loads', expected: 'Skeleton loaders shown during data fetching', priority: 'Medium' },
  { module: 'Cross-Cutting', id: 'XC-009', title: 'Empty states', steps: '1. View pages with no data', expected: 'Helpful empty states with CTAs', priority: 'Medium' },
  { module: 'Cross-Cutting', id: 'XC-010', title: 'Search functionality', steps: '1. Search across modules', expected: 'Results appear correctly', priority: 'High' },
  { module: 'Cross-Cutting', id: 'XC-011', title: 'Browser back/forward', steps: '1. Navigate between pages\n2. Use browser back', expected: 'Correct page loads, no errors', priority: 'High' },
  { module: 'Cross-Cutting', id: 'XC-012', title: 'Session timeout', steps: '1. Leave app idle for session duration', expected: 'Session expired, redirect to login', priority: 'Medium' },
  { module: 'Cross-Cutting', id: 'XC-013', title: 'Multi-tab', steps: '1. Open app in two tabs\n2. Perform actions in one', expected: 'Both tabs stay in sync', priority: 'Medium' },
  { module: 'Cross-Cutting', id: 'XC-014', title: 'Print pages', steps: '1. Print compliance report\n2. Print meal plan', expected: 'Layout is print-friendly', priority: 'Low' },
  { module: 'Cross-Cutting', id: 'XC-015', title: 'PDF generation', steps: '1. Generate compliance PDF\n2. Generate meal plan PDF', expected: 'PDFs download correctly', priority: 'High' },
];

// Build workbook
const wb = XLSX.utils.book_new();

// Sheet 1: All Test Cases
const headers = ['ID', 'Module', 'Test Case', 'Priority', 'Steps', 'Expected Result', 'Status', 'Tested By', 'Date Tested', 'Pass/Fail', 'Comments / Bug Notes', 'Bug Ticket'];
const data = [headers, ...tests.map(t => [
  t.id, t.module, t.title, t.priority, t.steps, t.expected,
  'Not Started', '', '', '', '', ''
])];
const ws = XLSX.utils.aoa_to_sheet(data);

// Set column widths
ws['!cols'] = [
  { wch: 12 },   // ID
  { wch: 25 },   // Module
  { wch: 35 },   // Test Case
  { wch: 10 },   // Priority
  { wch: 55 },   // Steps
  { wch: 50 },   // Expected Result
  { wch: 14 },   // Status
  { wch: 14 },   // Tested By
  { wch: 14 },   // Date Tested
  { wch: 10 },   // Pass/Fail
  { wch: 40 },   // Comments
  { wch: 15 },   // Bug Ticket
];

XLSX.utils.book_append_sheet(wb, ws, 'Test Cases');

// Sheet 2: Summary by Module
const modules = [...new Set(tests.map(t => t.module))];
const summaryData = [['Module', 'Total', 'Critical', 'High', 'Medium', 'Low', 'Passed', 'Failed', 'Blocked', 'Not Started']];
for (const mod of modules) {
  const modTests = tests.filter(t => t.module === mod);
  summaryData.push([
    mod,
    modTests.length,
    modTests.filter(t => t.priority === 'Critical').length,
    modTests.filter(t => t.priority === 'High').length,
    modTests.filter(t => t.priority === 'Medium').length,
    modTests.filter(t => t.priority === 'Low').length,
    '', '', '', modTests.length // Not Started = total (initially)
  ]);
}
// Totals row
const allCritical = tests.filter(t => t.priority === 'Critical').length;
const allHigh = tests.filter(t => t.priority === 'High').length;
const allMedium = tests.filter(t => t.priority === 'Medium').length;
const allLow = tests.filter(t => t.priority === 'Low').length;
summaryData.push(['TOTAL', tests.length, allCritical, allHigh, allMedium, allLow, '', '', '', tests.length]);

const ws2 = XLSX.utils.aoa_to_sheet(summaryData);
ws2['!cols'] = [
  { wch: 28 }, { wch: 8 }, { wch: 10 }, { wch: 8 }, { wch: 8 }, { wch: 8 },
  { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 12 },
];
XLSX.utils.book_append_sheet(wb, ws2, 'Summary');

// Sheet 3: Bug Log
const bugHeaders = ['Bug ID', 'Test ID', 'Module', 'Severity', 'Title', 'Steps to Reproduce', 'Expected', 'Actual', 'Status', 'Assigned To', 'Date Found', 'Date Fixed'];
const bugData = [bugHeaders];
const ws3 = XLSX.utils.aoa_to_sheet(bugData);
ws3['!cols'] = [
  { wch: 10 }, { wch: 12 }, { wch: 22 }, { wch: 10 }, { wch: 35 },
  { wch: 50 }, { wch: 40 }, { wch: 40 }, { wch: 12 }, { wch: 15 },
  { wch: 12 }, { wch: 12 },
];
XLSX.utils.book_append_sheet(wb, ws3, 'Bug Log');

// Write file
const outPath = 'docs/MeticleCare_QA_UAT_Test_Pack.xlsx';
XLSX.writeFile(wb, outPath);
console.log(`Generated ${outPath} with ${tests.length} test cases across ${modules.length} modules`);
