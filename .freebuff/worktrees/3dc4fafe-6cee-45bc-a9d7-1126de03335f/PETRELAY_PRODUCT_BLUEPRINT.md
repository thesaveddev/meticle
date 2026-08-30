# PetRelay Product Blueprint

**Status:** Pre-build decision document  
**Prepared:** 27 August 2026  
**Product thesis:** Make pet care portable between owners, families, sitters, boarding providers, foster carers, and veterinary professionals.

> This document is a planning model, not a financial forecast or legal opinion. All figures are estimates and should be validated with Nigerian customers and suppliers before spending materially.

---

## 1. Executive summary

PetRelay is a shared pet-care coordination product centred on one object: the **Care Pass**.

A pet owner creates a structured profile and care plan, then shares a secure, temporary link with a sitter, family member, boarding business, foster carer, or vet. The recipient sees exactly what to do, confirms tasks, and can access emergency information without needing to install the full app.

The initial product should not try to be a social network, AI veterinarian, GPS tracker, marketplace, insurance product, and e-commerce store at the same time. The first release should solve one repeated, painful job:

> **Hand a pet to another person without losing instructions, records, or accountability.**

### Recommended launch strategy

- Start in one city, preferably Lagos.
- Begin with pet sitters, boarding providers, foster organisations, and owners of medicated pets.
- Use a mobile app for owners and a lightweight web Care Pass for recipients.
- Use WhatsApp as a communication and acquisition channel, not as the only system of record.
- Validate manually before building a full platform.
- Charge professionals early; do not depend on consumer advertising.

### Decision recommendation

Proceed only if a manual pilot demonstrates:

1. Owners create care plans without extensive assistance.
2. Recipients actually use the Care Pass.
3. At least some users pay or a professional partner agrees to pay.
4. The workflow is meaningfully better than WhatsApp, paper, and photo galleries.

---

## 2. Problem definition

Pet-care information is usually scattered across:

- WhatsApp messages
- Paper vaccination cards
- Vet invoices
- Photos of prescriptions
- Notes apps
- Phone contacts
- Family members' memories
- Different boarding or grooming forms

This creates predictable failures:

- A sitter misses a feeding or medication instruction.
- A vet does not see the pet's full history.
- A boarding business repeatedly asks for the same details.
- A pet owner cannot quickly find vaccination proof.
- Emergency contacts are unavailable when needed.
- A foster organisation loses continuity when a pet changes homes.

PetRelay is valuable when care is transferred between people. If an owner lives alone with a healthy pet and never shares responsibility, the product has less urgency.

---

## 3. Target customers

### Primary customer segments

#### A. Boarding and pet-sitting businesses

**Pain:** Repeatedly collect feeding, medication, behaviour, and emergency instructions.  
**Value:** Standardised intake, fewer misunderstandings, better customer confidence.  
**Monetisation:** Monthly professional subscription.

#### B. Foster and rescue organisations

**Pain:** Multiple carers need consistent records and handovers.  
**Value:** Continuity of care, central history, transfer-ready records.  
**Monetisation:** Low-cost organisation plan or sponsorship.

#### C. Owners of medicated or chronically ill pets

**Pain:** Multiple people must give the correct care and record it.  
**Value:** Shared medication logs, vet summaries, reminders, and audit trail.  
**Monetisation:** Consumer premium.

#### D. Frequent travellers and multi-person households

**Pain:** Care instructions are repeatedly sent and easily lost.  
**Value:** Reusable care templates and temporary access.  
**Monetisation:** Consumer premium.

### Secondary segments

- Groomers
- Veterinary clinics
- New puppy and kitten owners
- Pet transport services
- Breeders with responsible handover processes
- University and community animal programmes

---

## 4. Product positioning

### Core promise

> **Anyone caring for your pet should know exactly what to do.**

### Positioning statement

For pet owners and care professionals who need reliable handovers, PetRelay is a shared care system that combines a pet profile, care instructions, task confirmation, and emergency information in one secure link. Unlike a clinic portal or pet diary, it works across providers and does not require every caregiver to install the app.

### What PetRelay is not

- Not a veterinary diagnosis service.
- Not a replacement for emergency veterinary care.
- Not a broadcast marketplace for unverified providers.
- Not a substitute for medical records held by a veterinarian.
- Not a GPS tracker unless a future hardware integration is added.

