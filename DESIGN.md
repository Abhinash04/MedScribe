---
version: 1.0.0
name: MedScribe-Design-System
description: A clinical-grade, high-legibility light design system for MedScribe — a React Native mobile application for medical dictation, live speech-to-text, transcript review, and structured report generation. Designed for doctors with inspirations from Apple Health, Google Recorder, Notion, and Linear.

colors:
  primary: "#2563EB"
  primary-hover: "#1D4ED8"
  primary-active: "#1E40AF"
  primary-disabled: "#93C5FD"
  primary-light: "#EFF6FF"
  ink: "#0F172A"
  body: "#334155"
  body-strong: "#1E293B"
  muted: "#64748B"
  muted-soft: "#94A3B8"
  border: "#E5E7EB"
  border-soft: "#F1F5F9"
  border-strong: "#CBD5E1"
  background: "#FAFBFC"
  surface: "#FFFFFF"
  surface-soft: "#F8FAFC"
  surface-card: "#FFFFFF"
  surface-elevated: "#FFFFFF"
  onPrimary: "#FFFFFF"
  success: "#16A34A"
  success-light: "#F0FDF4"
  success-border: "#BBF7D0"
  warning: "#F59E0B"
  warning-light: "#FEF3C7"
  warning-border: "#FDE68A"
  error: "#DC2626"
  error-light: "#FEF2F2"
  error-border: "#FECACA"
  info: "#0284C7"
  info-light: "#F0F9FF"
  info-border: "#BAE6FD"
  waveform-active: "#2563EB"
  waveform-paused: "#94A3B8"

typography:
  display:
    fontSize: 28
    fontWeight: "700"
    lineHeight: 34
    letterSpacing: -0.5
  heading:
    fontSize: 22
    fontWeight: "700"
    lineHeight: 28
    letterSpacing: -0.3
  title-lg:
    fontSize: 18
    fontWeight: "600"
    lineHeight: 24
    letterSpacing: -0.2
  title-md:
    fontSize: 16
    fontWeight: "600"
    lineHeight: 22
    letterSpacing: 0
  title-sm:
    fontSize: 14
    fontWeight: "600"
    lineHeight: 20
    letterSpacing: 0
  body-lg:
    fontSize: 16
    fontWeight: "400"
    lineHeight: 24
    letterSpacing: 0
  body-md:
    fontSize: 15
    fontWeight: "400"
    lineHeight: 22
    letterSpacing: 0
  body-sm:
    fontSize: 14
    fontWeight: "400"
    lineHeight: 20
    letterSpacing: 0
  caption:
    fontSize: 12
    fontWeight: "500"
    lineHeight: 16
    letterSpacing: 0.2
  caption-uppercase:
    fontSize: 11
    fontWeight: "700"
    lineHeight: 14
    letterSpacing: 0.8
  button:
    fontSize: 15
    fontWeight: "600"
    lineHeight: 20
    letterSpacing: 0.2
  code:
    fontSize: 13
    fontWeight: "400"
    lineHeight: 18
    letterSpacing: 0

rounded:
  xs: 4
  sm: 6
  md: 8
  lg: 12
  xl: 16
  pill: 9999

spacing:
  xxs: 4
  xs: 8
  sm: 12
  md: 16
  lg: 20
  xl: 24
  xxl: 32
  section: 40

components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.onPrimary}"
    typography: "{typography.button}"
    rounded: "{rounded.pill}"
    padding: "12px 24px"
    height: 48
  button-secondary:
    backgroundColor: "{colors.surface}"
    borderColor: "{colors.border}"
    textColor: "{colors.ink}"
    typography: "{typography.button}"
    rounded: "{rounded.pill}"
    padding: "12px 24px"
    height: 48
  button-danger:
    backgroundColor: "{colors.surface}"
    borderColor: "{colors.error}"
    textColor: "{colors.error}"
    typography: "{typography.button}"
    rounded: "{rounded.pill}"
    padding: "12px 24px"
    height: 48
  card-surface:
    backgroundColor: "{colors.surface}"
    borderColor: "{colors.border}"
    rounded: "{rounded.lg}"
    padding: 16
  status-pill:
    backgroundColor: "{colors.surface}"
    borderColor: "{colors.border}"
    rounded: "{rounded.pill}"
    padding: "4px 12px"
  text-input:
    backgroundColor: "{colors.surface}"
    borderColor: "{colors.border}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "12px 16px"
    minHeight: 48
