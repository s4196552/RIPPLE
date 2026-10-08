import type { SourceId } from '@/providers/types';

/**
 * The words the Follow flow and the introduction use for each source.
 *
 * Kept beside the UI rather than on the providers: this is how the screens
 * talk about a source to someone choosing one, not what the source is. Typed
 * as a `Record` so registering a source fails the build until it has copy.
 */
export const FOLLOW_COPY: Record<
  SourceId,
  {
    /** One line under the name in the source picker. */
    pick: string;
    /** What to type, as examples. Shown in mono. */
    example: string;
    /** The step-2 question. */
    question: string;
    /** The longer explanation the introduction gives. */
    explain: string;
    /** What following one means, said once it is done. */
    after: string;
  }
> = {
  congress: {
    pick: 'A whole party, or one member of the House or Senate.',
    example: 'e.g. Republicans · Nancy Pelosi',
    question: 'Who in Congress?',
    explain:
      'Stock trades members must disclose under the STOCK Act — filed as dollar ranges, up to 45 days after the trade.',
    after: 'New trade disclosures will appear in Signals as they are filed.',
  },
  insider: {
    pick: 'Form 4 filings for a company, by name or ticker.',
    example: 'e.g. Apple Inc. · NVDA',
    question: 'Which company?',
    explain: 'SEC Form 4 filings: executives and directors buying or selling their own company’s stock.',
    after: 'New Form 4 filings will appear in Signals as they are filed.',
  },
  policy: {
    pick: 'A topic in executive orders and proclamations.',
    example: 'e.g. “tariff”',
    question: 'Which topic?',
    explain: 'Executive orders and proclamations as they are signed. Follow a topic, like “tariff”.',
    after: 'Matching orders and proclamations will appear in Signals as they are signed.',
  },
  stocks: {
    pick: 'Big price moves and volume spikes on a ticker.',
    example: 'e.g. GOOG · MSFT · HD',
    question: 'Which ticker?',
    explain: 'Notable price moves and volume spikes on the tickers you track.',
    after: 'Big price moves and volume spikes will appear in Signals.',
  },
};