---

## 5. MVP product scope

### 5.1 Owner mobile app

#### Account and household

- Phone or email sign-up
- Household members
- Role-based access
- Notification preferences
- Account deletion and data export

#### Pet profile

- Name and photo
- Species and breed
- Sex and birth date
- Weight
- Identification or microchip number
- Allergies
- Conditions
- Current medications
- Vet contact
- Emergency contact
- Notes and behaviour preferences

#### Care timeline

- Vet visits
- Vaccinations
- Medication events
- Weight measurements
- Uploaded documents
- Photos and notes
- Grooming and boarding events

#### Care plan builder

- Feeding schedule
- Medication schedule
- Exercise and walk routine
- Behaviour instructions
- Restricted foods or activities
- Emergency instructions
- Start and end date
- Assigned caregiver

#### Care Pass creation

- Select pet
- Select care plan
- Select recipient
- Set expiry date
- Choose information to share
- Generate secure link or QR code
- Revoke access
- View activity and task completion

#### Reminders and task completion

- Scheduled tasks
- Push reminders
- Mark complete
- Add note or photo
- Record who completed the task
- Missed-task state
- Escalation to owner

#### Vet-ready summary

- Current medications
- Allergies
- Recent events
- Weight trend
- Uploaded records
- Owner questions
- Export to PDF or secure link

### 5.2 Recipient web Care Pass

The recipient should not need to install the app.

- Secure link access
- Pet identity and photo
- Today’s tasks
- Feeding instructions
- Medication instructions exactly as supplied by the owner/vet
- Emergency contact
- Vet contact
- Behaviour notes
- Task completion
- Notes and photos
- Report an issue
- Expiry and access notice

### 5.3 Admin console

- User management
- Pet and document moderation tools
- Abuse reports
- Support tickets
- Subscription status
- Audit logs
- Feature flags
- Data export/deletion requests
- Basic product analytics

### 5.4 Professional portal: limited MVP

Do not build a full practice-management system initially.

- Business profile
- Create or receive a Care Pass
- Client/pet intake form
- View assigned care instructions
- Mark handover complete
- Upload visit notes or documents
- Manage staff access

---

## 6. Deferred features

These features should wait until the Care Pass is proven:

- AI symptom interpretation
- Automated diagnosis
- In-app veterinary consultations
- GPS hardware
- Pet social network
- National marketplace
- E-commerce catalogue
- Insurance claims
- Pharmacy integration
- Complex clinic software integrations
- Automated breed or food recommendations
- Nationwide emergency dispatch
- Multi-country regulatory workflows

The main reason to defer them is not technical difficulty alone. They add medical, operational, moderation, liability, and support complexity before the central workflow is validated.

---

## 7. Core user journeys

### Journey A: Owner preparing for boarding

1. Owner adds pet and uploads vaccination document.
2. Owner selects “Boarding plan.”
3. App prompts for feeding, medications, behaviour, and emergency contacts.
4. Owner shares the Care Pass with the boarding provider.
5. Provider confirms receipt and requests missing information.
6. Provider records daily care tasks.
7. Owner sees status and receives alerts for missed or concerning tasks.
8. Care Pass expires after pickup.

### Journey B: Medication handover

1. Owner adds medication instructions from the vet.
2. Owner assigns tasks to partner or sitter.
3. Caregiver receives reminders.
4. Caregiver records each dose.
5. Owner sees completion history.
6. Missed doses trigger a neutral escalation: “Contact the owner/vet for instructions.”

The app must never invent a replacement dosage or tell the caregiver to double a dose.

### Journey C: Vet visit

1. Owner opens the pet timeline.
2. Owner selects a date range.
3. App generates a summary.
4. Owner reviews and approves it.
5. Owner shares the summary or exports PDF.
6. Vet adds a document or note if the workflow supports it.

### Journey D: Foster transfer

1. Rescue organisation creates pet profile.
2. Current foster carer logs food, medication, behaviour, and appointments.
3. Organisation assigns a new foster carer.
4. New carer receives a transfer Care Pass.
5. Historical records remain attached to the pet.
6. Access is changed when the foster placement ends.

---

## 8. Trust, privacy, and safety

PetRelay may contain personal data, location information, veterinary documents, and emergency contacts. Trust is a product feature, not just an engineering concern.

### Required controls

