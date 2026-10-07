# AnyWear Client Design Reference

## Provenance and maintenance

This document describes the **implemented** Client UI at source revision [`d2a21a747c04d5b0075b8db1f54f58df65424a5a`](https://github.com/git-malu/AnyWear-Client/tree/d2a21a747c04d5b0075b8db1f54f58df65424a5a), reviewed on **2026-10-07** for [AnyWear #10](https://github.com/git-malu/AnyWear/issues/10). Relative source links below follow this document's checkout. The baseline identifies the source used for this snapshot; later UI changes should update the relevant sections and this review record together.

Covered surfaces are auth (`/login`, `/register`, `/verify`), `/dashboard`, `/wardrobe`, `/mirror`, `/settings`, and their shared shells. Desktop/mobile/web observations below describe the shared source rules; no device-specific rendering check was performed.

The section order follows the [Meta DESIGN template](https://github.com/git-malu/AnyWear-Meta/blob/309c5e15cd75ffc43390003025b7800cfeb6b869/architecture/templates/DESIGN_TEMPLATE.md) at immutable revision `309c5e15cd75ffc43390003025b7800cfeb6b869`. Meta owns cross-project principles and reusable documentation conventions; this repository owns concrete classes, components, and observed implementation gaps. This is a source review, not a browser/device accessibility or visual certification.

Research inputs retrieved on 2026-10-07:

| Source | Traceable revision or availability | Convention used here |
| --- | --- | --- |
| [VoltAgent/awesome-design-md](https://github.com/VoltAgent/awesome-design-md/blob/13be5c05c63be24b57581162364167028020f043/README.md) | Commit `13be5c05c63be24b57581162364167028020f043`, dated 2026-10-05T07:34:31Z | A discoverable Markdown design reference with identity, color, type, components, layout, and depth. Its README links the Google Stitch overview/specification; community extensions are distinct from that schema. This document adopts the Meta section convention without claiming Stitch schema validation. |
| [Design-MD Notion analysis](https://getdesign.md/notion/design-md) | HTTP 200; title “Design System Analysis: Notion” | An example of recording a brand's visual choices, not AnyWear's identity or a universal specification. |
| [Tailwind CSS default theme](https://github.com/tailwindlabs/tailwindcss/blob/c2b24dd15fed1c59dd521bd86082f520c9f5ad0d/packages/tailwindcss/theme.css) | v4.3.3 commit `c2b24dd15fed1c59dd521bd86082f520c9f5ad0d`; matches [lockfile](pnpm-lock.yaml) | Exact default utility values; no inferred project token layer or v3 hex palette. |

State terms used throughout: **Implemented** means present in the linked source; **Unsupported** means the component does not implement the state or capability; **Unverified** means runtime/device behavior has not been measured; **Target** is a future intention, never current behavior. Unless a row states otherwise, there is no extra size/theme variant, dedicated query-error UI, or custom focus treatment beyond the source/browser defaults.

When changing UI, read the affected component **and its callers**, update variants and state conditions, and validate links, utility values, responsive rules, and accessibility claims. Preserve explicit gaps until an implementation change resolves them. New colors or tokens require a real source definition before they can be listed as implemented. Follow [AGENTS.md](AGENTS.md) for code verification and API boundaries.

## Visual identity

AnyWear uses a quiet light interface around wardrobe and virtual try-on photography: white cards, gray page surfaces, dark gray text, compact controls, and restrained colored feedback. This reflects Meta's visual-dominance principle; it is not a new redesign. “AnyWear” is rendered as text in [AuthLayout](src/layouts/AuthLayout.tsx) and [MainLayout](src/layouts/MainLayout.tsx), without an implemented logo component.

Indigo identifies most primary actions, input focus, and image selections. Blue appears in weather/location actions and saved-outfit selection. Red identifies failure and destructive actions; yellow identifies processing; amber and green distinguish credit levels. Garment and generated images use `CachedImage`, commonly cropped with `object-cover`; result previews use `object-contain`. Inline SVGs, emoji, and text provide iconography; there is no shared icon library contract.

## Color and theme

[index.css](src/index.css) imports Tailwind with `@import "tailwindcss";`; [vite.config.ts](vite.config.ts) uses the Tailwind Vite plugin. [package.json](package.json) and [pnpm-lock.yaml](pnpm-lock.yaml) resolve Tailwind to **4.3.3**. There is no project `@theme`, semantic custom color variable, dark variant, theme switch, or dark-mode palette. Tailwind's imported `--color-*` variables are framework defaults, not AnyWear-defined tokens.

The global body declares literal `background-color: #f9fafb` and `color: #111827`. These literals are separate from `bg-gray-50` and `text-gray-900`, whose v4 defaults are OKLCH values. Components can override the inherited body styles with utilities. Do not substitute old v3 hex values for the v4 default palette.

Representative implemented roles are mapped below. Other shades referenced in source resolve through the same pinned [default theme](https://github.com/tailwindlabs/tailwindcss/blob/c2b24dd15fed1c59dd521bd86082f520c9f5ad0d/packages/tailwindcss/theme.css); role names in this table are descriptive, not CSS token names.

| Role and utilities | Exact default value(s) | Implementation examples |
| --- | --- | --- |
| Auth surface `bg-gray-50`; main surface `bg-gray-100` | `--color-gray-50: oklch(98.5% 0.002 247.839)`; `--color-gray-100: oklch(96.7% 0.003 264.542)` | [AuthLayout](src/layouts/AuthLayout.tsx), [MainLayout](src/layouts/MainLayout.tsx) |
| Cards `bg-white`; dark image overlays `bg-black/50` | `--color-white: #fff`; `--color-black: #000`, with utility opacity modifier `/50` | [MirrorPage](src/pages/mirror/MirrorPage.tsx), [VtoHistorySection](src/components/mirror/VtoHistorySection.tsx) |
| Primary action `bg-indigo-600`, hover `bg-indigo-700` | `oklch(51.1% 0.262 276.966)`; `oklch(45.7% 0.24 277.023)` | [TryOnButton](src/components/mirror/TryOnButton.tsx), [LoginPage](src/pages/auth/LoginPage.tsx) |
| Indigo selection/focus `*-indigo-500`; selected tint `bg-indigo-50` | `oklch(58.5% 0.233 277.117)`; `oklch(96.2% 0.018 272.314)` | [BasePhotoSelector](src/components/mirror/BasePhotoSelector.tsx), [CreateOutfitModal](src/pages/wardrobe/CreateOutfitModal.tsx) |
| Blue action `bg-blue-600`, hover `bg-blue-700`; selection `border-blue-500`/`ring-blue-500`, `bg-blue-50` | `oklch(54.6% 0.245 262.881)`; `oklch(48.8% 0.243 264.376)`; `oklch(62.3% 0.214 259.815)`; `oklch(97% 0.014 254.604)` | [WeatherWidget](src/components/dashboard/WeatherWidget.tsx), [SettingsPage](src/pages/settings/SettingsPage.tsx), [OutfitPicker](src/components/mirror/OutfitPicker.tsx) |
| Titles `text-gray-900`; body `text-gray-700`; secondary `text-gray-500`; subtle `text-gray-400` | `oklch(21% 0.034 264.665)`; `oklch(37.3% 0.034 259.733)`; `oklch(55.1% 0.027 264.364)`; `oklch(70.7% 0.022 261.325)` | [MirrorPage](src/pages/mirror/MirrorPage.tsx), [WeatherWidget](src/components/dashboard/WeatherWidget.tsx) |
| Borders/skeletons `*-gray-200`; input border `border-gray-300` | `oklch(92.8% 0.006 264.531)`; `oklch(87.2% 0.01 258.338)` | [CachedImage](src/components/CachedImage.tsx), [StylePromptInput](src/components/mirror/StylePromptInput.tsx) |
| Destructive `bg-red-600`, hover `bg-red-700`; errors `text-red-500`; failure badge `bg-red-100 text-red-800` | `oklch(57.7% 0.245 27.325)`; `oklch(50.5% 0.213 27.518)`; `oklch(63.7% 0.237 25.331)`; `oklch(93.6% 0.032 17.717)` / `oklch(44.4% 0.177 26.899)` | [ItemDetailsModal](src/pages/wardrobe/ItemDetailsModal.tsx), [WardrobePage](src/pages/wardrobe/WardrobePage.tsx) |
| Processing `bg-yellow-100 text-yellow-800` | `oklch(97.3% 0.071 103.193)` / `oklch(47.6% 0.114 61.907)` | [WardrobePage](src/pages/wardrobe/WardrobePage.tsx), [VtoHistorySection](src/components/mirror/VtoHistorySection.tsx) |
| Low credits `bg-amber-100 text-amber-800`, `text-amber-500`; positive `bg-green-100 text-green-800`, `text-green-500` | `oklch(96.2% 0.059 95.617)` / `oklch(47.3% 0.137 46.201)` / `oklch(76.9% 0.188 70.08)`; `oklch(96.2% 0.044 156.743)` / `oklch(44.8% 0.119 151.328)` / `oklch(72.3% 0.219 149.579)` | [CreditDisplay](src/components/mirror/CreditDisplay.tsx) |

**Unverified legacy styling:** the three wardrobe modal backdrops contain `bg-gray-500 bg-opacity-75`. `bg-opacity-75` is a legacy utility, with no project compatibility definition. The source spelling does not establish a rendered 75% backdrop in Tailwind v4. Use the source and compiled output when reviewing a future fix; this issue does not migrate those classes.

## Typography

The body font stack is `Inter, system-ui, Avenir, Helvetica, Arial, sans-serif` in [index.css](src/index.css). **Inter is a preferred font name only**: no bundled font, `@font-face`, or download is configured. The selected face therefore depends on fonts installed on the host. There is no separate display font or project type token.

Default sizes below come from the pinned Tailwind theme. Pixel equivalents assume the browser's usual 16px root size; rem values remain authoritative. An explicit `leading-*` class overrides the size utility's default line height.

| Utility | Font size / default line height | Implemented use |
| --- | --- | --- |
| `text-xs` | 0.75rem / 1rem (12px / 16px) | Metadata, credit/history badges, mobile navigation, prompt counter |
| `text-sm` | 0.875rem / 1.25rem (14px / 20px) | Controls, helper text, history and outfit labels |
| `text-base` | 1rem / 1.5rem (16px / 24px) | Add-item modal action text below `sm` |
| `text-lg` | 1.125rem / 1.75rem (18px / 28px) | Mirror/settings/outfit-editor titles (`font-semibold`); auth and Add/Details titles use `font-medium leading-6` (1.5rem line height) |
| `text-xl` | 1.25rem / 1.75rem (20px / 28px) | Main brand (`font-bold`), loading/error headings (`font-semibold`), outfit heading |
| `text-2xl` | 1.5rem / 2rem (24px / 32px) | Mirror/Wardrobe page headings (`font-bold`) |
| `text-3xl` | 1.875rem / 2.25rem (30px / 36px) | Auth brand and profile-sync failure (`font-extrabold`) |
| `text-4xl` | 2.25rem / 2.5rem (36px / 40px) | Weather temperature (`font-bold`) |
| `text-5xl` | 3rem / 3rem (48px / 48px) | Weather emoji |

Weights actually used are normal 400, medium 500, semibold 600, bold 700, and extrabold 800. [WeatherWidget](src/components/dashboard/WeatherWidget.tsx) uses `leading-relaxed` (1.625) and `line-clamp-2` for clothing advice. [SettingsPage](src/pages/settings/SettingsPage.tsx) uses `uppercase tracking-wider` (0.05em letter spacing) for popular cities. [ItemDetailsModal](src/pages/wardrobe/ItemDetailsModal.tsx) has a small `text-[10px] leading-none` remove-image control. These are local exceptions, not a new type scale.

## Spacing, layout, and elevation

Tailwind's default `--spacing` is **0.25rem**. Common gaps/padding use this scale: `1` = 0.25rem, `1.5` = 0.375rem, `2` = 0.5rem, `3` = 0.75rem, `4` = 1rem, `6` = 1.5rem, `8` = 2rem, `12` = 3rem. Half steps such as `p-0.5` and `py-2.5` are present in the Mirror mode switch and try-on action. There is no project spacing token set.

| Pattern | Implemented classes and constraints | Source |
| --- | --- | --- |
| Authentication shell | `min-h-screen`, centered column, `py-12 sm:px-6 lg:px-8`; form `sm:max-w-md` (28rem); white card `py-8 px-4 sm:px-10` | [AuthLayout](src/layouts/AuthLayout.tsx) |
| App shell | `min-h-screen bg-gray-100`; top bar `h-16`; nav container `max-w-7xl mx-auto px-4 sm:px-6 lg:px-8`; main `flex-1 max-w-7xl mx-auto py-6 sm:px-6 lg:px-8` | [MainLayout](src/layouts/MainLayout.tsx) |
| Mirror | Outer page `space-y-8`; input sections `grid grid-cols-1 md:grid-cols-2 gap-6`; white `rounded-lg p-6 shadow` cards | [MirrorPage](src/pages/mirror/MirrorPage.tsx) |
| Wardrobe | Item/outfit grids `grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4`; rounded image cards and category pills | [WardrobePage](src/pages/wardrobe/WardrobePage.tsx) |
| Settings and dashboard | Settings `max-w-lg` (32rem) centered, `space-y-8`, cards `p-6`; Dashboard `space-y-6` and `sm:grid-cols-3` definition-list rows | [SettingsPage](src/pages/settings/SettingsPage.tsx), [DashboardPage](src/pages/dashboard/DashboardPage.tsx) |
| Image selection and history | Base photos and wearable cards `aspect-[3/4]`; base grid `grid-cols-2 sm:grid-cols-3`; item/history grid `grid-cols-2 sm:grid-cols-3 md:grid-cols-4`; generated result `max-h-96 object-contain` | [BasePhotoSelector](src/components/mirror/BasePhotoSelector.tsx), [WearableItemMultiSelector](src/components/mirror/WearableItemMultiSelector.tsx), [VtoHistorySection](src/components/mirror/VtoHistorySection.tsx), [ResultArea](src/components/mirror/ResultArea.tsx) |
| Wardrobe dialogs | Fixed `inset-0` wrappers: Add/Details `z-10`, white panels `sm:max-w-lg shadow-xl`; Create/Update outfit `z-50`, centered `max-w-lg w-full p-6` panel and scrollable list | [AddItemModal](src/pages/wardrobe/AddItemModal.tsx), [ItemDetailsModal](src/pages/wardrobe/ItemDetailsModal.tsx), [CreateOutfitModal](src/pages/wardrobe/CreateOutfitModal.tsx) |

The shell main element has a maximum width, but no `w-full`; do not treat it as a guaranteed full-width container. MainLayout has fixed mobile bottom navigation without safe-area padding or an explicit matching content bottom spacer. Wardrobe cards still spell the older `aspect-w-3 aspect-h-4`; no aspect-ratio plugin or custom definition establishes those classes as a working 3:4 ratio. These limitations differ from the supported `aspect-[3/4]` utility in Mirror components.

Controls use `rounded-md` (0.375rem), cards/dialogs `rounded-lg` (0.5rem), and pills/circular controls use `rounded-full`. Most borders are `border` (1px); selected photos/items use `border-2`; selection can add `ring-1` or `ring-2`.

Framework shadow defaults used by source:

| Utility | Default shadow |
| --- | --- |
| `shadow` / `shadow-sm` | `0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)` |
| `shadow-md` | `0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)` |
| `shadow-xl` | `0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)` |

Cards gain `hover:shadow-md` in Wardrobe; dialogs use `shadow-xl`. [FullPageLoading](src/components/FullPageLoading.tsx) and the history image viewer use `z-50`. These are local utility choices, not a managed elevation/z-index token system.

## Core components, variants, and states

The bounded inventory is **19 implementation files**: all 14 components currently in `src/components`, two route layouts, and three wardrobe dialogs. The following rows describe real component branches and props; they do not prescribe a new component library. Query state and mutation orchestration often live in callers/hooks, so an absent local error branch does not imply a network operation cannot fail.

### Shared components and layouts (5)

| Implementation / purpose | Implemented variants and states | Focus, unsupported states, and limitations |
| --- | --- | --- |
| [CachedImage](src/components/CachedImage.tsx) — shared image/cache rendering | Initial source resolution: `animate-pulse bg-gray-200` placeholder `div` with caller `className`; resolved: native `img` forwarding caller props. Browser uses network URL; Tauri uses deduplicated local caching, falling back to the original URL on cache/download exception. Caller owns crop, dimensions, and `alt`. Existing image can remain while a changed source resolves. | No custom empty/broken-image/error replacement, intrinsic placeholder size, disabled/focus state, or loading semantics. Placeholder does not forward image attributes. Image-load failure after resolution is ordinary browser behavior. |
| [FullPageLoading](src/components/FullPageLoading.tsx) — route/profile loading overlay | Single `fixed inset-0 z-50 bg-gray-50` full-screen state. `w-16 h-16 border-4 border-indigo-200 border-t-indigo-600` spinning circle; `text-xl font-semibold` brand and pulsing `text-sm` setup copy. [App](src/App.tsx) uses it for both lazy-route Suspense and profile loading. | No interactive/focus, empty/error, live-region/status, or reduced-motion variant. “Setting up your wardrobe...” is also shown for route-module loading. |
| [WeatherWidget](src/components/dashboard/WeatherWidget.tsx) — dashboard weather card | White `shadow rounded-lg p-6`. Loading: pulse skeleton. HTTP 404 or null/missing data: location prompt and blue Set Location button to Settings. Other errors: red text with no retry. Ready: location/time, weather emoji, `text-4xl font-bold` temperature, humidity/wind; stale data adds amber “Outdated”; clothing advice is optional blue-tinted, clamped text. [Dashboard](src/pages/dashboard/DashboardPage.tsx) renders it first. | Set Location has blue `focus:ring-2 focus:ring-offset-2`; emoji has image role/label. No disabled variant or dynamic loading/error announcement. Compact-screen variant and contrast are unverified. |
| [AuthLayout](src/layouts/AuthLayout.tsx) — auth route shell | Gray-50 full-height centered column, `text-3xl font-extrabold` brand; white shadow card expands padding and adds rounding at `sm`, constrained by `sm:max-w-md`. Child route arrives via `Outlet`. | No local loading/empty/error/disabled/focus variant; App and route forms own those states. No dark/theme variation. |
| [MainLayout](src/layouts/MainLayout.tsx) — protected route shell | Gray-100 background; white 4rem top bar, `max-w-7xl` containers, text brand, indigo Logout. Desktop links visible from `sm`; fixed bottom links below `sm`; child route in `main`/`Outlet`. | Logout has indigo ring2/offset2; navigation hover text/borders are implemented. No active-route styling/`aria-current`, logout pending/error/disabled UI, safe-area inset, or explicit bottom-nav content clearance. App owns profile loading/error; shell has no such local variant. |

### Mirror components (11)

| Implementation / purpose | Implemented variants and states | Focus, unsupported states, and limitations |
| --- | --- | --- |
| [BasePhotoSelector](src/components/mirror/BasePhotoSelector.tsx) — mannequin-photo selection | Loading returns 3 pulse skeletons and hides upload controls. Empty: first-photo prompt. Populated: `grid-cols-2 sm:grid-cols-3 gap-3`, 3:4 cover cards, indigo selected border/ring, optional “★ Default”. Upload accepts/validates images up to 10 MiB, disables button with “Uploading...”, and shows red `role="alert"` errors. New photo is selected only if selection was empty. Default/delete actions appear in a gradient hover overlay; delete uses browser confirmation. | Upload has indigo ring2/offset1. Card selection uses non-keyboard `div`s; overlay lacks focus reveal. Default does not automatically select a photo. No dedicated query-error UI or mutation-pending/disabled/error treatment for default/delete actions. |
| [WearableItemMultiSelector](src/components/mirror/WearableItemMultiSelector.tsx) — individual-item selection | Count/removable chips, local name/category search, server category filter/pills; optional save-as-outfit name input (200 characters). Loading keeps controls and shows 4 pulse cards. Zero results always show the same empty-wardrobe copy, including search/filter misses. Cards `grid-cols-2 sm:grid-cols-3 md:grid-cols-4`, 3:4 cover, indigo selected border/ring; missing image “No Image”; populated list `max-h-96 overflow-y-auto`. Chips derive from items in the current category response. | Search has ring2; outfit name ring1. No maximum-selection, disabled/pending-selection, or dedicated query-error branch. Clickable card `div`s lack keyboard semantics; inputs and chip-removal icons lack labels, filters lack selected-state semantics. |
| [OutfitPicker](src/components/mirror/OutfitPicker.tsx) — saved-outfit single selection | Plain loading text; empty saved-outfit instruction; full-width native button rows in `max-h-[320px] overflow-y-auto`. First item's primary-image thumbnail or gray icon; untitled-name fallback and item count. Selected uses **blue** border/tint/ring1; unselected uses white/gray hover border; `transition-colors`. | Native button activation, no custom focus or `aria-pressed`. No disabled or dedicated query-error variant. Decorative thumbnail `alt=""`. |
| [CreditDisplay](src/components/mirror/CreditDisplay.tsx) — daily credit pill | `{dailyCredits ?? 0}/10 today`; zero red, positive ≤2 amber, >2 green; matching 100 background/800 text/500 icon. `px-3 py-1 rounded-full text-sm font-medium`; tooltip says reset at midnight. | Passive `div`; no interaction, focus, motion, distinct loading/error, or live announcement. Missing/loading user data appears as zero/red, not a separate skeleton. |
| [StylePromptInput](src/components/mirror/StylePromptInput.tsx) — optional prompt | Controlled single-line input, example placeholder, `maxLength=500`, right-aligned length counter. Gray border, `rounded-md px-3 py-2`; parent trims and omits empty prompt. | Indigo focus ring2 and border. No associated label/counter description; no disabled/loading/error/validation variant. |
| [TryOnButton](src/components/mirror/TryOnButton.tsx) — generation action | Native disabled for `disabled \|\| isLoading \|\| credits === 0`; enabled indigo/white, disabled gray with not-allowed cursor. Loading spinner and “Generating...” take label precedence; otherwise zero credits “Out of Credits”, else “Try On”. Parent also requires photo, selected outfit/items, positive credits, and no start/nonterminal generation. | Indigo ring2/offset2, color transition. Text names the action; no busy/live announcement. Generation-start error is separate in [MirrorPage](src/pages/mirror/MirrorPage.tsx); button has no error/empty variant. |
| [ResultArea](src/components/mirror/ResultArea.tsx) — current generation result | No ID: dashed empty prompt. Pending/Processing: pulse skeleton, spinner, elapsed seconds. Failed: red panel/API message and Retry. Complete **with** image key: contain image `max-h-96`, rating and Retry. Missing status or Complete without image: “Waiting for result...”. Inner content key resets elapsed timer on a new generation. | Retry has red or indigo ring2/offset1; no disabled/credit/busy guard locally, no download control or live-status semantics. Caller supplies null rating and a no-op `onRate`, so current-result stars do **not persist ratings**. RatingWidget's own label/focus gaps apply. |
| [RatingWidget](src/components/mirror/RatingWidget.tsx) — 1–5 star input/display | Null rating gives empty stars and prompt; rated caption shows committed value. Pointer hover previews fill; click emits 1–5. Readonly disables buttons and suppresses hover/click. Indigo filled/gray outlined 1.5rem stars; editable `hover:scale-110 transition-transform`. | No named star buttons, selected-value/rating semantics, custom focus, keyboard preview, persistence/loading/error branch. Native button activation is available; it does not supply the missing rating accessibility contract. |
| [VtoHistorySection](src/components/mirror/VtoHistorySection.tsx) — filterable history | All/Complete/Failed/Pending/Processing filter; 4 skeletons; common empty text even for filtered emptiness. 2/3/4-column responsive 3:4 cards, image/failed/no-image fallback, relative time, status badge and count. Existing rating readonly; unrated complete entries can persist rating through [useVtoHistory](src/hooks/useVtoHistory.ts). Hover overlay exposes conditional View Full/Reuse Outfit, placeholder Retry, and inline delete Yes/Cancel. Previous disabled on first page; Next conditional. Full-image viewer `z-50 bg-black/80`; any bubbled click closes it. | Filter has ring2 but no label; hover overlay lacks focus reveal; viewer lacks dialog/focus/Escape contract and close label. **History Retry is a no-op.** No explicit query/rating/delete error or busy/disabled mutation feedback. Delete confirmation clears immediately. Hook page size is 12, preserves previous data, and does not reset page on a changed filter. |
| [MirrorErrorBoundary](src/components/mirror/MirrorErrorBoundary.tsx) — render-exception recovery | Normal renders children; caught render exception shows centered `min-h-[60vh]` white `max-w-md p-8 rounded-lg shadow` card, heading, exception/fallback copy, and Try Again that reloads the whole window. | Reload uses indigo ring2/offset2. No alert role or focus movement. This is not a loading/empty/API-query-error/disabled component. |
| [MirrorPageSkeleton](src/components/mirror/MirrorPageSkeleton.tsx) — dormant page skeleton | Static `space-y-8 animate-pulse`; title bars, four cards in `grid-cols-1 md:grid-cols-2 gap-6`, result/history placeholder cards. | **Unsupported in current route wiring:** no caller/import references; [App](src/App.tsx) uses FullPageLoading and [MirrorPage](src/pages/mirror/MirrorPage.tsx) renders real section components. No controls, error/empty/disabled/focus/status/reduced-motion variant. |

[MirrorPage](src/pages/mirror/MirrorPage.tsx) defaults to individual-items mode; changing mode clears the opposite selection. History reuse restores item IDs, clears selected outfit, and scrolls to top smoothly. [useVtoGeneration](src/hooks/useVtoGeneration.ts) combines SSE and a 10-second status-polling fallback until terminal status. Starting a generation clears the current result, so its empty panel may briefly coexist with “Generating...” on the button. Status-request/SSE errors have no dedicated visual state; source review does not certify connectivity behavior.

### Wardrobe dialogs (3)

| Implementation / purpose | Implemented variants and states | Focus, unsupported states, and limitations |
| --- | --- | --- |
| [AddItemModal](src/pages/wardrobe/AddItemModal.tsx) — image upload | Closed returns null; open fixed/scrollable `z-10` overlay, white `rounded-lg shadow-xl` panel with `sm:max-w-lg`, responsive footer. Dashed file-picker label, selected filename, hidden `image/*` input with rear-camera preference. No drag/drop handlers. Submit disabled for no file/uploading, opacity50, “Uploading...”; success delegates close/refetch to parent; error uses browser alert. | File label `focus-within:ring-2`; submit/Cancel ring2/offset2. Close has sr-only text but removes outline without replacement. Picker/Cancel/close/backdrop remain usable while uploading. Copy says PNG/JPG up to 10MB, while [upload helper](src/lib/imageUpload.ts) accepts broader image MIME/extension inputs up to 10 MiB. No inline error or modal focus/dialog contract. |
| [ItemDetailsModal](src/pages/wardrobe/ItemDetailsModal.tsx) — garment editor | Closed/missing item returns null; editor keyed by item ID. Contain main image `max-h-64`, or `h-48` No Image box. Gallery/add-image row only when an image already exists; 4rem thumbnails, view choices, wrapped Primary checkbox, indigo selected border. Scrollable `max-h-[50vh]` form: name/category, 11 attributes, weather tags. Uploading/Processing yellow Analyzing; Failed red Tagging Failed. Save/Re-tag pending copy and disabled during their mutation or processing/uploading; Delete pending only during delete; add-image pending only during its upload. Browser alerts/confirm handle failures/delete/retag feedback. | Inputs set indigo ring color/border without ring width; footer/close remove outlines without replacement. No shared pending lock: other controls and dismissal remain usable. Category/Color/Material `*` is visual, without native `required`; visible labels/view select and add/remove icons lack full associations/names. No loading query variant or modal focus/dialog contract. |
| [CreateOutfitModal](src/pages/wardrobe/CreateOutfitModal.tsx) — create/edit outfit | Create vs Edit title/action; Edit initializes name/items and adds Delete Outfit. Fixed `z-50`, centered `max-w-lg w-full p-6 rounded-lg shadow-xl`. Optional 200-character name; `max-h-64` item list, native selected-row buttons with indigo tint/check. No data: empty message; query loading/error share this fallback. Submit disabled for no selection or any create/update/delete pending, with Creating/Saving copy. Delete has inline warning/Confirm/Cancel, Deleting copy and pending-disable. | Name ring2; other actions no explicit focus styles. Selection lacks checked/pressed semantics; close icon unlabeled; name label unassociated. Close/backdrop/Cancel/name/selection remain active while pending. No mutation-error UI, form-submit behavior, or modal focus/dialog contract. |

All three dialogs close on backdrop click and lack implemented background scroll locking, dialog roles/label relationships, Escape handling, initial focus, trapping, or restoration. Their backdrop opacity caveat is recorded in [Color and theme](#color-and-theme).

### Inline patterns

There is no reusable `Button`, `Input`, `Card`, `Badge`, or generic `Modal` implementation in this snapshot. Reuse the actual feature behavior when working with these patterns:

| Pattern | Current source and states |
| --- | --- |
| Primary / secondary / destructive action | [AddItemModal](src/pages/wardrobe/AddItemModal.tsx) uses indigo primary and white bordered Cancel; [ItemDetailsModal](src/pages/wardrobe/ItemDetailsModal.tsx) uses red Delete. Native `disabled` and `disabled:opacity-50` are common, but focus styles differ per action. |
| Form field / password reveal | [LoginPage](src/pages/auth/LoginPage.tsx), [RegisterPage](src/pages/auth/RegisterPage.tsx), and [VerifyEmailPage](src/pages/auth/VerifyEmailPage.tsx) use gray bordered inputs, indigo focus border/color, pending button copy, and inline red errors. Password reveal uses an unlabeled icon button; native browser reveal is hidden in CSS. |
| Category pills / status badges / photo cards | [WardrobePage](src/pages/wardrobe/WardrobePage.tsx) provides indigo active category pills; uploading blue, processing yellow, failed red badges; clickable image cards with hover shadow and hover-only deletion. |
| Mirror mode switch | [MirrorPage](src/pages/mirror/MirrorPage.tsx) switches saved-outfit and individual-item controls with native buttons inside a gray rounded group; selected tab is white with shadow. No ARIA tab/selection semantics are implemented. |
| Location search/results | [SettingsPage](src/pages/settings/SettingsPage.tsx) supplies blue geolocation actions, disabled detecting/updating state, green success/red geolocation error copy, popular-city pills, query-length disabled Search, searching/empty results, and scrollable result rows. No general toast component exists. |

## Interaction and motion

Loading animations and visual transitions use Tailwind utilities; history reuse also uses the browser's smooth scrolling. There is no animation library or shared motion token layer. No explicit `duration-*` classes, reduced-motion variant, page-enter animation, or dialog enter/exit sequence is defined.

| Behavior | Exact implementation/default | Source |
| --- | --- | --- |
| Busy spinner | `animate-spin`: `spin 1s linear infinite`, rotation to 360 degrees | [FullPageLoading](src/components/FullPageLoading.tsx), [TryOnButton](src/components/mirror/TryOnButton.tsx), [ResultArea](src/components/mirror/ResultArea.tsx) |
| Loading placeholders | `animate-pulse`: `pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite`, opacity 0.5 at 50% | [CachedImage](src/components/CachedImage.tsx), [WeatherWidget](src/components/dashboard/WeatherWidget.tsx), photo/item/history skeletons |
| Hover/selection changes | `transition-colors`, `transition-opacity`, `transition-shadow`, `transition-all`, `transition-transform`, or `transition`; default duration **150ms**, timing `cubic-bezier(0.4, 0, 0.2, 1)` | [OutfitPicker](src/components/mirror/OutfitPicker.tsx), [BasePhotoSelector](src/components/mirror/BasePhotoSelector.tsx), [WardrobePage](src/pages/wardrobe/WardrobePage.tsx), [ItemDetailsModal](src/pages/wardrobe/ItemDetailsModal.tsx) |
| Rating hover | Interactive stars use `hover:scale-110` plus `transition-transform`; hover previews the filled star count | [RatingWidget](src/components/mirror/RatingWidget.tsx) |
| Reuse history outfit | `window.scrollTo({ top: 0, behavior: 'smooth' })`; browser controls timing | [MirrorPage](src/pages/mirror/MirrorPage.tsx) |

Presence of `transition-all transform` on Add/Details dialog panels does not prove an entrance animation: those dialogs mount/unmount without a staged transform/opacity sequence. Delete/default-photo/history affordances often appear via `opacity-0 group-hover:opacity-100`; a keyboard/touch equivalent is not consistently defined.

Focus is component-specific. Actions such as try-on, auth submit, reload/retry, and logout use `focus:ring-2` with an indigo (or red/blue) color, often `focus:ring-offset-2`. Inputs sometimes set only ring **color**, not ring **width**; `focus:ring-indigo-500` alone does not guarantee a visible ring. Several icon buttons use `focus:outline-none` without a replacement. Do not assert a universal focus style.

## Accessibility

**Implemented:** many controls use native buttons, inputs, selects, and `disabled`; auth forms use `required` and email input types. Cached images forward caller image props such as `alt`; many callers supply meaningful names. Text accompanies most error/status colors. ResultArea has text-labeled Retry actions, and Add/Details dialogs have a screen-reader Close label.

**Unsupported or incomplete in this snapshot:**

- The three wardrobe dialogs do not implement `role="dialog"`, `aria-modal`, focus trapping/restoration, Escape dismissal, or a labeled dialog relationship. Backdrop click closes them. The history image viewer also lacks a complete dialog/focus contract.
- RatingWidget's star buttons have no accessible labels, current-value/selection semantics, or keyboard hover-preview behavior. Native button activation alone is not an accessible rating control contract; readonly simply disables the buttons.
- Base-photo, wearable, and wardrobe card selection uses clickable `div` elements without keyboard/selection semantics; image operations are frequently hover-only. Some action controls and password-reveal icons have no accessible name or replacement focus indicator.
- Many form labels, including auth and style prompt, are visual headings/labels without `htmlFor`/input IDs or another programmatic association. Placeholder copy is not a persistent accessible label.
- Dynamic loading/error/rating updates have no consistent `aria-live`/status announcement policy. Skeletons are visual feedback, not a guaranteed announced loading state.
- Navigation links have no active-route/`aria-current` treatment. Motion lacks `prefers-reduced-motion` handling.

**Unverified:** contrast ratios, zoom/reflow, screen-reader behavior, keyboard journeys, minimum touch targets, and actual font metrics have not been audited in this source-only work. No WCAG conformance is claimed. Any remediation is a separately scoped implementation change, after which this record should be updated.

## Responsive behavior

Tailwind's default mobile-first breakpoints apply: `sm` **40rem** (normally 640px), `md` **48rem** (768px), and `lg` **64rem** (1024px). Utilities without a prefix apply at all widths; prefixed rules start at that minimum width. No custom breakpoint or container-query system is defined.

| Area | Current behavior |
| --- | --- |
| Authentication | Below `sm`, the form card has small horizontal padding and no `sm:rounded-lg`; from `sm`, it centers within 28rem and increases padding. Add-item action buttons are full-width/base text below `sm`, auto-width/small text from `sm`. |
| Main navigation | Desktop links appear from `sm`; bottom navigation is fixed and appears below `sm`. The top brand/logout remain. Safe-area insets and content clearance for the bottom bar are unsupported. |
| Mirror | Single-column section cards become two columns from `md`; item/history grids expand 2 → 3 at `sm` → 4 at `md`. Base-photo grid expands 2 → 3 at `sm`. |
| Wardrobe | Image grids expand 2 → 3 at `sm` → 4 at `md` → 5 at `lg`; Add/Details panels gain centered alignment and a 32rem maximum width at `sm`. |
| Dashboard/settings | Dashboard details become a three-column layout from `sm`; Settings remains a centered `max-w-lg` column. Weather has flex rows, not a dedicated compact-screen variant. |

Tauri desktop/mobile targets share the React UI, but these classes alone do not prove tested platform parity. Very narrow viewports, fixed-nav overlap, touch-only access to hover controls, and device safe areas remain unverified or explicit gaps above.

## Implementation references and gaps

Use [App.tsx](src/App.tsx) for route/layout/Suspense and profile-sync fallback wiring; [MirrorPage](src/pages/mirror/MirrorPage.tsx) for selector/generation/history composition; [WardrobePage](src/pages/wardrobe/WardrobePage.tsx) for dialogs, item status, and outfit composition. Generated API models are consumed under the existing Service → published API → Client boundary; this design record does not define a new API contract.

Existing focused checks include [CachedImage tests](src/components/CachedImage.test.tsx), [OutfitPicker tests](src/components/mirror/OutfitPicker.test.tsx), and [CreateOutfitModal tests](src/pages/wardrobe/CreateOutfitModal.test.tsx). Their tested behavior should be read before changing those components; their presence does not establish visual or accessibility coverage of every state documented here.

Cross-project references: [Meta architecture principles](https://github.com/git-malu/AnyWear-Meta/blob/309c5e15cd75ffc43390003025b7800cfeb6b869/architecture/architecture_principles.md) and [frontend design/UX principles](https://github.com/git-malu/AnyWear-Meta/blob/309c5e15cd75ffc43390003025b7800cfeb6b869/architecture/system-component-architecture/application-architecture/frontend_architecture.md#7-design-and-ux-principles). They provide architectural direction; planned architecture/features must not be inferred as current component behavior.

Current gaps are intentional records, not accepted design targets: no semantic project tokens/dark theme/font delivery; inconsistent focus/labels/dialog semantics; no reduced motion/safe-area clearance; legacy backdrop/aspect classes; dormant MirrorPageSkeleton; and feature-specific query/mutation failures without dedicated feedback. Do not silently convert these statements into implemented behavior.

For document-only updates, check source accuracy, the 19-file inventory, local links/anchors, immutable external references, and `git diff --check`. [Pipeline](.github/workflows/pipeline.yml) still runs Build (audit/lint/typecheck/codegen/build and Rust Check), Unit Tests, and mocked Browser Integration on PRs; Markdown is not exempted. [Beta deployment](.github/workflows/beta-deploy.yml) is manually dispatched and separately guarded. Runtime deployment and real cross-repository system E2E are not applicable to this documentation snapshot; they are not replaced by source review or mocked browser checks.
