/**
 * The data the store screenshots are taken against.
 *
 * Everything here is invented and belongs to nobody: the clients, the address,
 * the phone numbers and the care notes are invented for the listing. Times are
 * the one part that is *not* fixed, because the Today screen classifies a visit
 * against the real clock — a hard-coded 09:00 visit would be "in progress" at
 * 09:00 and "overdue" at 15:00, so the set would break depending on when the
 * capture ran. Instead every time is derived from `now` and snapped to the
 * half-hour, so the timeline reads the same at any hour of any day.
 */
import type { AuthSession, HomecareVisit, MobileUser, OfflineVisitAction } from '../types'

/** Ids the shot list navigates by. Keep them in one place so the two cannot drift. */
export const CAPTURE_IDS = {
  visitMorning: 'cap-visit-morning',
  visitInProgress: 'cap-visit-in-progress',
  visitNext: 'cap-visit-next',
  visitLater: 'cap-visit-later',
  personEileen: 'cap-person-eileen',
  personPriya: 'cap-person-priya',
  channelCareTeam: 'cap-channel-care-team',
  channelNightHandover: 'cap-channel-night-handover',
  channelSana: 'cap-channel-sana',
} as const

export const CARER: MobileUser = {
  id: 'cap-staff-amara',
  email: 'amara.okafor@brightwatercare.co.uk',
  role: 'CARE_WORKER',
  organizationId: 'cap-org-brightwater',
  first_name: 'Amara',
  last_name: 'Okafor',
  organization: { id: 'cap-org-brightwater', name: 'Brightwater Home Care' },
}

export const CAPTURE_SESSION: AuthSession = {
  accessToken: 'capture-access-token',
  refreshToken: 'capture-refresh-token',
  user: CARER,
  organization: {
    id: 'cap-org-brightwater',
    name: 'Brightwater Home Care',
    logo_url: null,
    // Supported living rather than domiciliary, because the client record
    // screenshot is meant to show the medication tab, and ClientDetailScreen
    // hides medication for domiciliary organisations. Adding 'domiciliary' here
    // swaps the Today card for the open-call marketplace but takes the
    // medication tab away again — the app gates both on the same flag.
    service_types: ['supported_living'],
    emergency_contact_1_label: 'Brightwater 24h line',
    emergency_contact_1_phone: '0161 496 0100',
    emergency_contact_2_label: 'Sana Iqbal (coordinator)',
    emergency_contact_2_phone: '07700 900412',
  },
}

/** The half hour the clock is currently in, so every call lands on :00 or :30. */
function currentSlot(now: Date): Date {
  const d = new Date(now)
  d.setSeconds(0, 0)
  d.setMinutes(Math.floor(d.getMinutes() / 30) * 30)
  return d
}

const MINUTE = 60_000
const HOUR = 60 * MINUTE

export interface CaptureFixtures {
  session: AuthSession
  visits: HomecareVisit[]
  queue: OfflineVisitAction[]
  routes: Record<string, unknown>
}

/**
 * The four visits behind the Today screenshot: one done, one under way, the
 * next one, and a later one. That spread is what makes the timeline legible —
 * a list of four identical future rows says nothing.
 */