- HTTPS everywhere
- Encrypted storage for sensitive documents
- Signed, expiring share links
- Immediate link revocation
- Explicit sharing permissions
- Separate owner, caregiver, professional, and admin roles
- Access audit trail
- No public home addresses
- Document access logs
- User export and deletion
- Backups and disaster recovery
- Rate limiting and abuse monitoring
- Malware scanning for uploads
- Privacy policy and terms of service

### Medical safety

- Label the product as an organiser and communication tool.
- Do not diagnose.
- Do not prescribe or change doses.
- Show the original instruction source where possible.
- Provide “contact a vet” guidance for concerning situations.
- Have a veterinarian review health-related UX and copy.

### Nigerian operational safety

- Verify provider identities and professional credentials where applicable.
- Display last verification date.
- Let users report providers.
- Do not rank providers solely by payment.
- Have a clear dispute and refund process.
- Follow applicable Nigerian data-protection obligations and obtain legal advice before launch.

---

## 9. Nigerian market adaptation

### Recommended starting geography

Start in Lagos, then evaluate Abuja, Port Harcourt, and Ibadan.

A city-first model is important because a directory is not useful if providers are too dispersed or unavailable.

### Local product decisions

- Phone-number authentication
- WhatsApp sharing and notifications where appropriate
- Low-data mobile experience
- Nigerian naira pricing
- Paystack and/or Flutterwave
- Bank transfer support for professional customers
- Provider phone and WhatsApp buttons
- House-call and pet-transport fields
- Price ranges with last-updated timestamps
- English first; local-language support only after validation
- Local emergency and clinic-directory configuration

### Local trust signals

- Verified business badge
- License or credential field where relevant
- Physical location or service area
- Response-time indicator
- Customer reviews
- Provider-submitted documents
- Last verification date
- “Sponsored” label for paid placement

### Local competitive context

Existing Nigerian and Nigeria-serving options appear to include:

- PetBacker for pet sitting, boarding, grooming, and walking
- Pettify for pet listings and related products
- Emerging tele-vet and pet-care services
- Instagram, Facebook, phone, and WhatsApp as informal discovery channels

PetRelay should not compete by simply listing more providers. It should combine trusted provider contact with a portable pet record and handover workflow.

---

## 10. Competitive advantage

### Primary differentiator

**Portable care handover across providers.**

The Care Pass should work even when:

- The vet uses different software.
- The sitter is not a PetRelay user.
- The boarding business is small.
- The owner is in another city.
- The recipient only wants a link, not a full account.

### Defensibility over time

Potential moats include:

- Structured longitudinal pet-care history
- Reusable care-plan templates
- Provider workflows and integrations
- Verified professional network
- Caregiver completion history
- Trust and safety reputation
- Distribution through boarding, rescue, and clinic partners

A feature list alone is not defensible. Adoption, data continuity, and provider distribution are.

---

## 11. Technical blueprint

### Recommended stack

#### Mobile

- React Native with Expo
- TypeScript
- Expo Router
- TanStack Query for server state
- Zustand or equivalent for local state
- Expo Notifications initially
- RevenueCat if subscriptions are introduced

#### Web recipient experience

- React or Next.js responsive web app
- Token-based Care Pass access
- Progressive enhancement for low-bandwidth conditions

#### Backend

- Node.js and TypeScript
- Fastify or Express
- PostgreSQL
- Redis only when caching/queues require it
- Object storage compatible with S3
- Background worker for reminders and document processing

#### Integrations

- Paystack/Flutterwave
- WhatsApp Business provider, subject to approval and cost
- Email provider
- Push notifications
- PDF generation
- Optional maps/geocoding later

### Main services

- Identity and authentication
- Pet profiles
- Care plans
- Tasks and reminders
- Share tokens and permissions
- Documents
- Notifications
- Professional accounts
- Billing
- Admin and moderation
- Audit logging

### Simplified data model

```text
users
households
household_members
pets
pet_conditions
pet_medications
pet_vaccinations
pet_documents
care_plans
care_plan_tasks
care_passes
care_pass_permissions
care_task_events
providers
provider_staff
vet_visits
notifications
subscriptions
audit_events
```

### Care Pass security model

- Generate a random, high-entropy token.
- Store only a hash of the token.
- Set expiry by default.
- Allow owner revocation.
- Scope the pass to one pet and one care plan.
- Never expose internal database IDs as authorization.
- Log access and task events.
- Offer optional passcode protection.

