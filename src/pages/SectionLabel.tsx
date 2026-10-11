import { Stack, Text } from "@mantine/core";
import type { FC, ReactNode } from "react";

interface SectionLabelProps {
    children: ReactNode;
}

export const SectionLabel: FC<SectionLabelProps> = ({children}) =>
    <Text size="xs" tt="uppercase" fw={700} c="dimmed" style={{letterSpacing: "0.06em"}}>
        {children}
    </Text>;

interface LabeledSectionProps {
    label: string;
    gap?: number;
    children: ReactNode;
}

export const LabeledSection: FC<LabeledSectionProps> = ({label, gap = 6, children}) =>
    <Stack gap={gap}>
        <SectionLabel>{label}</SectionLabel>
        {children}
    </Stack>;