export function captureVisits(now: Date = new Date()): HomecareVisit[] {
  const slot = currentSlot(now)
  const morning = new Date(slot.getTime() - 3 * HOUR)
  const inProgress = new Date(slot)
  const next = new Date(slot.getTime() + HOUR)
  const later = new Date(slot.getTime() + 2 * HOUR)

  // Everything above sits inside the current clock half hour, so the ordering
  // holds at any minute of any day. The outer two are dropped when they would
  // land on the previous or the next day: the Today screen is given one day of
  // visits by the API, and a fixture that quietly included another day's would
  // put a 21:00 call from yesterday under today's date.
  const sameDay = (date: Date) => date.getDate() === now.getDate()
  const visits: HomecareVisit[] = []

  if (sameDay(morning)) visits.push({
      id: CAPTURE_IDS.visitMorning,
      label: 'Morning call',
      visit_type: 'personal_care',
      status: 'completed',
      scheduled_start: morning.toISOString(),
      scheduled_end: new Date(morning.getTime() + 60 * MINUTE).toISOString(),
      person_id: CAPTURE_IDS.personEileen,
      person_name: 'Eileen Fairweather',
      person_address: '14 Elmwood Road, Chorlton, Manchester M21',
      person_latitude: 53.4348,
      person_longitude: -2.2761,
      package_name: 'Personal care · 3 visits a week',
      assigned_staff_id: CARER.id,
      assigned_staff_name: 'Amara Okafor',
      travel_buffer_minutes: 30,
      check_in_at: morning.toISOString(),
      check_out_at: new Date(morning.getTime() + 55 * MINUTE).toISOString(),
      visit_notes: 'Breakfast and a full strip. Slept well, in good spirits. Asked about the garden in the spring.',
      photos: [],
      requires_two_staff: false,
  })

  visits.push({
      id: CAPTURE_IDS.visitInProgress,
      label: 'Personal care · double-up',
      visit_type: 'personal_care',
      status: 'checked_in',
      scheduled_start: inProgress.toISOString(),
      scheduled_end: new Date(inProgress.getTime() + 60 * MINUTE).toISOString(),
      person_id: CAPTURE_IDS.personEileen,
      person_name: 'Eileen Fairweather',
      person_address: '14 Elmwood Road, Chorlton, Manchester M21',
      person_latitude: 53.4348,
      person_longitude: -2.2761,
      package_name: 'Personal care · double-up',
      assigned_staff_id: CARER.id,
      assigned_staff_name: 'Amara Okafor',
      travel_buffer_minutes: 30,
      check_in_at: inProgress.toISOString(),
      check_out_at: null,
      visit_notes: null,
      photos: [],
      requires_two_staff: true,
      second_staff_id: 'cap-staff-rosa',
      second_staff_name: 'Rosa Mendes',
  })

  visits.push({
      id: CAPTURE_IDS.visitNext,
      label: 'Medication prompt',
      visit_type: 'medication',
      status: 'scheduled',
      scheduled_start: next.toISOString(),
      scheduled_end: new Date(next.getTime() + 30 * MINUTE).toISOString(),
      person_id: CAPTURE_IDS.personPriya,
      person_name: 'Priya Raman',
      person_address: '7 Cornbrook Road, Manchester M15',
      person_latitude: 53.4631,
      person_longitude: -2.2255,
      package_name: 'Medication and light domestic',
      assigned_staff_id: CARER.id,
      assigned_staff_name: 'Amara Okafor',
      travel_buffer_minutes: 30,
      check_in_at: null,
      check_out_at: null,
      visit_notes: null,
      photos: [],
      requires_two_staff: false,
  })

  if (sameDay(later)) {
    visits.push({
      id: CAPTURE_IDS.visitLater,
      label: 'Evening call',
      visit_type: 'personal_care',
      status: 'scheduled',
      scheduled_start: later.toISOString(),
      scheduled_end: new Date(later.getTime() + 30 * MINUTE).toISOString(),
      person_id: CAPTURE_IDS.personEileen,
      person_name: 'Eileen Fairweather',
      person_address: '14 Elmwood Road, Chorlton, Manchester M21',
      person_latitude: 53.4348,
      person_longitude: -2.2761,
      package_name: 'Personal care · 3 visits a week',
      assigned_staff_id: CARER.id,
      assigned_staff_name: 'Amara Okafor',
      travel_buffer_minutes: 30,
      check_in_at: null,
      check_out_at: null,
      visit_notes: null,
      photos: [],
      requires_two_staff: false,
    })
  }

  return visits
}

/**
 * Three actions waiting to sync, which is what the offline-sync screenshot is
 * actually about. All three are `pending` on purpose: the app distinguishes
 * "waiting to sync" from "the server refused this", and only the first of those
 * belongs in a store screenshot.
 */