### Reliability targets for MVP

- Daily backups
- Error monitoring
- Basic uptime monitoring
- Document upload retry
- Offline-friendly task completion with later sync
- Clear failure states when notifications do not send

---

## 12. Recommended build phases

### Phase 0: discovery and manual pilot — 2 to 4 weeks

- Interview owners and providers.
- Recruit 20–30 Lagos providers.
- Build a simple directory and form-based Care Pass.
- Run 30–50 real handovers manually.
- Measure task completion and repeated use.

**Exit condition:** At least 10 active pilot households and 3 providers request continued use or agree to pay.

### Phase 1: MVP — 8 to 12 weeks

- Authentication
- Pet profiles
- Care plans
- Care Pass web page
- Reminders
- Basic documents
- Owner app
- Admin console
- Analytics and support

### Phase 2: professional workflow — 6 to 10 weeks

- Provider accounts
- Intake forms
- Multi-staff permissions
- Client list
- Branded Care Pass
- Billing
- Provider reporting

### Phase 3: local network — 8 to 12 weeks

- Verified provider directory
- WhatsApp workflows
- Payments
- Appointment requests
- Lost-pet alerts
- Local emergency directory

### Phase 4: expansion — after traction

- Additional Nigerian cities
- Foster/rescue tools
- Vet integrations
- More languages
- Other African markets
- International privacy and payment support

---

## 13. Cost to build

Costs vary greatly by whether the founder builds the product, uses contractors, or hires an agency. The estimates below are planning ranges for a working MVP, not a guaranteed quote.

### Option A: founder-led / low-cost validation

| Item | Estimated cost |
|---|---:|
| Landing page and forms | $0–$200 |
| Basic hosting and domain | $50–$250 |
| WhatsApp Business setup/tools | $0–$300 |
| Design help/templates | $0–$500 |
| Legal/privacy review | $300–$1,500 |
| Provider verification and travel | $200–$1,000 |
| Research incentives | $200–$800 |
| **Estimated total** | **$750–$4,550** |

This is the recommended route before full development.

### Option B: lean freelancer MVP

| Item | Estimated cost |
|---|---:|
| Product/design specification | $1,000–$4,000 |
| Mobile app | $8,000–$25,000 |
| Care Pass web experience | $3,000–$10,000 |
| Backend and database | $8,000–$25,000 |
| Admin portal | $2,000–$8,000 |
| QA and release support | $2,000–$7,000 |
| Legal, privacy, and veterinary review | $1,000–$5,000 |
| **Estimated total** | **$25,000–$84,000** |

### Option C: professional product team

| Item | Estimated cost |
|---|---:|
| Discovery and UX research | $5,000–$20,000 |
| Product design | $10,000–$30,000 |
| Mobile apps and recipient web | $35,000–$100,000 |
| Backend and infrastructure | $30,000–$100,000 |
| Professional/admin systems | $15,000–$60,000 |
| Security, QA, analytics, release | $15,000–$50,000 |
| Legal, compliance, and clinical review | $5,000–$25,000 |
| **Estimated total** | **$115,000–$385,000** |

For a first Nigerian pilot, Option C is excessive unless funding is already available.

### Cost range in naira

Exchange rates change, so use current rates before budgeting. At an illustrative rate of ₦1,500 per US dollar:

- Validation: approximately ₦1.1m–₦6.8m
- Lean MVP: approximately ₦37.5m–₦126m
- Professional build: approximately ₦172.5m–₦577.5m

These conversions are illustrative only.

---

## 14. Monthly operating costs

### Pilot stage

| Item | Estimated monthly cost |
|---|---:|
| Hosting/database/storage | $25–$200 |
| Email and push notifications | $0–$100 |
| WhatsApp tooling | $0–$300+ |
| Analytics/error monitoring | $0–$100 |
| Support phone/data | $50–$250 |
| Provider verification/field work | $100–$500 |
| Marketing experiments | $100–$1,000 |
| **Estimated total** | **$275–$2,450/month** |

### Early production stage

| Item | Estimated monthly cost |
|---|---:|
| Infrastructure and backups | $150–$1,000 |
| Messaging and notifications | $100–$1,500 |
| Support | $500–$3,000 |
| Provider operations | $500–$3,000 |
| Marketing and sales | $1,000–$10,000 |
| Security/legal/accounting | $300–$2,000 |
| **Estimated total** | **$2,550–$20,500/month** |

