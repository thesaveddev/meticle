/**
 * Mica's spoken-time resolution — the carer's wall-clock, resolved server-side.
 *
 * Why this exists. A carer says "book podiatry for tomorrow at 2pm". By the time
 * the request reaches CREATE_APPOINTMENT the words have been reduced to a title
 * and a subject, the *time* has nowhere to live, and the action refused the
 * draft with "When is the appointment? Give me a date and time." — asking a user
 * for something they had just said aloud. The 9 October phrasing test recorded
 * exactly that, plus the second half of the same bug: when a time did arrive it
 * arrived as a pre-resolved instant, and a `toISOString()` from the client's
 * `Date` turned "tomorrow at 2pm" spoken in BST into 23:15 UTC on the wrong day.
 *
 * The rule this module implements: never make the client pre-resolve a spoken
 * time. The server reads the utterance in UK wall-clock (the same
 * `Europe/London` default `homecare.digests.ts` uses for every other local-time
 * decision in this codebase), converts that wall-clock to a real instant with
 * the daylight-saving offset that was actually in force *on that date*, and
 * hands the action a UTC ISO string.
 *
 * Two deliberate refusals, because the confirm-before-persist draft is the only
 * thing standing between a misheard time and a booked appointment:
 *
 *  - A bare hour with no meridiem is not guessed at. "at 2" could be 02:00 or
 *    14:00 and a care system that books the wrong one silently is worse than one
 *    that asks; say "at 2pm" or "at 14:00". The caller's clarification then
 *    fires, which is the behaviour a missing time already had.
 *  - A date with no time of day ("book podiatry tomorrow") is also left to the
 *    clarification. A default time would be an invention.
 *
 * Pure by design: `now` and `timezone` are parameters, so the DST edges are
 * testable without a database, a clock or a frozen process timezone.
 */

/**
 * UK wall-clock, matching `DEFAULT_DIGEST_TIMEZONE` in `homecare.digests.ts`.
 * Mica serves UK providers; a per-org timezone column does not exist yet, so
 * this is the one place the assumption is named.
 */
export const MICA_TIMEZONE = 'Europe/London'

const WEEKDAY_INDEX: Record<string, number> = {
  sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6,
}

/** Spoken hours, so "half past two" resolves without the caller spelling "2". */
const WORD_HOURS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6,
  seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
}

const MONTHS: Record<string, number> = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
}

const MONTH_ABBREVIATIONS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12,
}

interface DayParts {
  year: number
  month: number
  day: number
}

interface ClockTime {
  hour: number
  minute: number
}

interface LocalParts extends DayParts, ClockTime {}

const dayKey = (day: DayParts): number => Date.UTC(day.year, day.month - 1, day.day)

function readParts(instant: Date, timezone: string): LocalParts {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(instant)
  const value = (type: string): number => Number(parts.find(part => part.type === type)?.value)
  return {
    year: value('year'),
    month: value('month'),
    day: value('day'),
    // `hour12: false` renders midnight as 24 in some ICU builds.
    hour: value('hour') % 24,
    minute: value('minute'),
  }
}

/**
 * The zone's offset from UTC at a given instant, in milliseconds.
 *
 * Derived by formatting the instant back into the zone and comparing that
 * wall-clock reading against the same digits read as UTC. This is the portable
 * way to ask a zone for its offset at a specific moment, which is what makes the
 * conversion below DST-correct rather than fixed-offset.
 */
function zoneOffsetMs(instant: Date, timezone: string): number {
  const parts = readParts(instant, timezone)
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute)
  // Minute resolution only: the formatter carries no seconds field, so comparing
  // against a millisecond-bearing timestamp would fold the remainder into the
  // offset. Every real zone offset is a whole number of minutes.
  const wholeMinute = Math.floor(instant.getTime() / 60_000) * 60_000
  return asUtc - wholeMinute
}

/**
 * A wall-clock reading in `timezone` → the instant it names.
 *
 * Two passes, because the offset depends on the instant we are still computing:
 * guess with the offset at the naive UTC reading, then re-read the offset at
 * that candidate and settle. For the hour that changes offset the second pass is
 * what makes it right: a nonexistent time in spring resolves to just after the
 * jump, and an ambiguous time in autumn resolves to its later, post-transition
 * reading — the naive guess is already past the change, so that is the instant
 * the second pass finds. Both are pinned by test rather than left to chance,
 * because an hour that resolves differently on two runs is worse than one that
 * resolves predictably and visibly wrong.
 */
export function zonedWallClockToUtc(parts: LocalParts, timezone: string = MICA_TIMEZONE): Date {
  const naive = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute)
  const firstPass = naive - zoneOffsetMs(new Date(naive), timezone)
  const settled = naive - zoneOffsetMs(new Date(firstPass), timezone)
  return new Date(settled)
}

function addDays(day: DayParts, days: number): DayParts {
  const shifted = new Date(Date.UTC(day.year, day.month - 1, day.day + days))
  return { year: shifted.getUTCFullYear(), month: shifted.getUTCMonth() + 1, day: shifted.getUTCDate() }
}