export function captureQueue(now: Date = new Date()): OfflineVisitAction[] {
  const visits = captureVisits(now)
  const inProgress = visits.find(visit => visit.id === CAPTURE_IDS.visitInProgress)!
  const morning = visits.find(visit => visit.id === CAPTURE_IDS.visitMorning)
  const actions: OfflineVisitAction[] = [
    {
      id: 'cap-action-1',
      visitId: inProgress.id,
      action: 'check-in',
      payload: { latitude: 53.4351, longitude: -2.2758, accuracy_meters: 8 },
      createdAt: inProgress.check_in_at || now.toISOString(),
      state: 'pending',
    },
    {
      id: 'cap-action-2',
      visitId: inProgress.id,
      action: 'check-out',
      payload: { latitude: 53.4351, longitude: -2.2758, accuracy_meters: 8, actual_travel_minutes: 22, actual_mileage_miles: 4.1 },
      createdAt: new Date(new Date(inProgress.scheduled_end).getTime() - 5 * MINUTE).toISOString(),
      state: 'pending',
    },
  ]

  // A very early capture has no finished call to add a third action for. Two
  // waiting is still the point of the screenshot, so the rail is not padded with
  // an action for a visit that does not exist.
  if (morning) {
    actions.push({
      id: 'cap-action-3',
      visitId: morning.id,
      action: 'check-out',
      payload: { latitude: 53.4349, longitude: -2.2763, accuracy_meters: 11, actual_travel_minutes: 18, actual_mileage_miles: 3.4 },
      createdAt: morning.check_out_at || now.toISOString(),
      state: 'pending',
    })
  }

  return actions
}

const PERSON = {
  id: CAPTURE_IDS.personEileen,
  first_name: 'Eileen',
  last_name: 'Fairweather',
  preferred_name: 'Eileen',
  date_of_birth: '1941-03-18',
  gender: 'female',
  address: '14 Elmwood Road, Chorlton, Manchester M21 9AB',
  phone: '0161 496 0188',
  email: '',
  photo_url: null,
  status: 'active',
  language: 'English',
  gp_practice: 'Chorlton Health Centre',
  gp_phone: '0161 496 0200',
  next_of_kin_name: 'David Fairweather (son)',
  next_of_kin_phone: '07700 900318',
  next_of_kin_relation: 'Son',
  tenancy: 'Owner-occupier',
  support_needs: 'Early-stage Alzheimer’s. Registered blind in the left eye. Needs support with washing, dressing and meals.',
  allergies: 'Penicillin',
  conditions: ['Type 2 diabetes', "Alzheimer's disease, early stage", 'Hypertension'],
  mobility: 'Walks indoors with a frame. No steps at the property.',
  communication: 'Large print preferred. Asks the same question several times — reassure, do not correct.',
  risk_notes: 'Falls risk. One fall in February, no injury. Kitchen rug removed at the family’s request.',
  care_summary:
    'Eileen lives alone and is independent with her front door. Two staff calls a day: a morning call for personal care and breakfast, and an evening call for a meal and medication prompt. She is chatty and engages easily, and she will tell you about her garden unprompted.',
  preferred_visit_times: 'Mornings before 11:00, evenings after 17:00',
  access_notes: 'Key safe to the left of the porch. Code given at allocation. Door entry must be logged.',
  latitude: 53.4348,
  longitude: -2.2761,
  created_at: '2023-04-02T09:12:00.000Z',
  updated_at: '2026-09-18T14:03:00.000Z',
}

const MEDICATIONS = [
  {
    id: 'cap-med-1',
    record_id: 'cap-medrec-1',
    person_id: CAPTURE_IDS.personEileen,
    name: 'Metformin',
    generic_name: 'Metformin 500mg',
    dosage: '500mg',
    form: 'tablet',
    route: 'oral',
    frequency: 'Twice daily',
    times: ['08:00', '18:00'],
    with_food: true,
    purpose: 'Type 2 diabetes',
    prescriber: 'Dr H. Mbeki, Chorlton Health Centre',
    started_on: '2021-06-14',
    status: 'active',
    is_controlled_drug: false,
    stock_on_hand: 28,
    instructions: 'Take with food to avoid stomach upset.',
  },
  {
    id: 'cap-med-2',
    record_id: 'cap-medrec-1',
    person_id: CAPTURE_IDS.personEileen,
    name: 'Ramipril',
    generic_name: 'Ramipril 5mg',
    dosage: '5mg',
    form: 'tablet',
    route: 'oral',
    frequency: 'Once daily',
    times: ['08:00'],
    with_food: false,
    purpose: 'Blood pressure',
    prescriber: 'Dr H. Mbeki, Chorlton Health Centre',
    started_on: '2022-01-09',
    status: 'active',
    is_controlled_drug: false,
    stock_on_hand: 14,
    instructions: 'One tablet each morning.',
  },
  {
    id: 'cap-med-3',
    record_id: 'cap-medrec-1',
    person_id: CAPTURE_IDS.personEileen,
    name: 'Simvastatin',
    generic_name: 'Simvastatin 20mg',
    dosage: '20mg',
    form: 'tablet',
    route: 'oral',
    frequency: 'Once daily at night',
    times: ['22:00'],
    with_food: true,
    purpose: 'Cholesterol',
    prescriber: 'Dr H. Mbeki, Chorlton Health Centre',
    started_on: '2023-11-30',
    status: 'active',
    is_controlled_drug: false,
    stock_on_hand: 28,
    instructions: 'Prompt the evening call if the 22:00 dose has not been taken.',
  },
]