The largest cost is likely people and acquisition, not servers.

---

## 15. How much before the first customer?

“First customer” needs definition:

- **First user:** someone who creates a free pet profile.
- **First paid consumer:** someone who pays for a premium plan.
- **First professional customer:** a sitter, boarding business, clinic, or rescue that pays.

### Cheapest credible path to first customer

A founder-led pilot can potentially reach the first paying professional customer for approximately:

> **$1,500–$6,000 before revenue**

Approximate allocation:

| Activity | Estimate |
|---|---:|
| Customer interviews and incentives | $300–$800 |
| Landing page and basic prototype | $100–$700 |
| Manual Care Pass system | $100–$500 |
| Local travel and provider verification | $300–$1,500 |
| Legal/privacy review | $300–$1,500 |
| Outreach and pilot marketing | $400–$1,000 |
| **Total** | **$1,500–$6,000** |

This assumes the founder handles sales and product work and uses lightweight tools.

### If building the app before selling

If you build a lean MVP first, a more realistic amount before the first paid customer is:

> **$25,000–$90,000**

That includes development, testing, legal review, initial provider recruitment, and early marketing. It is riskier because you can spend the money before confirming that providers or owners will pay.

### Recommended path

Do not spend $25,000+ before trying to sell the workflow manually. First sell:

- A verified care-intake service
- A digital Care Pass
- Reminder coordination
- A boarding/foster handover workflow

If someone pays for the manual version, product development has evidence behind it.

---

## 16. Monetisation model

### Consumer free tier

- One or two pets
- Basic profile
- Limited Care Passes
- Basic reminders

### Consumer premium

Potential test range in Nigeria: **₦1,500–₦5,000/month**, with annual pricing tested separately.

Features:

- Unlimited pets
- Unlimited Care Passes
- Advanced reminders
- Document history
- Vet summaries
- Household sharing
- Care history export
- Priority support

### Professional plans

Potential test range: **₦10,000–₦50,000/month** for small providers, increasing with staff, client, and workflow limits.

Features:

- Client intake
- Multiple staff
- Branded Care Passes
- Care history
- Follow-up reminders
- Customer records
- Basic analytics

### Transaction revenue

Possible later sources:

- Booking fee
- Pet transport commission
- Boarding/grooming commission
- Sponsored placement
- Food or medicine referral

### Advertising

Use sparingly. Avoid ads in medication, emergency, and sensitive health workflows.

---

## 17. Early financial scenarios

These are illustrative planning scenarios, not forecasts.

### Early traction

- 5,000 monthly active households
- 3% paid conversion
- 150 paying households
- Average net consumer revenue: ₦3,000/month
- 15 professional accounts at ₦20,000/month

Approximate monthly gross:

```text
150 × ₦3,000 = ₦450,000
15 × ₦20,000 = ₦300,000
Total = ₦750,000/month
```

### Strong Lagos niche

- 20,000 monthly active households
- 5% paid conversion
- 1,000 paying households
- 75 professional accounts at ₦25,000/month

Approximate monthly gross:

```text
1,000 × ₦3,000 = ₦3,000,000
75 × ₦25,000 = ₦1,875,000
Total = ₦4,875,000/month
```

These scenarios depend on retention, customer support, provider supply, and payment behaviour.

---

## 18. Go-to-market plan

### Step 1: recruit supply

Personally recruit and verify:

- 10 vets or clinics
- 5 boarding providers
- 5 groomers
- 5 pet sitters/transporters
- 2 rescue or foster groups

Start with one Lagos area rather than the whole city.

### Step 2: sell a workflow, not an app

Pitch boarding businesses:

> “We give your customers a structured digital handover, so your staff do not lose feeding, medication, and emergency instructions in WhatsApp.”

Pitch owners:

> “Create one trusted care sheet and share it whenever someone looks after your pet.”

### Step 3: manual pilot

Use:

- Landing page
- Airtable or simple database
- WhatsApp Business
- Secure document links
- Basic web Care Pass
- Manual support

Do not hide the manual work. Learn which parts need automation.

### Step 4: convert the first professional customer

Offer a 30-day pilot with a clear success condition:

