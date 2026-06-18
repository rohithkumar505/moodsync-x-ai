import { useMemo } from 'react';

/** Bottom offsets for nav + player + MoodBuddy FAB on mobile. */
export function useMobileShellInsets(hasPlayer: boolean, playerExpanded: boolean) {
  return useMemo(() => {
    const dockVisible = hasPlayer;
    const expanded = dockVisible && playerExpanded;
    return {
      dockVisible,
      expanded,
      fabClass: expanded
        ? 'mobile-assistant-fab-expanded'
        : dockVisible
          ? 'mobile-assistant-fab-mini'
          : 'mobile-assistant-fab-nav',
    };
  }, [hasPlayer, playerExpanded]);
}
