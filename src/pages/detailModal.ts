import { useMediaQuery } from "@mantine/hooks";

/**
 * Shared layout for the spell / feat detail modals: the record's name is a
 * prominent title in the header bar, long words wrap instead of widening the
 * body, and on phones the modal takes the whole screen.
 */
export const useDetailModalLayout = () => {
    const isMobile = useMediaQuery("(max-width: 48em)") ?? false;

    return {
        fullScreen: isMobile,
        transitionProps: isMobile ? {transition: "fade" as const} : {},
        styles: {
            title: {fontWeight: 700, fontSize: "var(--mantine-font-size-xl)"},
            body: {overflowWrap: "anywhere" as const},
        },
    };
};
