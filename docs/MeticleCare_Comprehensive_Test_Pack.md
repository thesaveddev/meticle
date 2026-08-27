# MeticleCare — Comprehensive QA / UAT Test Pack

**Version:** 1.0
**Date:** August 2026
**App:** MeticleCare — Supported Living Care Management Platform
**Environment:** Production (meticlecare.com) or Staging
**Tester Role:** ORG_ADMIN unless otherwise noted

---

## How to Use This Document

Each test case has:
- **ID** — unique reference (e.g. AUTH-001)
- **Preconditions** — what must be true before starting
- **Steps** — numbered actions to perform
- **Expected Result** — what should happen
- **Pass/Fail** — mark after executing

Execute tests in order within each module. A failure in a prerequisite blocks downstream tests.

---

## Table of Contents

1. [Authentication & Account](#1-authentication--account)
2. [Multi-Factor Authentication](#2-multi-factor-authentication)
3. [Onboarding](#3-onboarding)
4. [Dashboard](#4-dashboard)
5. [People Directory & Profiles](#5-people-directory--profiles)
6. [Health Tab](#6-health-tab)
7. [Nutrition & Meals](#7-nutrition--meals)
8. [Body Mapping](#8-body-mapping)
9. [Goals & Progress](#9-goals--progress)
10. [Memory Book](#10-memory-book)
11. [eMAR & Medication](#11-emar--medication)
12. [Staff Directory & Profiles](#12-staff-directory--profiles)
13. [Training & Competency](#13-training--competency)
14. [DBS & Identity Checks](#14-dbs--identity-checks)
15. [Compliance Records](#15-compliance-records)
16. [Rota Planner](#16-rota-planner)
17. [Day Board & Timeline Views](#17-day-board--timeline-views)
18. [Shift Marketplace](#18-shift-marketplace)
19. [Overtime Claims](#19-overtime-claims)
20. [Leave Management](#20-leave-management)
21. [Incidents & Safeguarding](#21-incidents--safeguarding)
22. [Room Checks](#22-room-checks)
23. [Tasks](#23-tasks)
24. [Appointments](#24-appointments)
25. [Chat & Messaging](#25-chat--messaging)
26. [Notifications](#26-notifications)
27. [Expenses](#27-expenses)
28. [Policies & Procedures](#28-policies--procedures)
29. [Agencies Management](#29-agencies-management)
30. [Compliance Dashboard](#30-compliance-dashboard)
31. [CQC Readiness](#31-cqc-readiness)
32. [Evidence Packs](#32-evidence-packs)
33. [Satisfaction Surveys](#33-satisfaction-surveys)
34. [DSPT Self-Assessment](#34-dspt-self-assessment)
35. [Reporting & Analytics](#35-reporting--analytics)
36. [Insights](#36-insights)
37. [Mission Control](#37-mission-control)
38. [Billing & Subscriptions](#38-billing--subscriptions)
39. [Settings](#39-settings)
40. [Permissions & Roles](#40-permissions--roles)
41. [Family Portal](#41-family-portal)
42. [Compliance Portal](#42-compliance-portal)
43. [Mobile Features](#43-mobile-features)
44. [Marketing Pages](#44-marketing-pages)
45. [API & Events](#45-api--events)

---

## 1. Authentication & Account

| ID | Test Case | Steps | Expected Result | Pass/Fail |
|----|-----------|-------|-----------------|-----------|
| AUTH-001 | Register new organisation | 1. Navigate to /register 2. Enter org name, admin email, password 3. Submit | Account created, verification email sent, redirect to login | |
| AUTH-002 | Email verification flow | 1. Check inbox for verification link 2. Click link | Email verified, can now log in | |
| AUTH-003 | Login with valid credentials | 1. Navigate to /login 2. Enter email + password 3. Click Login | Redirect to dashboard, user session created | |
| AUTH-004 | Login with invalid password | 1. Enter wrong password 2. Click Login | Error message: "Invalid email or password" | |
| AUTH-005 | Login with non-existent email | 1. Enter unregistered email 2. Click Login | Error message: "Invalid email or password" (no email enumeration) | |
| AUTH-006 | Forgot password flow | 1. Click "Forgot password" 2. Enter email 3. Check inbox 4. Click reset link 5. Enter new password | Password reset email received, password updated, can log in with new password | |
| AUTH-007 | Session persistence | 1. Log in 2. Close browser tab 3. Reopen app | Session persists, user still logged in | |
| AUTH-008 | Logout | 1. Click logout | Session destroyed, redirect to login page | |
| AUTH-009 | Unauthorised access | 1. Log out 2. Navigate to /dashboard directly | Redirect to login page | |
| AUTH-010 | Role-based access — Care Worker | 1. Log in as CARE_WORKER 2. Try accessing /settings | Redirect to unauthorised page or limited view | |
| AUTH-011 | Role-based access — Manager | 1. Log in as MANAGER 2. Access /settings | Can access, limited to relevant tabs | |
| AUTH-012 | Role-based access — Org Admin | 1. Log in as ORG_ADMIN 2. Access all modules | Full access to all admin features | |

---

## 2. Multi-Factor Authentication

| ID | Test Case | Steps | Expected Result | Pass/Fail |
|----|-----------|-------|-----------------|-----------|
| MFA-001 | Enable MFA | 1. Go to Settings > Security 2. Click "Enable MFA" 3. Scan QR code with authenticator app 4. Enter 6-digit code 5. Click Verify | MFA enabled, backup codes displayed | |
| MFA-002 | Login with MFA | 1. Log out 2. Log in with email + password 3. Enter authenticator code | Login successful with MFA verification | |
| MFA-003 | Login with wrong MFA code | 1. Enter incorrect 6-digit code | Error: "Invalid token" | |
| MFA-004 | Login with backup code | 1. Enter backup code instead of authenticator code | Login successful | |
| MFA-005 | Disable MFA | 1. Go to Settings > Security 2. Click "Disable MFA" 3. Enter authenticator code | MFA disabled | |
| MFA-006 | Force MFA (admin) | 1. Go to Settings > Org > Security 2. Enable "Force all staff to set up MFA" 3. Save 4. Log in as staff member without MFA | Staff forced to set up MFA before accessing app | |

---

## 3. Onboarding

| ID | Test Case | Steps | Expected Result | Pass/Fail |
|----|-----------|-------|-----------------|-----------|
| ONBOARD-001 | Onboarding checklist visible | 1. Log in as new ORG_ADMIN 2. View dashboard | Onboarding checklist shows with 4 steps | |
| ONBOARD-002 | Step 1 — Add location | 1. Click "Add your location" 2. Create a location | Step marked complete, progress bar updates | |
| ONBOARD-003 | Step 2 — Invite team | 1. Click "Invite your team" 2. Add staff member | Step marked complete | |
| ONBOARD-004 | Step 3 — Add people | 1. Click "Add people in your care" 2. Add a person | Step marked complete | |
| ONBOARD-005 | Step 4 — Choose plan | 1. Click "Choose your plan" 2. Select a plan | Step marked complete | |
| ONBOARD-006 | Dismiss onboarding | 1. Click "I'm all set, don't show again" | Onboarding hidden, persists across sessions | |

---

## 4. Dashboard

| ID | Test Case | Steps | Expected Result | Pass/Fail |
|----|-----------|-------|-----------------|-----------|
| DASH-001 | Dashboard loads | 1. Log in 2. View dashboard | Greeting with user name, stat cards visible | |
| DASH-002 | Stat cards — Total Staff | 1. Check Total Staff card | Shows correct count matching staff directory | |
| DASH-003 | Stat cards — Active People | 1. Check Active People card | Shows correct count | |
| DASH-004 | Stat cards — Compliance Rate | 1. Check Compliance Rate card | Shows percentage matching compliance module | |
| DASH-005 | Stat cards — Open Shifts | 1. Check Open Shifts card | Shows count of unfilled shifts | |
| DASH-006 | Stat cards — Alerts | 1. Check Alerts card | Shows open incident count | |
| DASH-007 | Widget — DBS Expiring | 1. Check Staff with Expiring Docs widget | Shows count, links to /compliance/identity | |
| DASH-008 | Widget — Training Expiring | 1. Check Training Expiring widget | Shows count, links to /compliance/training | |
| DASH-009 | Widget — Pending Leave | 1. Check Pending Leave widget | Shows count of pending leave requests | |
| DASH-010 | Widget — Overdue Medications | 1. Check Overdue Medications widget | Shows count, links to /emedication | |
| DASH-011 | Compliance Snapshot | 1. Check Compliance Snapshot section | Shows progress bars for training, DBS, identity | |
| DASH-012 | Today's Rota | 1. Check Today's Rota section | Shows shifts scheduled for today | |
| DASH-013 | Today's Appointments | 1. Check Today's Appointments section | Shows appointments for today | |
| DASH-014 | Stat card navigation | 1. Click on "Total Staff" card | Navigates to /staff | |
| DASH-015 | Widget navigation | 1. Click on "Training Expiring" widget | Navigates to /compliance/training | |

---

## 5. People Directory & Profiles

| ID | Test Case | Steps | Expected Result | Pass/Fail |
|----|-----------|-------|-----------------|-----------|
| PEOPLE-001 | People directory loads | 1. Navigate to /people | List of people displayed with search | |
| PEOPLE-002 | Search people | 1. Type a name in search | Filtered results appear | |
| PEOPLE-003 | Add new person | 1. Click "Add Person" 2. Enter name, DOB, location 3. Save | Person created, appears in directory | |
| PEOPLE-004 | View person profile | 1. Click on a person | Profile page loads with tabs | |
| PEOPLE-005 | Edit person details | 1. Edit name/DOB/address 2. Save | Changes persisted | |
| PEOPLE-006 | Person profile tabs | 1. View a person profile 2. Check each tab | Health, Nutrition, Goals, Body Map, Memory Book tabs visible | |
| PEOPLE-007 | Deactivate person | 1. Deactivate a person 2. Confirm | Person marked inactive, no longer in active list | |
| PEOPLE-008 | Filter by location | 1. Select location filter | Only people from that location shown | |
| PEOPLE-009 | Person audit trail | 1. View person profile 2. Check audit log | All changes logged with timestamps | |

---

## 6. Health Tab

| ID | Test Case | Steps | Expected Result | Pass/Fail |
|----|-----------|-------|-----------------|-----------|
| HEALTH-001 | Health tab loads | 1. Open a person profile 2. Click Health tab | Health overview displayed | |
| HEALTH-002 | Record vital signs | 1. Add vitals (BP, temperature, weight, etc.) 2. Save | Vitals recorded with timestamp | |
| HEALTH-003 | View vitals history | 1. Check vitals history | All recorded vitals shown in chronological order | |
| HEALTH-004 | Fluid intake tracking | 1. Record fluid intake 2. Enter amount in ml | Fluid intake recorded, appears on daily summary | |
| HEALTH-005 | Fluid target | 1. Set fluid daily target 2. Record intake below target | Warning shown when intake below 70% of target | |
| HEALTH-006 | Allergies | 1. Add allergies to person profile | Allergies visible on profile and flagged in medication | |
| HEALTH-007 | Medical conditions | 1. Add medical conditions | Conditions recorded and visible | |
| HEALTH-008 | Dietary requirements | 1. Add dietary requirements | Requirements visible on nutrition tab | |

---

## 7. Nutrition & Meals

| ID | Test Case | Steps | Expected Result | Pass/Fail |
|----|-----------|-------|-----------------|-----------|
| NUTR-001 | Nutrition tab loads | 1. Open person profile 2. Click Nutrition tab | Nutrition overview displayed | |
| NUTR-002 | Record meal | 1. Add meal record 2. Select type (breakfast/lunch/dinner) 3. Enter details 4. Save | Meal recorded with timestamp | |
| NUTR-003 | Record meal consumption | 1. Enter consumed percentage 2. Save | Consumption percentage saved | |
| NUTR-004 | Record refused meal | 1. Mark meal as refused 2. Enter refusal reason | Refusal recorded with reason | |
| NUTR-005 | Add meal items | 1. Add individual food items to a meal | Items listed with portions and allergens | |
| NUTR-006 | Appetite tracking | 1. Set appetite level (good/fair/poor) | Appetite level recorded | |
| NUTR-007 | Nutrition trends chart | 1. View nutrition trends | 30-day chart shows intake, refusal rates, fluid | |
| NUTR-008 | AI meal plan generation | 1. Go to Meal Plans 2. Click "AI Generate" 3. Select person and parameters 4. Generate | AI-generated meal plan displayed | |
| NUTR-009 | Weekly meal planner | 1. Switch to Weekly view 2. Generate weekly plan | 7-day grid with meals for each day | |
| NUTR-010 | Meal plan options (A/B) | 1. View a generated plan 2. Click a cell to expand | Two options shown (A and B) | |
| NUTR-011 | Select meal option | 1. Click "Select" on an option | Option highlighted as selected | |
| NUTR-012 | All A / All B buttons | 1. Click "All A" | All recommended options selected | |
| NUTR-013 | Compare view | 1. Click "Compare" toggle | Side-by-side comparison of both options | |
| NUTR-014 | Generate shopping list | 1. Select options 2. Click "Generate Shopping List" | Categorized shopping list from selected meals | |
| NUTR-015 | Print meal plan | 1. Click print/download | PDF generated with selected options | |
| NUTR-016 | Meal plan settings toggle | 1. Go to Settings > AI 2. Toggle "AI Meal Plans" on | Toggle stays on after save | |
| NUTR-017 | Dietary profile | 1. Create dietary profile for a person | Profile saved with allergies, texture mods, preferences | |

---

## 8. Body Mapping

| ID | Test Case | Steps | Expected Result | Pass/Fail |
|----|-----------|-------|-----------------|-----------|
| BODY-001 | Body map loads | 1. Open person profile 2. Click Body Map tab | Body map diagram displayed | |
| BODY-002 | Add observation | 1. Click on body area 2. Enter wound/mark details 3. Save | Observation recorded with location | |
| BODY-003 | View body map history | 1. Check body map history | All observations shown chronologically | |
| BODY-004 | Body map images | 1. Upload photo of wound/mark | Image attached to observation | |
| BODY-005 | Body map status tracking | 1. Update observation status (healing/worsening) | Status updated on body map | |

---

## 9. Goals & Progress

| ID | Test Case | Steps | Expected Result | Pass/Fail |
|----|-----------|-------|-----------------|-----------|
| GOALS-001 | Goals page loads | 1. Navigate to /goals | Goals list displayed | |
| GOALS-002 | Add goal for person | 1. Click "Add Goal" 2. Enter goal details 3. Assign to person 4. Save | Goal created | |
| GOALS-003 | Record goal progress | 1. Open a goal 2. Add progress update 3. Save | Progress recorded with date | |
| GOALS-004 | View goal timeline | 1. Open a goal 2. Check timeline | All progress updates shown in order | |
| GOALS-005 | Complete goal | 1. Mark goal as completed | Goal status changed to completed | |
| GOALS-006 | Goal metrics | 1. Set target metric 2. Record current value | Progress bar reflects actual vs target | |

---

## 10. Memory Book

| ID | Test Case | Steps | Expected Result | Pass/Fail |
|----|-----------|-------|-----------------|-----------|
| MEM-001 | Memory book loads | 1. Open person profile 2. Click Memory Book tab | Memory book displayed | |
| MEM-002 | Add memory entry | 1. Add entry with title, description, photo 2. Save | Entry saved with timestamp | |
| MEM-003 | View memory entries | 1. Check memory book | All entries shown in reverse chronological order | |
| MEM-004 | Share with family | 1. Mark entry as "Share with family" | Entry visible in family portal | |

---

## 11. eMAR & Medication

| ID | Test Case | Steps | Expected Result | Pass/Fail |
|----|-----------|-------|-----------------|-----------|
| EMAR-001 | eMAR page loads | 1. Navigate to /emedication | 31-day medication chart displayed | |
| EMAR-002 | Add medication record | 1. Add new medication 2. Enter name, dosage, frequency, time 3. Save | Medication record created | |
| EMAR-003 | Administer medication | 1. Click on scheduled dose 2. Record administration 3. Save | Dose marked as administered with timestamp | |
| EMAR-004 | Mark dose as refused | 1. Click on scheduled dose 2. Mark as refused 3. Enter reason | Dose marked as refused | |
| EMAR-005 | Mark dose as missed | 1. Click on scheduled dose 2. Mark as missed | Dose marked as missed, alert generated | |
| EMAR-006 | PRN medication | 1. Add PRN medication 2. Administer as needed | PRN doses recorded separately | |
| EMAR-007 | Stock count | 1. Go to stock tab 2. Record current stock level | Stock count saved | |
| EMAR-008 | Daily medication count | 1. Perform end-of-day count 2. Enter physical count | Count recorded, discrepancy flagged if any | |
| EMAR-009 | Reorder alert | 1. Stock drops below reorder level | Alert generated for low stock | |
| EMAR-010 | Medication audit trail | 1. View medication history | All administrations logged with staff name and time | |
| EMAR-011 | Archived MAR | 1. Navigate to /emedication/archived | Past month records viewable | |
| EMAR-012 | Late medication alert | 1. Medication not administered within 30 min of schedule | High-severity alert generated in Mission Control | |
| EMAR-013 | Missed medication event | 1. Medication marked as missed | Critical alert generated, outbox notification drafted | |

---

## 12. Staff Directory & Profiles

| ID | Test Case | Steps | Expected Result | Pass/Fail |
|----|-----------|-------|-----------------|-----------|
| STAFF-001 | Staff directory loads | 1. Navigate to /staff | Staff list displayed | |
| STAFF-002 | Search staff | 1. Type name in search | Filtered results appear | |
| STAFF-003 | Add staff member | 1. Click "Add Staff" 2. Enter details 3. Invite | Staff member created, invitation sent | |
| STAFF-004 | View staff profile | 1. Click on a staff member | Profile loads with compliance status | |
| STAFF-005 | Edit staff details | 1. Edit role, contact info 2. Save | Changes saved | |
| STAFF-006 | Deactivate staff | 1. Deactivate a staff member | Staff marked inactive | |
| STAFF-007 | Staff compliance overview | 1. View staff profile | Compliance percentage shown with breakdown | |

---

## 13. Training & Competency

| ID | Test Case | Steps | Expected Result | Pass/Fail |
|----|-----------|-------|-----------------|-----------|
| TRAIN-001 | Training matrix loads | 1. Navigate to /compliance/training | Training matrix displayed | |
| TRAIN-002 | Add training module | 1. Create training module 2. Set expiry period | Module created | |
| TRAIN-003 | Record training completion | 1. Mark staff as completed 2. Enter date and expiry | Record saved | |
| TRAIN-004 | Training expiry tracking | 1. View training matrix | Expiring items highlighted (30-day warning) | |
| TRAIN-005 | Training alerts | 1. Training expires | Alert generated in Mission Control | |
| TRAIN-006 | Competency assessments | 1. Navigate to /compliance/competency | Assessment list displayed | |
| TRAIN-007 | Create competency assessment | 1. Create assessment 2. Assign to staff | Assessment created | |
| TRAIN-008 | Complete competency assessment | 1. Record assessment results 2. Save | Results saved with evidence | |

---

## 14. DBS & Identity Checks

| ID | Test Case | Steps | Expected Result | Pass/Fail |
|----|-----------|-------|-----------------|-----------|
| DBS-001 | Identity monitoring loads | 1. Navigate to /compliance/identity | Staff identity status displayed | |
| DBS-002 | Record DBS check | 1. Add DBS record 2. Enter type, date, expiry | Record saved | |
| DBS-003 | DBS expiry tracking | 1. View identity monitoring | Expiring DBS checks highlighted | |
| DBS-004 | DBS expiry alert | 1. DBS check expires | Critical alert in Mission Control | |
| DBS-005 | Upload identity document | 1. Upload ID document 2. Set type and expiry | Document uploaded, tracked | |

---

## 15. Compliance Records

| ID | Test Case | Steps | Expected Result | Pass/Fail |
|----|-----------|-------|-----------------|-----------|
| COMP-001 | Compliance records loads | 1. Navigate to /compliance/records | Compliance records displayed | |
| COMP-002 | Add compliance record | 1. Create record 2. Assign to staff | Record created | |
| COMP-003 | Mark record complete | 1. Mark record as complete 2. Upload evidence | Record updated with completion date | |
| COMP-004 | Compliance profiles | 1. Go to Settings > Compliance Profiles | Profiles listed | |
| COMP-005 | Create compliance profile | 1. Create profile 2. Add requirements | Profile created | |
| COMP-006 | Auto-assign profiles | 1. Click "Auto-assign profiles" | Profiles assigned to staff based on role | |
| COMP-007 | Seed compliance records | 1. Click "Seed Records" | Records auto-created for all staff | |

---

## 16. Rota Planner

| ID | Test Case | Steps | Expected Result | Pass/Fail |
|----|-----------|-------|-----------------|-----------|
| ROTA-001 | Rota planner loads | 1. Navigate to /scheduling | Week grid displayed | |
| ROTA-002 | Create shift | 1. Click on empty slot 2. Enter shift details 3. Save | Shift created on grid | |
| ROTA-003 | Assign staff to shift | 1. Click shift 2. Select staff member | Staff assigned, shift status changes to "filled" | |
| ROTA-004 | Unassign staff | 1. Click assigned shift 2. Remove staff | Staff removed, shift becomes "open" | |
| ROTA-005 | Safe staffing rules | 1. Try assigning staff below compliance threshold | Assignment blocked with warning | |
| ROTA-006 | Copy shift | 1. Right-click shift 2. Copy to another day | Shift copied | |
| ROTA-007 | Delete shift | 1. Delete a shift | Shift removed from grid | |
| ROTA-008 | Weekly view | 1. View weekly rota | Full week grid visible | |
| ROTA-009 | Unfilled shift alert | 1. Shift has no staff assigned | Alert generated in Mission Control | |

---

## 17. Day Board & Timeline Views

| ID | Test Case | Steps | Expected Result | Pass/Fail |
|----|-----------|-------|-----------------|-----------|
| DAYBOARD-001 | Day board loads | 1. Navigate to Day Board view | Current day shifts displayed as cards | |
| DAYBOARD-002 | Shift details | 1. Click on a shift card | Detail dialog opens with full info | |
| DAYBOARD-003 | Timeline view | 1. Switch to Timeline view | Shifts displayed on timeline | |
| DAYBOARD-004 | Filter by location | 1. Select location filter | Only shifts for that location shown | |

---

## 18. Shift Marketplace

| ID | Test Case | Steps | Expected Result | Pass/Fail |
|----|-----------|-------|-----------------|-----------|
| MKT-001 | Marketplace loads | 1. Navigate to /shift-marketplace | Open shifts listed | |
| MKT-002 | Claim shift | 1. Click "Claim" on an open shift | Shift assigned to current user | |
| MKT-003 | View claimed shifts | 1. Check "My Shifts" | Claimed shifts listed | |
| MKT-004 | Release shift | 1. Release a claimed shift | Shift becomes open again | |

---

## 19. Overtime Claims

| ID | Test Case | Steps | Expected Result | Pass/Fail |
|----|-----------|-------|-----------------|-----------|
| OT-001 | Overtime page loads | 1. Navigate to /scheduling/overtime | Overtime claims listed | |
| OT-002 | Submit overtime claim | 1. Submit claim 2. Enter hours and reason | Claim submitted for approval | |
| OT-003 | Approve overtime claim | 1. Manager approves claim | Claim approved, shift updated | |
| OT-004 | Reject overtime claim | 1. Manager rejects claim | Claim rejected with reason | |

---

## 20. Leave Management

| ID | Test Case | Steps | Expected Result | Pass/Fail |
|----|-----------|-------|-----------------|-----------|
| LEAVE-001 | Leave manager loads | 1. Navigate to /leave | Leave calendar and requests displayed | |
| LEAVE-002 | Request leave | 1. Click "Request Leave" 2. Select dates 3. Submit | Leave request created | |
| LEAVE-003 | Approve leave | 1. Manager approves request | Leave approved, calendar updated | |
| LEAVE-004 | Reject leave | 1. Manager rejects request | Leave rejected with reason | |
| LEAVE-005 | Cancel leave request | 1. Staff cancels pending request (before approval) | Request cancelled | |
| LEAVE-006 | Leave balance | 1. Check leave balance | Correct balance shown | |
| LEAVE-007 | Leave types | 1. Go to Settings > Leave Types | Custom leave types listed | |
| LEAVE-008 | Add leave type | 1. Create leave type 2. Set colour and duration | Type created | |
| LEAVE-009 | Delegation on leave | 1. Manager on leave sets delegate | Delegate receives notifications | |

---

## 21. Incidents & Safeguarding

| ID | Test Case | Steps | Expected Result | Pass/Fail |
|----|-----------|-------|-----------------|-----------|
| INC-001 | Incident directory loads | 1. Navigate to /incidents | Incident list displayed | |
| INC-002 | Report incident | 1. Click "Report Incident" 2. Enter details 3. Set severity 4. Save | Incident created | |
| INC-003 | Incident detail | 1. Click on incident | Full incident detail page loads | |
| INC-004 | Add action to incident | 1. Add action item 2. Assign to staff 3. Set due date | Action created | |
| INC-005 | Complete action | 1. Mark action as complete 2. Add notes | Action completed | |
| INC-006 | Overdue action alert | 1. Action due date passes | High-severity alert in Mission Control | |
| INC-007 | Incident status tracking | 1. Update incident status | Status changes logged | |
| INC-008 | Incident categories | 1. Go to Settings > Incident Categories | Categories listed | |
| INC-009 | Add incident category | 1. Create category | Category created | |
| INC-010 | Incident audit trail | 1. View incident | All changes logged | |

---

## 22. Room Checks

| ID | Test Case | Steps | Expected Result | Pass/Fail |
|----|-----------|-------|-----------------|-----------|
| ROOM-001 | Room checks page loads | 1. Navigate to /room-checks | Room check schedule displayed | |
| ROOM-002 | Perform room check | 1. Select room 2. Complete checklist 3. Submit | Check recorded | |
| ROOM-003 | Room check history | 1. View check history | Past checks listed | |
| ROOM-004 | Missed room check | 1. Room check not completed on time | Alert generated | |

---

## 23. Tasks

| ID | Test Case | Steps | Expected Result | Pass/Fail |
|----|-----------|-------|-----------------|-----------|
| TASK-001 | Tasks page loads | 1. Navigate to /tasks | Task list displayed | |
| TASK-002 | Create task | 1. Click "Create Task" 2. Enter title, description 3. Assign to staff 4. Set due date 5. Save | Task created | |
| TASK-003 | Task frequency | 1. Set task frequency (daily/weekly/monthly/yearly) | Recurrence set | |
| TASK-004 | Complete task | 1. Open task 2. Mark as completed 3. Add notes | Task marked complete with timestamp | |
| TASK-005 | Task detail view | 1. Click on a task | Full task detail shown with notes | |
| TASK-006 | Add note to task | 1. Open task 2. Add note | Note saved with author and timestamp | |
| TASK-007 | Task filtering | 1. Filter by status/assignee/date | Filtered results shown | |
| TASK-008 | Delete task | 1. Delete a task | Task removed | |

---

## 24. Appointments

| ID | Test Case | Steps | Expected Result | Pass/Fail |
|----|-----------|-------|-----------------|-----------|
| APT-001 | Appointments page loads | 1. Navigate to /appointments | Appointment list/calendar displayed | |
| APT-002 | Create appointment | 1. Click "New Appointment" 2. Enter details (person, staff, date, time) 3. Save | Appointment created | |
| APT-003 | Appointment frequency | 1. Set frequency (once/daily/weekly/monthly/yearly) | Recurrence set | |
| APT-004 | Complete appointment | 1. Open appointment 2. Mark as completed 3. Add notes | Appointment completed with notes | |
| APT-005 | Follow-up appointment | 1. Complete appointment 2. Add follow-up | Follow-up appointment created | |
| APT-006 | Cancel appointment | 1. Cancel an appointment | Status changed to cancelled | |
| APT-007 | Appointment detail | 1. Click on appointment | Full detail shown with person and staff info | |
| APT-008 | Add note to appointment | 1. Add note | Note saved | |
| APT-009 | View by date | 1. Filter by specific date | Appointments for that date shown | |

---

## 25. Chat & Messaging

| ID | Test Case | Steps | Expected Result | Pass/Fail |
|----|-----------|-------|-----------------|-----------|
| CHAT-001 | Chat page loads | 1. Navigate to /chat | Channel list and messages displayed | |
| CHAT-002 | Send message | 1. Select a channel 2. Type message 3. Send | Message sent and displayed | |
| CHAT-003 | Create group channel | 1. Click "Create Group" 2. Enter name 3. Add members 4. Save | Group created | |
| CHAT-004 | Start DM | 1. Click "Start DM" 2. Select staff member | DM channel created | |
| CHAT-005 | Share file | 1. Attach file to message 2. Send | File shared with preview | |
| CHAT-006 | View shared files | 1. Click "Shared Files" in channel | All shared files listed | |
| CHAT-007 | Message read receipts | 1. Send message 2. Other user reads it | Read status shown | |
| CHAT-008 | Member management | 1. Open member list 2. Add/remove members | Members updated | |
| CHAT-009 | Link preview | 1. Paste URL in message | Link preview generated | |
| CHAT-010 | Message reply | 1. Reply to a specific message | Thread shown | |

---

## 26. Notifications

| ID | Test Case | Steps | Expected Result | Pass/Fail |
|----|-----------|-------|-----------------|-----------|
| NOTIF-001 | Notifications bell | 1. Check notification icon | Badge shows unread count | |
| NOTIF-002 | View notifications | 1. Click notification bell | Notification list displayed | |
| NOTIF-003 | Mark as read | 1. Click notification | Marked as read, count decreases | |
| NOTIF-004 | Notification preferences | 1. Go to Settings > Notifications | Preferences displayed | |
| NOTIF-005 | Update preferences | 1. Toggle notification types 2. Save | Preferences saved | |
| NOTIF-006 | Missed medication notification | 1. Medication missed | On-duty staff notified | |

---

## 27. Expenses

| ID | Test Case | Steps | Expected Result | Pass/Fail |
|----|-----------|-------|-----------------|-----------|
| EXP-001 | Expenses page loads | 1. Navigate to /expenses | Expense list displayed | |
| EXP-002 | Add expense | 1. Click "Add Expense" 2. Enter amount, category, description 3. Save | Expense recorded | |
| EXP-003 | Expense categories | 1. View expense categories | Categories listed | |
| EXP-004 | Top-up house | 1. Click "Top-up" 2. Select "House" 3. Select location 4. Enter amount | House top-up recorded | |
| EXP-005 | Top-up person | 1. Click "Top-up" 2. Select "Person" 3. Select person 4. Enter amount | Person top-up recorded | |
| EXP-006 | Reconcile location | 1. Select location 2. Enter physical cash amount 3. Reconcile | Cash balance reconciled | |
| EXP-007 | Reconcile person | 1. Select person 2. Enter physical cash amount 3. Reconcile | Person cash reconciled | |
| EXP-008 | Daily cash balance check | 1. View daily cash check | Date, expected amount, physical cash for each person/location shown | |
| EXP-009 | Download expenses report | 1. Click "Download Report" | PDF/CSV generated | |
| EXP-010 | Expense filtering | 1. Filter by date/category/location | Filtered results shown | |

---

## 28. Policies & Procedures

| ID | Test Case | Steps | Expected Result | Pass/Fail |
|----|-----------|-------|-----------------|-----------|
| POL-001 | Policies page loads | 1. Navigate to /policies | Policy list displayed | |
| POL-002 | View policy | 1. Click on a policy | Full policy content displayed | |
| POL-003 | Create policy | 1. Click "Create Policy" 2. Enter title, content, category 3. Save | Policy created | |
| POL-004 | Edit policy | 1. Edit policy content 2. Save | Policy updated (version tracked) | |
| POL-005 | Policy review due | 1. Policy review date arrives | Alert generated in Mission Control | |
| POL-006 | Download policy | 1. Click download | PDF generated | |
| POL-007 | Share policy | 1. Share policy with staff | Notification sent | |
| POL-008 | Policy categories | 1. Filter by category | Policies filtered | |
| POL-009 | Default policies | 1. View policies page | Default policies loaded (not blank page) | |
| POL-010 | Delete policy | 1. Delete a policy | Policy removed | |

---

## 29. Agencies Management

| ID | Test Case | Steps | Expected Result | Pass/Fail |
|----|-----------|-------|-----------------|-----------|
| AG-001 | Agencies page loads | 1. Navigate to /agencies | Agency list displayed | |
| AG-002 | Add agency | 1. Click "Add Agency" 2. Enter name, contact, rates 3. Save | Agency created | |
| AG-003 | Agency detail | 1. Click on agency | Agency detail page loads | |
| AG-004 | Agency rates | 1. View/edit agency rates | Rates displayed and editable | |
| AG-005 | Agency workers | 1. View agency workers | Workers from agency listed | |
| AG-006 | Agency location | 1. Set agency location | Location saved | |
| AG-007 | Agency ratings | 1. Rate an agency | Rating saved | |
| AG-008 | Delete agency | 1. Delete an agency | Agency removed | |

---

## 30. Compliance Dashboard

| ID | Test Case | Steps | Expected Result | Pass/Fail |
|----|-----------|-------|-----------------|-----------|
| CDASH-001 | Compliance dashboard loads | 1. Navigate to /compliance | Overall compliance score displayed | |
| CDASH-002 | Domain scores | 1. View CQC domain scores | Scores shown for Safe, Effective, Caring, Responsive, Well-led | |
| CDASH-003 | Staff compliance breakdown | 1. View staff breakdown | Per-staff compliance status shown | |
| CDASH-004 | Compliance trends | 1. View compliance trends | Score trends over time displayed | |
| CDASH-005 | Nutrition compliance | 1. View nutrition section | Dietary compliance data shown | |

---

## 31. CQC Readiness

| ID | Test Case | Steps | Expected Result | Pass/Fail |
|----|-----------|-------|-----------------|-----------|
| CQC-001 | CQC readiness page loads | 1. Navigate to /compliance/cqc | CQC readiness score displayed | |
| CQC-002 | KLOE assessment | 1. View KLOE assessments | All key lines of enquiry scored | |
| CQC-003 | Evidence gaps | 1. View evidence gaps | Missing evidence highlighted | |

---

## 32. Evidence Packs

| ID | Test Case | Steps | Expected Result | Pass/Fail |
|----|-----------|-------|-----------------|-----------|
| EP-001 | Evidence packs page loads | 1. Navigate to /compliance/evidence-packs | Pack list displayed | |
| EP-002 | Generate evidence pack | 1. Click "Generate Pack" 2. Select parameters | Pack generated | |
| EP-003 | Download evidence pack | 1. Download generated pack | PDF downloaded with evidence | |
| EP-004 | Auto-generated pack | 1. Enable auto-generation in Settings | Pack generated on schedule | |

---

## 33. Satisfaction Surveys

| ID | Test Case | Steps | Expected Result | Pass/Fail |
|----|-----------|-------|-----------------|-----------|
| SURV-001 | Surveys page loads | 1. Navigate to /compliance/surveys | Survey list displayed | |
| SURV-002 | Create survey | 1. Create survey with questions | Survey created | |
| SURV-003 | Send survey | 1. Send survey to people/families | Survey sent via email | |
| SURV-004 | Complete survey | 1. Open survey link 2. Answer questions 3. Submit | Survey submitted | |
| SURV-005 | View results | 1. View survey results | Results displayed with averages | |

---

## 34. DSPT Self-Assessment

| ID | Test Case | Steps | Expected Result | Pass/Fail |
|----|-----------|-------|-----------------|-----------|
| DSPT-001 | DSPT page loads | 1. Navigate to /dspt | DSPT assessment displayed | |
| DSPT-002 | Answer DSPT questions | 1. Answer each of the 10 data security standards | Answers saved | |
| DSPT-003 | Submit DSPT | 1. Submit assessment | Assessment submitted | |
| DSPT-004 | DSPT status | 1. View DSPT status | Status shown (Not Started / In Progress / Submitted / Standards Met) | |

---

## 35. Reporting & Analytics

| ID | Test Case | Steps | Expected Result | Pass/Fail |
|----|-----------|-------|-----------------|-----------|
| RPT-001 | Reporting page loads | 1. Navigate to /reporting | Report list displayed | |
| RPT-002 | Generate staff report | 1. Select "Staff Report" 2. Set parameters 3. Generate | Report generated | |
| RPT-003 | Generate compliance report | 1. Select "Compliance Report" 2. Generate | Report generated with compliance data | |
| RPT-004 | Generate medication report | 1. Select "Medication Report" 2. Generate | Report generated | |
| RPT-005 | Generate incident report | 1. Select "Incident Report" 2. Generate | Report generated | |
| RPT-006 | Generate nutrition report | 1. Select "Nutrition Report" 2. Generate | Report generated with dietary compliance | |
| RPT-007 | Download report as PDF | 1. Click download | PDF downloaded | |
| RPT-008 | Report builder | 1. Go to Report Builder 2. Customise columns 3. Generate | Custom report generated | |
| RPT-009 | Care outcome reports | 1. Generate care outcome report | Report with care outcome data generated | |

---

## 36. Insights

| ID | Test Case | Steps | Expected Result | Pass/Fail |
|----|-----------|-------|-----------------|-----------|
| INS-001 | Insights page loads | 1. Navigate to /insights | Analytics dashboard displayed | |
| INS-002 | Staff analytics | 1. View staff analytics | Headcount trends, turnover rates shown | |
| INS-003 | People analytics | 1. View people analytics | Admissions, discharges, active counts shown | |
| INS-004 | Operational metrics | 1. View operational metrics | Shift fill rates, leave utilisation, incident frequency shown | |

---

## 37. Mission Control

| ID | Test Case | Steps | Expected Result | Pass/Fail |
|----|-----------|-------|-----------------|-----------|
| MC-001 | Mission Control loads | 1. Navigate to /mission-control | Alert summary and feed displayed | |
| MC-002 | Severity counts | 1. Check severity bar | Critical, High, Medium, Low counts correct | |
| MC-003 | Category cards | 1. Check category cards | Medication, Staffing, Compliance, Care counts shown | |
| MC-004 | Filter by severity | 1. Select "Critical" severity filter | Only critical alerts shown | |
| MC-005 | Filter by category | 1. Select "Medication" category | Only medication alerts shown | |
| MC-006 | Clear filters | 1. Click "Clear" | All alerts shown again | |
| MC-007 | Dismiss alert | 1. Click dismiss on an alert | Alert removed from feed | |
| MC-008 | Batch dismiss | 1. Select multiple alerts 2. Click "Dismiss N" | All selected alerts dismissed | |
| MC-009 | Select all | 1. Click "Select all" | All alerts selected | |
| MC-010 | Assign alert | 1. Click assign icon 2. Select staff member | Alert assigned, chip shown | |
| MC-011 | Navigate to alert | 1. Click "Go to detail" on alert | Navigates to relevant module | |
| MC-012 | Alert history tab | 1. Click "History" tab | Dismissed alerts shown with timestamps | |
| MC-013 | Trends tab | 1. Click "Trends" tab | This week vs last week comparison shown | |
| MC-014 | Trend delta | 1. Check change percentages | Correct delta calculated | |
| MC-015 | Daily trend chart | 1. Check 14-day chart | Daily bar chart with severity breakdown | |
| MC-016 | Refresh | 1. Click refresh button | Data reloaded | |
| MC-017 | All clear state | 1. No alerts present | "All clear" message displayed | |

---

## 38. Billing & Subscriptions

| ID | Test Case | Steps | Expected Result | Pass/Fail |
|----|-----------|-------|-----------------|-----------|
| BILL-001 | Billing page loads | 1. Navigate to /billing | Current plan and billing info displayed | |
| BILL-002 | View plans | 1. View pricing plans | Starter, Professional, Enterprise plans shown | |
| BILL-003 | Upgrade plan | 1. Click "Upgrade" 2. Select plan 3. Enter payment via Stripe | Plan upgraded, Stripe checkout completed | |
| BILL-004 | Downgrade plan | 1. Click "Downgrade" 2. Confirm | Plan downgraded at end of billing period | |
| BILL-005 | Cancel subscription | 1. Click "Cancel" 2. Confirm | Subscription cancelled, access until period end | |
| BILL-006 | Payment history | 1. View payment history | Past invoices listed | |
| BILL-007 | Update payment method | 1. Update card details via Stripe | Payment method updated | |
| BILL-008 | Invoice download | 1. Download invoice | PDF invoice downloaded | |

---

## 39. Settings

| ID | Test Case | Steps | Expected Result | Pass/Fail |
|----|-----------|-------|-----------------|-----------|
| SET-001 | Settings page loads | 1. Navigate to /settings | Settings tabs displayed | |
| SET-002 | Profile tab | 1. View profile tab | Personal info displayed | |
| SET-003 | Edit profile | 1. Change name/phone/address 2. Save | Profile updated | |
| SET-004 | Upload profile picture | 1. Upload photo | Photo updated | |
| SET-005 | Security tab | 1. View security tab | MFA options displayed | |
| SET-006 | Appearance tab | 1. View appearance tab | Theme and zoom options shown | |
| SET-007 | Toggle dark mode | 1. Click Dark mode | Theme switches to dark | |
| SET-008 | Toggle light mode | 1. Click Light mode | Theme switches to light | |
| SET-009 | Change zoom | 1. Select zoom level | Interface scale changes | |
| SET-010 | Org settings tab | 1. View org settings | Org details, branding, security shown | |
| SET-011 | Edit org details | 1. Change org name 2. Save | Org name updated | |
| SET-012 | Branding | 1. Upload logo 2. Change colours 3. Save | Branding applied | |
| SET-013 | Security policies | 1. Toggle "Force MFA" 2. Save | Setting saved | |
| SET-014 | Staffing rules | 1. Set minimum compliance % 2. Save | Rule applied | |
| SET-015 | Compliance notifications | 1. Toggle daily digest 2. Save | Setting saved | |
| SET-016 | Medication alerts | 1. Toggle reorder alerts 2. Set delay 3. Save | Alerts configured | |
| SET-017 | Daily medication counts | 1. Set count convention 2. Save | Convention saved | |
| SET-018 | AI tab | 1. View AI tab | AI configuration displayed | |
| SET-019 | Enable AI | 1. Toggle "Enable AI Features" 2. Enter API key 3. Save | AI enabled | |
| SET-020 | Toggle AI features | 1. Toggle individual features | Each toggle auto-saves immediately | |
| SET-021 | Compliance config tab | 1. View compliance config | Config items listed | |
| SET-022 | Add compliance config | 1. Add new requirement | Requirement created | |
| SET-023 | Leave types tab | 1. View leave types | Custom leave types listed | |
| SET-024 | Incident categories tab | 1. View incident categories | Categories listed | |
| SET-025 | Deactivate account | 1. Click "Deactivate Account" 2. Confirm | Account deactivated, logged out | |

---

## 40. Permissions & Roles

| ID | Test Case | Steps | Expected Result | Pass/Fail |
|----|-----------|-------|-----------------|-----------|
| PERM-001 | View user permissions | 1. Go to staff profile 2. View permissions | Permission matrix displayed | |
| PERM-002 | Update permissions | 1. Toggle module access 2. Save | Permissions updated | |
| PERM-003 | Role-based defaults | 1. Create new user with role | Default permissions set based on role | |
| PERM-004 | Module access restriction | 1. Restrict module for user 2. User tries to access | Access denied, module hidden from nav | |

---

## 41. Family Portal

| ID | Test Case | Steps | Expected Result | Pass/Fail |
|----|-----------|-------|-----------------|-----------|
| FAM-001 | Family portal accessible | 1. Log in as family member | Portal dashboard displayed | |
| FAM-002 | View care notes | 1. View care notes | Shared care notes displayed | |
| FAM-003 | View care plans | 1. View care plans | Shared care plans displayed | |
| FAM-004 | View goals | 1. View goals | Person's goals shown | |
| FAM-005 | View memory book | 1. View memory book | Shared memory entries displayed | |

---

## 42. Compliance Portal

| ID | Test Case | Steps | Expected Result | Pass/Fail |
|----|-----------|-------|-----------------|-----------|
| CPORT-001 | Compliance portal accessible | 1. Log in as compliance officer | Portal dashboard displayed | |
| CPORT-002 | View compliance feed | 1. View compliance feed | Recent compliance events shown | |
| CPORT-003 | Nutrition compliance data | 1. View nutrition section | Dietary compliance data shown | |
| CPORT-004 | Evidence packs view | 1. View evidence packs | Generated packs downloadable | |

---

## 43. Mobile Features

| ID | Test Case | Steps | Expected Result | Pass/Fail |
|----|-----------|-------|-----------------|-----------|
| MOB-001 | Mobile check-in | 1. Navigate to /mobile/check-in 2. Check in with GPS | Check-in recorded with location | |
| MOB-002 | Mobile notes | 1. Navigate to /mobile/notes 2. Record care note | Note saved | |
| MOB-003 | Voice note | 1. Record voice note 2. Save | Voice note saved | |
| MOB-004 | Mobile eMAR | 1. Access eMAR on mobile 2. Record administration | Administration recorded | |

---

## 44. Marketing Pages

| ID | Test Case | Steps | Expected Result | Pass/Fail |
|----|-----------|-------|-----------------|-----------|
| MKT-001 | Landing page loads | 1. Navigate to / | Hero, features, trust strip visible | |
| MKT-002 | Features page | 1. Navigate to /features | All feature sections displayed | |
| MKT-003 | Pricing page | 1. Navigate to /pricing | Three pricing tiers shown | |
| MKT-004 | About page | 1. Navigate to /about | About content displayed | |
| MKT-005 | Contact page | 1. Navigate to /contact | Contact form displayed | |
| MKT-006 | Contact form submit | 1. Fill form 2. Submit | Form submitted, confirmation shown | |
| MKT-007 | Blog page | 1. Navigate to /blog | Blog posts listed | |
| MKT-008 | Learning center | 1. Navigate to /learning | Learning articles listed | |
| MKT-009 | How it works | 1. Navigate to /how-it-works | How it works content displayed | |
| MKT-010 | Case studies | 1. Navigate to /case-studies | Case studies listed | |
| MKT-011 | Compliance badges | 1. Navigate to /compliance-badges | Regulatory body info displayed | |
| MKT-012 | Logo section | 1. View trust strip on landing page | Regulatory logos displayed on white background | |
| MKT-013 | SEO meta tags | 1. View page source | Title, description, canonical, structured data present | |
| MKT-014 | Responsive layout | 1. View on mobile viewport | Layout adapts correctly | |

---

## 45. API & Events

| ID | Test Case | Steps | Expected Result | Pass/Fail |
|----|-----------|-------|-----------------|-----------|
| API-001 | Auth endpoint | 1. POST /api/auth/login with valid credentials | JWT token returned | |
| API-002 | Auth endpoint — invalid | 1. POST /api/auth/login with wrong password | 401 returned | |
| API-003 | Protected endpoint | 1. GET /api/dashboard/stats without token | 401 returned | |
| API-004 | Rate limiting | 1. Send 100 requests in 1 second | Rate limit triggered, 429 returned | |
| API-005 | Event publishing | 1. Miss a medication dose | medication.administration_missed event published | |
| API-006 | Event consumer — Mission Control | 1. Event published | Alert created in mission_control_alerts table | |
| API-007 | Event deduplication | 1. Publish same event twice | Single alert updated, not duplicated | |
| API-008 | Event — incident action overdue | 1. Incident action past due | incident.action_overdue event published | |
| API-009 | Event — shift unfilled | 1. Shift with no staff | shift.unfilled event published | |
| API-010 | Event — training expiring | 1. Training within 30 days of expiry | training.expiring event published | |
| API-011 | Event — DBS expiring | 1. DBS within 30 days of expiry | dbs.expiring event published | |
| API-012 | Event — policy review due | 1. Policy past review date | policy.review_due event published | |
| API-013 | Event — care plan review due | 1. Care plan past review date | care_plan.review_due event published | |
| API-014 | Event — fluid intake below target | 1. Fluid intake below 70% of target | fluid.intake_below_target event published | |
| API-015 | Event — appetite decline | 1. Consecutive poor meals logged | nutrition.appetite_decline event published | |
| API-016 | Event — refused meal | 1. Meal refused | nutrition.refused_meal event published | |
| API-017 | WebSocket connection | 1. Connect to WebSocket | Connection established | |
| API-018 | WebSocket — real-time notification | 1. Trigger notification event | Notification delivered via WebSocket | |

---

## Cross-Cutting Concerns

| ID | Test Case | Steps | Expected Result | Pass/Fail |
|----|-----------|-------|-----------------|-----------|
| XC-001 | Data isolation | 1. Create data in Org A 2. Log in as Org B | Org B cannot see Org A data | |
| XC-002 | Audit trail | 1. Perform CRUD operations 2. Check audit log | All operations logged | |
| XC-003 | UK GDPR compliance | 1. Check data processing terms 2. Check retention | Terms accurate, retention periods correct | |
| XC-004 | CQC compliance | 1. Check compliance features | All 5 CQC domains covered | |
| XC-005 | Responsive design | 1. Test at 320px, 375px, 768px, 1024px, 1280px | Layout adapts at all breakpoints | |
| XC-006 | Accessibility | 1. Run axe accessibility audit | No critical violations | |
| XC-007 | Error handling | 1. Trigger API errors 2. Check UI | Graceful error messages, no crashes | |
| XC-008 | Loading states | 1. Observe page loads | Skeleton loaders shown during data fetching | |
| XC-009 | Empty states | 1. View pages with no data | Helpful empty states with CTAs | |
| XC-010 | Search functionality | 1. Search across modules | Results appear correctly | |
| XC-011 | Browser back/forward | 1. Navigate between pages 2. Use browser back | Correct page loads, no errors | |
| XC-012 | Session timeout | 1. Leave app idle for session duration | Session expired, redirect to login | |
| XC-013 | Multi-tab | 1. Open app in two tabs 2. Perform actions in one | Both tabs stay in sync | |
| XC-014 | Print pages | 1. Print compliance report 2. Print meal plan | Layout is print-friendly | |
| XC-015 | PDF generation | 1. Generate compliance PDF 2. Generate meal plan PDF | PDFs download correctly | |

---

## Test Execution Summary

| Module | Total Tests | Passed | Failed | Blocked |
|--------|------------|--------|--------|---------|
| Authentication & Account | 12 | | | |
| Multi-Factor Authentication | 6 | | | |
| Onboarding | 6 | | | |
| Dashboard | 15 | | | |
| People Directory & Profiles | 9 | | | |
| Health Tab | 8 | | | |
| Nutrition & Meals | 17 | | | |
| Body Mapping | 5 | | | |
| Goals & Progress | 6 | | | |
| Memory Book | 4 | | | |
| eMAR & Medication | 13 | | | |
| Staff Directory & Profiles | 7 | | | |
| Training & Competency | 8 | | | |
| DBS & Identity Checks | 5 | | | |
| Compliance Records | 7 | | | |
| Rota Planner | 9 | | | |
| Day Board & Timeline Views | 4 | | | |
| Shift Marketplace | 4 | | | |
| Overtime Claims | 4 | | | |
| Leave Management | 9 | | | |
| Incidents & Safeguarding | 10 | | | |
| Room Checks | 4 | | | |
| Tasks | 8 | | | |
| Appointments | 9 | | | |
| Chat & Messaging | 10 | | | |
| Notifications | 6 | | | |
| Expenses | 10 | | | |
| Policies & Procedures | 10 | | | |
| Agencies Management | 8 | | | |
| Compliance Dashboard | 5 | | | |
| CQC Readiness | 3 | | | |
| Evidence Packs | 4 | | | |
| Satisfaction Surveys | 5 | | | |
| DSPT Self-Assessment | 4 | | | |
| Reporting & Analytics | 9 | | | |
| Insights | 4 | | | |
| Mission Control | 17 | | | |
| Billing & Subscriptions | 8 | | | |
| Settings | 25 | | | |
| Permissions & Roles | 4 | | | |
| Family Portal | 5 | | | |
| Compliance Portal | 4 | | | |
| Mobile Features | 4 | | | |
| Marketing Pages | 14 | | | |
| API & Events | 18 | | | |
| Cross-Cutting Concerns | 15 | | | |
| **TOTAL** | **~400** | | | |

---

**Total Test Cases: ~400**
**Modules Covered: 45**
**Date Completed:** _______________
**Tester:** _______________
**Overall Result:** PASS / FAIL
**Notes:** _______________
