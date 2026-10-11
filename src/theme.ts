import { createTheme, type MantineColorsTuple } from "@mantine/core";

const forestDark: MantineColorsTuple = [
    "#c8d0cc",
    "#adb8b2",
    "#8d9c95",
    "#607068",
    "#3b4840",
    "#2c3830",
    "#212e25",
    "#192420",
    "#131c17",
    "#0e1612",
];

export const theme = createTheme({
    fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
    fontFamilyMonospace: "ui-monospace, 'Cascadia Code', Consolas, monospace",
    primaryColor: "teal",
    // Filled badges/buttons pick black or white text by background luminance
    // (white on yellow/lime/orange is unreadable)
    autoContrast: true,
    defaultRadius: "md",
    colors: {
        dark: forestDark,
    },
    headings: {
        fontWeight: "600",
    },
});
