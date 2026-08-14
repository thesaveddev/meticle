---
version: 1
slug: "apps-web-src-pages-chat-chatpage-tsx"
primary_target: "apps/web/src/pages/chat/ChatPage.tsx"
related_targets: []
---

# Chat surface brief

**Scope & mode:** Operate — the team's conversation console (channels, DMs, groups, shared files, reactions, presence).

**Audience:** Care managers, shift leads, and care workers inside an org, on duty and mid-shift. They open the console to see who is on shift and to continue the working day in one thread.

**Job / task:** Find the right conversation, see who is online and what is unread, send a message or file, react, edit, and manage group membership without leaving the console.

**Proof / content:** One calm console that shows who is on shift (presence dots, online counts) and carries the working day (unread badges, last-message previews, shared files). Real threads, live presence, shared files.

**Direction:** The framed-window operational world — a white window with a chrome sidebar (General / Groups / Direct messages) seated on warm bone, navy identity carried by self-messages, a single emerald accent reserved for presence and unread, ink text on bone/white grounds, editorial hairlines, flat surfaces. Memorable moment: the bone desk seats the window, and the navy composer closes the thread.

**Constraints:**
- Surface-only redesign: socket wiring, API calls, and all behavior preserved untouched.
- No purple/cyan/orange; navy + one emerald on bone/ink only; Inter only.
- Keyboard-reachable everywhere; icon-only buttons carry accessible names; emoji/reaction pickers are keyboard-operable.
- Cards/entries are clickable to view (file cards, message rows); no separate view-icon affordances.
- Unread badges and action controls meet WCAG AA contrast; the hover-only message actions also reveal on focus-within.

**Unresolved:** The paperclip emoji used in channel last-message strings is preserved wire data (flagged, not changed). Focus ring is emerald at ~2.3:1 against bone — accepted as the committed ring.
