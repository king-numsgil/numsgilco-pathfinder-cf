import { ActionIcon, Chip, Divider, Drawer, Group, MultiSelect, ScrollArea, Stack, Text } from "@mantine/core";
import { type FC, useMemo } from "react";
import { FiX } from "react-icons/fi";
import { type DomainWithSubdomains, type LookupItem } from "../api";
import { type FilterState } from "./spellFilterState";

const SCHOOL_COLORS: Record<string, string> = {
    Abjuration: "blue",
    Conjuration: "teal",
    Divination: "violet",
    Enchantment: "pink",
    Evocation: "red",
    Illusion: "grape",
    Necromancy: "dark",
    Transmutation: "green",
    Universal: "gray",
};

function toOptions(items: LookupItem[]) {
    return items.map((i) => ({value: i.id, label: i.name}));
}

function FilterSection({label, children}: { label: string; children: React.ReactNode }) {
    return (
        <Stack gap={6}>
            <Text size="xs" tt="uppercase" fw={700} c="dimmed" style={{letterSpacing: "0.06em"}}>
                {label}
            </Text>
            {children}
        </Stack>
    );
}

interface Props {
    opened: boolean;
    onClose: () => void;
    filters: FilterState;
    onChange: <K extends keyof FilterState>(key: K, value: FilterState[K]) => void;
    onClear: () => void;
    schools: LookupItem[];
    subschools: LookupItem[];
    descriptorOptions: string[];
    classes: LookupItem[];
    domains: DomainWithSubdomains[];
    bloodlines: LookupItem[];
    patrons: LookupItem[];
    mysteries: LookupItem[];
}

export const SpellFilters: FC<Props> =
    ({
         opened,
         onClose,
         filters,
         onChange,
         onClear,
         schools,
         subschools,
         descriptorOptions,
         classes,
         domains,
         bloodlines,
         patrons,
         mysteries,
     }) => {
        const availableSubdomains = useMemo(() => {
            const source = filters.domainIds.length
                ? domains.filter((d) => filters.domainIds.includes(d.id))
                : domains;
            const seen = new Set<string>();
            return source.flatMap((d) => d.subdomains).filter((s) => {
                if (seen.has(s.id)) {
                    return false;
                }
                seen.add(s.id);
                return true;
            });
        }, [domains, filters.domainIds]);

        return <Drawer
            opened={opened}
            onClose={onClose}
            title={
                <Group justify="space-between" w="100%">
                    <Text fw={600}>Filters</Text>
                    <ActionIcon variant="subtle" color="gray" onClick={onClear} title="Clear all filters">
                        <FiX size={16}/>
                    </ActionIcon>
                </Group>
            }
            position="right"
            size="sm"
            scrollAreaComponent={ScrollArea.Autosize}
        >
            <Stack gap="lg" pb="xl">
                <FilterSection label="Level">
                    <Chip.Group multiple value={filters.levels} onChange={(v) => onChange("levels", v)}>
                        <Group gap={6}>
                            {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((lvl) => (
                                <Chip key={lvl} value={String(lvl)} size="xs" variant="outline" color="teal">
                                    {lvl}
                                </Chip>
                            ))}
                        </Group>
                    </Chip.Group>
                </FilterSection>

                <Divider/>

                <FilterSection label="School">
                    <Chip.Group multiple value={filters.schoolIds} onChange={(v) => onChange("schoolIds", v)}>
                        <Group gap={6} wrap="wrap">
                            {schools.map((s) => (
                                <Chip
                                    key={s.id}
                                    value={s.id}
                                    size="xs"
                                    variant="outline"
                                    color={SCHOOL_COLORS[s.name] ?? "gray"}
                                >
                                    {s.name}
                                </Chip>
                            ))}
                        </Group>
                    </Chip.Group>
                </FilterSection>

                <FilterSection label="Subschool">
                    <MultiSelect
                        data={toOptions(subschools)}
                        value={filters.subschoolIds}
                        onChange={(v) => onChange("subschoolIds", v)}
                        placeholder="Any subschool"
                        searchable
                        clearable
                        maxDropdownHeight={200}
                    />
                </FilterSection>

                <FilterSection label="Descriptor">
                    <MultiSelect
                        data={descriptorOptions}
                        value={filters.descriptors}
                        onChange={(v) => onChange("descriptors", v)}
                        placeholder="Any descriptor"
                        searchable
                        clearable
                        maxDropdownHeight={200}
                    />
                </FilterSection>

                <Divider/>

                <FilterSection label="Class">
                    <MultiSelect
                        data={toOptions(classes)}
                        value={filters.classIds}
                        onChange={(v) => onChange("classIds", v)}
                        placeholder="Any class"
                        searchable
                        clearable
                        maxDropdownHeight={240}
                    />
                </FilterSection>

                <Divider/>

                <FilterSection label="Domain">
                    <MultiSelect
                        data={toOptions(domains)}
                        value={filters.domainIds}
                        onChange={(v) => onChange("domainIds", v)}
                        placeholder="Any domain"
                        searchable
                        clearable
                        maxDropdownHeight={200}
                    />
                </FilterSection>

                <FilterSection label="Subdomain">
                    <MultiSelect
                        data={toOptions(availableSubdomains)}
                        value={filters.subdomainIds}
                        onChange={(v) => onChange("subdomainIds", v)}
                        placeholder={filters.domainIds.length ? "Any subdomain of selected" : "Any subdomain"}
                        searchable
                        clearable
                        maxDropdownHeight={200}
                    />
                </FilterSection>

                <Divider/>

                <FilterSection label="Bloodline">
                    <MultiSelect
                        data={toOptions(bloodlines)}
                        value={filters.bloodlineIds}
                        onChange={(v) => onChange("bloodlineIds", v)}
                        placeholder="Any bloodline"
                        searchable
                        clearable
                        maxDropdownHeight={200}
                    />
                </FilterSection>

                <FilterSection label="Patron">
                    <MultiSelect
                        data={toOptions(patrons)}
                        value={filters.patronIds}
                        onChange={(v) => onChange("patronIds", v)}
                        placeholder="Any patron"
                        searchable
                        clearable
                        maxDropdownHeight={200}
                    />
                </FilterSection>

                <FilterSection label="Mystery">
                    <MultiSelect
                        data={toOptions(mysteries)}
                        value={filters.mysteryIds}
                        onChange={(v) => onChange("mysteryIds", v)}
                        placeholder="Any mystery"
                        searchable
                        clearable
                        maxDropdownHeight={200}
                    />
                </FilterSection>
            </Stack>
        </Drawer>;
    };
