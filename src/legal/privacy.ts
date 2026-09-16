import type { SourceId } from '@/providers/types';
import { TERMS_CONTACT } from './terms.ts';

/**
 * The Privacy Policy text, as data.
 *
 * Same shape and reasoning as `./terms.ts`: a plain module so it renders with
 * no parser and no network, versioned in git beside the behaviour it
 * describes, and assertable in a test.
 *
 * -- Why this file has to exist ---------------------------------------------
 * App Store Review Guideline 5.1.1(i) requires a privacy policy link in App
 * Store Connect *and* inside the app, and Google Play requires a policy URL on
 * the store listing plus a completed Data safety form. Neither is optional,
 * and neither is satisfied by the Terms of Service.
 * ---------------------------------------------------------------------------
 *
 * The substance is unusual for an app that "collects nothing": Ripple really
 * does keep every byte of user data on the device, but it also calls public
 * APIs directly from the device rather than through a backend. Those services
 * therefore see the user's IP address and which subject was asked about. A
 * policy that said only "we collect no data" would be technically true about
 * the developer and misleading about what actually happens when the app runs,
 * so every recipient is named individually below.
 *
 * NOT LEGAL ADVICE, and no substitute for review by a lawyer.
 */

export interface PrivacySection {
  /** Stable key for lists and tests; never rendered. */
  id: string;
  title: string;
  /** One entry per paragraph. */
  body: string[];
}

/** Bumped whenever any wording below changes. Shown at the top of the screen. */
export const PRIVACY_EFFECTIVE_DATE = 'September 4, 2026';

/**
 * Deliberately the same value the terms use, rather than a second placeholder.
 * Two contact addresses that can drift apart is one more thing to get wrong,
 * and `test/terms.test.ts` already gates the unfilled one.
 */
export const PRIVACY_CONTACT = TERMS_CONTACT;

/** Who receives a request, and what they necessarily learn from it. */
export interface DataRecipient {
  name: string;
  /** The host the device connects to. */
  host: string;
  /** What that service can see, stated plainly. */
  receives: string;
  /** Their own policy, for the user to read. */
  policyUrl: string;
  /** True when the connection only happens if an optional API key is set. */
  optional?: boolean;
}

/**
 * Everyone the app talks to, grouped by the source that talks to them.
 *
 * Typed as `Record<SourceId, ...>` so registering a new source fails the build
 * until its upstream is disclosed here. A provider added without a matching
 * entry would silently start sending users' requests to an undisclosed third
 * party, which is the exact failure this policy exists to prevent.
 */
export const PRIVACY_RECIPIENTS: Record<SourceId, DataRecipient[]> = {
  congress: [
    {
      name: 'U.S. House of Representatives, Office of the Clerk',
      host: 'disclosures-clerk.house.gov',
      receives: 'your IP address and the disclosure index the app downloads',
      policyUrl: 'https://www.house.gov/privacy-policy',
    },
    {
      // The roster of current members, and their official portraits, come from
      // the @unitedstates open-data project, which is served by GitHub Pages.
      name: 'GitHub (@unitedstates congress-legislators)',
      host: 'unitedstates.github.io',
      receives: 'your IP address when the roster of current members and their portraits are fetched',
      policyUrl:
        'https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement',
    },
    {
      name: 'Quiver Quantitative',
      host: 'api.quiverquant.com',
      receives: 'your IP address and the member of Congress being looked up',
      policyUrl: 'https://www.quiverquant.com/privacy/',
      optional: true,
    },
    {
      name: 'Financial Modeling Prep',
      host: 'financialmodelingprep.com',
      receives: 'your IP address and the member of Congress being looked up',
      policyUrl: 'https://site.financialmodelingprep.com/privacy-policy',
      optional: true,
    },
  ],
  insider: [
    {
      name: 'U.S. Securities and Exchange Commission (EDGAR)',
      host: 'sec.gov',
      receives: 'your IP address and the company whose filings are requested',
      policyUrl: 'https://www.sec.gov/privacy',
    },
  ],
  policy: [
    {
      name: 'Federal Register',
      host: 'federalregister.gov',
      receives: 'your IP address and the document type or topic being searched',
      policyUrl: 'https://www.federalregister.gov/reader-aids/legal-notices',
    },
  ],
  stocks: [
    {
      name: 'Yahoo Finance',
      host: 'query1.finance.yahoo.com',
      receives: 'your IP address and the ticker symbol being priced',
      policyUrl: 'https://legal.yahoo.com/us/en/yahoo/privacy/index.html',
    },
    {
      name: 'Finnhub',
      host: 'finnhub.io',
      receives: 'your IP address and the ticker symbol being priced',
      policyUrl: 'https://finnhub.io/privacy-policy',
      optional: true,
    },
  ],
};