const ASSESSMENTS = [
  {
    id: 'cap-assess-1',
    person_id: CAPTURE_IDS.personEileen,
    type: 'Falls risk assessment',
    title: 'Falls risk assessment',
    score: 12,
    risk_level: 'moderate',
    summary: 'Moderate falls risk. Frame used indoors. Two-person call agreed for the morning personal care.',
    assessed_on: '2026-08-24',
    assessed_by: 'Sana Iqbal',
    next_review_on: '2027-02-24',
    status: 'current',
  },
  {
    id: 'cap-assess-2',
    person_id: CAPTURE_IDS.personEileen,
    type: 'Nutrition assessment',
    title: 'Nutrition assessment',
    score: null,
    risk_level: 'low',
    summary: 'Eating well. Left side of a full plate is often left — offer food, do not pressure.',
    assessed_on: '2026-07-11',
    assessed_by: 'Amara Okafor',
    next_review_on: '2027-01-11',
    status: 'current',
  },
]

const TIMELINE = [
  {
    id: 'cap-timeline-1',
    person_id: CAPTURE_IDS.personEileen,
    event_type: 'visit',
    title: 'Morning call completed',
    detail: 'Breakfast, full strip. Slept well and in good spirits.',
    occurred_at: '2026-09-26T08:42:00.000Z',
    recorded_by: 'Amara Okafor',
  },
  {
    id: 'cap-timeline-2',
    person_id: CAPTURE_IDS.personEileen,
    event_type: 'medication',
    title: 'Medication administered',
    detail: 'Metformin 500mg and Ramipril 5mg taken with breakfast.',
    occurred_at: '2026-09-26T08:15:00.000Z',
    recorded_by: 'Amara Okafor',
  },
  {
    id: 'cap-timeline-3',
    person_id: CAPTURE_IDS.personEileen,
    event_type: 'body_map',
    title: 'Bruise recorded — left forearm',
    detail: 'Healing, mild. Noticed during the morning call. No action needed beyond observation.',
    occurred_at: '2026-09-24T09:05:00.000Z',
    recorded_by: 'Amara Okafor',
  },
  {
    id: 'cap-timeline-4',
    person_id: CAPTURE_IDS.personEileen,
    event_type: 'note',
    title: 'Call missed — no answer at the door',
    detail: 'Rang David (son) who confirmed she was at a hospital appointment. Call rearranged for the following morning.',
    occurred_at: '2026-09-22T10:30:00.000Z',
    recorded_by: 'Sana Iqbal',
  },
]

const BODY_MAP_ENTRIES = [
  {
    id: 'cap-bm-1',
    person_id: CAPTURE_IDS.personEileen,
    body_view: 'front',
    body_zone: 'Left forearm',
    zone_x: 0.28,
    zone_y: 0.52,
    condition_type: 'bruise',
    description: 'Yellowing bruise, roughly the size of a 50p coin. Eileen does not recall how it happened.',
    severity: 'mild',
    status: 'healing',
    recorded_date: '2026-09-24',
    resolved_date: null,
    image_url: null,
    recorded_by_name: 'Amara Okafor',
    created_at: '2026-09-24T09:05:00.000Z',
  },
]

