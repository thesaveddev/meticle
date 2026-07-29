export interface LearnSection {
  id: string; category: string; title: string; icon: string
  subsections: { id: string; title: string; content: string }[]
}

function h2(text: string) { return `<h2>${text}</h2>` }
function h3(text: string) { return `<h3>${text}</h3>` }
function p(text: string) { return `<p>${text}</p>` }
function li(text: string) { return `<li>${text}</li>` }
function ul(items: string[]) { return `<ul>${items.map(li).join('')}</ul>` }
function ol(items: string[]) { return `<ol>${items.map(li).join('')}</ol>` }
function tip(text: string) { return `<blockquote style="background:#EEF2FF;border-left:4px solid #0F4C81;padding:12px 16px;margin:16px 0;border-radius:4px"><strong>Tip:</strong> ${text}</blockquote>` }
function warn(text: string) { return `<blockquote style="background:#FEF3C7;border-left:4px solid #F59E0B;padding:12px 16px;margin:16px 0;border-radius:4px"><strong>Important:</strong> ${text}</blockquote>` }
function step(n: number, text: string) { return `<p><strong>Step ${n}:</strong> ${text}</p>` }

const s: LearnSection[] = [

// ═══════════ 1. GETTING STARTED ═══════════
{ id:'getting-started', category:'Introduction', title:'Getting Started', icon:'🚀', subsections:[
{ id:'welcome', title:'Welcome to Meticle',
  content:
    p('Meticle is a compliance-first care management platform for supported living and domiciliary care providers across all four UK nations. It combines staff management, scheduling, medication administration (eMAR), service user care planning, and regulatory compliance into one integrated system.') +
    p('This Learning Center will walk you through every feature, button, and workflow step by step. Use the sidebar to navigate between modules and the search bar to find specific topics.') +
    h3('Who is this for?') +
    ul(['Registered Managers overseeing supported living or domiciliary care services','Care Coordinators managing rotas and appointments','Compliance Officers preparing for CQC/regulatory inspections','Care Workers documenting daily notes and administering medication','Administrators handling billing and staff onboarding']) +
    h3('Key Concepts') +
    ul(['<strong>Organisation:</strong> Your care provider entity. Everything in Meticle is scoped to your organisation — data from other orgs is never visible.','<strong>Roles:</strong> ORG_ADMIN (full access), MANAGER (location management), CARE_WORKER (frontline staff), COMPLIANCE_OFFICER (audit and compliance), NURSE, SUPPORT_WORKER.','<strong>Locations:</strong> Physical care settings (supported living houses, offices, etc.). Each has its own minimum staffing rules.','<strong>Service Users:</strong> The people receiving care. Each person has a full profile with care plans, daily notes, health records, and more.','<strong>Regulator:</strong> Your governing body — CQC (England), CIW (Wales), Care Inspectorate (Scotland), or RQIA (Northern Ireland). This setting affects how compliance is scored.'])
},
{ id:'login', title:'Login, MFA & Account Security',
  content:
    h2('How to Log In') +
    step(1,'Navigate to your organisation\'s Meticle URL (e.g., <code>yourorg.meticlecare.com</code> or the self-hosted URL provided by your administrator).') +
    step(2,'Enter your <strong>email address</strong> and <strong>password</strong>.') +
    step(3,'If MFA is enabled (see below), you will be prompted for a 6-digit code from your authenticator app.') +
    step(4,'Upon successful login, you land on the <strong>Dashboard</strong>.') +
    p('Passwords must be at least 12 characters and include an uppercase letter, a lowercase letter, a digit, and a special character. This is enforced on registration, password reset, and password change.') +
    h2('Multi-Factor Authentication (MFA)') +
    p('MFA adds a second layer of security beyond your password. After logging in with your password, you must also provide a time-based one-time code from an authenticator app.') +
    h3('Setting Up MFA for the First Time') +
    step(1,'After your first login, you will see the MFA setup screen automatically.') +
    step(2,'A <strong>QR code</strong> is displayed. Open your authenticator app (Google Authenticator, Microsoft Authenticator, Authy, etc.).') +
    step(3,'Scan the QR code. The app will add "Meticle" as an account and start displaying 6-digit codes that refresh every 30 seconds.') +
    step(4,'Enter the current 6-digit code in the "Verification Code" field and click <strong>Verify</strong>.') +
    step(5,'If successful, you will see a confirmation message. <strong>Save your backup codes</strong> — these are one-time use codes for when you cannot access your authenticator app.') +
    p('If the verification fails, an error message will appear inside the dialog telling you why. Common issues: code expired (codes refresh every 30 seconds), incorrect code entered, or QR code rescanned.') +
    h3('Disabling MFA') +
    p('To disable MFA, go to <strong>Settings → Security</strong>. You must enter your current TOTP code to confirm disabling. This prevents unauthorised MFA removal.') +
    warn('If you lose access to your authenticator app, you will need to contact an ORG_ADMIN to reset your MFA. Keep your backup codes in a safe place.') +
    h2('Forgot Password Flow') +
    step(1,'On the login page, click <strong>Forgot Password</strong>.') +
    step(2,'Enter your email address and click <strong>Send Reset Link</strong>.') +
    step(3,'Check your email for a message from Meticle containing a reset link.') +
    step(4,'Click the link to open the reset password page.') +
    step(5,'Enter your new password (min 12 chars, uppercase + lowercase + digit + special char) and confirm.') +
    step(6,'You will be redirected to the login page to sign in with your new password.') +
    h2('Role-Based Access Control') +
    p('Your role determines what you can see and do in Meticle. Roles are assigned by an ORG_ADMIN during staff creation and can be changed at any time from the Staff Directory.') +
    ul(['<strong>ORG_ADMIN:</strong> Full access to all modules. Can manage billing, change any user\'s role, configure organisation settings, promote other users to ORG_ADMIN.','<strong>MANAGER:</strong> Can manage staff, service users, scheduling, leave, and compliance. Cannot change their own role or access billing. Cannot approve their own leave.','<strong>CARE_WORKER:</strong> Sees simplified dashboard (own shifts only, no compliance snapshot). Can view service user profiles, record daily notes, administer medication, claim shifts. Cannot create/edit shifts or access settings.','<strong>COMPLIANCE_OFFICER:</strong> Access to compliance modules — training matrix, identity monitoring, competency, evidence packs, CQC readiness, surveys.','<strong>NURSE:</strong> Clinical access — health observations, eMAR administration, care assessments.','<strong>SUPPORT_WORKER:</strong> Basic access — view rota, service users, daily notes.']) +
    tip('Role changes take effect immediately without requiring logout. The system re-checks user roles on every page focus and periodically.')
},
{ id:'dashboard', title:'The Dashboard — Complete Walkthrough',
  content:
    h2('Dashboard Layout') +
    p('The Dashboard is your landing page after login and provides an at-a-glance overview of your organisation\'s key metrics. It is divided into several sections, each described below.') +
    h3('Top Row: Key Performance Indicators (KPIs)') +
    p('Seven KPI cards span the top of the dashboard:') +
    ul(['<strong>Total Staff:</strong> Number of active staff members in your organisation. Click to navigate to the <em>Staff Directory</em>.','<strong>Active People:</strong> Count of service users with status "active". Click to navigate to <em>Service Users</em>.','<strong>Staff on Duty:</strong> Number of staff with assigned shifts for today (counts shifts with status "assigned" or "accepted" that start today).','<strong>Compliance Rate:</strong> Your organisation\'s overall compliance percentage (completed compliance records ÷ total records). Click the card or the "View Full Report" button to navigate to the <em>Compliance Dashboard</em>.','<strong>Open Shifts:</strong> Number of unassigned shifts across all locations.','<strong>Alerts:</strong> Count of open incidents (status "reported" or "investigating").','<strong>Agency Saved:</strong> Placeholder for cost savings from filling shifts internally vs. using agencies (Phase 2 feature).']) +
    h3('Onboarding Checklist') +
    p('New organisations see a checklist guiding initial setup. Each item links to the relevant page:') +
    ul(['Add staff members → Staff Directory','Configure locations → Settings → Locations','Set minimum staffing rules → Settings → Organisation','Upload branding/logo → Settings → Branding','Set compliance profiles → Settings → Compliance','Invite your team → Staff Directory → Invite button']) +
    p('Completed items show a green checkmark. The checklist disappears once all items are complete.') +
    h3('Widget Row') +
    p('Below the KPIs, three widget cards show items needing attention:') +
    ul(['<strong>DBS Renewals Due:</strong> Count of approved identity documents (DBS, Passport, Visa, RTW) expiring within 30 days. Click to navigate to <em>Identity Monitoring</em>.','<strong>Training Expiring:</strong> Count of completed training records expiring within 30 days. Click to navigate to the <em>Training Matrix expiring tab</em>.','<strong>Pending Leave:</strong> Count of leave requests with status "pending". Click to navigate to the <em>Leave Manager — All Requests tab</em>.']) +
    h3('Compliance Snapshot') +
    p('Shows: active staff count, compliance rate percentage, and a "Needs Attention" count of staff below the minimum compliance threshold. The "View Full Report" button navigates to the Compliance Dashboard. <strong>CARE_WORKER role does not see this section.</strong>') +
    h3('Today\'s Rota') +
    p('A table of all shifts happening today. Columns: Staff Name, Location, Time, Status. CARE_WORKERs see only their own shifts. Managers and admins see all shifts across all locations.') +
    h3('Today\'s Appointments') +
    p('Lists all appointments scheduled for today with service user name, time, and status. Each appointment has a status chip: Scheduled (blue), In Progress (orange), Completed (green), Cancelled (grey).')
}
]},

// ═══════════ 2. SERVICE USERS ═══════════
{ id:'service-users', category:'Service Users', title:'Service Users Manager', icon:'👤', subsections:[
{ id:'su-directory', title:'Directory — Finding, Adding & Managing People',
  content:
    h2('Service User Directory Page') +
    p('The Service Users page (accessible from the sidebar) is your central hub for managing all people supported. It shows a paginated table of every service user in your organisation.') +
    h3('Table Columns') +
    ul(['<strong>Name:</strong> First and last name with a person icon. Click any row to open that person\'s profile.','<strong>Room:</strong> The person\'s room or bed number. Shows "—" if not set.','<strong>NHS Number:</strong> The person\'s NHS number. Shows "—" if not set.','<strong>DOB:</strong> Date of birth in DD/MM/YYYY format.','<strong>Status:</strong> Color-coded chip — Active (green), Discharged (grey), Deceased (red).','<strong>Care Plans:</strong> Number of active care plans for this person.','<strong>Open Risks:</strong> Number of high/critical risk assessments. Shows a red warning icon if greater than zero.']) +
    h3('Search & Filter') +
    step(1,'Use the <strong>search bar</strong> at the top to find people by first name, last name, or room number. The search is case-insensitive.') +
    step(2,'Use the <strong>Status dropdown</strong> to filter by All, Active, Discharged, or Deceased.') +
    p('Both filters can be used together — e.g., search for "John" with status "Active".') +
    h3('Adding a New Person') +
    step(1,'Click the <strong>Add Person</strong> button at the top right.') +
    step(2,'A dialog opens with the following fields:') +
    ul(['<strong>First Name</strong> (required)','<strong>Last Name</strong> (required)','<strong>Date of Birth</strong> — click the calendar picker or type in YYYY-MM-DD format','<strong>Status</strong> — dropdown: Active, Discharged, Deceased (defaults to Active)','<strong>NHS Number</strong> — free text, typically 10 digits','<strong>Room / Bed</strong> — free text, e.g., "Room 3" or "Bed A"','<strong>Allergies</strong> — enter as comma-separated values, e.g., "Penicillin, Latex, Peanuts". These will be stored as a list and displayed as red chips on the profile.']) +
    step(3,'Click <strong>Create Person</strong>. The button shows a loading spinner while saving.') +
    step(4,'On success, the dialog closes, the table refreshes, and the new person appears.') +
    p('Upon creation, an automatic Monthly Medication Administration Record (MAR) is generated for the new person — you don\'t need to create one manually.') +
    h3('Pagination') +
    p('The directory table is paginated. Use the controls at the bottom to:') +
    ul(['Change rows per page (5, 10, 25, 50)','Navigate to next/previous pages','See the total count of people matching your filters']) +
    h3('Removing a Person') +
    p('People cannot be deleted from the directory page. To "remove" a person, change their status to "Discharged" or "Deceased" from their profile page. Only ORG_ADMIN can hard-delete a service user via the API.') +
    tip('When creating a person, you can also set extended fields like GP details, pharmacy, and social worker information after creation by editing the profile. These fields are available in the "Edit Person" dialog on the profile page.')
},
{ id:'su-profile', title:'Profile Page — All 9 Tabs Explained',
  content:
    h2('Service User Profile Overview') +
    p('Clicking any person in the directory opens their profile page. The page has a header section with key info and photo upload, followed by 9 tabs for different aspects of care documentation.') +
    h3('Header Section') +
    ul(['<strong>Photo:</strong> Shows the person\'s photo if uploaded, otherwise shows initials. Click the camera icon overlay to upload a photo (JPEG, PNG, GIF, WebP). Photos are loaded securely via authenticated fetch. A loading spinner appears during upload.','<strong>Name:</strong> Full name in large text.','<strong>Room Chip:</strong> Shows room number if assigned, otherwise "No room assigned".','<strong>Status Chip:</strong> Green for Active, grey otherwise.','<strong>NHS Number:</strong> Displayed if set.','<strong>Edit Button:</strong> Opens the full edit dialog with all person fields (see below).']) +
    h2('Edit Person Dialog') +
    p('Clicking "Edit" in the header opens a comprehensive edit form with all fields organised into sections:') +
    ul(['<strong>Personal:</strong> First Name, Last Name, Date of Birth, NHS Number, Room, Status dropdown','<strong>GP Details:</strong> GP Name, GP Surgery, GP Phone, GP Email, GP Address, Dietary Requirements (multiline)','<strong>Pharmacy:</strong> Pharmacy Name, Pharmacy Phone, Pharmacy Address (multiline)','<strong>Social Worker:</strong> Name, Phone, Email']) +
    p('Changes are saved by clicking "Save" at the bottom of the dialog. The button shows a loading spinner while saving.') +
    h2('Tab 0 — Overview') +
    p('The default tab showing four information cards in a grid layout:') +
    ul(['<strong>Personal Details:</strong> DOB, calculated Age, NHS Number, Room','<strong>Medical & GP:</strong> GP Name, Surgery, Phone, Email, Address, Dietary Requirements','<strong>Pharmacy:</strong> Pharmacy Name, Phone, Address','<strong>Social Worker:</strong> Name, Phone, Email']) +
    p('If allergies are recorded, a red-bordered card appears below showing allergy chips.') +
    h2('Tab 1 — Care Plans') +
    p('Lists all care plans for this person as cards in a 2-column grid.') +
    p('<strong>Add Care Plan:</strong> Click "Add Care Plan" button. Fill in: Title (required), Category (dropdown: personal_care, medication, mobility, nutrition, mental_health, behaviour, social, other), Description (multiline), Risk Assessment (multiline text), Review Date (date picker).') +
    p('Each care plan card shows: Title, Category chip, Status chip (active/paused/archived), Description (if present), Review Date.') +
    h2('Tab 2 — Daily Notes') +
    p('Chronological list of daily care notes (up to 50 most recent, loaded from the server).') +
    p('<strong>Add Note:</strong> Click "Add Note". Fill in: Date (defaults to today), Shift (Day/Night dropdown), Category (wellbeing, nutrition, hydration, mobility, mood, medication, personal_care, other), Content (required, multiline).') +
    p('Each note shows: Shift chip (blue=day, grey=night), Category chip, Date, Author name, Content (preserves line breaks).') +
    h2('Tab 3 — Risk Assessments') +
    p('Table of risk assessments with columns: Type, Risk Level (color-coded chip), Details, Review Date.') +
    p('<strong>Add Assessment:</strong> Click "Add Assessment". Fill in: Type (falls, pressure_sore, nutrition, behaviour, mobility, medication, other), Risk Level (low/medium/high/critical — each has a distinct color), Details (multiline), Mitigation Actions (multiline), Review Date.') +
    h2('Tab 4 — Family & Contacts') +
    p('Card grid showing family contacts and emergency contacts.') +
    p('<strong>Add Contact:</strong> Fill in: Full Name (required), Relationship, Phone, Email, Emergency Contact toggle. Emergency contacts show a red left border.') +
    p('Each card has a delete icon. Click to remove the contact.') +
    h2('Tab 5 — Health') +
    p('Delegates to a sub-component with 4 sub-tabs:') +
    ul(['<strong>Observations:</strong> Record general health observations with date, category (general, skin, medication, sleep, pain, weight, other), notes, severity (normal/mild/moderate/severe). Add/delete per record.','<strong>Bowel Movements:</strong> Record date, time, Bristol stool type (1-7), color, frequency, consistency, notes.','<strong>Dental Records:</strong> Record checkup date, dentist name, findings, actions taken, next checkup date, notes.','<strong>Fluid Intake:</strong> Record date, time, amount in ml, fluid type, notes. A daily total is also shown.']) +
    p('Each sub-tab has an Add button and per-record delete button.') +
    h2('Tab 6 — Body Map') +
    p('Interactive front/back human body diagrams for recording skin conditions and wounds. Detailed in the <strong>Body Map</strong> section below.') +
    h2('Tab 7 — Memory Book') +
    p('Photo journal for documenting outings, activities, and special moments. Detailed in the <strong>Memory Book</strong> section.') +
    h2('Tab 8 — Goals') +
    p('Inline summary of service user goals. Shows stat cards (Total, Active, Completed, Avg Progress) and a list of goals with progress bars. "Manage Goals" button navigates to the full Goals page.') +
    h2('Tab 9 — Care Assessments') +
    p('Inline summary of care assessments. Shows stat cards (Total, Completed, Draft) and a table with assessment type, date, assessor, status, next review date. "Manage Assessments" button navigates to the full Care Assessments page.')
},
{ id:'su-body-map', title:'Body Map — Recording Skin Conditions',
  content:
    h2('How the Body Map Works') +
    p('The Body Map provides a visual way to document and track skin conditions, wounds, bruises, rashes, pressure sores, and other physical observations using interactive human body diagrams.') +
    h3('Front View vs Back View') +
    p('Use the <strong>Front View</strong> and <strong>Back View</strong> tabs above the body diagram to switch perspectives. The front view shows the face, chest, abdomen, arms, and front of legs. The back view shows the back of head, back, buttocks, and back of legs.') +
    h3('Adding a Body Map Entry') +
    step(1,'Click on any body zone on the diagram. A tooltip will show the zone name when you hover.') +
    step(2,'A dialog opens titled "New Entry — [Zone Name]". Fill in:') +
    ul(['<strong>Condition:</strong> Select from bruise, wound, rash, injection, burn, pressure_sore, scar, swelling, skin_tear, other. Each has a distinct color.','<strong>Severity:</strong> Mild (green), Moderate (amber), Severe (red).','<strong>Description:</strong> Free text — describe size, colour, shape, any treatment given. Be specific (e.g., "3cm diameter, purple-blue, tender to touch, no broken skin").','<strong>Recorded Date:</strong> Defaults to today. Change if documenting retrospectively.']) +
    step(3,'Click <strong>Save</strong>. A colored marker pin appears on the body at the zone location.') +
    h3('Viewing and Editing Entries') +
    ul(['Click any colored marker on the body to view its details and edit.','The latest active entry shows a pulsing ring animation around it.','Below the body diagram, a list shows all entries chronologically with condition type, severity, status, date, and description.','Click any entry in the list to open its edit dialog.']) +
    h3('Managing Entry Status') +
    ul(['<strong>Active:</strong> The condition is still present (red chip).','<strong>Healing:</strong> The condition is improving (amber chip).','<strong>Resolved:</strong> The condition has fully healed (green chip).','Change status from the edit dialog using the Status dropdown.']) +
    h3('Deleting Entries') +
    p('Open the entry\'s edit dialog and click the red delete icon at the bottom left. Confirm the deletion prompt.') +
    h3('Zone Legend') +
    p('Below the body diagram, a legend shows all body zones. Hover any chip to highlight the corresponding zone on the body. Chips with numbers (e.g., "L Thigh (2)") indicate active entries in that zone.') +
    tip('For documenting wound progression, add a new entry each time you assess the wound rather than editing the old one. This creates an audit trail over time. Use consistent descriptions so you can track changes.')
},
{ id:'su-memory-book', title:'Memory Book — Documenting Adventures',
  content:
    h2('Memory Book Overview') +
    p('The Memory Book is a photo-driven journal for documenting outings, activities, birthdays, and special moments. It is designed to be shared with family members.') +
    h3('Adding a Memory') +
    step(1,'Click <strong>Add Memory</strong>.') +
    step(2,'Fill in the form:') +
    ul(['<strong>Title:</strong> A descriptive name (e.g., "Trip to the Seaside" or "Sarah\'s Birthday Party")','<strong>Description:</strong> What happened, who was there, any special moments','<strong>Date:</strong> When the event took place (defaults to today)','<strong>Add Photo:</strong> Click the dashed "Add Photo" button to select an image. A preview appears. Click the X to remove and choose a different photo.']) +
    step(3,'Click <strong>Save</strong>.') +
    h3('Viewing Memories') +
    p('Memories are displayed as a responsive card grid. Each card shows:') +
    ul(['The photo (or a placeholder icon if no photo was uploaded)','Title','Description (truncated to 2 lines)','Date and author name']) +
    p('Click <strong>Edit</strong> (pencil icon) to modify a memory\'s title, description, or date.') +
    p('Click <strong>Delete</strong> (trash icon) and confirm to remove a memory.') +
    h3('Security & Privacy') +
    p('Photos are stored securely on the server and loaded via authenticated requests. They are not publicly accessible. Only staff with access to this service user\'s profile can view the Memory Book.') +
    tip('The Memory Book is great for CQC evidence of person-centred care and meaningful activity. Regular entries show inspectors that people are engaged and their wellbeing is prioritised.')
}
]},

// ═══════════ 3. STAFF MANAGEMENT ═══════════
{ id:'staff', category:'Staff Management', title:'Staff Directory & Profiles', icon:'👥', subsections:[
{ id:'staff-directory', title:'Staff Directory — Complete Guide',
  content:
    h2('Staff Directory Page') +
    p('The Staff Directory lists all staff in your organisation. It is accessible from the sidebar.') +
    h3('Table Columns') +
    ul(['<strong>Name:</strong> With avatar showing initials or profile photo','<strong>Email:</strong> The staff member\'s email address (unique across the entire platform)','<strong>Role:</strong> Color-coded chip — ORG_ADMIN (blue), MANAGER (purple), CARE_WORKER (green), COMPLIANCE_OFFICER (orange), NURSE (red), SUPPORT_WORKER (grey)','<strong>Location:</strong> Assigned location name (or "—" if unassigned)','<strong>Compliance:</strong> Progress bar showing compliance percentage (green ≥80%, amber 50-79%, red <50%)','<strong>Status:</strong> Active or Inactive']) +
    h3('Search & Filter') +
    ul(['<strong>Search bar:</strong> Filters by name (first name, last name, or full name). Case-insensitive.','<strong>Role dropdown:</strong> Filter to show only staff of a specific role.']) +
    h3('Inviting a New Staff Member') +
    step(1,'Click <strong>Add Staff Member</strong> at the top right.') +
    step(2,'A dialog opens with these fields:') +
    ul(['<strong>Email:</strong> The email address the invitation will be sent to. This email must be unique across the entire Meticle platform.','<strong>First Name:</strong> Required','<strong>Last Name:</strong> Required','<strong>Role:</strong> Select from dropdown','<strong>Location:</strong> Optionally assign to a location']) +
    step(3,'Click <strong>Send Invitation</strong>.') +
    step(4,'The staff member receives an email with a registration link. They click the link, set their password, set up MFA, and are added to your organisation.') +
    p('Invited staff who have not yet registered show with a "Pending" badge in the directory.') +
    h3('Bulk Import via CSV Template') +
    step(1,'On the Staff Directory page, locate the <strong>Import CSV</strong> button (if your organisation has the feature enabled).') +
    step(2,'Download the CSV template. The template has the following columns: <code>email, first_name, last_name, role, location_name</code>.') +
    step(3,'Fill in the template with your staff data. One row per staff member.') +
    step(4,'Upload the completed CSV file. The system validates each row and sends invitations to all valid entries.') +
    step(5,'Review any errors — the system will report rows that could not be processed (duplicate emails, invalid roles, etc.).') +
    tip('The CSV import is the fastest way to onboard a large team. Prepare your staff list in a spreadsheet, export as CSV, and upload. All staff will receive email invitations simultaneously.') +
    h3('Managing Staff Roles') +
    p('To change a staff member\'s role:') +
    step(1,'Navigate to the staff member\'s profile page (click their row in the directory).') +
    step(2,'Click <strong>Edit</strong> or find the role selector.') +
    step(3,'Select the new role from the dropdown.') +
    step(4,'Save. The change takes effect immediately — the staff member does not need to log out.') +
    warn('Only ORG_ADMIN can change user roles. Managers cannot change their own role or the role of other users. If you need to promote someone to ORG_ADMIN (backup admin), an existing ORG_ADMIN must do it.') +
    h3('Staff Profile Page') +
    p('Clicking a staff row opens their profile with tabs for:') +
    ul(['<strong>Profile:</strong> Personal details, role, location, department, teams, contracted hours','<strong>Compliance:</strong> All compliance requirements with statuses, documents (DBS, passport, visa, RTW), training records','<strong>Leave:</strong> Leave history and balances','<strong>Activity:</strong> Recent shifts, notes, and actions']) +
    h3('Staff — Compliance View') +
    p('On the staff profile compliance tab, you can:') +
    ul(['View all compliance requirements and their statuses (complete/incomplete/expiring)','Upload identity documents (DBS, passport, visa, right-to-work)','View training records and their expiry dates','Request document renewals','See overall compliance percentage'])
},
{ id:'staff-invitations', title:'Invitations & Onboarding Flow',
  content:
    h2('How Staff Invitations Work') +
    p('When you invite a staff member, the system:') +
    ol(['Creates a user record with status "invited"','Sends a branded HTML email with a unique registration link','The link expires after 7 days','When the staff member clicks the link, they create their password and set up MFA','After completing registration, their status changes to "active" and they can log in']) +
    h3('Resending an Invitation') +
    p('If a staff member didn\'t receive the invitation or the link expired:') +
    step(1,'Find the staff member in the directory (they will have a "Pending" badge).') +
    step(2,'Click on their row to open their profile.') +
    step(3,'Click <strong>Resend Invitation</strong>.') +
    step(4,'A new invitation email is sent with a fresh link and 7-day expiry.') +
    h3('Onboarding Flow for New Staff') +
    p('When a new staff member logs in for the first time:') +
    ol(['They see the MFA setup screen (QR code)','After MFA setup, they are redirected to the <strong>Onboarding page</strong>','The onboarding page asks them to confirm their details, set preferences, and review basic navigation','After completing onboarding, they land on the Dashboard']) +
    h3('Deactivating a Staff Member') +
    p('To deactivate a staff member (e.g., they leave the organisation):') +
    step(1,'Go to their profile page.') +
    step(2,'Change their status to "Inactive".') +
    step(3,'Deactivated staff can no longer log in. Their historical data (shifts, notes, compliance records) is preserved.') +
    warn('Deactivating a staff member is immediate. They will not be able to log in, and active sessions will be invalidated on the next role/permission check.')
}
]},

// ═══════════ 4. SCHEDULING ═══════════
{ id:'scheduling', category:'Scheduling', title:'Rota Planner & Scheduling', icon:'📅', subsections:[
{ id:'rota-overview', title:'Rota Planner — Complete Guide',
  content:
    h2('Rota Planner Overview') +
    p('The Rota Planner is the central scheduling tool for managing staff shifts across your locations. It is accessible from the sidebar as "Schedule" or via the Dashboard "Open Shifts" card.') +
    h3('Location Selector') +
    p('At the top of the Rota Planner, you\'ll see a location selector. Choose which location\'s rota to view, or select "All Locations" to see shifts across the organisation. Staff who are assigned to a single location see that location automatically. Managers see the locations they manage.') +
    h3('Calendar View') +
    p('Shifts are displayed on a calendar-style grid. Each shift card shows:') +
    ul(['Staff name and role','Start and end times','Shift type (Day, Night, Sleep)','Service user (if assigned)']) +
    h3('Adding a Shift') +
    step(1,'Click the <strong>+</strong> icon on any day header or hour cell in the calendar.') +
    step(2,'A shift creation dialog opens with:') +
    ul(['<strong>Shift Type:</strong> Day, Night (wake_night), Sleep (sleep)','<strong>Start Time:</strong> Time picker','<strong>End Time:</strong> Time picker','<strong>Staff Member:</strong> Autocomplete dropdown of active staff at this location','<strong>Service User:</strong> Optional — assign the shift to a specific person']) +
    step(3,'Click <strong>Save</strong>. The shift appears on the calendar.') +
    p('<strong>Permission required:</strong> The <em>scheduling:edit</em> permission is needed to add, edit, or delete shifts. Staff without this permission see a read-only view.') +
    h3('Assigning Staff to Shifts') +
    step(1,'Click on an unassigned shift on the calendar.') +
    step(2,'Select a staff member from the dropdown.') +
    step(3,'The system checks: (a) the staff member\'s compliance percentage meets the organisation\'s minimum threshold, (b) the staff member doesn\'t have another shift at the same time, (c) the staff member is active.') +
    step(4,'If all checks pass, the assignment is saved. If not, an error message explains why.') +
    h3('Unassigning Staff') +
    step(1,'Click on an assigned shift and select "Unassign".') +
    step(2,'The system checks that removing this staff member won\'t drop the location below its minimum daily staffing level.') +
    step(3,'If the minimum would be breached, the unassignment is blocked and an error is shown.') +
    h3('Deleting a Shift') +
    p('Click on a shift and select "Delete". The shift is permanently removed from the rota.') +
    h3('AI Rota Generator') +
    p('The AI Rota Generator creates a suggested schedule based on your staffing rules.') +
    step(1,'Click <strong>Generate Rota</strong> at the top of the planner.') +
    step(2,'Configure the generation parameters:') +
    ul(['<strong>Shift Start & End Rules:</strong> Set mandatory start times (the number of slots matches your location\'s minimum staff per day). Optionally enforce "all shifts start at same time".','<strong>Minimum End Time:</strong> Shifts should end no earlier than this time.','<strong>Generation Inputs:</strong> You\'ll see a summary of the selected location, minimum staffing, available staff count, and existing shift count.']) +
    step(3,'Click <strong>Generate</strong>. The AI suggests an optimal schedule.') +
    step(4,'Review the generated shifts. You can accept them, modify individual shifts, or clear all generated suggestions.') +
    h3('Calendar Quick Shift-Add') +
    p('Hover over any day header or hour cell to reveal a <strong>+</strong> overlay. Click it to create a shift that starts at that time — a faster alternative to the full dialog.') +
    h3('View-Only Mode') +
    p('Staff without the <em>scheduling:edit</em> permission see the rota in view-only mode. All action buttons (Add Shift, Assign, Delete, Claim OT) are hidden. They can browse the calendar and see who is working when.') +
    tip('Use the "All Locations" view to spot coverage gaps across your entire organisation. The calendar color-codes shifts by location for easy scanning.')
},
{ id:'shift-marketplace', title:'Shift Marketplace — Claiming Open Shifts',
  content:
    h2('Shift Marketplace (formerly "Open Shifts")') +
    p('The Shift Marketplace allows staff to browse and claim available shifts. It is accessible from the sidebar.') +
    h3('Viewing Open Shifts') +
    p('All unassigned shifts are listed with: Location, Date, Time, Shift Type. Use the search bar to find shifts by location or date.') +
    h3('Claiming a Shift') +
    step(1,'Find a shift you want to work and click <strong>Claim</strong>.') +
    step(2,'The system verifies: (a) your compliance percentage meets the minimum threshold, (b) you don\'t have a conflicting shift at the same time, (c) you are active.') +
    step(3,'If all checks pass, the shift is assigned to you.') +
    h3('Overtime Claims') +
    p('If your organisation has "Overtime Requires Approval" enabled in Settings, claimed overtime shifts go into a "Pending" state instead of being immediately assigned. A manager must approve the claim before it is finalised. You will receive a notification when your overtime is approved or rejected.') +
    p('The system enforces an <strong>11-hour rest period</strong> between shifts for staff claiming overtime. You cannot claim a shift that starts within 11 hours of your previous shift ending.') +
    tip('You can see your own upcoming shifts on the Dashboard under "Today\'s Rota". Staff with the CARE_WORKER role see only their own shifts.')
},
{ id:'overtime', title:'Overtime Claims Management',
  content:
    h2('Overtime Claims Page') +
    p('For managers: the Overtime Claims page lists all overtime requests requiring approval.') +
    h3('Filtering Claims') +
    ul(['<strong>Status filter:</strong> Pending, Approved, Rejected','<strong>Search:</strong> By staff name']) +
    h3('Approving a Claim') +
    step(1,'Review the claim details — staff member, location, date, time, shift type.') +
    step(2,'Click <strong>Approve</strong>.') +
    step(3,'The system checks: (a) compliance percentage, (b) no conflicting shifts, (c) 11-hour rest period.') +
    step(4,'If checks pass, the shift is assigned and the staff member is notified.') +
    h3('Rejecting a Claim') +
    p('Click <strong>Reject</strong>. The staff member receives a notification that their overtime claim was rejected.') +
    h3('Settings') +
    p('In Settings → Organisation, under "Staffing Rules for Rota Planner", you can toggle <strong>Overtime Requires Approval</strong>. When off, overtime claims are auto-approved (subject to compliance and rest period checks).')
},
{ id:'appointments', title:'Appointments Tracker',
  content:
    h2('Appointments Page') +
    p('Tracks all scheduled appointments for service users. Accessible from the sidebar.') +
    h3('Filtering Appointments') +
    ul(['<strong>Date picker:</strong> Filter by specific date','<strong>Service User:</strong> Autocomplete search']) +
    h3('Adding an Appointment') +
    step(1,'Click <strong>Add Appointment</strong>.') +
    step(2,'Fill in:') +
    ul(['<strong>Service User:</strong> Autocomplete search','<strong>Staff Member:</strong> Autocomplete (optional)','<strong>Title:</strong> E.g., "GP Appointment", "Dentist", "Physio"','<strong>Start/End:</strong> Date and time','<strong>Status:</strong> Scheduled, In Progress, Completed, Cancelled','<strong>Location:</strong> Optional location assignment']) +
    step(3,'Click <strong>Save</strong>.') +
    h3('Dashboard Widget') +
    p('Today\'s appointments appear on the main Dashboard as a list. Each shows the service user name, appointment title, time, and status chip.') +
    h3('Shift-Start Notifications') +
    p('Staff assigned to shifts receive an automated "Today\'s Plan" email approximately 15 minutes before their first shift starts, listing their appointments for the day.') +
    tip('Use the appointment status to track whether a person actually attended. Completed appointments are good evidence for CQC\'s Effective and Responsive domains.')
}
]},

// ═══════════ 5. LEAVE MANAGEMENT ═══════════
{ id:'leave', category:'Leave Management', title:'Leave Management', icon:'🏖️', subsections:[
{ id:'leave-overview', title:'Leave Manager — Complete Guide',
  content:
    h2('Leave Manager Overview') +
    p('The Leave Manager handles all staff leave requests, approvals, tracking, and calendar views. It is accessible from the sidebar.') +
    h3('Leave Balance Cards') +
    p('At the top right of the header, compact inline cards show your aggregated leave totals:') +
    ul(['<strong>Total:</strong> Your total leave entitlement','<strong>Used:</strong> Leave already taken','<strong>Pending:</strong> Leave requested but not yet approved/rejected','<strong>Remaining:</strong> Total minus Used minus Pending']) +
    p('Balances are displayed in "X days + Y hours" format for precision.') +
    h3('Requesting Leave') +
    step(1,'Click <strong>Request Leave</strong>.') +
    step(2,'Fill in the request form:') +
    ul(['<strong>Leave Type:</strong> Select from available types (annual, sick, etc.)','<strong>Start Date:</strong> Date picker','<strong>End Date:</strong> Date picker','<strong>Reason:</strong> Free text note (optional)']) +
    step(3,'Click <strong>Submit</strong>. If there is an error (e.g., overlapping dates, insufficient balance), it will display <em>inside the modal</em>, not behind it.') +
    h3('Calendar View') +
    p('The calendar tab shows all leave entries. Different leave types are displayed in different colors.') +
    ul(['<strong>Staff view:</strong> Care workers see only their own leave on the calendar.','<strong>Manager/Admin view:</strong> See all staff leave across the organisation. Deduplication ensures days with multiple staff on leave are not rendered twice.']) +
    p('<strong>Clicking a day</strong> opens a detailed popup showing:') +
    ul(['Status chips (Approved/Rejected/Pending)','Duration (number of days/hours)','Reason for leave','<strong>Approve/Reject buttons</strong> for pending requests (managers only)']) +
    h3('Approval Workflow') +
    ul(['Managers <strong>cannot approve their own leave</strong>.','Manager and admin leave requests are routed to a different ORG_ADMIN for review.','If no different ORG_ADMIN exists, the notification falls back to any ORG_ADMIN (not silent).','If a staff member has no location manager, the notification falls back to any ORG_ADMIN.']) +
    h3('All Requests Tab') +
    p('A table view of all leave requests across the organisation. Filter by:') +
    ul(['<strong>Status:</strong> Pending, Approved, Rejected','<strong>Location:</strong> Dropdown from live database','<strong>Date Range:</strong> Start and end date pickers']) +
    h3('Leave Entitlements') +
    p('Leave entitlements (base hours, calculation type, default hours per leave day) are configured in <strong>Settings → Organisation tab</strong>, not in the Leave Manager. Only ORG_ADMIN and MANAGER can change these.') +
    warn('Leave entitlement settings were intentionally removed from the Leave Manager to centralise configuration. Managers should go to Settings to adjust leave policies.')
}
]},

// ═══════════ 6. COMMUNICATION ═══════════
{ id:'chat', category:'Communication', title:'Chat & Collaboration', icon:'💬', subsections:[
{ id:'chat-full', title:'Chat — Complete Guide',
  content:
    h2('Chat Module Overview') +
    p('The Chat module provides real-time messaging for your team with direct messages, group channels, file sharing, link previews, and read receipts. It uses Socket.io for real-time delivery (not polling).') +
    h3('Channel Types') +
    ul(['<strong>Direct Messages (DM):</strong> One-on-one private conversations. DMs show an "Unread Messages" divider and "Seen" indicators.','<strong>Group Channels:</strong> Team-wide or topic-based channels. Group messages do not show read receipts or unread dividers.']) +
    h3('Creating a Channel') +
    step(1,'Click <strong>New Channel</strong> (or the + icon next to Channels).') +
    step(2,'Enter a channel name and optionally add a description.') +
    step(3,'Select members from the staff list. You can add more members later.') +
    step(4,'Click <strong>Create</strong>. The channel appears in your channel list.') +
    h3('Sending Messages') +
    p('Type your message in the text field at the bottom and press Enter or click Send. Messages are sent <strong>optimistically</strong> — they appear in the chat instantly before the server confirms delivery. Duplicate detection prevents messages from appearing twice.') +
    h3('Link Previews (Unfurling)') +
    p('When you paste a URL into the chat:') +
    ol(['A debounced (700ms) preview appears above the text field showing the page title, description, and thumbnail image.','After sending, a rich preview card is rendered in the chat with the domain name, title, description, and thumbnail.','If the link doesn\'t return OG metadata, the bare domain is shown as a fallback.']) +
    p('Public thumbnail images are loaded directly via <code>&lt;img&gt;</code> tags to avoid CORS issues with external domains.') +
    h3('File Sharing') +
    p('The <strong>Files tab</strong> (second tab in any channel) shows all shared files:') +
    step(1,'Click the <strong>Upload</strong> button or drag-and-drop a file onto the chat.') +
    step(2,'The file is uploaded and appears in the Files tab and in the chat as a message.') +
    step(3,'<strong>Download:</strong> Click the download icon on any file. Files are downloaded with authentication headers via programmatic fetch + blob URL.') +
    step(4,'<strong>Preview:</strong> Text, JSON, and XML files can be previewed in a dark-themed modal. Image files (via SecureImg component) and PDFs are displayed inline where possible.') +
    p('File uploads in one channel are immediately visible to other channel members via Socket.io events.') +
    h3('Read Receipts & Unread Tracking') +
    ul(['<strong>"Seen" indicator:</strong> On DMs, your sent messages show "Seen" once the recipient reads them.','<strong>"New messages" divider:</strong> In DMs, a chip and divider line appear above the first unread message (the first message the other person hasn\'t read yet).','<strong>Notification dot:</strong> A red dot appears on the Chat sidebar icon when you have unread messages. This works cross-page via Socket.io.']) +
    h3('No Messages Yet') +
    p('If a channel has never had messages, the backend sends an empty last_message. The frontend skips rendering the "last message" preview. Channels with file-only messages show "📎 [filename]" as the preview.') +
    tip('The Chat module uses Socket.io for instant delivery. Messages appear for all channel members in real time without page refresh. The notification dot updates across all open tabs.')
}
]},

// ═══════════ 7. COMPLIANCE ═══════════
{ id:'compliance-overview', category:'Compliance Suite', title:'Compliance Dashboard', icon:'✅', subsections:[
{ id:'comp-dashboard', title:'Compliance Dashboard',
  content:
    h2('Compliance Dashboard Overview') +
    p('The Compliance Dashboard is your central hub for all compliance activities. Access it from the sidebar under "Compliance".') +
    h3('Circular Gauge Hero') +
    p('At the top, a large circular progress indicator shows your overall compliance rate as a percentage. Below it, a caption shows "COMPLIANT" (green) or "NEEDS ATTENTION" (amber/red) based on your organisation\'s threshold. The gauge is 140px in diameter with a custom MUI CircularProgress and overlay text.') +
    h3('Stat Cards') +
    p('Four clickable stat cards:') +
    ul(['<strong>Active Staff:</strong> Navigates to Staff Directory','<strong>Requirements:</strong> Navigates to Training Matrix','<strong>Pending Documents:</strong> Navigates to Identity Monitoring','<strong>Staff With Gaps:</strong> Scrolls to the requirements section and shows how-to-address links']) +
    h3('Needs Attention Section') +
    p('Below the stat cards, a prominent alert section shows critical items: staff below compliance threshold, gaps requiring action. Each item has a CTA button (Assign training, Run assessments, Upload docs).') +
    h3('Expanded Sections') +
    p('Three collapsible data sections:') +
    ul(['<strong>Requirements:</strong> All compliance requirements with completion status per staff. Search and filter by requirement. Incomplete requirements show inline action links.','<strong>Documents:</strong> Identity documents table with status, type, expiry dates.','<strong>Trend Chart:</strong> Line chart (recharts) showing compliance scores over the last 30 days with date on X-axis and score on Y-axis.']) +
    h3('Compliance Profiles') +
    p('Compliance profiles are role-based. Each profile comprises linked requirements. When a staff member\'s role is set, they are auto-assigned the compliance profile for that role. Profiles and their requirements are managed in <strong>Settings → Compliance</strong>.')
},
{ id:'training-matrix', title:'Training Matrix — Full Guide',
  content:
    h2('Training Compliance Matrix') +
    p('Accessible from Compliance or directly at /training. Four tabs manage all aspects of staff training.') +
    h2('Tab 1 — Dashboard') +
    p('Shows training KPIs:') +
    ul(['Overall completion % (completed ÷ total)','Staff count and module count','Bar chart by staff role','Table by module showing completion counts','CQC-mandated training rate (completion rate for modules tagged as CQC-mandated)']) +
    h2('Tab 2 — Compliance Grid') +
    p('A matrix of Staff (rows) × Modules (columns). Each cell shows a clickable chip: Green (completed), Amber (incomplete), Red (expired). CQC-mandated modules have a <strong>⚑ flag</strong> in the column header. Click any cell to mark training as complete or incomplete. Bulk assign option available.') +
    h2('Tab 3 — Modules Management') +
    p('Full CRUD for training modules:') +
    ul(['<strong>Create Module:</strong> Name, Category (dropdown: Mandatory, Clinical, Safeguarding, Health & Safety, Fire Safety, Infection Control, Manual Handling, Food Hygiene, Medication, First Aid, Dementia, Autism, Mental Health, Other), Description, Frequency (days), Mandatory toggle, Requires Competency toggle, CQC-Mandated toggle with multi-select role picker','<strong>CQC-Mandated:</strong> When enabled, you can select which staff roles this training is mandatory for. Modules tagged this way get the ⚑ badge on the grid and a separate CQC-mandated training rate feeds into the CQC Safe domain.','<strong>Auto-Assign by Role:</strong> Click the "Auto-Assign by Role" button. The system queries all CQC-mandated modules and automatically creates training records for staff whose role matches the module\'s target roles. Records are created with status "incomplete".']) +
    h2('Tab 4 — Expiring Soon') +
    p('Shows training records expiring within a configurable look-ahead (default 30 days). Each record shows: Staff name, Module name, Days until expiry (color-coded chip), Expiry date. Paginated.') +
    h2('Manager Notification') +
    p('When a staff member completes mandatory training, their location manager (if assigned) receives an in-app notification. This ensures managers are aware of completed training without having to check the matrix.') +
    h3('Training Record Management') +
    p('When clicking a cell in the compliance grid:') +
    ul(['Set completion date','Set expiry date (auto-calculated if module has a frequency)','Toggle competency passed','Enter trainer name','Add notes','Link to a certificate file']) +
    tip('Use the "Auto-Assign by Role" button after creating new CQC-mandated training modules. This ensures all relevant staff get training records created automatically, eliminating manual assignment.')
},
{ id:'identity', title:'Identity & DBS Monitoring',
  content:
    h2('Identity Monitoring Page') +
    p('Tracks all staff identity documents. Accessible from Compliance → Identity or directly at /compliance/identity.') +
    h3('Document Types Tracked') +
    ul(['<strong>DBS:</strong> Disclosure and Barring Service check','<strong>Passport:</strong> Proof of identity and right to work','<strong>Visa:</strong> Immigration status','<strong>Right to Work:</strong> Share code or other RTW evidence']) +
    h3('Uploading a Document') +
    step(1,'Click <strong>Upload Document</strong>.') +
    step(2,'Select the <strong>staff member</strong> using the Autocomplete search (searches /staff/org-members).') +
    step(3,'Select the <strong>document type</strong> from the dropdown.') +
    step(4,'Choose the file to upload (images, PDFs, documents accepted).') +
    step(5,'Set the <strong>expiry date</strong>.') +
    step(6,'Click <strong>Upload</strong>. A loading spinner appears during upload.') +
    p('If the organisation has <strong>auto_approve_documents</strong> enabled in Settings, the document is automatically set to "approved". Otherwise, it starts as "pending".') +
    h3('Document Statuses') +
    ul(['<strong>Pending:</strong> Awaiting review','<strong>Approved:</strong> Verified and valid','<strong>Rejected:</strong> Not accepted','<strong>Expired:</strong> Past expiry date']) +
    h3('Renewal Workflow') +
    p('There are three renewal actions, each sending an in-app notification:') +
    ol(['<strong>Request Renewal:</strong> Click "Request Renewal" on a document. Sets renewal_status to "requested". Sends in-app notification to the staff member.','<strong>Submit Renewal:</strong> Staff upload a new document as a renewal. The old document is marked as "renewed" and linked to the new one via replaced_by. If auto_approve is on, the new document is auto-approved.','<strong>Send Reminder:</strong> Send a manual reminder notification to the staff member.']) +
    h3('Auto-Renewal') +
    p('The background compliance check (every 6 hours) automatically detects expired identity documents and sets their renewal_status to "requested". The staff member receives both an in-app notification and an email. No manual action is needed to trigger this.') +
    h3('Dashboard Widget') +
    p('The DBS Renewals Due widget on the Dashboard now shows all identity document types (DBS, Passport, Visa, RTW) expiring within 30 days, not just DBS.') +
    h3('Dashboard Grid View') +
    p('Staff are grouped by compliance status:') +
    ul(['<strong>Compliant:</strong> All documents approved and not expiring soon','<strong>Incomplete:</strong> Missing required documents','<strong>Expiring Soon:</strong> Documents expiring within 30 days','<strong>Expired:</strong> One or more documents expired']) +
    p('Each staff card shows per-document-type indicators. Green dot = document is valid. Red dot = missing/expired. Yellow = expiring soon.') +
    tip('Set auto_approve_documents in Settings → Organisation if you want uploaded documents to be automatically approved without manual review. This is useful for organisations with high document volumes.')
},
{ id:'competency', title:'Competency Assessments',
  content:
    h2('Competency Assessments Overview') +
    p('Three tabs: Pending, Templates, All Records.') +
    h3('Tab 1 — Pending Assessments') +
    p('Staff grouped by name with accordion expansion. Each staff member shows templates they haven\'t been assessed on, failed, or past their reassessment date.') +
    ul(['Search bar filters by name or template','Each row shows: Template name, Category, Last assessed date, Previous result (Passed/Failed), Rubric criteria count']) +
    p('<strong>Assess Now Dialog:</strong>') +
    ul(['If the template has a rubric, star ratings appear for each criterion. Rate each criterion. Total score is calculated automatically. Pass threshold: 60% of max score.','Toggle Pass/Fail (auto-calculated from rubric if rubric exists, or manual toggle if no rubric).','Set assessment date (defaults to today).','Set reassessment date (when should this be rechecked?).','Select assessor from Autocomplete staff list.','Enter others involved (names of staff present).','Attach evidence file (image or PDF) — uploaded to secure storage.','Add notes.']) +
    h3('Tab 2 — Templates') +
    p('Manage assessment templates with full CRUD:') +
    ul(['<strong>Name:</strong> Required','<strong>Category:</strong> Free text or from common categories','<strong>Description:</strong> What the assessment covers','<strong>Criteria:</strong> Assessment criteria text','<strong>Reassessment Interval:</strong> Days until reassessment is due','<strong>CQC Statement:</strong> Map to specific CQC quality statement (S4, S8, E2, E5, C1, C2, R1, R4)','<strong>Required for Roles:</strong> Multi-select — limit this assessment to specific staff roles. Leave empty for all roles. Controls which staff see this template in their pending list.','<strong>Observation Rubric:</strong> Add criteria with name and max score. Used for multi-criteria scoring during assessment.']) +
    h3('Tab 3 — All Records') +
    p('Paginated table of all past assessments. Columns: Staff, Template, Result (Passed/Fail chip), Score (if rubric), Assessor, Date. Filterable by template and staff.') +
    h3('Auto-Reassessment') +
    p('The background compliance check detects assessments where reassessment_date has passed and creates notifications for the staff member. Pending assessments also appear in the Pending tab.') +
    h3('CQC Feed') +
    p('Competency pass rates feed into the CQC Safe (S4, S8) and Effective (E2, E5) domain scores. Templates mapped to specific CQC statements get per-statement pass rates.') +
    tip('For templates with rubrics, the star ratings provide granular evidence of competence. This is more defensible in a CQC inspection than a simple pass/fail checkbox.')
},
{ id:'evidence-packs', title:'Evidence Packs',
  content:
    h2('Evidence Packs — Inspector-Ready Documentation') +
    p('Generate comprehensive evidence packs for CQC/regulatory inspections with one click.') +
    h3('Configuring the Pack') +
    step(1,'Use the <strong>Staff Filter</strong> to generate a pack for a specific staff member or leave on "All Staff".') +
    step(2,'Toggle which sections to include: Training, Identity Documents, Competency. Turn off sections you don\'t need.') +
    step(3,'The KLOE evidence mapping is auto-calculated based on your organisation\'s configurable mappings (see Settings → Compliance → Evidence Mappings) or built-in defaults.') +
    h3('Download Options') +
    ul(['<strong>Download PDF:</strong> Uses Puppeteer with real Chrome to generate a professional A4 PDF with cover page, executive summary, staff table, training records, documents, competency, service users, care plans, incidents, and satisfaction overview. Includes page numbers, headers, and footers.','<strong>Download HTML:</strong> Downloads as an HTML file with embedded CSS for browser viewing.','<strong>Print:</strong> Opens the pack in a print-friendly browser window with @media print CSS for page breaks, avoiding splitting tables across pages.']) +
    h3('What\'s in the Evidence Pack') +
    ul(['<strong>Cover Page:</strong> Organisation name, regulator framework, generation date, summary counts','<strong>Executive Summary:</strong> Stat cards for staff, service users, training, documents, competency, satisfaction','<strong>Staff Table:</strong> All active staff with compliance rates','<strong>Service Users Table:</strong> People with care plan counts, open risks, goals','<strong>Training Records:</strong> Staff, module, category, status, completion date','<strong>Identity Documents:</strong> Staff, type, status, expiry date','<strong>Competency Records:</strong> Staff, template, result, assessor, date','<strong>Care Plans:</strong> Per service user with categories and statuses','<strong>Incidents:</strong> Recent incidents with involved people and severity','<strong>Satisfaction Overview:</strong> Average rating, total responses, positive count']) +
    h3('Scheduled Auto-Generation') +
    p('In Settings → Organisation → Compliance Notifications, you can enable <strong>Auto-generate evidence packs</strong> and choose a frequency (Weekly on Mondays, or Monthly on the 1st). When enabled, evidence packs are automatically generated and emailed to all ORG_ADMINs with summary stats.') +
    h3('Configurable Evidence Mappings') +
    p('In Settings → Compliance → Evidence Mappings, you can override which evidence sources feed into which CQC domain. For example, you can map Infection Control training to the Safe domain, or Medication competency to the Effective domain. Mappings are per-organisation and override built-in defaults.') +
    tip('Generate an evidence pack before every inspection. Keep historical packs for comparison. The PDF format is designed to be printed and placed in a physical folder for inspectors to browse.')
},
{ id:'cqc-readiness', title:'CQC Readiness Scoring',
  content:
    h2('CQC Readiness — Your Inspection Dashboard') +
    p('The CQC Readiness page is Meticle\'s most powerful compliance tool. It scores your organisation against your regulator\'s framework using real data from your database.') +
    h3('Framework Selection') +
    p('Your regulator is set in Settings → Organisation. The readiness page automatically uses the correct framework:') +
    ul(['<strong>CQC (England):</strong> 5 domains, 34 Quality Statements, 4 ratings (Outstanding ≥85%, Good ≥70%, Requires Improvement ≥50%, Inadequate <50%)','<strong>CIW (Wales):</strong> Same domain structure, 4 ratings (Excellent, Good, Adequate, Poor)','<strong>Care Inspectorate (Scotland):</strong> 4 domains, 12 statements, 6-point scale (6=Excellent to 1=Unsatisfactory)','<strong>RQIA (Northern Ireland):</strong> 5 domains, 14 statements, 3 ratings (Mostly Compliant, Partially Compliant, Not Compliant)']) +
    h3('How Scoring Works') +
    p('Each domain score is calculated from real data:') +
    ul(['<strong>Safe:</strong> Training completion rate, document compliance rate, competency pass rate, CQC-mandated training rate, staffing adequacy (last 90 days)','<strong>Effective:</strong> Training rate, competency-to-CQC-statement mapping, care plan evidence','<strong>Caring:</strong> Satisfaction survey average rating, competency presence','<strong>Responsive:</strong> Incident severity scoring, document compliance, training rate','<strong>Well-led:</strong> Staff engagement survey scores, competency rate, satisfaction presence']) +
    h3('Domain Details') +
    p('Click any domain bar to expand and see per-statement scores. Hover over any statement to see the exact score and what data feeds it. Per-statement drill-down shows which specific training modules, documents, or assessments contribute to that statement\'s score.') +
    h3('Gap Analysis') +
    p('Below the domain scores, a gap analysis section shows:') +
    ul(['Prioritised list of gaps (HIGH, MEDIUM, LOW) with color-coded borders','Current state description','Recommended action','Effort estimate (small/medium/large)','CQC statement reference']) +
    h3('Action Plan Tracking') +
    p('Each gap has a <strong>Create Action</strong> button. Click it to create a tracked action item. The Action Plan section shows all action items with:') +
    ul(['Checkmark button to cycle status: Open → In Progress → Completed','Priority chip (high/medium/low)','Description of the action','Staff name (if assigned)','Delete button']) +
    h3('AI Gap Analysis') +
    p('Click <strong>Analyse with AI</strong> to get AI-generated analysis. Requires AI to be configured in Settings → AI. Results include: critical gaps, quick wins you can action immediately, and an overall assessment. You can share results to team chat channels.') +
    h3('Download Report') +
    p('Click <strong>Download Report</strong> to export the readiness report as a PDF (client-side html2pdf.js). The report includes the overall gauge, domain scores, gap analysis, and action plan.') +
    tip('Run the readiness assessment monthly. Compare scores over time to demonstrate continuous improvement to inspectors. The trend chart on the Compliance Dashboard shows your compliance trajectory.')
},
{ id:'surveys', title:'Satisfaction & Engagement Surveys',
  content:
    h2('Satisfaction Surveys') +
    p('Collect feedback from service users, families, and stakeholders.') +
    h3('Manual Entry') +
    step(1,'Click <strong>Add Feedback</strong>.') +
    step(2,'Fill in: Service User (optional), Respondent Name, Relationship to person (family, friend, social worker, etc.), Rating (1-5 stars), Comments.') +
    step(3,'Click <strong>Submit</strong>. The source is recorded as "Manual".') +
    h3('Email Invitation') +
    step(1,'Click <strong>Send Invitation</strong>.') +
    step(2,'Fill in: Recipient email, Service User (optional, pre-fills "Regarding" on the form), Respondent name.') +
    step(3,'Click <strong>Send</strong>. A branded HTML email is sent with a unique token link to a public satisfaction form.') +
    step(4,'The recipient clicks the link, fills in the form (no login required), and submits. The source is recorded as "Email".') +
    h3('Viewing Results') +
    ul(['Table with search, date range filter, source filter (Manual/Email)','Aggregate stats: average rating, total responses, positive (≥4), negative (≤2)']) +
    p('Satisfaction data feeds directly into the CQC <strong>Caring</strong> domain score.') +
    h2('Staff Engagement Surveys') +
    p('Customisable surveys sent to staff to measure engagement and wellbeing.') +
    h3('Creating Templates') +
    step(1,'Go to the <strong>Templates</strong> sub-tab.') +
    step(2,'Click <strong>Add Template</strong>.') +
    step(3,'Enter a name and add questions as key:label pairs (e.g., "workload" → "How manageable is your current workload?"). Add/remove question rows as needed.') +
    step(4,'Click <strong>Save</strong>.') +
    h3('Sending a Survey') +
    step(1,'Go to the <strong>Surveys</strong> sub-tab.') +
    step(2,'Click <strong>Send Survey</strong>.') +
    step(3,'Select a template and optionally filter by staff role.') +
    step(4,'Click <strong>Send to All</strong>. Every active staff member (optionally filtered by role) receives an email + push notification with a link to a token-based public form.') +
    h3('Viewing Results') +
    p('Responses are aggregated per question. Each question shows an average score. Staff answer using a 6-question slider interface on the public form.') +
    p('Engagement data feeds directly into the CQC <strong>Well-led</strong> domain score.') +
    h3('Public Forms') +
    p('Both survey types use public forms (no login required) accessed via unique tokens. Tokens expire after 7 days. The public form for satisfaction collects: name, relationship, rating, comments. The public form for engagement renders the template\'s questions as sliders.')
},
{ id:'dspt', title:'NHS DSPT Self-Assessment',
  content:
    h2('Data Security and Protection Toolkit') +
    p('Meticle includes an internal DSPT self-assessment tool based on the NHS DSP Toolkit standards. This is an <strong>internal tool</strong> — formal NHS submission requires registration on dsptoolkit.nhs.uk (opens October).') +
    h3('Assessment Structure') +
    ul(['<strong>11 standards</strong> across 4 themes','<strong>Theme 1:</strong> Managing Data Protection — policies, training, roles','<strong>Theme 2:</strong> Confidentiality & Data Security — access controls, encryption, audit','<strong>Theme 3:</strong> Protecting & Sharing Information — data sharing agreements, IG','<strong>Theme 4:</strong> Minimising Impact — breach response, business continuity']) +
    h3('Per-Standard Assessment') +
    p('Each standard can be marked as: Not Assessed, Partially Met, Met, Exceeded. You can add evidence notes per standard explaining how you meet the requirement.') +
    h3('Progress Tracking') +
    ul(['Overall progress bar','Per-year tracking (e.g., 2025-26)','Organisation DSPT status: Not Started, In Progress, Submitted, Standards Met, Standards Exceeded']) +
    warn('This is an internal self-assessment tool. To formally submit your DSPT assessment, you must register on dsptoolkit.nhs.uk as an organisation (not as a software provider). Software provider registration opens October 2026.')
}
]},

// ═══════════ 8. MEDICATION ═══════════
{ id:'emedication', category:'Medication', title:'eMAR (Medication)', icon:'💊', subsections:[
{ id:'emar-full', title:'eMAR — Complete Guide',
  content:
    h2('eMAR Overview') +
    p('The eMAR (Electronic Medication Administration Record) module manages medication charts, administration, stock, and daily counts.') +
    h3('Selecting a Service User') +
    p('The main view shows a list of active medication charts. Select a service user to view their current MAR chart. Charts marked as "active" are shown; archived charts are moved to a separate page.') +
    h3('MAR Grid Layout') +
    p('The MAR grid uses a flat layout — one row per medication + time slot combination. All administration times are visible at once without expand/collapse.') +
    p('Each row shows: Drug name, Dose, Route (oral, topical, etc.), Frequency, Administration time, Status chip (Pending/Given/Refused/Missed/Not Available/N/A). A color swatch key explains the status colors.') +
    h3('Administering Medication') +
    step(1,'Find the scheduled dose row on the grid.') +
    step(2,'Click the dose cell to open the administration dialog.') +
    step(3,'Select the status: Given, Refused, Missed, Not Available, or N/A.') +
    step(4,'Add notes if needed (e.g., reason for refusal).') +
    step(5,'Click <strong>Save</strong>. The status updates on the grid.') +
    p('Marking a dose as <strong>Given</strong> automatically decrements the linked stock item by 1.') +
    h3('PRN Medication') +
    p('PRN (as-needed) medications are listed separately at the bottom of the chart. When administering PRN medication, you must record: the time given, reason for administration (e.g., "patient reported pain 7/10"), and effectiveness (to be filled in later).') +
    h3('Medication Periods') +
    p('Each medication can have a <strong>start_date</strong> and <strong>end_date</strong> to specify a course duration (e.g., a 7-day antibiotic course from June 1-7). After the end date, the medication stops appearing on the active MAR.') +
    h3('Stock Management') +
    p('<strong>Inventory Tab:</strong> View all medication stock items linked to service users. Adding a non-PRN medication to a MAR auto-creates a stock entry with quantity 0 (you must set the initial quantity manually).') +
    p('<strong>Stock Adjustments:</strong> Click a stock item to open the adjustment dialog. Record adjustments for: Damaged, Expired, Lost, Returned, or Other. Enter the quantity and reason. Each adjustment creates an audit record with timestamp and staff ID.') +
    h3('Daily Counts') +
    p('The Daily Counts tab allows daily medication stock reconciliation:') +
    step(1,'Select the service user and date.') +
    step(2,'Physically count the medication.') +
    step(3,'Check the <strong>Matches Physical Count</strong> checkbox if the system count matches reality.') +
    step(4,'Enter your staff name and any notes.') +
    step(5,'Click <strong>Save</strong>. This creates a permanent audit trail entry.') +
    h3('Archived MARs') +
    p('Archived medication charts are moved to <strong>/emedication/archived</strong>. Search by chart title to find historical MARs. The main view only shows active charts to stay focused.') +
    h3('Printing MARs') +
    p('The print view includes: patient info (name, NHS number, DOB, age, room, allergies, GP details), regular medication grid (route, frequency, course dates), PRN section (reason, effectiveness, staff), staff signatures table with initials, codes key with color swatches, and chart metadata. Use the Print button to open a print-optimised browser window.') +
    tip('Always complete the daily count reconciliation. This creates an audit trail that proves medications were checked, which is critical for CQC medication management inspections.')
}
]},

// ═══════════ 9. INCIDENTS & POLICIES ═══════════
{ id:'incidents', category:'Risk & Incidents', title:'Incidents & Policies', icon:'⚠️', subsections:[
{ id:'incidents-full', title:'Incident Reporting',
  content:
    h2('Incident Directory') +
    p('Lists all reported incidents with search and pagination.') +
    h3('Reporting an Incident') +
    step(1,'Click <strong>Report Incident</strong>.') +
    step(2,'Fill in: Title, Description, Severity (Low/Medium/High/Critical), Date/Time Occurred, Location, Involved Service Users (multi-select Autocomplete).') +
    step(3,'Click <strong>Submit</strong>.') +
    h3('Managing an Incident') +
    p('Click any incident row to open its detail page:') +
    ul(['View full details, timeline, and involved people','Add more involved people (Autocomplete search)','Update status: Reported → Investigating → Resolved → Closed','Add investigation notes (append-only timeline)']) +
    h3('Severity Classification') +
    p('Incident severity feeds into CQC scoring:') +
    ul(['<strong>Responsive domain:</strong> All incidents contribute to the score','<strong>Safe domain:</strong> High and critical open incidents negatively impact the score (-15 per incident)']) +
    h3('CQC AI Triage') +
    p('If AI is configured, incidents can be triaged by AI (Phase 1A feature). The AI classifies severity and suggests required actions. This is a decision-support tool — humans always make the final determination.') +
    tip('Always close incidents after resolution. Open high/critical incidents drag down your CQC Safe domain score.')
},
{ id:'policies', title:'Policy Management',
  content:
    h2('Policies Page') +
    p('A library of CQC-aligned policies with versioning.') +
    h3('12 Standard Policies') +
    p('Click <strong>Load 12 Standard Policies</strong> to seed the library with pre-written policies:') +
    p('Risk Assessment, Complaints, Lone Working, GDPR, Whistleblowing, Infection Control, Equality & Diversity, MCA & DoLS, Fire Safety, Medication, Safeguarding Adults, Health & Safety.') +
    p('Each policy includes: Title, Category chip, Status (Draft/Published/Archived), Version number, Content (full text).') +
    h3('Creating Custom Policies') +
    step(1,'Click <strong>Add Policy</strong>.') +
    step(2,'Fill in: Title (required), Category (text), Content (full formatted text, required), Version (e.g., "1.0"), Status (draft/published/archived).') +
    step(3,'Click <strong>Save</strong>.') +
    h3('Viewing & Searching') +
    ul(['Search by title','Filter by category','Click any policy to read full content in a dialog']) +
    tip('Keep policies updated and versioned. CQC inspectors expect to see policy review cycles. The version field helps demonstrate that policies are living documents.')
}
]},

// ═══════════ 10. SERVICE USER TOOLS ═══════════
{ id:'su-tools', category:'Service User Tools', title:'Goals, Assessments & Reports', icon:'🎯', subsections:[
{ id:'goals-full', title:'Service User Goals',
  content:
    h2('Goals Page') +
    p('Track individual service user goals, progress, and outcomes.') +
    h3('Summary Cards') +
    ul(['Total goals across all service users','Active goals (status = active)','Completed goals','Average progress percentage']) +
    h3('Creating a Goal') +
    step(1,'Click <strong>Add Goal</strong>.') +
    step(2,'Select the Service User (Autocomplete search).') +
    step(3,'Enter: Title (required, max 500 chars), Description (optional, max 2000 chars), Target Date, Review Date, Status (active/completed/cancelled/on-hold), Progress (0-100 integer), CQC Domain (safe/effective/caring/responsive/well-led), Frequency (text, e.g., "Weekly"), Goal Category (text).') +
    step(4,'Click <strong>Save</strong>.') +
    h3('Table View') +
    ul(['Title, Service User, Progress bar (green ≥100%, blue otherwise), Status chip, CQC domain chip, Target date, Review date','Filter by service user (URL parameter ?su={id})','Filter by status']) +
    h3('Profile Tab Integration') +
    p('The Goals tab on the Service User profile shows an inline summary with stat cards and progress bars. "Manage Goals" navigates to the full Goals page.') +
    tip('Map goals to CQC domains to demonstrate person-centred care planning. This feeds into the Effective and Caring domain scores.')
},
{ id:'care-assessments-full', title:'Care Assessments',
  content:
    h2('Care Assessments Page') +
    p('Formal care evaluations for service users.') +
    h3('Summary Cards') +
    ul(['Total assessments','Completed','Draft']) +
    h3('Creating an Assessment') +
    step(1,'Click <strong>New Assessment</strong>.') +
    step(2,'Select Service User, Assessment Type, Date, Assessor Name, Findings (multiline), Recommendations (multiline), Status (draft/completed/reviewed), Next Review Date.') +
    step(3,'Click <strong>Save</strong>.') +
    h3('Table View') +
    ul(['Type, Service User, Date, Assessor, Status chip, Next Review Date','Type filter dropdown','Paginated']) +
    h3('Profile Tab Integration') +
    p('The Care Assessments tab on the Service User profile shows inline stats and a table. "Manage Assessments" navigates to the full page.') +
    tip('Create care assessments as draft initially, then mark as completed after review. The "reviewed" status indicates a senior staff member has signed off.')
},
{ id:'reports', title:'Reporting Suite',
  content:
    h2('Reports Page') +
    p('Six report card templates for common reporting needs. Each card has a description and a "Download Sample CSV" button.') +
    ul(['<strong>Staff Compliance Report:</strong> Staff names, roles, compliance rates, missing requirements','<strong>Training Matrix Report:</strong> Staff vs modules matrix with completion statuses','<strong>Incident Log Report:</strong> Incident title, severity, date, status, involved people','<strong>Leave Overview Report:</strong> Staff leave balances, used, pending, remaining','<strong>Service User Roster Report:</strong> Active people with room numbers, care plans, risk counts','<strong>Medication Administration Report:</strong> MAR administration records with staff, times, statuses']) +
    p('Note: These are Phase 1 templates. Full live-data reporting is planned for Phase 2.') +
    tip('Use the sample CSVs to understand the report structure. Phase 2 will replace samples with live data and add PDF export.')
}
]},

// ═══════════ 11. SETTINGS ═══════════
{ id:'settings', category:'Administration', title:'Settings & Configuration', icon:'⚙️', subsections:[
{ id:'settings-org', title:'Organization Tab',
  content:
    h2('Organization Tab') +
    p('Core organisation settings. Accessible from Settings → Organization.') +
    h3('Organisation Details') +
    ul(['<strong>Name:</strong> Your organisation\'s display name','<strong>Status:</strong> Active or Inactive','<strong>Plan:</strong> Your subscription tier','<strong>Regulator:</strong> CQC, CIW, Care Inspectorate, or RQIA. This setting controls which framework is used for compliance scoring.']) +
    h3('Leave Settings') +
    ul(['<strong>Leave Start Month:</strong> Month when the leave year begins (e.g., April for UK tax year). Number field (must be entered as a number, e.g., 4 for April).','<strong>Leave Calculation Type:</strong> Accrual (earned over time) or Annual (allocated at start of year).','<strong>Default Hours Per Leave Day:</strong> How many hours count as one leave day.','<strong>Base Leave Hours:</strong> Total annual leave entitlement in hours.','<strong>Base Contracted Hours:</strong> Weekly contracted hours for full-time staff.']) +
    h3('Staffing Rules for Rota Planner') +
    ul(['<strong>Minimum Compliance Percent:</strong> Staff below this percentage cannot be assigned to shifts.','<strong>Overtime Requires Approval:</strong> Toggle. When on, overtime claims need manager approval.','<strong>Force MFA:</strong> Toggle. When on, all staff must have MFA enabled.']) +
    p('Click <strong>Save Staffing Rules</strong> to apply changes.') +
    h3('Compliance Notifications') +
    ul(['<strong>Daily Compliance Digest:</strong> When enabled, location managers receive daily emails listing non-compliant staff.','<strong>Predictive Compliance Alerts:</strong> When enabled, the system analyses 60-day trends and alerts admins if scores are declining toward the threshold.','<strong>Auto-Generate Evidence Packs:</strong> Schedule automatic evidence pack generation (Weekly on Mondays or Monthly on 1st). When enabled, packs are emailed to all ORG_ADMINs.']) +
    p('Click <strong>Save Compliance Notification Settings</strong> to apply changes.') +
    h3('Leave Entitlements Summary') +
    p('Shows base leave hours and staff count as summary cards. The Calculate button computes leave entitlements for all staff. Individual leave data is on the Staff Directory.')
},
{ id:'settings-branding', title:'Branding Tab',
  content:
    h2('Branding Tab') +
    h3('Logo Upload') +
    step(1,'Click the logo area to select a file.') +
    step(2,'Choose an image file (JPEG, PNG, GIF, WebP).') +
    step(3,'The logo is uploaded to /settings/upload and saved to your organisation.') +
    p('The logo appears on: login page, dashboard header, email templates.') +
    h3('Color Customisation') +
    ul(['<strong>Primary Color:</strong> Main brand color (header, buttons, links).','<strong>Secondary Color:</strong> Accent elements.','<strong>Accent Color:</strong> Highlights and badges.']) +
    p('Each color can be selected via:') +
    ul(['Native <strong>color picker</strong> (click the color swatch to open your OS color picker)','<strong>Preset swatches:</strong> 10 preset colors shown as clickable circles below each color input — Navy (#0F4C81), Emerald (#16A34A), Amber (#F59E0B), Red (#DC2626), Purple (#7C3AED), Cyan (#06B6D4), Gray (#6B7280), Off-white (#F8FAFC), Black (#111827), White (#FFFFFF). Click any swatch to instantly apply that color.']) +
    p('Click <strong>Save Branding</strong> to apply all changes. The button shows a loading spinner while saving.') +
    tip('Use your organisation\'s brand colors for a professional look. The colors apply across the entire platform for your organisation.')
},
{ id:'settings-departments', title:'Departments & Teams',
  content:
    h2('Departments Tab') +
    h3('Creating a Department') +
    step(1,'Click <strong>Add Department</strong>. A form dialog opens.') +
    step(2,'Enter: Name (required), select a Location from dropdown.') +
    step(3,'Optionally add initial members using the Autocomplete search (searches all active staff).') +
    step(4,'Click <strong>Save</strong>. The button shows a loading spinner.') +
    h3('Managing Departments') +
    ul(['Paginated table with name and location','Edit (pencil icon) and Delete (trash icon) per row','Assign Staff: Use Autocomplete search (not raw user ID) to find and assign staff','Staff assignment sends in-app notification to the staff member']) +
    h2('Teams Tab') +
    h3('Creating a Team') +
    step(1,'Click <strong>Create Team</strong>.') +
    step(2,'Enter: Name (required), Description (optional).') +
    step(3,'Optionally add initial members using Autocomplete search.') +
    step(4,'Click <strong>Save</strong>.') +
    h3('Managing Teams') +
    ul(['Add/remove members via Autocomplete','Notifications sent on assignment and removal','Members can belong to multiple teams']) +
    h3('My Profile') +
    p('The Profile tab in Settings shows your departments and teams. This data comes from /settings/my-teams and /organizations/departments/single/:id.')
},
{ id:'settings-compliance', title:'Compliance Configuration',
  content:
    h2('Compliance Tab') +
    h3('Compliance Profiles') +
    p('Profiles are role-based. Each profile comprises linked requirements. Staff are auto-assigned based on their role when profiles change.') +
    ul(['<strong>Create Profile:</strong> Name, role assignment, set of requirements','<strong>Edit:</strong> Modify name, role, requirements','<strong>Delete:</strong> Remove profile (existing staff assignments are preserved)']) +
    h3('Compliance Requirements') +
    ul(['Create individual requirements with name, category, description','Requirements are linked to profiles','Paginated table with edit/delete actions']) +
    h3('Compliance Records') +
    ul(['View individual staff compliance records','Seed Records: Auto-assign profiles to all active staff','Bulk-update statuses (complete/incomplete)','Last checked date tracking']) +
    h3('Delegations') +
    p('Manager delegation management:') +
    ul(['Assign a Primary Manager and Delegate Manager','Set optional end date for temporary delegations','Duplicate delegations (same primary + delegate pair) are rejected with HTTP 409','Delegations affect notification routing — delegates receive notifications for their primary\'s staff']) +
    h3('Evidence Mappings') +
    p('Configure which evidence sources feed which CQC domain:') +
    ul(['Source types: training, documents, competency, care_plans, incidents, satisfaction','Map a specific source_category to a target_domain (safe, effective, caring, responsive, well-led)','Use wildcard (no category) to map all items of a source type to a domain','Overrides built-in heuristic defaults']) +
    h3('Audit Trail') +
    p('View all compliance-related audit log entries:') +
    ul(['Filters: action type, entity type, user','Shows user_name (from staff profile or email), action, entity type, entity ID, timestamp, IP address','Pagination with configurable limit up to 500 entries','Loads on dialog open (not on mount) for performance'])
},
{ id:'settings-security', title:'Security & Profile',
  content:
    h2('Security Tab') +
    h3('MFA Management') +
    ul(['<strong>Enable MFA:</strong> Shows QR code. Scan with authenticator app. Enter verification code.','<strong>Disable MFA:</strong> Requires current TOTP code verification.','<strong>Reset MFA:</strong> Removes MFA and allows re-setup.']) +
    h3('Password Change') +
    ul(['Current password + new password + confirm','Enforces: min 12 chars, uppercase + lowercase + digit + special char']) +
    h3('Session Management') +
    p('View active sessions with IP, device, and last activity. Revoke individual sessions or all other sessions.') +
    h2('Profile Tab') +
    h3('Account Info') +
    ul(['First name, last name, email, role, organisation','Departments: List of departments you belong to','Teams: List of teams you belong to']) +
    h3('Notification Preferences') +
    p('Toggle on/off 10 notification types: compliance, training, documents, leave, shift, swap, overtime, survey, delegation, general. When a type is disabled, you will not receive in-app or push notifications of that type. Preferences are per-user and persist across sessions.')
},
{ id:'settings-locations', title:'Locations & AI Config',
  content:
    h2('Locations Tab') +
    h3('Creating a Location') +
    step(1,'Click <strong>Add Location</strong>.') +
    step(2,'Fill in: Name, Address, Manager assignment (Autocomplete).') +
    step(3,'Click <strong>Save</strong>.') +
    h3('Staffing Rules per Location') +
    ul(['<strong>Minimum Staff Per Day:</strong> Total minimum staff across all shift types','<strong>Minimum Day Staff:</strong> Staff required during day shifts','<strong>Minimum Night Staff:</strong> Staff required during wake night shifts','<strong>Minimum Sleep Staff:</strong> Staff required during sleep shifts']) +
    p('These rules are enforced by the Rota Planner — you cannot unassign staff if it would drop below the minimum. The AI Rota Generator uses these to determine how many shifts to create.') +
    h3('Pagination') +
    p('Locations table is paginated (10 rows per page).') +
    h2('AI Tab') +
    p('(ORG_ADMIN only) Configure AI features for your organisation.') +
    h3('Provider Setup') +
    ul(['<strong>Provider:</strong> OpenAI or Anthropic','<strong>API Key:</strong> Your organisation\'s key. Costs are borne by you, not Meticle. No data leaves your tenant.','<strong>Model:</strong> e.g., gpt-4o, claude-3-5-sonnet']) +
    h3('Feature Toggles') +
    p('Enable/disable individual AI features: Compliance Gap Analysis, AI Rota Generator, Visit Note Analysis, Competency Assessment Assistant.') +
    h3('Usage Stats') +
    p('View: total AI calls, tokens used, success rate, cost estimate per feature. Audit log of all AI requests.') +
    tip('AI features are optional. The platform works identically without AI configured. Enable features incrementally as you become comfortable with them.')
},
{ id:'settings-billing', title:'Billing Tab',
  content:
    h2('Billing Tab (ORG_ADMIN only)') +
    h3('Current Plan') +
    p('View your subscription tier, price, renewal date, and included features.') +
    h3('Payment Methods') +
    ul(['<strong>Add Card:</strong> Enter card details via Stripe','<strong>Set Default:</strong> Click "Set as Default" on any card. The current default shows a bold "Default" indicator and brand-specific color chip (Visa blue, Mastercard orange, Amex green).','<strong>Delete Card:</strong> Remove a payment method. If the deleted card was the default, the next card is auto-assigned as default.']) +
    h3('Invoice History') +
    p('View past invoices with download capability.') +
    h3('Stripe Integration') +
    p('Meticle uses Stripe for payment processing. Products and prices are auto-provisioned on first use. Webhook can be tested locally using <code>stripe listen --forward-to localhost:3002/billing/webhook</code>.') +
    warn('Phase 2 add-ons (eMAR, Mobile PWA, Shift Marketplace, etc.) are not yet available for purchase. They will appear in billing when launched.')
}
]},

// ═══════════ 12. BILLING & MARKETPLACE ═══════════
{ id:'billing', category:'Billing & Marketplace', title:'Billing & Agencies', icon:'💳', subsections:[
{ id:'billing-full', title:'Managing Your Subscription',
  content:
    h2('Billing Page') +
    p('Manage your Meticle subscription, payment methods, and invoices. Accessible from the sidebar (ORG_ADMIN only).') +
    h3('Subscription') +
    ul(['View current plan, price, and renewal date','Upgrade or downgrade plan tier','View included features']) +
    h3('Card Management') +
    ul(['Add credit/debit cards via Stripe','Set a default payment method','Cards show brand colors (Visa, Mastercard, Amex)','Auto-assign next card as default when current default is deleted']) +
    h3('Invoices') +
    ul(['View invoice history','Download invoice PDFs']) +
    h2('Agencies Page') +
    p('Manage external agency workers.') +
    ul(['Add agency workers with: name, agency name, contact details, DBS check date, DBS expiry date, hourly rate','View and manage agency staff directory','The "Agency Saved" KPI on the dashboard is a placeholder for future cost calculation']) +
    tip('Stripe auto-provisions products and prices so you don\'t need to manually configure them in the Stripe dashboard.')
}
]},

// ═══════════ 13. ADVANCED ═══════════
{ id:'advanced', category:'Advanced', title:'Insights & Best Practices', icon:'📊', subsections:[
{ id:'insights', title:'Insights Dashboard',
  content:
    h2('Insights Page') +
    p('Provides analytics across your organisation.') +
    ul(['Staff analytics: headcount trends, turnover rates','Service user analytics: admissions, discharges, active counts','Operational metrics: shift fill rates, leave utilisation, incident frequency','Data visualisation with charts and tables']) +
    h2('Best Practices') +
    h3('For CQC Inspections') +
    ul(['Generate an evidence pack at least 2 weeks before inspection','Review gap analysis and create action items for any HIGH priority gaps','Ensure all identity documents are current (check the expiring dashboard widget)','Run satisfaction and engagement surveys quarterly — data feeds directly into Caring and Well-led domain scores','Keep training records up to date — expiring training counts against your Safe domain score']) +
    h3('Daily Operations') +
    ul(['Complete the daily medication count reconciliation every day','Review Today\'s Rota on the Dashboard each morning','Check the compliance dashboard weekly for trends','Use the body map to document any new skin conditions immediately','Record daily notes during or immediately after each shift for accuracy']) +
    h3('Staff Management') +
    ul(['Use the CSV import for bulk onboarding','Set up compliance profiles for each role before inviting staff','Use auto-assign by role for training modules to save time','Review staff compliance rates monthly and address anyone below threshold','Keep manager delegations up to date for leave/scheduling coverage'])
}
]}
]

export function getLearnSections(): LearnSection[] { return s }
export function getSectionById(id: string): LearnSection | undefined { return s.find(x => x.id === id) }
