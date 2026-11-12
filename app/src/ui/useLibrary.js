import { useEffect, useState } from 'preact/hooks';
import { loadLibrary } from '../lib/library.js';

/** Biblioteca cargada (o error). Devuelve { lib, error }. */
export function useLibrary() {
  const [state, setState] = useState({ lib: null, error: null });
  useEffect(() => {
    let alive = true;
    loadLibrary().then(lib => alive && setState({ lib, error: null }), e => alive && setState({ lib: null, error: String(e?.message || e) }));
    return () => { alive = false; };
  }, []);
  return state;
}
