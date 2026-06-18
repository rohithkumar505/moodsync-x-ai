import { useEffect, useState } from 'react';

const MOBILE_MQ = '(max-width: 1023px)';

export function useIsMobileViewport(): boolean {
  const [mobile, setMobile] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(MOBILE_MQ).matches : false,
  );

  useEffect(() => {
    const mq = window.matchMedia(MOBILE_MQ);
    const onChange = () => setMobile(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return mobile;
}