---

# MedScribe Design System

## 1. Overview & Project Context

MedScribe is a clinical-grade React Native mobile application engineered for physicians to streamline dictation, live speech recognition, transcript verification, and structured medical report synthesis.

MedScribe is **not** a marketing site, consumer social app, or entertainment utility. It is an essential clinical workspace tool used in high-stress, fast-paced healthcare settings (consultation rooms, outpatient clinics, emergency wards).

### Core Brand Attributes
- **Trust**: Solid contrast, dependable status feedback, precise data recovery.
- **Simplicity**: Single primary action per screen, zero visual clutter, uncluttered typography hierarchy.
- **Professionalism**: Clean medical blue palettes (`#2563EB`), neutral slates, crisp borders, zero trendy gimmicks.
- **Reliability**: Instant state updates, clear dictation indicators, guaranteed session recovery.
- **Calmness**: Gentle off-white background (`#FAFBFC`), controlled animations, subtle iOS elevation.
- **Precision**: Clear metadata badges, confidence indicators, granular utterance breakdown.
- **Readability**: Optimized typography scale with generous line-heights for rapid clinical parsing.

### Visual Influences
- **Apple Health**: Crisp card typography, medical status clarity, subtle container borders.
- **Google Recorder**: Live waveform responsiveness, real-time transcript streaming, clear recording states.
- **Notion**: Unobtrusive editorial layout, focused inline editing, structured field cards.
- **Linear**: Micro-interactions, tight visual hierarchy, status pills, shortcuts, zero fluff.

---

## 2. Theme & Color Tokens

MedScribe uses a **Light Theme** as its default design system. Dark modes are deliberately avoided for clinical readability under artificial room lighting.

### Color Token Reference

| Token Key | Hex Code | Role / Usage |
|---|---|---|
| `colors.primary` | `#2563EB` | Primary brand accent, main CTAs, active indicators |
| `colors.primary-hover` | `#1D4ED8` | Active/Pressed state for primary buttons |
| `colors.primary-active` | `#1E40AF` | Deep state for active tabs / selected chips |
| `colors.primary-disabled` | `#93C5FD` | Disabled button background |
| `colors.primary-light` | `#EFF6FF` | Soft primary tint for selected fields / badges |
| `colors.ink` | `#0F172A` | Slate 900 — Headlines, modal titles, primary body text |
| `colors.body` | `#334155` | Slate 700 — Standard running text, field content |
| `colors.body-strong` | `#1E293B` | Slate 800 — Emphasized body text, labels |
| `colors.muted` | `#64748B` | Slate 500 — Subtitles, secondary labels, icons |
| `colors.muted-soft` | `#94A3B8` | Slate 400 — Placeholders, inactive state dots |
| `colors.border` | `#E5E7EB` | Slate 200 — Default surface borders, dividers |
| `colors.border-soft` | `#F1F5F9` | Slate 100 — Soft card interior borders |
| `colors.border-strong` | `#CBD5E1` | Slate 300 — Focused input borders, active outlines |
| `colors.background` | `#FAFBFC` | Off-white canvas background for all screens |
| `colors.surface` | `#FFFFFF` | Pure white surface for cards, modals, header bars |
| `colors.surface-soft` | `#F8FAFC` | Subtle slate tint for secondary containers |
| `colors.surface-card` | `#FFFFFF` | Standard card container floor |
| `colors.surface-elevated` | `#FFFFFF` | Modals, bottom sheets, floating dialogs |
| `colors.onPrimary` | `#FFFFFF` | Text/Icon color over primary blue background. Required on every filled `primary`, `success` or `danger` surface — the ink colours fail contrast there. |
| `colors.success` | `#16A34A` | Green 600 — Saved status, active mic dot |
| `colors.success-light` | `#F0FDF4` | Success pill background |
| `colors.success-border` | `#BBF7D0` | Success pill border |
| `colors.warning` | `#F59E0B` | Amber 500 — Paused dictation, unsaved edits |
| `colors.warning-light` | `#FEF3C7` | Paused pill background |
| `colors.warning-border` | `#FDE68A` | Paused pill border |
| `colors.error` | `#DC2626` | Red 600 — Stop action, error alerts, delete links |
| `colors.error-light` | `#FEF2F2` | Error banner background |
| `colors.error-border` | `#FECACA` | Error banner border |
| `colors.info` | `#0284C7` | Sky 600 — System notices, info badges |
| `colors.info-light` | `#F0F9FF` | Info banner background |
| `colors.info-border` | `#BAE6FD` | Info banner border |
| `colors.waveform-active` | `#2563EB` | Active spectrum bar color |
| `colors.waveform-paused` | `#94A3B8` | Paused spectrum bar color |

