'use client'

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import sdk from '@farcaster/miniapp-sdk';

type FarcasterUser = {
  fid: number | null;
  username: string | null;
  displayName: string | null;
  pfpUrl: string | null;
};

type QuickAuthUser = {
  fid: number;
  issuedAt: number;
  expiresAt: number;
} | null;

interface MiniAppContextValue {
  context: Awaited<typeof sdk.context> | null;
  farcasterUser: FarcasterUser | null;
  quickAuthUser: QuickAuthUser;
  isMiniApp: boolean;
  isReady: boolean;
}

export const MiniAppContext = createContext<MiniAppContextValue | null>(null);

export function useMiniApp() {
  const context = useContext(MiniAppContext);
  if (!context) {
    throw new Error('useMiniApp must be used within MiniAppProvider');
  }
  return context;
}

export function MiniAppProvider({ children }: { children: ReactNode }) {
  const [context, setContext] = useState<Awaited<typeof sdk.context> | null>(null);
  const [farcasterUser, setFarcasterUser] = useState<FarcasterUser | null>(null);
  const [quickAuthUser, setQuickAuthUser] = useState<QuickAuthUser>(null);
  const [isMiniApp, setIsMiniApp] = useState(false);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let mounted = true;
    const init = async () => {
      try {
        const isInApp = await sdk.isInMiniApp();
        if (!mounted) return;
        setIsMiniApp(isInApp);

        if (isInApp) {
          const ctx = await sdk.context;
          if (!mounted) return;
          setContext(ctx);

          const user = (ctx as { user?: Record<string, unknown> } | null)?.user;
          setFarcasterUser({
            fid: typeof user?.fid === 'number' ? user.fid : null,
            username: typeof user?.username === 'string' ? user.username : null,
            displayName: typeof user?.displayName === 'string' ? user.displayName : null,
            pfpUrl: typeof user?.pfpUrl === 'string' ? user.pfpUrl : null,
          });

          try {
            const quickAuthFetch = (sdk as unknown as {
              quickAuth?: { fetch?: (input: string) => Promise<Response> };
            }).quickAuth?.fetch;
            if (quickAuthFetch) {
              const response = await quickAuthFetch('/api/auth');
              if (response.ok) {
                const data = (await response.json()) as {
                  user?: { fid?: number; issuedAt?: number; expiresAt?: number };
                };
                const fid = data.user?.fid;
                if (mounted && typeof fid === 'number') {
                  setQuickAuthUser({
                    fid,
                    issuedAt: typeof data.user?.issuedAt === 'number' ? data.user.issuedAt : 0,
                    expiresAt: typeof data.user?.expiresAt === 'number' ? data.user.expiresAt : 0,
                  });
                }
              }
            }
          } catch (error) {
            console.warn('Quick Auth unavailable', error);
          }

          try {
            await sdk.actions.ready();
          } catch (error) {
            console.warn('Mini app ready action failed', error);
          }
        }
      } finally {
        if (mounted) {
          setIsReady(true);
        }
      }
    };
    init();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <MiniAppContext.Provider value={{ context, farcasterUser, quickAuthUser, isMiniApp, isReady }}>
      {children}
    </MiniAppContext.Provider>
  );
}