- Number of pet handovers
- Time saved on intake
- Completion rate
- Customer satisfaction
- Repeated usage

Then charge for continued access.

### Acquisition channels

- Boarding and grooming partnerships
- Vet referrals
- Rescue and foster networks
- Pet communities and WhatsApp groups
- Instagram/TikTok educational content
- Local pet events
- Pet-food retailers
- University veterinary networks

Avoid buying broad app-install advertising before knowing which segment converts.

---

## 19. Validation scorecard

### Must-prove assumptions

| Assumption | Test | Proceed signal |
|---|---|---|
| Owners need structured handover | Interview + pilot | Repeated real use |
| Recipients open the Care Pass | Link analytics | Most recipients access it |
| Tasks are completed | Pilot logs | Majority completed without prompting |
| Providers value it | Paid pilot | At least one renewal |
| Users trust storage | Interviews | Low concern after explanation |
| Local channels work | WhatsApp tests | Requests convert to appointments |
| Pricing is viable | Paid offers | Real payment, not compliments |

### Suggested 30-day pilot goals

- 30 owner interviews
- 15 provider interviews
- 50 Care Passes created
- 25 completed handovers
- 10 recurring households
- 3 professional pilots
- 1 paid professional account
- 30%+ recipient repeat usage as an early directional signal

These numbers are operating targets, not universal benchmarks.

### Stop or pivot signals

- Owners say WhatsApp is already sufficient and do not use the Care Pass.
- Providers will only use it if it is free.
- Recipients do not complete tasks.
- Pet owners are unwilling to store documents.
- Supply is too sparse in the chosen launch area.
- Support burden is too high for the revenue available.

---

## 20. Risks and mitigations

### Low willingness to pay

**Mitigation:** Sell to professionals first and keep basic owner access free.

### Marketplace cold start

**Mitigation:** Do not start as a broad marketplace. Start with Care Pass and recruit a small verified network.

### Medical liability

**Mitigation:** No diagnosis or treatment advice; veterinary review; clear limitations; professional escalation.

### Privacy concerns

**Mitigation:** Minimal data collection, expiring links, permissions, revocation, encryption, transparent policy.

### Poor connectivity

**Mitigation:** Lightweight recipient web page, low-resolution uploads, offline task caching, WhatsApp fallback.

### Unverified provider quality

**Mitigation:** Verification workflow, reports, reviews, suspension tools, visible verification dates.

### Founder builds too much

**Mitigation:** Require paid pilot evidence before adding marketplace, AI, GPS, or commerce features.

---

## 21. Product metrics

### Activation

- Pet profile completed
- First care plan created
- First Care Pass shared

### Engagement

- Care Pass opened
- Tasks completed
- Reminder interactions
- Documents uploaded
- Repeat Care Pass created

### Business

- Provider activation
- Paid conversion
- Monthly recurring revenue
- Churn
- Support cost per account
- Lead-to-booking conversion

### Trust and safety

- Reported providers
- Link abuse attempts
- Document access events
- Revoked links
- Failed notifications
- Data deletion requests

The north-star metric should be:

> **Completed pet handovers per active household or professional account.**

Downloads and registered users are secondary.

---

## 22. Final recommendation

PetRelay is worth validating, but only as a focused coordination product.

### Build first

- Pet profile
- Care plan
- Care Pass
- Shared tasks
- Documents
- Emergency summary
- Professional intake
- Secure web recipient experience

### Validate first

- Lagos boarding and sitting businesses
- Owners of medicated pets
- Foster/rescue organisations
- Multi-person households

### Budget recommendation

Set aside approximately:

- **$1,500–$6,000** for discovery, manual operations, legal review, and the first paid pilot.
- **$25,000–$90,000** for a lean production MVP after the pilot proves demand.
- Avoid a larger build until professional retention and repeated handovers are demonstrated.

### Go/no-go decision

Proceed to full MVP development if:

- At least one provider pays for a pilot or signs a paid letter of intent.
- At least 25 real Care Pass handovers are completed.
- Users return for another handover.
- The workflow is faster or safer than their current WhatsApp process.
- The product can operate within a realistic support budget.

**Final thesis:** PetRelay can work in Nigeria and later globally, but its first defensible product is not “an app for all pet owners.” It is a trusted, portable care-handover system distributed through the people and businesses already responsible for pets.