/** A day-of-month in a given month, or undefined when that date does not exist. */
function dayInMonth(year: number, month: number, day: number): DayParts | undefined {
  const roundTrip = new Date(Date.UTC(year, month - 1, day))
  if (roundTrip.getUTCMonth() + 1 !== month || roundTrip.getUTCDate() !== day) return undefined
  return { year, month, day }
}

/** The first day of the calendar month after `day`. */
function nextMonth(day: DayParts): DayParts {
  const shifted = new Date(Date.UTC(day.year, day.month, 1))
  return { year: shifted.getUTCFullYear(), month: shifted.getUTCMonth() + 1, day: 1 }
}

const weekdayOf = (day: DayParts): number => new Date(Date.UTC(day.year, day.month - 1, day.day)).getUTCDay()

/** `2026-10-13` → { year, month, day }, rejecting impossible calendar days. */
function parseIsoDay(text: string): DayParts | undefined {
  const match = text.match(/\b(\d{4})-(\d{2})-(\d{2})\b/)
  if (!match) return undefined
  return dayInMonth(Number(match[1]), Number(match[2]), Number(match[3]))
}

/**
 * The day an utterance names, if it names one.
 *
 * A bare weekday means its next occurrence — "Tuesday" said on a Tuesday is
 * seven days out, not today, because "on Tuesday" from someone already in
 * Tuesday is far more often next week's visit than a second one today. "next
 * Tuesday" resolves the same way on purpose: the two readings differ by a week
 * in some dialects, and the draft reads the date back before anything is booked,
 * so the reading the user is shown is the one that can be corrected.
 */
function parseNamedDay(text: string, today: DayParts): DayParts | undefined {
  const iso = parseIsoDay(text)
  if (iso) return iso

  if (/\bday after tomorrow\b/.test(text)) return addDays(today, 2)
  if (/\btomorrow\b/.test(text)) return addDays(today, 1)
  if (/\btoday\b|\btonight\b|\bthis (morning|afternoon|evening)\b/.test(text)) return today
  if (/\bnext week\b/.test(text)) return addDays(today, 7)

  const inDays = text.match(/\bin (\d{1,3}) (day|days|week|weeks)\b/)
  if (inDays) {
    const count = Number(inDays[1])
    return addDays(today, /week/.test(inDays[2]) ? count * 7 : count)
  }

  const weekday = Object.keys(WEEKDAY_INDEX).find(name => new RegExp(`\\b${name}\\b`).test(text))
  if (weekday) {
    const delta = (WEEKDAY_INDEX[weekday] - weekdayOf(today) + 7) % 7 || 7
    return addDays(today, delta)
  }

  const writtenMonth = text.match(/\b(?:on |the )?(\d{1,2})(?:st|nd|rd|th)?\s+(?:of\s+)?([a-z]{3,9})\b/)
  const month = writtenMonth ? (MONTHS[writtenMonth[2]] ?? MONTH_ABBREVIATIONS[writtenMonth[2]]) : undefined
  if (writtenMonth && month !== undefined) {
    const candidate = dayInMonth(today.year, month, Number(writtenMonth[1]))
    if (candidate) {
      // No year was spoken, so the next time that date comes round.
      return dayKey(candidate) < dayKey(today) ? dayInMonth(today.year + 1, month, Number(writtenMonth[1])) : candidate
    }
  }

  const ordinal = text.match(/\bon the (\d{1,2})(?:st|nd|rd|th)\b/)
  if (ordinal) {
    const thisMonth = dayInMonth(today.year, today.month, Number(ordinal[1]))
    if (thisMonth && dayKey(thisMonth) >= dayKey(today)) return thisMonth
    const following = nextMonth(today)
    return dayInMonth(following.year, following.month, Number(ordinal[1]))
  }

  return undefined
}

/**
 * The hour a spoken meridiem gives a named hour.
 *
 * The meridiem can follow the phrase ("quarter to three pm") or stand apart
 * ("9am, then quarter past two"): the token just after the phrase wins, and only
 * then does any meridiem in the utterance get a say. Without either the hour is
 * ambiguous and stays unresolved, which is how the caller ends up asking rather
 * than booking 02:45.
 */
function meridiemHour(text: string, spokenHour: number, fromIndex: number): number | undefined {
  const after = text.slice(fromIndex, fromIndex + 12).match(/\b(am|pm)\b/)
  const anywhere = text.match(/\b(am|pm)\b/)
  const suffix = after?.[1] ?? anywhere?.[1]
  if (!suffix) return undefined
  const twelveHour = spokenHour === 12 ? 12 : spokenHour
  return suffix === 'pm' ? (twelveHour === 12 ? 12 : twelveHour + 12) : (twelveHour === 12 ? 0 : twelveHour)
}

