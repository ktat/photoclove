/**
 * useOverlayMargin Hook
 *
 * Handles margin adjustment when left menu is in overlay mode on narrow screens.
 * On screens < 1000px, when the left menu is expanded, it becomes position: absolute
 * and overlays the content. This hook provides the margin needed to prevent content
 * from being hidden under the overlay.
 */

import { useState, useEffect } from 'react';

const NARROW_SCREEN_BREAKPOINT = 1000;
const OVERLAY_MARGIN = 72; // collapsed menu (60px) + padding (12px)

/**
 * Hook to manage overlay margin for narrow screen left menu overlay mode
 * @returns {number} The margin-left value to apply (0 or 72px)
 */
export function useOverlayMargin() {
    const [overlayMargin, setOverlayMargin] = useState(0);

    useEffect(() => {
        const leftMenu = document.getElementById('leftMenu');
        if (!leftMenu) return;

        // Calculate initial overlay margin
        const calculateMargin = () => {
            const isNarrowScreen = window.innerWidth < NARROW_SCREEN_BREAKPOINT;
            const isCollapsed = leftMenu.classList.contains('collapsed');
            // On narrow screens, expanded left menu (not collapsed) is in overlay mode
            const isOverlay = isNarrowScreen && !isCollapsed;
            return isOverlay ? OVERLAY_MARGIN : 0;
        };

        // Set initial value
        setOverlayMargin(calculateMargin());

        // Watch for left menu class changes
        const leftMenuObserver = new MutationObserver(() => {
            setOverlayMargin(calculateMargin());
        });
        leftMenuObserver.observe(leftMenu, { attributes: true, attributeFilter: ['class'] });

        // Also recalculate on window resize (screen width may cross breakpoint)
        const handleResize = () => {
            setOverlayMargin(calculateMargin());
        };
        window.addEventListener('resize', handleResize);

        return () => {
            leftMenuObserver.disconnect();
            window.removeEventListener('resize', handleResize);
        };
    }, []);

    return overlayMargin;
}
