/**
 * The Terms of Service text, as data.
 *
 * Kept as a plain module rather than markdown or a remote fetch for three
 * reasons: it renders with no parser and no network, it is versioned in git
 * alongside the behaviour it describes, and `TERMS_EFFECTIVE_DATE` can be
 * asserted against in a test, so the terms cannot change without the date
 * moving with them.
 *
 * NOT LEGAL ADVICE, and no substitute for review by a lawyer. This is a
 * plain-language starting point written to match what the app actually does.
 * The two placeholders below cannot be invented and must be filled in before
 * any public release — `test/terms.test.ts` fails while they are still set.
 */

export interface TermsSection {
  /** Stable key for lists and tests; never rendered. */
  id: string;
  title: string;
  /** One entry per paragraph. */
  body: string[];
}

/** Bumped whenever any wording below changes. Shown at the top of the screen. */
export const TERMS_EFFECTIVE_DATE = 'September 3, 2026';

/**
 * Shipping with either of these still unset leaves the terms unenforceable and
 * the user with no way to reach anyone, so the test suite treats a remaining
 * `TODO:` prefix as a failure rather than a warning.
 */
export const TERMS_CONTACT = 'TODO: support email address';
export const TERMS_JURISDICTION = 'TODO: the state or country whose law governs';

export const TERMS_SECTIONS: TermsSection[] = [
  {
    id: 'acceptance',
    title: '1. Accepting these terms',
    body: [
      'By installing or using Ripple ("the app"), you agree to these terms. If you do not agree with them, do not use the app.',
      'You must be old enough to enter into a binding agreement where you live. The app is not directed at children.',
    ],
  },
  {
    id: 'what-ripple-is',
    title: '2. What Ripple is',
    body: [
      'Ripple collects public disclosure records — congressional periodic transaction reports, SEC Form 4 insider filings, presidential actions published in the Federal Register, and public market price data — and shows them in one reverse-chronological feed.',
      'Ripple is a reader. It does not hold funds, place trades, connect to a brokerage, or act on your behalf in any way. There is no account to create and nothing to buy.',
    ],
  },
  {
    id: 'not-advice',
    title: '3. Not financial advice',
    body: [
      'Nothing in the app is investment, legal, tax, or accounting advice, and nothing in it is a recommendation to buy, sell, or hold any security.',
      'Ripple is not a broker-dealer, an investment adviser, or a fiduciary, and using it creates no advisory relationship of any kind. That a filing appears in your feed is not a signal that anyone should act on it.',
      'Every decision you make with information from the app is yours alone. Consider speaking to a licensed professional who knows your circumstances before you act.',
    ],
  },
  {
    id: 'accuracy',
    title: '4. Accuracy and timing',
    body: [
      'The records shown here are produced by other people. Congressional trade disclosures are self-reported, usually give a value range rather than an exact figure, and may be filed up to 45 days after the trade they describe. Form 4 filings and Federal Register documents carry their own filing windows and corrections.',
      'Price data may be delayed, and any figure the app derives from it — a percentage move, a reaction to a filing — is an estimate, not a quote.',
      'The app also falls back to bundled sample data when a source is unreachable or unconfigured. Settings shows every source’s current mode, so you can always check whether what you are reading is live.',
      'We do not warrant that any record is complete, accurate, current, or free of upstream error, and the app is the official record of nothing. Where a decision matters, verify it against the primary source; the links in Settings go straight to them.',
    ],
  },
  {
    id: 'acceptable-use',
    title: '5. Acceptable use',
    body: [
      'Use the app for your own personal, non-commercial purposes. Do not resell it, redistribute its data in bulk, or use it to assemble a competing dataset.',
      'Do not attempt to defeat rate limits, disguise other automated traffic as app traffic, or otherwise put load on an upstream source beyond what that source permits. The public agencies behind this data run on public money and shared capacity.',
      'These filings name real people. Do not use the app, or anything obtained through it, to harass, threaten, stalk, or intimidate anyone, or to imply wrongdoing that a filing does not establish. A disclosure is a disclosure, not an accusation.',
    ],
  },
  {
    id: 'third-party',
    title: '6. Third-party sources and services',
    body: [
      'The app reads from the U.S. House Clerk disclosure system, the SEC EDGAR submissions and full-text APIs, the Federal Register API, and commercial market-data APIs. Their own terms, licences, and access policies govern their data and apply to you when you use it — including the SEC’s fair-access policy for automated EDGAR requests.',
      'Those services can change, rate-limit, or withdraw access at any time, and the app depends on them. When one goes away, the part of the feed it fed goes with it.',
      'Company logos, party marks, and official portraits belong to their respective owners and appear solely to identify the subject of a filing. Their appearance implies no endorsement, affiliation, or sponsorship in either direction.',
    ],
  },
  {
    id: 'your-data',
    title: '7. Your data',
    body: [
      'The app has no accounts and no server of its own. Your watchlist and your cached signals are stored on your device and are not transmitted to us — we do not receive, store, or have any way to see what you follow.',
      'The app makes its requests directly to the public sources listed above. Those requests reach those services from your device, and what they log is governed by their policies, not ours.',
      'Clearing the cached signals in Settings, or deleting the app, removes the data the app keeps.',
    ],
  },
  {
    id: 'availability',
    title: '8. Availability',
    body: [
      'The app is provided free of charge, with no service level and no guarantee of continued availability. Features may change, break, or be removed, and the app may be discontinued entirely.',
    ],
  },
  {
    id: 'warranty',
    title: '9. Disclaimer of warranties',
    body: [
      'The app is provided "as is" and "as available", without warranty of any kind, express or implied — including any implied warranty of merchantability, fitness for a particular purpose, accuracy, or non-infringement — to the fullest extent the law allows.',
      'Some places do not allow certain warranties to be excluded, so parts of this section may not apply to you.',
    ],
  },
  {
    id: 'liability',
    title: '10. Limitation of liability',
    body: [
      'To the fullest extent the law allows, we are not liable for any trading or investment loss, lost profit, lost data, or any indirect, incidental, special, consequential, or punitive damages arising out of your use of the app — including anything that follows from a record that was late, incomplete, wrong, or missing.',
      'Where liability cannot be excluded, it is limited to the greater of what you paid for the app (nothing) and the minimum the law requires.',
    ],
  },
  {
    id: 'changes',
    title: '11. Changes to these terms',
    body: [
      'These terms may be updated as the app changes. The effective date at the top of this screen moves whenever they do, and continuing to use the app after that date means you accept the revised terms.',
    ],
  },
  {
    id: 'law',
    title: '12. Governing law',
    body: [
      `These terms are governed by the laws of ${TERMS_JURISDICTION}, without regard to its conflict-of-laws rules.`,
    ],
  },
  {
    id: 'contact',
    title: '13. Contact',
    body: [`Questions about these terms can be sent to ${TERMS_CONTACT}.`],
  },
];