---

## 3. Typography System

Typography drives visual hierarchy in MedScribe. Fonts use standard React Native system fonts (`System`, `-apple-system`, `Roboto`, `Inter`) for native performance and familiarity.

### Typography Scale

| Style Token | Size | Weight | Line Height | Tracking | Clinical Usage |
|---|---|---|---|---|---|
| `display` | 28pt | 700 (Bold) | 34pt | -0.5pt | Screen headlines ("Dictation", "Medical Report") |
| `heading` | 22pt | 700 (Bold) | 28pt | -0.3pt | Modal titles, Section headers |
| `title-lg` | 18pt | 600 (SemiBold) | 24pt | -0.2pt | Patient names, primary card titles |
| `title-md` | 16pt | 600 (SemiBold) | 22pt | 0 | Sub-section titles, report field names |
| `title-sm` | 14pt | 600 (SemiBold) | 20pt | 0 | Segment labels, metadata item titles |
| `body-lg` | 16pt | 400 (Regular) | 24pt | 0 | Full transcript text input, report content |
| `body-md` | 15pt | 400 (Regular) | 22pt | 0 | Standard body copy, list descriptions |
| `body-sm` | 14pt | 400 (Regular) | 20pt | 0 | Secondary text, field descriptions |
| `caption` | 12pt | 500 (Medium) | 16pt | 0.2pt | Status pills, timestamps, subtitle notes |
| `caption-uppercase`| 11pt | 700 (Bold) | 14pt | 0.8pt | Section tags ("LIVE EXTRACTED DETAILS", "SUMMARY") |
| `button` | 15pt | 600 (SemiBold) | 20pt | 0.2pt | Primary, Secondary, and Action button text |
| `code` | 13pt | 400 (Regular) | 18pt | 0 | Technical IDs, structured JSON previews |

---

## 4. Spacing System & Layout Grid

MedScribe uses an 8pt base grid with a 4pt sub-grid for precise mobile layouts.

### Spacing Tokens

| Token Key | Value | Usage |
|---|---|---|
| `spacing.xxs` | 4pt | Micro gaps between icon and text, status dot padding |
| `spacing.xs` | 8pt | Standard gap between metadata items, internal pill padding |
| `spacing.sm` | 12pt | Card internal vertical gap, sub-component margins |
| `spacing.md` | 16pt | Standard outer horizontal padding, card padding |
| `spacing.lg` | 20pt | Section gaps, modal padding |
| `spacing.xl` | 24pt | Large screen vertical padding, empty state padding |
| `spacing.xxl` | 32pt | Hero spacing, section break margins |
| `spacing.section` | 40pt | Major section separation on long forms |

### Layout Rules
- **Outer Margins**: All screen content has `16pt` (`spacing.md`) horizontal padding from screen edges.
- **Card Spacing**: Consecutive cards use `12pt` (`spacing.sm`) vertical gaps.
- **Safe Area**: Bottom buttons clear navigation bars with safe-area padding + `16pt`.

---

## 5. Border Radius & Shadows

### Border Radius Tokens
- `rounded.xs` (4px): Tiny indicators, subtle highlights.
- `rounded.sm` (6px): Action tags, inline code chips.
- `rounded.md` (8px): Input fields, secondary buttons.
- `rounded.lg` (12px): Standard cards, report field containers, list items.
- `rounded.xl` (16px): Main transcript cards, visualizer stage, modals.
- `rounded.pill` (9999px): Primary buttons, status pills, floating control bars.

### Elevation & Shadows (iOS-Inspired)
Avoid heavy Material shadows. Use subtle iOS ambient elevation:

```js
shadowColor: "#0F172A",
shadowOffset: { width: 0, height: 2 },
shadowOpacity: 0.05,
shadowRadius: 8,
elevation: 3, // Android fallback
```