const DAILY_NOTES = [
  {
    id: 'cap-note-1',
    person_id: CAPTURE_IDS.personEileen,
    note_date: '2026-09-26',
    author: 'Amara Okafor',
    author_name: 'Amara Okafor',
    category: 'general',
    content: 'Slept well. In good spirits, talked about the garden. Ate a full breakfast. Left side of the plate left as usual, offered twice and declined politely.',
    created_at: '2026-09-26T08:50:00.000Z',
  },
  {
    id: 'cap-note-2',
    person_id: CAPTURE_IDS.personEileen,
    note_date: '2026-09-25',
    author: 'Rosa Mendes',
    author_name: 'Rosa Mendes',
    category: 'general',
    content: 'Evening call. Meal heated and eaten, medication prompted. Asked twice about David calling. Settled by nine.',
    created_at: '2026-09-25T19:20:00.000Z',
  },
]

const WELLBEING = [
  {
    id: 'cap-wb-1',
    person_id: CAPTURE_IDS.personEileen,
    recorded_date: '2026-09-20',
    mood: 'good',
    appetite: 'good',
    sleep: 'slept well',
    engagement: 'High — asked after the neighbours and the garden',
    notes: 'No concerns. Enjoyed a walk to the corner with her frame.',
    recorded_by_name: 'Amara Okafor',
  },
]

const CARE_PLANS = [
  {
    id: 'cap-cp-1',
    person_id: CAPTURE_IDS.personEileen,
    title: 'Morning personal care',
    status: 'active',
    review_date: '2027-01-11',
    summary: 'Full strip and wash, breakfast, medication prompt, clear fluids. Record what was eaten.',
    tasks: ['Offer a full strip', 'Prepare breakfast', 'Prompt morning medication', 'Record food and fluid'],
    created_by: 'Sana Iqbal',
  },
  {
    id: 'cap-cp-2',
    person_id: CAPTURE_IDS.personEileen,
    title: 'Evening support',
    status: 'active',
    review_date: '2027-01-11',
    summary: 'Meal, evening medication prompt, settle for the night. Check the back door is locked.',
    tasks: ['Heat the evening meal', 'Prompt evening medication', 'Check doors and windows'],
    created_by: 'Sana Iqbal',
  },
]

const CHAT_CHANNELS = [
  {
    id: CAPTURE_IDS.channelCareTeam,
    name: 'Care team — North Manchester',
    channel_type: 'channel',
    description: 'Daily coordination for the north round.',
    member_count: 14,
    unread_count: 2,
    last_message: 'Eileen’s double-up is covered by Rosa, all good.',
    last_message_at: '2026-09-26T09:02:00.000Z',
    created_at: '2025-11-04T08:00:00.000Z',
  },
  {
    id: CAPTURE_IDS.channelNightHandover,
    name: 'Night team handover',
    channel_type: 'channel',
    description: 'Evening and night staff.',
    member_count: 9,
    unread_count: 0,
    last_message: 'All visits completed, no concerns overnight.',
    last_message_at: '2026-09-25T22:14:00.000Z',
    created_at: '2025-11-04T08:05:00.000Z',
  },
  {
    id: CAPTURE_IDS.channelSana,
    name: 'Sana Iqbal',
    channel_type: 'dm',
    description: null,
    member_count: 2,
    unread_count: 0,
    last_message: 'Thanks Amara — noted, I’ll update the care plan.',
    last_message_at: '2026-09-25T16:40:00.000Z',
    created_at: '2025-11-04T08:10:00.000Z',
  },
]

function message(id: string, senderId: string, senderName: string, body: string, at: string, mine = false) {
  return {
    id,
    channel_id: CAPTURE_IDS.channelCareTeam,
    channel: CAPTURE_IDS.channelCareTeam,
    sender_id: senderId,
    sender_name: senderName,
    sender_email: `${senderName.toLowerCase().replace(/\s+/g, '.')}@brightwatercare.co.uk`,
    body,
    created_at: at,
    edited_at: null,
    file_url: null,
    file_name: null,
    is_mine: mine,
  }
}

