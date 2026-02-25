import { useEffect, useRef } from 'react';
import { isNative } from '@/lib/capacitor';

interface BackgroundResilienceOptions {
  isActive: boolean;
  onForegroundResume: () => void;
  onBackgroundEnter?: () => void;
  label: string;
}

export function useBackgroundResilience({
  isActive,
  onForegroundResume,
  onBackgroundEnter,
  label,
}: BackgroundResilienceOptions) {
  const lastHiddenTimeRef = useRef<number | null>(null);
  const isActiveRef = useRef(isActive);
  isActiveRef.current = isActive;

  useEffect(() => {
    if (!isActive) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        lastHiddenTimeRef.current = Date.now();
        console.log(`[${label}] App went to background`);
        onBackgroundEnter?.();
      } else if (document.visibilityState === 'visible') {
        const hiddenDuration = lastHiddenTimeRef.current
          ? Math.round((Date.now() - lastHiddenTimeRef.current) / 1000)
          : 0;
        console.log(`[${label}] App returned to foreground after ${hiddenDuration}s`);
        lastHiddenTimeRef.current = null;

        setTimeout(() => {
          if (isActiveRef.current) {
            onForegroundResume();
          }
        }, 500);
      }
    };

    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted && isActiveRef.current) {
        console.log(`[${label}] Page restored from bfcache`);
        setTimeout(() => onForegroundResume(), 500);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pageshow', handlePageShow);

    let capacitorCleanup: (() => void) | null = null;

    if (isNative) {
      import('@capacitor/app').then(({ App }) => {
        const listener = App.addListener('appStateChange', ({ isActive: appIsActive }) => {
          if (appIsActive && isActiveRef.current) {
            console.log(`[${label}] Native app resumed`);
            setTimeout(() => onForegroundResume(), 300);
          } else if (!appIsActive) {
            console.log(`[${label}] Native app backgrounded`);
            onBackgroundEnter?.();
          }
        });
        capacitorCleanup = () => {
          listener.then(h => h.remove());
        };
      });
    }

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pageshow', handlePageShow);
      if (capacitorCleanup) capacitorCleanup();
    };
  }, [isActive, onForegroundResume, onBackgroundEnter, label]);
}
