import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

interface MusicAssistantContextValue {
  open: boolean;
  openAssistant: () => void;
  closeAssistant: () => void;
  toggleAssistant: () => void;
}

const MusicAssistantContext = createContext<MusicAssistantContextValue | null>(null);

export function MusicAssistantProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);

  const openAssistant = useCallback(() => setOpen(true), []);
  const closeAssistant = useCallback(() => setOpen(false), []);
  const toggleAssistant = useCallback(() => setOpen((v) => !v), []);

  const value = useMemo(
    () => ({ open, openAssistant, closeAssistant, toggleAssistant }),
    [open, openAssistant, closeAssistant, toggleAssistant],
  );

  return <MusicAssistantContext.Provider value={value}>{children}</MusicAssistantContext.Provider>;
}

export function useMusicAssistant() {
  const ctx = useContext(MusicAssistantContext);
  if (!ctx) throw new Error('useMusicAssistant must be used within MusicAssistantProvider');
  return ctx;
}