const CHAT_MESSAGES = [
  message('cap-msg-1', 'cap-staff-rosa', 'Rosa Mendes', 'Morning all — I am on the double-up with Amara at Fairweather’s today.', '2026-09-26T08:31:00.000Z'),
  message('cap-msg-2', 'cap-staff-amara', 'Amara Okafor', 'Perfect, thank you Rosa. She prefers the second carer to know her before washing.', '2026-09-26T08:33:00.000Z', true),
  message('cap-msg-3', 'cap-staff-sana', 'Sana Iqbal', 'She is also due a blood pressure recheck this week. If you get a chance, the reading goes straight on the record.', '2026-09-26T08:40:00.000Z'),
  message('cap-msg-4', 'cap-staff-amara', 'Amara Okafor', 'Will do. I logged the bruise on her left forearm yesterday on the body map — healing, no action.', '2026-09-26T08:47:00.000Z', true),
  message('cap-msg-5', 'cap-staff-rosa', 'Rosa Mendes', 'Seen it, thank you. I’ll check it again at the evening call.', '2026-09-26T08:55:00.000Z'),
  message('cap-msg-6', 'cap-staff-sana', 'Sana Iqbal', 'Eileen’s double-up is covered by Rosa, all good.', '2026-09-26T09:02:00.000Z'),
]

const ORG_MEMBERS = [
  { id: 'cap-staff-sana', user_id: 'cap-staff-sana', first_name: 'Sana', last_name: 'Iqbal', email: 'sana.iqbal@brightwatercare.co.uk', role: 'MANAGER', is_online: true },
  { id: 'cap-staff-rosa', user_id: 'cap-staff-rosa', first_name: 'Rosa', last_name: 'Mendes', email: 'rosa.mendes@brightwatercare.co.uk', role: 'CARE_WORKER', is_online: true },
  { id: 'cap-staff-tomas', user_id: 'cap-staff-tomas', first_name: 'Tomás', last_name: 'Byrne', email: 'tomas.byrne@brightwatercare.co.uk', role: 'CARE_WORKER', is_online: false },
  { id: 'cap-staff-amara', user_id: 'cap-staff-amara', first_name: 'Amara', last_name: 'Okafor', email: 'amara.okafor@brightwatercare.co.uk', role: 'CARE_WORKER', is_online: true },
]

const VISIT_TASKS = [
  { id: 'cap-task-1', visit_id: CAPTURE_IDS.visitInProgress, label: 'Offer a full strip', done: true, sort_order: 1, created_at: '2026-09-01T09:00:00.000Z' },
  { id: 'cap-task-2', visit_id: CAPTURE_IDS.visitInProgress, label: 'Medication prompt — Metformin, Ramipril', done: true, sort_order: 2, created_at: '2026-09-01T09:00:00.000Z' },
  { id: 'cap-task-3', visit_id: CAPTURE_IDS.visitInProgress, label: 'Check the left forearm bruise', done: false, sort_order: 3, created_at: '2026-09-25T14:20:00.000Z' },
  { id: 'cap-task-4', visit_id: CAPTURE_IDS.visitInProgress, label: 'Record what was eaten and drunk', done: false, sort_order: 4, created_at: '2026-09-01T09:00:00.000Z' },
  { id: 'cap-task-5', visit_id: CAPTURE_IDS.visitInProgress, label: 'Check the back door is locked on the way out', done: false, sort_order: 5, created_at: '2026-09-01T09:00:00.000Z' },
]

/**
 * The pre-filled incident form. An empty form says nothing about the app, and a
 * half-written one is what a carer actually sees when something has happened.
 */
export const CAPTURE_INCIDENT_DRAFT = {
  category: 'fall',
  severity: 'medium',
  title: 'Unwitnessed fall in the hallway',
  description:
    'Eileen was found sitting on the hallway floor when I arrived at 08:31, about two minutes before the call was due to start. She was alert and oriented and said she had lost her balance getting up from the chair. No visible injury, no pain on moving her left arm or leg. I helped her into the armchair, checked her over and called the coordinator.',
  location: 'Hallway, 14 Elmwood Road',
  witnesses: 'None. Reported to Sana Iqbal by phone at 08:38.',
  isNearMiss: false,
}

const NOTIFICATIONS = [
  {
    id: 'cap-note-a',
    type: 'shift',
    title: 'Double-up call added',
    body: 'Rosa Mendes is covering the second carer for Mrs Fairweather’s morning call today.',
    data: { visitId: CAPTURE_IDS.visitInProgress },
    read: false,
    created_at: '2026-09-26T08:05:00.000Z',
  },
  {
    id: 'cap-note-b',
    type: 'care',
    title: 'Care plan updated',
    body: 'The morning personal care plan was reviewed by Sana Iqbal.',
    data: { personId: CAPTURE_IDS.personEileen },
    read: true,
    created_at: '2026-09-25T16:35:00.000Z',
  },
]

