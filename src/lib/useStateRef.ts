import { useCallback, useRef, useState, type RefObject } from "react";

/**
 * State that a non-React callback can also read, without the usual pair of a
 * `useState` and a `useRef` kept in sync by an effect.
 *
 * The map is the reason this exists. MapLibre owns a WebGL context and a
 * worker pool, so its event handlers are registered exactly once, in an
 * effect with an empty dependency array — which means they close over the
 * first render's state forever. Anything they need to read has to come
 * through a ref.
 *
 * Mirroring state into a ref by hand invites three failure modes, all of
 * which this codebase had at once:
 *
 *   - mirroring in `useEffect`, which lands one render *late*, so a handler
 *     that runs during the same tick as the click reads the old value;
 *   - assigning the ref at each call site, which is correct until someone
 *     adds a fourth call site and forgets;
 *   - assigning it inside a `setState` updater, which makes the updater
 *     impure — React is free to call it twice, and does in StrictMode.
 *
 * Writing the ref inside the setter, before scheduling the render, closes
 * all three: the ref is current the instant the setter returns, so the
 * caller can flip a checkbox and immediately re-derive the map's filters
 * from it.
 */
export function useStateRef<T>(initial: T): [T, (next: T | ((prev: T) => T)) => void, RefObject<T>] {
  const [value, setValue] = useState(initial);
  const ref = useRef(value);

  const set = useCallback((next: T | ((prev: T) => T)) => {
    const resolved = typeof next === "function" ? (next as (prev: T) => T)(ref.current) : next;
    ref.current = resolved;
    setValue(resolved);
  }, []);

  return [value, set, ref];
}
