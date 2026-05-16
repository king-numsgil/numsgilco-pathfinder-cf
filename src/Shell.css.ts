import { style } from "@vanilla-extract/css";
import { vars } from "./theme.css";

export const brand = style({
    color: vars.colors.teal[4],
    letterSpacing: "-0.5px",
    userSelect: "none",
});

export const header = style({
    background: vars.colors.dark[8],
    borderBottom: `1px solid ${vars.colors.dark[5]}`,
    boxShadow: `0 1px 0 ${vars.colors.teal[9]}`,
});

export const navbar = style({
    background: vars.colors.dark[8],
    borderRight: `1px solid ${vars.colors.dark[5]}`,
});
