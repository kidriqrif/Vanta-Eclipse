import { useEffect, useRef } from 'react';

/** False once the component unmounts, so an async result can tell it has nowhere to land. */
export function useMountedRef() {
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  return mounted;
}
