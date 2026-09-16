# App Store and Google Play compliance

What Ripple needs to ship, what is already done in code, and what can only be
done in the two consoles. Written against the guidelines as of September 2026 —
re-check the linked pages before submitting, because both stores move.

Nothing here is legal advice.

---

## Done in this repo

| Requirement | Where |
|---|---|
| Privacy policy reachable inside the app (Apple 5.1.1(i)) | [app/privacy.tsx](../app/privacy.tsx), linked from Settings |
| Every third party that receives user data, named individually | [src/legal/privacy.ts](../src/legal/privacy.ts) |
| Terms of service in-app | [app/terms.tsx](../app/terms.tsx) |
| iOS privacy manifest (required-reason APIs, no tracking, no collection) | `expo.ios.privacyManifests` in [app.json](../app.json) |
| Export-compliance declaration (HTTPS only) | `ITSAppUsesNonExemptEncryption: false` in [app.json](../app.json) |
| Android permissions minimised to internet + vibrate | `android.permissions` / `blockedPermissions` in [app.json](../app.json) |
| Store version identifiers | `ios.buildNumber`, `android.versionCode` |
| "Not investment advice" disclaimer | Settings → About, and the terms |
| Honest provenance labelling (live / keyless / sample) | `ProviderMode`, shown on every source |

The privacy manifest declares only what the vendored libraries declare:
`NSPrivacyAccessedAPICategoryUserDefaults` with reason `CA92.1` (React Native
core, expo-constants) and `NSPrivacyAccessedAPICategoryFileTimestamp` with
`C617.1` (React Native core, AsyncStorage). Those codes were taken from the
`PrivacyInfo.xcprivacy` files in `node_modules`, not guessed.

---

## Blockers — must be resolved before either submission

1. **Contact address and governing jurisdiction.** `TERMS_CONTACT` and
   `TERMS_JURISDICTION` in [src/legal/terms.ts](../src/legal/terms.ts) are still
   `TODO:` placeholders, and the privacy policy shares the contact.
   `test/terms.test.ts` fails on purpose while they are unfilled.
2. **A publicly hosted privacy policy URL.** Both stores require a URL on the
   listing, reachable without installing the app. The in-app screen satisfies
   Apple's *second* requirement, not this one. The text in `src/legal/privacy.ts`
   is the source to publish.
3. **A real SEC contact address.** `SEC_HEADERS` in
   [src/providers/insider/InsiderProvider.ts](../src/providers/insider/InsiderProvider.ts)
   still says `support@ripple.app`. SEC fair-access rules require a working
   address; it is how they reach you instead of silently blocking your users.
4. **A developer account that is not a financial institution** — see the
   guideline risk below before investing in submission work.

---

## Apple

### Guideline risks specific to this app

**3.2.1(viii) — financial services.** *"Apps used for financial trading,
investing, or money management should be submitted by the financial institution
performing such services and must have necessary licensing and permissions in
the locations where you make them available."*

Ripple is a reader for public records: it executes no trades, holds no funds,
connects to no brokerage, has no portfolio, and gives no personalised advice.
That is the correct side of this line, but the line is enforced on how the app
*presents*, not only on what it does. Keep the listing, screenshots and
description describing it as a disclosure reader rather than an investing tool,
and keep the "not investment advice" disclaimer visible. The Trades tab is the
screen most likely to be misread — it already labels awards as awards and
withholds a timing verdict on anything nobody chose.

**4.2.2 — aggregators.** *"Other than catalogs, apps shouldn't primarily be
marketing materials, advertisements, web clippings, content aggregators, or a
collection of links."* Ripple opens source documents in a browser, so this is a
real review risk. The defence is that it is not a link list: it parses Form 4
XML, pairs positions FIFO, computes benchmark-relative price reactions, clusters
filings on a timeline, groups the feed into daily digests and classifies trade
timing. Worth naming this in the review notes rather than hoping the reviewer
finds it.

### App Privacy answers (App Store Connect)

Select **"Data Not Collected"**. It is accurate: nothing leaves the device to
the developer, there is no account, no analytics SDK and no advertising.

The third parties in the privacy policy do not change this answer. Apple's
question is about data *you or your third-party partners* collect from the app;
a server logging an inbound IP for a request the user's device made directly is
not collection by the app in that sense. Disclose it in the policy anyway — that
is what section 3 of the policy is for.

- **Tracking:** No. Nothing is used to track across apps or websites, so
  App Tracking Transparency is not required and no permission prompt is shown.
- **Account deletion (5.1.1(v)):** not applicable — the app supports no account
  creation, so there is no account to delete.
- **Age rating:** no objectionable content. Answer **No** to unrestricted web
  access: the in-app browser opens only URLs supplied by the government and
  market sources the app reads, never an address bar.
- **Sign in with Apple (4.8):** not applicable — no third-party login.
- **Purpose strings:** none needed. The app requests no protected iOS
  permission — no location, contacts, camera, microphone, photos or tracking.

---

## Google Play

### Financial features declaration

**Required for every app**, including apps with no financial features. Answer
**"My app doesn't provide any financial features."** Ripple appears in the
form's *Trading and funds → stock trading* territory by subject matter, but the
declaration is about what the app lets users *do*: it enables no trading, no
brokerage, no money movement and no personalised advice. Declaring otherwise
would invite licensing documentation requests for a product that needs none.

### Data safety answers

Play defines collection as **any data transmitted off the device**, which is a
broader test than Apple's, so answer it carefully:

- **Does your app collect or share any of the required user data types?** No.
  The data types Play enumerates — name, email, location, contacts, photos,
  financial *account* information, health, messages, identifiers — are none of
  them read or transmitted. The watchlist never leaves the device.
- **Is all user data encrypted in transit?** Yes. Every request is HTTPS.
- **Do you provide a way for users to request data deletion?** Not applicable;
  say so and point at the policy. Uninstalling removes everything, and there is
  no server-side copy to request.
- **Ads:** No ads, no ad SDK, no advertising ID.
- **Target audience and content:** not designed for children; do not opt into
  the Designed for Families programme.

### Technical requirements

- **Target API level.** New apps and updates must target **Android 16 (API 36)**
  from 31 August 2026. Expo SDK 57 already defaults `targetSdkVersion` and
  `compileSdkVersion` to 36, so no `expo-build-properties` override is needed —
  but verify it in the generated `build.gradle` after `expo prebuild` rather
  than trusting this note.
- **Permissions.** Only `INTERNET` and `VIBRATE` (the latter is required by
  `expo-haptics`; blocking it silently kills every haptic in the app). No
  sensitive or restricted permission is declared, so no permissions declaration
  form is needed.
- **Privacy policy URL** on the listing — see blocker 2.
- **Content rating (IARC):** complete the questionnaire. No violence, no user
  interaction, no gambling, no purchases. Financial news and reference content.

---

## Sources

- [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- [Apple: describing use of required reason API](https://developer.apple.com/documentation/bundleresources/describing-use-of-required-reason-api)
- [Expo: Apple privacy manifests](https://docs.expo.dev/guides/apple-privacy/)
- [Play: Financial features declaration](https://support.google.com/googleplay/android-developer/answer/13849271)
- [Play: Data safety section](https://support.google.com/googleplay/android-developer/answer/10787469)
- [Play: target API level requirements](https://support.google.com/googleplay/android-developer/answer/11926878)
