import { CongressProvider } from './congress/CongressProvider';
import { FundsProvider } from './funds/FundsProvider';
import { InsiderProvider } from './insider/InsiderProvider';
import { PolicyProvider } from './policy/PolicyProvider';
import { StocksProvider } from './stocks/StocksProvider';
import type { Provider, SourceDescriptor, SourceId } from './types';

/**
 * The one place signal sources are wired in.
 *
 * To add another — Senate disclosures, government contract awards, lobbying
 * filings, Fed speeches:
 *   1. add the id to `SourceId` in `types.ts`;
 *   2. write `src/providers/<name>/<Name>Provider.ts` satisfying `Provider`;
 *   3. add it to the object below.
 * Nothing in `src/store` or `app/` changes — the picker, the filter chips, the
 * badges and the merge logic all iterate this registry.
 *
 * Order here is the order shown in the picker and the filter row, so it runs
 * from "who acted" to "what the market did".
 */
export const PROVIDERS = {
  congress: CongressProvider,
  insider: InsiderProvider,
  policy: PolicyProvider,
  stocks: StocksProvider,
  funds: FundsProvider,
} satisfies Record<SourceId, Provider<any>>;

export const SOURCE_IDS = Object.keys(PROVIDERS) as SourceId[];

export function getProvider(source: SourceId): Provider<any> {
  const provider = PROVIDERS[source];
  if (!provider) throw new Error(`Unknown source: ${source}`);
  return provider;
}

/** UI-only slice of a provider — safe to pass into presentational components. */
export function describe(source: SourceId): SourceDescriptor {
  const { id, label, sigil, color, icon, blurb, subjectNoun, provenance } = getProvider(source);
  return { id, label, sigil, color, icon, blurb, subjectNoun, provenance };
}

export const ALL_DESCRIPTORS: SourceDescriptor[] = SOURCE_IDS.map(describe);

/** True when `source` is a registered id — guards values read back from storage. */
export function isSourceId(value: string): value is SourceId {
  return Object.prototype.hasOwnProperty.call(PROVIDERS, value);
}