/** Every response the capture router can serve, keyed by `METHOD /path`. */
export function captureRoutes(now: Date = new Date()): Record<string, unknown> {
  const visits = captureVisits(now)
  return {
    'GET /auth/me': { user: CARER, organization: CAPTURE_SESSION.organization },
    'GET /homecare/my-visits': visits,
    'GET /homecare/ride-share-requests': [],
    'GET /homecare/settings/location-threshold': { location_threshold_meters: 150 },
    'GET /homecare/settings/require-photo': { require_photo_on_checkout: true },
    'GET /homecare/notifications': NOTIFICATIONS,
    'GET /homecare/exceptions': [],
    'GET /notifications': [],
    'GET /notifications/unread-count': { count: 1 },
    'GET /chat/unread': { [CAPTURE_IDS.channelCareTeam]: 2 },
    'GET /chat/channels': CHAT_CHANNELS,
    'GET /chat/ensure-general': { id: CAPTURE_IDS.channelCareTeam, name: 'Care team — North Manchester' },
    'GET /chat/channels/:channel/messages': { messages: CHAT_MESSAGES, other_last_read_at: '2026-09-26T08:47:00.000Z', member_reads: [{ user_id: 'cap-staff-rosa', last_read_at: '2026-09-26T09:00:00.000Z' }] },
    'GET /chat/channels/:channel/read-receipts': { other_last_read_at: '2026-09-26T08:47:00.000Z', member_reads: [{ user_id: 'cap-staff-rosa', last_read_at: '2026-09-26T09:00:00.000Z' }] },
    'GET /chat/channels/:channel/members': ORG_MEMBERS,
    'GET /chat/org-members': ORG_MEMBERS,
    'GET /staff/org-members': ORG_MEMBERS,
    [`GET /people/${CAPTURE_IDS.personEileen}`]: PERSON,
    [`GET /people/${CAPTURE_IDS.personEileen}/assessments`]: ASSESSMENTS,
    [`GET /people/${CAPTURE_IDS.personEileen}/timeline`]: TIMELINE,
    [`GET /people/${CAPTURE_IDS.personEileen}/daily-notes`]: DAILY_NOTES,
    [`GET /people/${CAPTURE_IDS.personEileen}/wellbeing`]: WELLBEING,
    [`GET /people/${CAPTURE_IDS.personEileen}/documents`]: [],
    [`GET /people/${CAPTURE_IDS.personEileen}/clinical-scores`]: [],
    [`GET /people/${CAPTURE_IDS.personEileen}/capacity`]: [],
    [`GET /people/${CAPTURE_IDS.personEileen}/care-pathways`]: CARE_PLANS,
    [`GET /people/${CAPTURE_IDS.personEileen}/communication-log`]: [],
    [`GET /people/${CAPTURE_IDS.personEileen}/time-away`]: [],
    [`GET /emedication/records`]: [{ id: 'cap-medrec-1', person_id: CAPTURE_IDS.personEileen, name: 'Current medication', active: true }],
    'GET /emedication/records/:recordId': { id: 'cap-medrec-1', person_id: CAPTURE_IDS.personEileen, name: 'Current medication', active: true, items: MEDICATIONS },
    [`GET /body-map/person/${CAPTURE_IDS.personEileen}/stats`]: { active_count: 0, healing_count: 1, resolved_count: 4, total_count: 5 },
    [`GET /body-map/person/${CAPTURE_IDS.personEileen}`]: BODY_MAP_ENTRIES,
    [`GET /body-map/person/${CAPTURE_IDS.personEileen}/active`]: BODY_MAP_ENTRIES,
    'GET /homecare/visits/:visitId/tasks': VISIT_TASKS,
    'GET /nutrition/:personId/meals/summary': { total_meals: 2, total_fluid_ml: 850, avg_consumed_percent: 72, meals_refused: 0 },
    'GET /shifts/open': [],
    'GET /shifts/my-claims': [],
  }
}

export function buildCaptureFixtures(now: Date = new Date()): CaptureFixtures {
  return {
    session: CAPTURE_SESSION,
    visits: captureVisits(now),
    queue: captureQueue(now),
    routes: captureRoutes(now),
  }
}