---

## 6. Motion & Interactive Feedback

Animations in MedScribe serve usability only. No decorative transitions.

### Motion Principles
1. **Standard Duration**: 200ms – 250ms with `ease-out` curve (`withTiming` or `LayoutAnimation`).
2. **Button Feedback**: Pressable opacity changes to `0.75` on press.
3. **Microphone Waveform**: Driven straight by Reanimated shared values (`amplitudeShared`) on the UI thread at 60 FPS without React re-renders.
4. **Pause/Resume Transition**: Smoothly morphs waveform heights to baseline 12pt in 300ms when dictation pauses.

---

## 7. Iconography Standards

**MedScribe ships no icon font or icon library.** Every glyph is composed from
plain `View`s, which keeps the APK free of a dependency that would exist purely
for decoration and lets each icon inherit theme tokens directly.

### Existing glyphs
- `MicGlyph.jsx` — the microphone, sized by a single `size` prop and coloured by
  `color`. Used by the dashboard CTA card and the round start button.
- `AnimatedMicButton.jsx` — a larger, hand-tuned microphone with its own
  breathing and ripple animation. It keeps a separate copy on purpose.
- `AppHeader.jsx` — the medical-cross mark and the back chevron.
- Text glyphs (`›`, `＋`, `⌕`, `▤`, `◷`, `✎`, `✓`, `▦`) carry the dashboard
  chevrons, stat tiles and quick actions.

### Rules
- Default sizes: `20pt` inside actions, `24pt` in headers, `26–30pt` for the
  primary microphone.
- Stroke weight is expressed as a fraction of `size` so a glyph stays balanced
  at any scale (see `MicGlyph`).
- Icons are decorative: mark them `accessibilityElementsHidden` and put the
  label on the surrounding pressable, never on the glyph.
- **Before adding a library**, extend these. Introducing `lucide-react-native`
  or similar would mean two icon systems on screen at once, which is worse than
  either alone.

---

## 8. Accessibility Standards (WCAG 2.1 AA)

1. **Touch Target Size**: Minimum 44x44pt (48x48pt for primary action controls).
2. **Contrast Ratio**:
   - Text Primary (`#0F172A`) vs Background (`#FAFBFC`): 15.8:1 (AAA).
   - Text Secondary (`#64748B`) vs Background (`#FAFBFC`): 4.6:1 (AA).
   - Primary Accent (`#2563EB`) vs White (`#FFFFFF`): 4.5:1 (AA).
3. **Screen Reader Integration**:
   - Provide explicit `accessibilityRole="button"`, `accessibilityLabel`, and `accessibilityHint` on all pressables.
   - Use `accessibilityLiveRegion="polite"` on live transcript streaming views.

---

## 9. Component Guidelines

### 1. Buttons
- **Primary Button**: Pill-shaped (`rounded.pill`), 48pt height, `#2563EB` fill, white text (`15pt SemiBold`).
- **Secondary Button**: Pill-shaped, 48pt height, transparent background, `#E5E7EB` border, `#0F172A` text.
- **Danger Button**: Pill-shaped, 48pt height, white surface, `#DC2626` border, `#DC2626` text.
- **States**: Default, Pressed (`opacity: 0.75`), Disabled (`#93C5FD` fill / `#94A3B8` text).

### 2. Cards
- Surface background (`#FFFFFF`), `#E5E7EB` border, `12pt` border radius, `16pt` padding.
- Used for Utterance segments, Patient summary, Report fields.

### 3. Text Inputs & Textarea
- White surface, `#E5E7EB` border (focus shifts to `#2563EB`), `8pt` border radius, `15pt` body font.
- Multiline text area has minimum height `140pt` with top-aligned text.

### 4. Search Bars
- Background `#F8FAFC`, border `#E5E7EB`, rounded `9999px`, height `44pt`, carries `Search` icon on left.

### 5. Status Pills & Badges
- **Listening Pill**: Background `#F0FDF4`, border `#BBF7D0`, green dot, `#16A34A` text ("Listening").
- **Paused Pill**: Background `#FEF3C7`, border `#FDE68A`, amber dot, `#D97706` text ("Paused").
- **Processing Pill**: Background `#F0F9FF`, border `#BAE6FD`, blue spinner, `#0284C7` text ("Processing").

