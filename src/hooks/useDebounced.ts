import { useEffect, useState } from 'react';

/**
 * Trailing debounce. The autocomplete field runs a network call per keystroke
 * otherwise, which both wastes quota and produces out-of-order results.
 */
export function useDebounced<T>(value: T, delayMs = 250): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
