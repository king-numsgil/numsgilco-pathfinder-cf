import { style } from "@vanilla-extract/css";

// Two columns: a narrow label (level badge or source name), then a value that
// wraps freely — minmax(0, 1fr) lets long lists shrink instead of overflowing
export const levelGrid = style({
    display: "grid",
    gridTemplateColumns: "auto minmax(0, 1fr)",
    columnGap: 12,
    rowGap: 6,
    alignItems: "baseline",
});