/** Flat list, in the registry's own order, for rendering and for tests. */
export const ALL_RECIPIENTS: DataRecipient[] = Object.values(PRIVACY_RECIPIENTS).flat();

export const PRIVACY_SECTIONS: PrivacySection[] = [
  {
    id: 'summary',
    title: '1. The short version',
    body: [
      'Ripple has no account, no sign-in, and no server of its own. Your watchlist and the signals you have already seen are stored on your device and are never uploaded anywhere.',
      'The app does fetch public records directly from the agencies and services that publish them. Those services see your IP address and what you asked for, the same as if you had visited their website in a browser. Section 3 names every one of them.',
      'There is no advertising, no analytics, no tracking, and no third-party SDK collecting anything in the background.',
    ],
  },
  {
    id: 'on-device',
    title: '2. What stays on your device',
    body: [
      'Your watchlist - which members of Congress, companies and policy topics you follow, and which of them are paused - is stored on your device.',
      'A copy of recent signals is cached on the device so the app opens on what you last saw instead of a loading spinner. Nothing about which signals you opened, shared, or scrolled past is recorded at all.',
      'None of this leaves the device. It is not backed up to us, because there is no server to back it up to. If your device operating system backup includes app data, that copy is governed by your own backup settings rather than by this app.',
    ],
  },
  {
    id: 'third-parties',
    title: '3. What leaves your device, and to whom',
    body: [
      'Ripple calls public APIs directly from your device rather than routing them through a server. That design keeps your watchlist private - nobody, including the developer, ever receives it - but it means each service sees the individual requests your device makes to it.',
      'What they receive is an ordinary web request: your IP address, your network user agent, and the specific subject being requested. None of these requests carry your name, your watchlist as a whole, an advertising identifier, or any account, because the app has none of those things to send.',
      'The services below are the complete set. Those marked optional are contacted only if an API key has been configured in this build.',
    ],
  },
  {
    id: 'not-done',
    title: '4. What the app does not do',
    body: [
      'No advertising, and no advertising identifier is read or transmitted.',
      'No analytics or crash-reporting SDK. Nothing measures which screens you visit or how long you spend on them.',
      'No tracking across apps or websites. No data is sold or shared with data brokers, and nothing is combined into a profile of you.',
      'No access to your contacts, photos, location, microphone, camera, calendar, or health data. The app never requests these permissions, so it cannot read them.',
    ],
  },
  {
    id: 'retention',
    title: '5. Keeping and deleting your data',
    body: [
      'On-device data is kept until you remove it. "Clear cached signals" in Settings empties the cached feed while keeping your watchlist. Removing a subject from your watchlist deletes its signals from the feed immediately.',
      'Uninstalling the app deletes everything it stored, permanently and completely.',
      'There is no request-my-data or delete-my-data process, because there is no copy held anywhere else to request or delete. Requests already made to the third parties in section 3 are held under their own retention policies, which are linked there, and cannot be recalled by this app.',
    ],
  },
  {
    id: 'children',
    title: '6. Children',
    body: [
      'Ripple is not directed at children and is not designed for anyone under 13. It does not knowingly collect information from children. Because it collects no personal information from anyone, there is nothing held about a child to delete.',
    ],
  },
  {
    id: 'changes',
    title: '7. Changes to this policy',
    body: [
      'If this policy changes, the effective date at the top of this screen changes with it, and the updated text ships in the same app update as the behaviour it describes. Continuing to use the app after an update means accepting the version shipped in it.',
    ],
  },
  {
    id: 'contact',
    title: '8. Contact',
    body: [`Questions about privacy can be sent to ${PRIVACY_CONTACT}.`],
  },
];