/**
 * The time of day an utterance names, if it names one unambiguously.
 *
 * Unambiguous means a meridiem ("2pm", "2 p.m."), a 24-hour reading
 * ("14:00", "at 14"), "noon"/"midnight", or a spoken half/quarter anchored on
 * one of those. "at 2" is deliberately not resolved — see the module header.
 */
function parseTimeOfDay(text: string): ClockTime | undefined {
  if (/\bnoon\b|\bmidday\b/.test(text)) return { hour: 12, minute: 0 }
  if (/\bmidnight\b/.test(text)) return { hour: 0, minute: 0 }

  const spoken = text.match(/\b(half|quarter) (past|to) ([a-z]+|\d{1,2})\b/)
  if (spoken) {
    const base = WORD_HOURS[spoken[3]] ?? Number(spoken[3])
    if (base >= 1 && base <= 12) {
      const resolved = meridiemHour(text, base, (spoken.index ?? 0) + spoken[0].length)
      if (resolved !== undefined) {
        const minute = spoken[1] === 'half' ? 30 : spoken[2] === 'past' ? 15 : 45
        // "quarter to three" is 02:45, so a "to" phrase borrows the hour before.
        return { hour: spoken[2] === 'past' ? resolved : (resolved + 23) % 24, minute }
      }
    }
  }

  const clock = text.match(/\b(\d{1,2}):(\d{2})\s*(am|pm)?\b/)
  if (clock) {
    const hour = Number(clock[1])
    const minute = Number(clock[2])
    if (hour <= 23 && minute <= 59) {
      if (clock[3] === 'pm' && hour <= 12) return { hour: hour === 12 ? 12 : hour + 12, minute }
      if (clock[3] === 'am' && hour <= 12) return { hour: hour === 12 ? 0 : hour, minute }
      // No meridiem: read as the 24-hour clock, which is what "14:00" is.
      return { hour, minute }
    }
  }

  const hourMeridiem = text.match(/\b(\d{1,2})\s*(am|pm)\b/)
  if (hourMeridiem) {
    const hour = Number(hourMeridiem[1])
    if (hour >= 1 && hour <= 12) {
      return hourMeridiem[2] === 'pm'
        ? { hour: hour === 12 ? 12 : hour + 12, minute: 0 }
        : { hour: hour === 12 ? 0 : hour, minute: 0 }
    }
  }

  const wordMeridiem = text.match(/\b([a-z]+)\s*(am|pm)\b/)
  if (wordMeridiem && WORD_HOURS[wordMeridiem[1]] !== undefined) {
    const hour = WORD_HOURS[wordMeridiem[1]]
    return wordMeridiem[2] === 'pm'
      ? { hour: hour === 12 ? 12 : hour + 12, minute: 0 }
      : { hour: hour === 12 ? 0 : hour, minute: 0 }
  }

  const oClock = text.match(/\b(\d{1,2}) ?o'? ?clock\s*(am|pm)\b/)
  if (oClock) {
    const hour = Number(oClock[1])
    if (hour >= 1 && hour <= 12) {
      return oClock[2] === 'pm'
        ? { hour: hour === 12 ? 12 : hour + 12, minute: 0 }
        : { hour: hour === 12 ? 0 : hour, minute: 0 }
    }
  }

  return undefined
}

/**
 * Resolve the time an utterance names, as a UTC ISO instant, or `undefined` when
 * it does not name one unambiguously.
 *
 * `undefined` is a normal answer, not a failure: the caller keeps its existing
 * clarification, which is the right thing to ask a user whose phrase carried no
 * bookable time.
 */
export function resolveSpokenTime(
  utterance: string,
  now: Date,
  timezone: string = MICA_TIMEZONE,
): string | undefined {
  const text = (utterance || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    // "2.30 p.m." → "2:30 pm", so one pattern covers every dotted, spaced and
    // colonless way a time gets written down.
    .replace(/\ba\.\s?m\.?/g, 'am')
    .replace(/\bp\.\s?m\.?/g, 'pm')
    .replace(/(\d{1,2})\.(\d{2})\s?(am|pm)?\b/g, (_match, hour, minute, suffix) =>
      suffix ? `${hour}:${minute} ${suffix}` : `${hour}:${minute}`,
    )
    .trim()
  if (!text) return undefined

  const timeOfDay = parseTimeOfDay(text)
  if (!timeOfDay) return undefined

  const nowLocal = readParts(now, timezone)
  const today: DayParts = { year: nowLocal.year, month: nowLocal.month, day: nowLocal.day }
  const named = parseNamedDay(text, today)
  const day = named ?? today

  const candidate = zonedWallClockToUtc({ ...day, ...timeOfDay }, timezone)
  // Only a phrase with no date of its own rolls forward: "at 2pm" said at 3pm
  // means tomorrow, but "today at 2pm" said at 3pm is a mistake the draft should
  // show as spoken rather than silently move.
  if (!named && candidate.getTime() < now.getTime()) {
    return zonedWallClockToUtc({ ...addDays(day, 1), ...timeOfDay }, timezone).toISOString()
  }
  return candidate.toISOString()
}
