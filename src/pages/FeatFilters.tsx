import { ActionIcon, Chip, Divider, Drawer, Group, NumberInput, ScrollArea, Stack, Text } from "@mantine/core";
import { type FC } from "react";
import { FiX } from "react-icons/fi";
import { activeFeatFilterCount, FEAT_TYPE_COLORS, type FeatFilterState } from "./featFilterState";
import { ListError } from "./ListFooter";
import { LabeledSection } from "./SectionLabel";

interface Props {
    opened: boolean;
    onClose: () => void;
    filters: FeatFilterState;
    onChange: <K extends keyof FeatFilterState>(key: K, value: FeatFilterState[K]) => void;
    onClear: () => void;
    featTypes: string[];
    lookupError: boolean;
    onRetryLookups: () => void;
}

export const FeatFilters: FC<Props> =
    ({opened, onClose, filters, onChange, onClear, featTypes, lookupError, onRetryLookups}) =>
        <Drawer
            opened={opened}
            onClose={onClose}
            title={
                <Group justify="space-between" w="100%">
                    <Text fw={600}>Filters</Text>
                    <ActionIcon
                        variant="subtle"
                        color="gray"
                        onClick={onClear}
                        title="Clear all filters"
                        aria-label="Clear all filters"
                        disabled={activeFeatFilterCount(filters) === 0}
                    >
                        <FiX size={16}/>
                    </ActionIcon>
                </Group>
            }
            position="right"
            size="sm"
            scrollAreaComponent={ScrollArea.Autosize}
        >
            <Stack gap="lg" pb="xl">
                {lookupError && <ListError message="Couldn't load feat types." onRetry={onRetryLookups}/>}

                <LabeledSection label="Type">
                    <Chip.Group multiple value={filters.types} onChange={(v) => onChange("types", v)}>
                        <Group gap={6} wrap="wrap">
                            {featTypes.map((t) => (
                                <Chip
                                    key={t}
                                    value={t}
                                    size="xs"
                                    variant="outline"
                                    color={FEAT_TYPE_COLORS[t] ?? "gray"}
                                >
                                    {t}
                                </Chip>
                            ))}
                        </Group>
                    </Chip.Group>
                </LabeledSection>

                <Divider/>

                <LabeledSection label="Character Requirements">
                    <NumberInput
                        label="Max BAB required"
                        description="Show feats with base attack bonus ≤ this value (or no BAB requirement)"
                        placeholder="Any"
                        min={0}
                        max={20}
                        value={filters.maxBab === "" ? "" : Number(filters.maxBab)}
                        onChange={(v) => onChange("maxBab", v === "" ? "" : String(v))}
                        allowDecimal={false}
                        clampBehavior="strict"
                    />
                    <NumberInput
                        label="Max caster level required"
                        description="Show feats with caster level ≤ this value (or no CL requirement)"
                        placeholder="Any"
                        min={0}
                        max={20}
                        value={filters.maxCl === "" ? "" : Number(filters.maxCl)}
                        onChange={(v) => onChange("maxCl", v === "" ? "" : String(v))}
                        allowDecimal={false}
                        clampBehavior="strict"
                    />
                </LabeledSection>
            </Stack>
        </Drawer>;
