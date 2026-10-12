import { ScrollArea } from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";

// Autosize gives its content `min-width: min-content`, so one wide child (a
// Markdown table) would widen the whole body; tables scroll on their own instead
const DetailScrollArea = ScrollArea.Autosize.withProps({styles: {content: {minWidth: 0}}});

/**
 * Shared layout for the spell / feat detail modals: the record's name is a
 * prominent title in the header bar, long words wrap instead of widening the
 * body, and on phones the modal takes the whole screen.
 */
export const useDetailModalLayout = () => {
    const isMobile = useMediaQuery("(max-width: 48em)") ?? false;

    return {
        fullScreen: isMobile,
        scrollAreaComponent: DetailScrollArea,
        transitionProps: isMobile ? {transition: "fade" as const} : {},
        styles: {
            title: {fontWeight: 700, fontSize: "var(--mantine-font-size-xl)"},
            body: {overflowWrap: "anywhere" as const},
        },
    };
};
