# Google Play store listing — ZBR Courier

Everything that goes into **Play Console → Grow → Store presence → Main store listing**,
plus the graphic assets and the screenshot capture plan.

- Package / applicationId: `app.zbr.courier`
- Version for this listing: `1.0.0` (`versionCode` 1 — `app.config.ts:67`)
- Listing locales: **en-US (default), ru-RU, uz** — the app ships `i18n/locales/{en,ru,uz}.json`
  and the market is Uzbekistan.
- Build/upload model: local `npx expo prebuild` + Gradle, AAB uploaded by hand. No EAS.

**Source of truth for the text is [`store-assets/listing-copy.json`](../store-assets/listing-copy.json).**
The copy is reproduced verbatim below for reading. Re-verify every character count with:

```bash
python3 store-assets/check_copy.py
```

which fails non-zero if any field exceeds Play's limit or if the background-location
disclosure sentence has gone missing from a locale.

---

## 1. Field-by-field summary

Counts below are the real output of `python3 store-assets/check_copy.py`. Play counts
characters (not bytes) and counts a newline as one character.

| Field | Locale | Limit | Value | Chars |
|---|---|---:|---|---:|
| App name | en | 30 | `ZBR Courier` | 11 |
| App name | ru | 30 | `ZBR Courier` | 11 |
| App name | uz | 30 | `ZBR Courier` | 11 |
| Short description | en | 80 | *Courier app for ZBR delivery partners: take orders, navigate, track earnings.* | 77 |
| Short description | ru | 80 | *Приложение для курьеров ZBR: заказы, навигация и учёт заработка.* | 64 |
| Short description | uz | 80 | *ZBR kuryerlari uchun ilova: buyurtmalar, navigatsiya, daromad hisobi.* | 69 |
| Full description | en | 4000 | §2.1 | 2525 |
| Full description | ru | 4000 | §2.2 | 2403 |
| Full description | uz | 4000 | §2.3 | 2671 |
| Release notes (What's new) | en | 500 | §4.1 | 467 |
| Release notes (What's new) | ru | 500 | §4.2 | 477 |
| Release notes (What's new) | uz | 500 | §4.3 | 472 |
| App icon | all | — | `store-assets/play-icon-512.png` | 512×512 |
| Feature graphic | all | — | `store-assets/feature-graphic-1024x500.png` | 1024×500 |
| Phone screenshots | all | 2–8 | **not yet captured** — see §5 | — |

The app name is deliberately the same string in all three locales: it is the brand, it
matches `name: 'ZBR Courier'` in `app.config.ts:47`, and it matches the Android launcher
label, which is what a Play reviewer compares against. There is 19 characters of headroom
if marketing later wants a descriptive suffix (e.g. `ZBR Courier: Delivery Partner`, 29) —
but keep it free of keyword stuffing, which Play's *Store Listing and Promotion* policy
treats as a metadata violation.

---

## 2. Full descriptions

Every claim below was checked against the code. See §7 for the claims that were
**deliberately left out** because the code does not back them.

### 2.1 English (en-US) — 2525 / 4000

```
ZBR Courier is the app for couriers who deliver orders for ZBR. It is a work app for delivery partners, not a shopping app for customers — you need a ZBR courier account that a ZBR administrator has approved before you can accept orders.

WORK YOUR OWN SHIFT
Switch yourself online when you are ready to take orders and offline when you are finished. You only receive offers while you are online.

ORDER OFFERS FROM NEARBY
When a new order comes in near you, ZBR Courier alerts you with a push notification and an offer card showing the pickup point, the drop-off point, the distance and what the delivery pays, including any tip. Accept it or let it pass to another courier — the choice is yours on every order.

NAVIGATE PICKUP TO DROP-OFF
Every active order opens on a map with the pickup pin, the drop-off pin and your own position. One tap hands the destination to Google Maps for turn-by-turn driving directions, and one tap calls the customer or the pickup point straight from the order screen.

MOVE THE ORDER FORWARD
Confirm the pickup when you collect the order and confirm the delivery when you hand it over. Every step is sent to ZBR dispatch over a live connection, so dispatch always sees the current state of the delivery.

CASH ON DELIVERY
Each order shows its payment method and whether it has already been paid, so you know at a glance which deliveries you collect cash for and which are settled before you arrive.

TRACK WHAT YOU EARN
The Earnings tab adds up today, this week and this month, shows how many deliveries sit behind each figure, and keeps your all-time delivery and earnings totals in one place.

YOUR LANGUAGE
The whole app is available in English, Russian and Uzbek, and you can switch language at any time in Settings.

LOCATION
This app collects location data to enable delivery dispatch and live order tracking even when the app is closed or not in use. Your location is used to match you with the orders closest to you and to keep a delivery on track while you are carrying it. It is collected only while you are online for a shift — go offline and collection stops. Location permission is requested inside the app and can be withdrawn at any time in Android Settings.

GETTING STARTED
1. Create an account with your phone number or your email address.
2. Add your personal details and your vehicle.
3. Wait for a ZBR administrator to verify your account.
4. Go online and start accepting deliveries.

ZBR Courier needs an internet connection and works in the cities where ZBR operates.
```

### 2.2 Russian (ru-RU) — 2403 / 4000

```
ZBR Courier — приложение для курьеров, которые доставляют заказы ZBR. Это рабочее приложение для партнёров по доставке, а не приложение для покупателей: чтобы принимать заказы, нужен аккаунт курьера ZBR, подтверждённый администратором ZBR.

СМЕНА НА ВАШИХ УСЛОВИЯХ
Выходите онлайн, когда готовы работать, и офлайн, когда закончили. Предложения заказов приходят только пока вы онлайн.

ЗАКАЗЫ РЯДОМ С ВАМИ
Когда рядом появляется новый заказ, ZBR Courier присылает push-уведомление и карточку предложения: точка получения, точка доставки, расстояние и сумма за доставку вместе с чаевыми. Примите заказ или пропустите его другому курьеру — решение всегда за вами.

НАВИГАЦИЯ ОТ ПОЛУЧЕНИЯ ДО ДОСТАВКИ
Каждый активный заказ открывается на карте с точками получения и доставки и вашим положением. Одно касание передаёт адрес в Google Maps для пошаговой навигации, ещё одно — звонит клиенту или в точку получения прямо с экрана заказа.

СТАТУС ЗАКАЗА
Подтверждайте получение, когда забрали заказ, и доставку, когда передали его клиенту. Каждый шаг уходит в диспетчерскую ZBR по постоянному соединению, поэтому диспетчер всегда видит актуальный статус доставки.

ОПЛАТА НАЛИЧНЫМИ
У каждого заказа видно способ оплаты и оплачен ли он, поэтому вы сразу понимаете, где нужно принять наличные, а где всё оплачено заранее.

УЧЁТ ЗАРАБОТКА
Вкладка «Доходы» показывает суммы за сегодня, неделю и месяц, количество доставок за каждый период и общие итоги за всё время.

ВАШ ЯЗЫК
Приложение полностью переведено на английский, русский и узбекский языки, язык можно сменить в настройках в любой момент.

ГЕОЛОКАЦИЯ
Это приложение собирает данные о местоположении, чтобы обеспечить распределение заказов и отслеживание доставки в реальном времени, даже когда приложение закрыто или не используется. Местоположение нужно, чтобы предлагать вам ближайшие заказы и вести доставку, пока она у вас на руках. Данные собираются только пока вы онлайн в смене — как только вы выходите офлайн, сбор прекращается. Разрешение на геолокацию запрашивается в приложении, и его можно отозвать в настройках Android в любой момент.

КАК НАЧАТЬ
1. Зарегистрируйтесь по номеру телефона или по электронной почте.
2. Заполните личные данные и данные транспорта.
3. Дождитесь проверки аккаунта администратором ZBR.
4. Выходите онлайн и принимайте доставки.

Для работы ZBR Courier нужен интернет; приложение работает в городах, где действует ZBR.
```

### 2.3 Uzbek (uz) — 2671 / 4000

```
ZBR Courier — ZBR buyurtmalarini yetkazib beruvchi kuryerlar uchun ilova. Bu xaridorlar uchun emas, yetkazib berish hamkorlari uchun ishchi ilova: buyurtma qabul qilish uchun ZBR administratori tasdiqlagan kuryer hisobi kerak.

SMENANI O'ZINGIZ BOSHQARASIZ
Ishlashga tayyor bo'lganingizda onlayn, tugatganingizda oflayn holatga o'ting. Buyurtma takliflari faqat siz onlayn bo'lganingizda keladi.

YAQIN ATROFDAGI BUYURTMA TAKLIFLARI
Yaqin atrofda yangi buyurtma paydo bo'lganda ZBR Courier push-bildirishnoma va taklif kartasini yuboradi: olib ketish manzili, yetkazish manzili, masofa va yetkazib berish uchun to'lanadigan summa, choychaqa bilan birga. Taklifni qabul qiling yoki boshqa kuryerga o'tkazib yuboring — tanlov har doim sizda.

OLIB KETISHDAN YETKAZISHGACHA NAVIGATSIYA
Har bir faol buyurtma xaritada ochiladi: olib ketish nuqtasi, yetkazish nuqtasi va sizning joylashuvingiz. Bir marta bosish manzilni bosqichma-bosqich navigatsiya uchun Google Maps'ga uzatadi, yana bir bosish esa buyurtma ekranidan mijozga yoki olib ketish nuqtasiga qo'ng'iroq qiladi.

BUYURTMA HOLATI
Buyurtmani olganingizda olib ketishni, mijozga topshirganingizda yetkazib berishni tasdiqlang. Har bir qadam jonli ulanish orqali ZBR dispetcherligiga yuboriladi, shuning uchun dispetcherlik yetkazib berishning joriy holatini doim ko'rib turadi.

NAQD PUL BILAN TO'LOV
Har bir buyurtmada to'lov usuli va uning to'langan yoki to'lanmagani ko'rinadi — qayerda naqd pul olish kerakligini darhol bilasiz.

DAROMADINGIZNI KUZATING
«Daromadlar» bo'limi bugungi, haftalik va oylik summalarni, har bir davrdagi yetkazishlar sonini hamda butun davr uchun umumiy natijalarni ko'rsatadi.

O'Z TILINGIZDA
Ilova to'liq ingliz, rus va o'zbek tillarida ishlaydi, tilni sozlamalarda istalgan vaqtda almashtirish mumkin.

JOYLASHUV
Bu ilova buyurtmalarni taqsimlash va yetkazib berishni real vaqtda kuzatib borish uchun joylashuv ma'lumotlarini to'playdi, hatto ilova yopiq yoki ishlatilmayotgan bo'lsa ham. Joylashuv sizga eng yaqin buyurtmalarni taklif qilish va yetkazib berish jarayonini kuzatib borish uchun kerak. Ma'lumotlar faqat siz smenada onlayn bo'lganingizda to'planadi — oflayn holatga o'tsangiz, to'plash to'xtaydi. Joylashuvga ruxsat ilova ichida so'raladi va uni Android sozlamalarida istalgan vaqtda bekor qilish mumkin.

QANDAY BOSHLASH KERAK
1. Telefon raqamingiz yoki elektron pochtangiz orqali ro'yxatdan o'ting.
2. Shaxsiy ma'lumotlaringizni va transportingizni kiriting.
3. ZBR administratori hisobingizni tasdiqlashini kuting.
4. Onlayn holatga o'ting va yetkazib berishni boshlang.

ZBR Courier internet aloqasini talab qiladi va ZBR faoliyat yuritadigan shaharlarda ishlaydi.
```

### 2.4 The background-location disclosure

Play's *Location* policy requires an app that accesses location in the background to
carry a prominent disclosure **in the store listing itself**, not only in-app. Each
full description carries it as its own `LOCATION` paragraph, opening with the sentence
Play's own guidance models:

> This app collects location data to enable delivery dispatch and live order tracking
> even when the app is closed or not in use.

`store-assets/check_copy.py` asserts the locale-appropriate form of this sentence is
present in all three full descriptions and fails the run if one is deleted.

This disclosure is required as long as the shipped manifest declares
`ACCESS_BACKGROUND_LOCATION` — which it does today, because `app.config.ts` passes
`isAndroidBackgroundLocationEnabled: true` to the `expo-location` plugin
(`app.config.ts:201`). See §7 for why that is currently a **release blocker**.

---

## 3. Graphic assets

### 3.1 Source images already in the repo

Real values, from `python3 -c "from PIL import Image; ..."` over `assets/images/`:

| File | Size | Mode | Notes |
|---|---|---|---|
| `icon.png` | 1024×1024 | RGB | Opaque. Source for the Play icon. |
| `adaptive-icon.png` | 1024×1024 | RGBA | Android launcher foreground — **not** the Play icon. |
| `splash-icon.png` | 1024×1024 | RGBA | Splash screen. |
| `logo.png` | 1081×1035 | RGBA | In-app `components/Logo.tsx`; not square, unusable as a store icon. |
| `notification-icon.png` | 96×96 | RGBA | Small notification icon. |
| `favicon.png` | 16×16 | RGBA | Web only. |
| `icon.svg` | vector | — | Bolt + speed lines on a `#059669 → #047857` gradient. |
| `zbr-logo.svg` | vector | — | Same mark with a "ZBR / COURIER" wordmark. |

### 3.2 Generated for Play

Both are produced by [`store-assets/generate_assets.py`](../store-assets/generate_assets.py):

```bash
python3 store-assets/generate_assets.py
```

Real, re-opened output of that command:

```
  feature graphic lockup: x 152..872 of 1024 (safe margins 152px left, 152px right)
store-assets/play-icon-512.png: size=(512, 512) mode=RGBA format=PNG bytes=23548 alpha_min_max=(255, 255)
store-assets/feature-graphic-1024x500.png: size=(1024, 500) mode=RGB format=PNG bytes=73166
```

**`play-icon-512.png`** — 512×512, 32-bit PNG. Downsampled with Lanczos from the
1024×1024 `assets/images/icon.png`. Before resizing, the source is composited onto solid
`#059669`, so no pixel can end up transparent; the verified `alpha_min_max=(255, 255)`
above proves every pixel's alpha is 255. That matters because Play renders the icon on
its own backgrounds and shows transparency as black, and because Play applies its own
rounded-corner mask — the artwork is a full-bleed square with the mark inset, so the mask
cannot clip it.

**`feature-graphic-1024x500.png`** — 1024×500, 24-bit RGB PNG. Composed at 4× (4096×2000)
and downsampled, so the type and the bolt outline are properly antialiased. Contents:

- diagonal `#059669 → #047857` gradient ground,
- the icon's "speed line" motif raked across the panel at 4–6% white — full-bleed and
  directional, so it still reads if Play crops an edge,
- the bolt mark, drawn from the exact path coordinates in `assets/images/icon.svg`
  (`M 430 180 L 640 430 …`) with the same amber gradient and white stroke,
- `DELIVERY PARTNER APP` / **ZBR Courier** / `Orders, routes and earnings`, with an amber rule.

The whole lockup sits between x=152 and x=872 of 1024 — a 152 px margin on both sides,
well inside the region Play is guaranteed not to crop. Nothing in it is a screenshot.

Type is set in **DejaVu Sans Bold / Regular** (`/usr/share/fonts/truetype/dejavu/`),
confirmed present via `fc-list`; PIL's bitmap default was **not** used. The script warns
loudly on stderr and degrades to the default only if the DejaVu fonts are missing, so a
machine without `fonts-dejavu-core` cannot silently produce a bad graphic.

### 3.3 What is still missing

Play's *Main store listing* also offers, and this launch does not yet have:

- **Phone screenshots** — required, 2 minimum. See §5.
- **Tablet screenshots** — only needed to distribute to / be featured on large screens.
  `app.config.ts` sets `ios.supportsTablet: false` and this is a phone-shift app, so skip
  them and set the large-screen distribution flags accordingly.
- **Promo video** — optional, a YouTube URL. Skip for 1.0.0.

---

## 4. Release notes ("What's new") for 1.0.0

### 4.1 English — 467 / 500

```
First public release of ZBR Courier.

• Go online and offline whenever you choose
• Order offers from nearby, with push alerts
• Map with pickup and drop-off pins, plus handoff to Google Maps
• Pickup and delivery confirmation sent live to ZBR dispatch
• Cash-on-delivery orders clearly marked
• Today, week, month and all-time earnings
• Full English, Russian and Uzbek interface

Thanks for delivering with ZBR. Tell us what to fix next from Settings > Help Center.
```

### 4.2 Russian — 477 / 500

```
Первый публичный выпуск ZBR Courier.

• Выход онлайн и офлайн в любой момент
• Предложения заказов рядом с вами и push-уведомления
• Карта с точками получения и доставки, переход в Google Maps
• Подтверждение получения и доставки уходит в диспетчерскую сразу
• Заказы с оплатой наличными отмечены явно
• Заработок за день, неделю, месяц и за всё время
• Полный перевод на английский, русский и узбекский

Спасибо, что работаете с ZBR. Напишите нам через «Настройки» → «Помощь».
```

### 4.3 Uzbek — 472 / 500

```
ZBR Courier'ning birinchi ommaviy versiyasi.

• Istalgan vaqtda onlayn va oflayn holatga o'tish
• Yaqin atrofdagi buyurtma takliflari va push-bildirishnomalar
• Olib ketish va yetkazish nuqtalari bilan xarita, Google Maps'ga o'tish
• Tasdiqlar dispetcherlikka jonli uzatiladi
• Naqd pul bilan to'lanadigan buyurtmalar aniq belgilangan
• Bugungi, haftalik, oylik va umumiy daromad
• To'liq ingliz, rus va o'zbek tillari

Takliflarni «Sozlamalar» → «Yordam» orqali yuboring.
```

The "Settings → Help Center" pointer is real: `app/(tabs)/settings.tsx:195` pushes
`/help-center`, and `app/help-center.tsx` exists.

---

## 5. Screenshot capture plan

Screenshots cannot be generated headlessly from this repo — they must come off a real
device or emulator running the release build. This section is the runbook.

### 5.1 Play's requirements

| Rule | Value |
|---|---|
| Phone screenshots required | **minimum 2**, maximum 8 per locale |
| To be eligible for Play's featuring/promotional surfaces | **at least 4**, 16:9 or 9:16, ≥1080 px on the longest side |
| Format | PNG or JPEG, **no alpha channel** |
| Each side | 320 px – 3840 px |
| Aspect | longest side **no more than 2×** the shortest side |

> **Re-check these before you upload.** Play's asset rules and its policy deadlines
> (target API level, the 16 KB page-size requirement, and so on) move on their own
> schedule. Authoritative sources, in order of precedence:
> 1. The uploader in Play Console itself — it rejects a non-compliant file with the exact
>    numeric reason. This is the only source that is never stale.
> 2. <https://support.google.com/googleplay/android-developer/answer/9866151> — "Add
>    preview assets to showcase your app".
> 3. <https://developer.android.com/google/play/requirements/target-sdk> — the target API
>    level table, which gains a new row every year (deadlines land on 31 August).
> 4. Play Console → **Policy → Program updates**, which lists live and upcoming deadlines
>    for this specific developer account.

**Aim for 8 shots.** Play shows the first 2–3 in search results, so lead with the strongest.

⚠️ **1080×2400 will be rejected**: 2400 ÷ 1080 = 2.22, over the 2× cap. Use a **1080×1920**
device profile (ratio 1.78).

### 5.2 Emulator / device setup

1. **AVD:** Pixel 2 profile — it is exactly **1080×1920** at 420 dpi. Android 14 (API 34)
   or newer system image. (Any 1080×1920 profile works; avoid modern tall phones.)
2. Install the **release** AAB/APK, not a Metro dev build — a dev build shows the Expo dev
   menu and the "Development build" banner, both of which are grounds for rejection as
   "not the actual in-app experience".
3. Log in with the **demo courier account** that also goes in Play Console → App content →
   App access (the account must already be admin-verified, or every screen after login is
   the verification-pending wall).
4. Seed the backend with **fictional** orders: fake customer names, fake street addresses,
   fake phone numbers. No real courier's name, phone, photo, or earnings may appear.
5. Grant location and notification permissions **except** for shot 2, which needs the
   disclosure dialog on screen — capture shot 2 on a fresh install before granting.
6. Set the device language to match the locale set you are capturing (Settings → Language
   inside the app, `app/language.tsx`).
7. Clean the status bar with Android's own demo mode — this is the real system UI, so it
   does not violate the "no fake status bar" rule:

```bash
adb shell settings put global sysui_demo_allowed 1
adb shell am broadcast -a com.android.systemui.demo -e command enter
adb shell am broadcast -a com.android.systemui.demo -e command clock -e hhmm 1000
adb shell am broadcast -a com.android.systemui.demo -e command battery -e level 100 -e plugged false
adb shell am broadcast -a com.android.systemui.demo -e command network -e wifi show -e level 4
adb shell am broadcast -a com.android.systemui.demo -e command network -e mobile show -e datatype none -e level 4
adb shell am broadcast -a com.android.systemui.demo -e command notifications -e visible false
# ... capture ...
adb shell am broadcast -a com.android.systemui.demo -e command exit
```

### 5.3 The eight shots, in listing order

The order tells the courier's shift as a story: go online → get offered work → deliver it
→ get paid.

| # | Screen | Source file | What must be visible |
|---|---|---|---|
| 1 | Orders tab, **online** | `app/(tabs)/orders.tsx` | The ONLINE toggle switched on (`orders.tsx:303`), the online/offline label, and 2–3 available order cards below it. The hero shot. |
| 2 | **Location disclosure** dialog | the disclosure modal, over `app/(tabs)/orders.tsx` | The in-app disclosure shown *before* the OS location prompt, with the toggle behind it. This is the shot that shows a reviewer the app does prominent disclosure properly. Capture on a fresh install. |
| 3 | **Incoming order offer** | `components/OrderOfferModal.tsx` | The offer modal with pickup, drop-off, distance, and the pay figure (`OrderOfferModal.tsx:237`), plus the accept/decline actions. |
| 4 | Available order detail | `app/available-order/[id].tsx` | Pickup block, drop-off block, total distance (`available-orders.tsx:190`), earnings. |
| 5 | **Active order** | `app/order/[id].tsx` | An order in `ACCEPTED`/`PICKED_UP` state with the status badge, the amount, and the **CASH** payment badge (`order/[id].tsx:248`) so cash-on-delivery is visibly part of the job. |
| 6 | **Map navigation** | `app/map-navigation/[orderId].tsx` | The map with the courier position and the destination pin, and the button that hands off to Google Maps. |
| 7 | **Earnings** | `app/(tabs)/finance.tsx` | The period card (today / week / month) with a delivery count, plus the all-time stats block (`finance.tsx:160`). Use plausible seeded UZS figures, never a real courier's. |
| 8 | Delivery rated / language | `app/order-rating/[orderId].tsx` or `app/language.tsx` | Either the post-delivery rating screen closing the loop, or the language picker showing English / Русский / O'zbek to advertise the trilingual UI. |

Capture each with:

```bash
mkdir -p store-assets/screenshots/en
adb exec-out screencap -p > store-assets/screenshots/en/01-online.png
adb exec-out screencap -p > store-assets/screenshots/en/02-location-disclosure.png
# ...through 08
```

`adb screencap` writes RGBA PNGs and Play rejects an alpha channel. Strip it and validate
every file in one pass:

```bash
python3 store-assets/prepare_screenshots.py store-assets/screenshots/en
```

Repeat the whole set for `ru` and `uz` if you want localized screenshots. Play falls back
to the default (en-US) listing's screenshots for any locale that has none, so the en set
is the only mandatory one — but ru and uz screenshots are worth the hour in this market.

### 5.4 Play rules the screenshots must not break

- **Real in-app content only.** Every pixel must be something the app actually renders.
  No mockup of a feature that does not exist.
- **No device frames that misrepresent the platform.** A plain screenshot is safest. If a
  frame is added later it must not show an iOS status bar, an iPhone notch, or Apple
  chrome on an Android listing.
- **No promotional overlays.** No "Editor's Choice", no star ratings, no award badges, no
  "#1 delivery app", no "Download now" / "Install" call-to-action, no price or discount
  claims, and no reference to a Play Store ranking or promotion. Play's *Store Listing and
  Promotion* policy rejects all of these.
- **No personal data.** No real names, phone numbers, addresses, plate numbers, courier
  photos, or real earnings figures. Use the demo account and seeded fictional data. A
  screenshot leaking a real customer address is both a policy violation and a privacy
  incident.
- **No placeholder / debug state.** No "Lorem ipsum", no error toasts, no empty-state
  screens, no red Metro error box, no visible dev menu.
- **Match the description.** Every feature the copy in §2 claims should be visible in at
  least one screenshot, and nothing should be shown that the copy does not claim.

---

## 6. Other Main-store-listing fields

These live next to the copy above and are **human decisions**, not code:

- **App category:** Business (a work app for delivery partners). *Maps & Navigation* would
  be a stretch — the app hands navigation off to Google Maps rather than providing it.
- **Tags:** pick from Play's fixed list; "Delivery", "Logistics", "Business tools".
- **Contact details** — Play requires an email address and shows it publicly.
  - [ACTION REQUIRED: support email address for the public listing]
  - [ACTION REQUIRED: support phone number — optional, omit if there is no staffed line]
  - [ACTION REQUIRED: website URL — optional]
- **Privacy policy URL** — mandatory, and mandatory for any app requesting location.
  It must be publicly reachable, must not be behind a login, and must specifically cover
  background location collection and the account-deletion route.
  - [ACTION REQUIRED: public HTTPS URL of the ZBR Courier privacy policy]
- **App access** (Play Console → App content) — this app is entirely behind login *and*
  behind admin verification, so a reviewer cannot see anything without credentials.
  - [ACTION REQUIRED: demo courier phone number / email + password + OTP handling for
    reviewers, on an account already verified by a ZBR admin]

---

## 7. Truthfulness audit — what was checked, and what was left out

The full descriptions were written against the code, not against a feature wishlist.
Verified claims:

| Claim in the copy | Evidence |
|---|---|
| Online/offline shift toggle gates order visibility | `app/(tabs)/orders.tsx:303-321` — the `Switch` calls `toggleOnline`, and the list renders `isOnline ? availableOrders : []` |
| Push notification for new offers | `services/pushNotification.ts` registers a token against `POST /api/v1/device-tokens` (`constants/config.ts:59`) |
| Offer card shows pickup, drop-off, distance, pay incl. tip | `app/available-orders.tsx:154,173,190`; `components/OrderOfferModal.tsx:237,241` |
| Hand-off to Google Maps for turn-by-turn | `app/map-navigation/[orderId].tsx:142` (`google.navigation:q=…`) with a `https://www.google.com/maps/dir/` fallback at :155 |
| Call the customer / pickup point | `app/map-navigation/[orderId].tsx:230` (`tel:`) |
| Confirm pickup, then confirm delivery | `app/order/[id].tsx:83-88` — `ACCEPTED`/`READY` → `PICKED_UP` → delivered |
| Status goes to dispatch over a live connection | STOMP subscriptions in `services/websocket.ts`, wired in `context/CourierContext.tsx:871` |
| Payment method / paid state shown per order | `app/order/[id].tsx:248` and `components/OrderCard.tsx:87` render `CASH` or `Paid` |
| Today / week / month / all-time earnings with delivery counts | `app/(tabs)/finance.tsx:42-75,160-175` against `GET /api/v1/couriers/me/earnings` |
| English, Russian, Uzbek, switchable in Settings | `i18n/locales/{en,ru,uz}.json` (576 keys each); `app/(tabs)/settings.tsx:172` → `app/language.tsx` |
| Admin verification required before working | `app/verification-pending.tsx` |
| Phone-OTP **or** email registration | `constants/config.ts:11-17` — `auth/login`, `auth/register`, `auth/phone/request-otp`, `auth/phone/verify-otp` |

Claims **deliberately excluded** because the code does not support them:

- **In-app chat with the customer.** `app/chat.tsx` exists and `app/order/[id].tsx:215`
  links to it, but the messages are hardcoded local state
  (`app/chat.tsx:50` — `useState<Message[]>([ … ])`) with no API or STOMP subscription
  behind them. Advertising it would be a false claim, and a reviewer who taps into it sees
  a non-functional feature. **Do not add it to the listing until it is wired up.**
- **Live tracking shown to the customer.** The copy says status reaches *ZBR dispatch*,
  which is what this repo can prove. What the customer app then shows is a backend
  question this repo cannot verify.
- **Offline operation.** Every screen is API-backed; the copy states an internet
  connection is required.
- **"Earn up to X" / income guarantees.** None made. Play treats unverifiable earnings
  claims in a gig-work listing as deceptive.

### Blockers that affect this listing

1. **Background location is declared but never used.** `app.config.ts:201` sets
   `isAndroidBackgroundLocationEnabled: true`, and the generated manifest carried
   `ACCESS_BACKGROUND_LOCATION`, `FOREGROUND_SERVICE` and `FOREGROUND_SERVICE_LOCATION`.
   But the only location code in the JS is a **foreground** `Location.watchPositionAsync`
   in `context/CourierContext.tsx:1372`, started from
   `Location.requestForegroundPermissionsAsync` at :1347. There is no `expo-task-manager`
   task and no `startLocationUpdatesAsync` anywhere in the tree. Either:
   - implement the background task the disclosure describes, **or**
   - drop `isAndroidBackgroundLocationEnabled` and delete the background-location
     paragraph's "even when the app is closed or not in use" sentence from all three
     locales (and the corresponding Data safety answer).

   Shipping the permission unused invites a background-location rejection; shipping the
   listing sentence without the behaviour makes the listing inaccurate. **They must agree
   before upload.** Re-run `python3 store-assets/check_copy.py` after any such edit.
2. **In-app account deletion does not delete anything.** `app/security.tsx:138-156`
   shows a confirmation and then a second alert — no `DELETE` request is issued, and
   `constants/config.ts` has no user-deletion endpoint (only `users/me/logout-all`). Play
   requires an in-app deletion route *and* a web URL for it. This is not a listing field,
   but it is a launch blocker sitting one screen from the copy above.
3. **No Google Maps API key is configured.** `app.config.ts` sets no
   `android.config.googleMaps.apiKey`, and `components/OrderMap.native.tsx:161` uses
   `PROVIDER_DEFAULT`, which on Android is Google Maps. Without a key the map renders
   grey — which makes screenshots 1, 6 and the map in 5 unusable, and makes the
   "opens on a map" claim look false to a reviewer.