### 6. Live Waveform & Listening Visualizer
- Central microphone capsule badge surrounded by Reanimated pulse aura.
- 7 vertical spectrum bars reading RMS audio level directly. Freezes gracefully to 12pt when paused.

### 7. Recording Controls Bar
- Horizontal bottom bar carrying **Pause** (Secondary) and **Stop Dictation** (Danger) when listening.
- Flips to **Resume** (Primary Play) and **Stop Dictation** (Danger) when paused.

### 8. Timer Display
- Formatted `MM:SS` in `14pt Bold` tabular numbers with `#2563EB` accent color.

### 9. Live Entity Preview
- Compact card showing live extracted patient fields (Patient, Age, Complaint, Diagnosis) in real-time pill chips during dictation.

### 10. Transcript Segments & Review Items
- Sentence breakdown card showing Sentence #, text body, edit/delete action links, and "Edited" status badge.

### 11. Confirmation Dialogs (Modals)
- Centered 360pt max-width modal with dark backdrop (`rgba(0,0,0,0.65)`), `#FFFFFF` card, title, message, and vertical action stack (**Continue Dictation** vs **Stop & Review**).

---

## 10. Screen Design Guidelines

### 1. Dashboard Screen (`DashboardScreen.jsx`)
- **Header**: App Logo + "MedScribe" title + Doctor Avatar / Settings button.
- **Hero CTA Card**: "Start New Dictation" banner with prominent microphone button.
- **Recent Reports List**: List of saved reports with Patient Name, Diagnosis, Status badge, Date.
- **Empty State**: Friendly illustration/card when no reports exist.

### 2. Recording Screen (`RecordingScreen.jsx`)
- **Header**: Back arrow, Status Pill badge (Listening/Paused), `MM:SS` duration timer.
- **Stage**: Headline title ("Listening..." / "Dictation Paused"), `ListeningVisualizer`.
- **Live Preview**: `LiveFieldsPreview` card showing extracted details in real time.
- **Transcript Card**: `TranscriptView` displaying confirmed text + interim italic text.
- **Controls**: `RecordingControls` (Pause / Resume / Stop).

### 3. Transcript Review Screen (`TranscriptReviewScreen.jsx`)
- **Header**: Back arrow + Title "Transcript Review".
- **Meta Bar**: Duration badge + Utterance count badge.
- **View Toggle**: Segmented toggle between "Full Editor" (multiline text area) and "Sentence Breakdown" (editable segments list).
- **Footer CTAs**: **+ Add More Speech** (Secondary) | **Generate Report ➔** (Primary).

### 4. Report Screen (`ReportScreen.jsx`)
- **Header**: Back arrow + Title "Patient Medical Report" + Save / Export PDF action.
- **Sections**: Structured accordion / card list for Patient Details, Chief Complaint, History, Examination, Diagnosis, Plan, Medications.
- **Footer**: **Save Report** (Primary).

---

## 11. Core UX Principles

1. **One Primary Action**: Every screen has exactly one high-emphasis primary button.
2. **Status Transparency**: The doctor always knows if the app is Listening, Paused, Processing, or Saved.
3. **Zero Data Loss**: Dictation segments auto-save to SQLite. If the phone dies, the app prompts to restore the session upon relaunch.
4. **Destructive Action Safety**: Tapping Stop or Delete triggers an explicit confirmation dialog.
5. **Fast Clinical Parsing**: High-contrast typography and clear labels allow scanning patient details in under 3 seconds.

---

## 12. AI Coding Agent Instructions

When building or updating UI code in this repository:

1. **Strictly Adhere to Tokens**: Read colors, spacing, typography, and radius from `src/theme/index.js` tokens. Never hardcode inline hex colors or arbitrary pixel values.
2. **Consult Component Guidelines**: Before introducing a new component, check Section 9. Extend existing components (`RecordingControls`, `TranscriptView`, `LiveFieldsPreview`) rather than duplicating.
3. **Maintain Visual Tone**: Use the light theme canvas (`#FAFBFC`). Do not introduce dark backgrounds except for subtle backdrop overlays.
4. **Preserve Accessibility**: Ensure all pressables include `accessibilityRole="button"`, `accessibilityLabel`, and `minHeight: 44`.
5. **Verify Build & Lint**: Run `npm run lint` and verification scripts after modifying UI files.
