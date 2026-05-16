import { style } from "@vanilla-extract/css";
import { vars } from "../theme.css";

export const heroTitle = style({
    fontSize: "2.5rem",
    lineHeight: 1.2,
    letterSpacing: "-0.03em",
    "@media": {
        "(max-width: 48em)": {
            fontSize: "1.75rem",
        },
    },
});

export const featureCard = style({
    textDecoration: "none",
    transition: "border-color 150ms ease, transform 150ms ease",
    ":hover": {
        borderColor: vars.colors.teal[7],
        transform: "translateY(-2px)",
    },
});

export const featureIcon = style({
    width: 48,
    height: 48,
    color: vars.colors.teal[4],
});
