import { Group, Pill, Select, Stack, Text } from "@mantine/core";
import { type FC, useEffect, useState } from "react";
import {
    type DomainWithSubdomains, fetchBloodlines, fetchDomains, fetchMysteries, fetchPatrons, type LookupItem,
} from "../api";
import { SOURCE_TYPE_LABELS, type SourceEntry, sourceLabel, type SourceType } from "./characterState";
import { SectionLabel } from "./SectionLabel";

interface Lookups {
    domains: DomainWithSubdomains[];
    bloodlines: LookupItem[];
    patrons: LookupItem[];
    mysteries: LookupItem[];
}

interface Option {
    value: string;
    label: string;
}

type OptionData = Option[] | { group: string; items: Option[] }[];

// Subdomain option values carry their domain: "<subdomainId>|<domainId>"
const options = (type: SourceType, lookups: Lookups): OptionData => {
    const plain = (items: LookupItem[]) => items.map((i) => ({value: i.id, label: i.name}));
    switch (type) {
        case "domain":
            return plain(lookups.domains);
        case "subdomain":
            return lookups.domains
                .filter((d) => d.subdomains.length > 0)
                .map((d) => ({group: d.name, items: d.subdomains.map((s) => ({value: `${s.id}|${d.id}`, label: s.name}))}));
        case "bloodline":
            return plain(lookups.bloodlines);
        case "patron":
            return plain(lookups.patrons);
        case "mystery":
            return plain(lookups.mysteries);
    }
};

const toEntry = (type: SourceType, value: string, lookups: Lookups): SourceEntry | null => {
    if (type === "subdomain") {
        const [subdomainId, domainId] = value.split("|");
        const domain = lookups.domains.find((d) => d.id === domainId);
        const subdomain = domain?.subdomains.find((s) => s.id === subdomainId);
        return domain && subdomain
            ? {type, sourceId: subdomain.id, domainId: domain.id, label: sourceLabel(subdomain.name, type, domain.name)}
            : null;
    }
    const list = type === "domain" ? lookups.domains
        : type === "bloodline" ? lookups.bloodlines
            : type === "patron" ? lookups.patrons
                : lookups.mysteries;
    const item = list.find((i) => i.id === value);
    return item ? {type, sourceId: item.id, domainId: null, label: sourceLabel(item.name, type)} : null;
};

interface SourcePickerProps {
    value: SourceEntry[];
    onChange: (sources: SourceEntry[]) => void;
}

/** Domains, subdomains, bloodlines, patrons and mysteries: any number, any mix. */
export const SourcePicker: FC<SourcePickerProps> = ({value, onChange}) => {
    const [type, setType] = useState<SourceType>("domain");
    const [lookups, setLookups] = useState<Lookups | null>(null);

    useEffect(() => {
        Promise.all([fetchDomains(), fetchBloodlines(), fetchPatrons(), fetchMysteries()])
            .then(([domains, bloodlines, patrons, mysteries]) => setLookups({domains, bloodlines, patrons, mysteries}))
            .catch(() => setLookups({domains: [], bloodlines: [], patrons: [], mysteries: []}));
    }, []);

    const add = (selected: string | null) => {
        const entry = selected && lookups ? toEntry(type, selected, lookups) : null;
        const duplicate = entry && value.some((v) =>
            v.type === entry.type && v.sourceId === entry.sourceId && (v.domainId ?? null) === (entry.domainId ?? null));
        if (entry && !duplicate) {
            onChange([...value, entry]);
        }
    };

    return <Stack gap={6}>
        <SectionLabel>Domains, bloodlines…</SectionLabel>
        <Group gap="xs" wrap="nowrap">
            <Select
                aria-label="Source type"
                w={130}
                data={Object.entries(SOURCE_TYPE_LABELS).map(([v, label]) => ({value: v, label}))}
                value={type}
                onChange={(v) => v && setType(v as SourceType)}
                allowDeselect={false}
            />
            <Select
                key={type}
                aria-label={`Add ${type}`}
                placeholder={`Add a ${type}…`}
                searchable
                style={{flex: 1}}
                disabled={!lookups}
                data={lookups ? options(type, lookups) : []}
                value={null}
                onChange={add}
            />
        </Group>
        {value.length > 0 ? (
            <Pill.Group>
                {value.map((src, i) => (
                    <Pill
                        key={`${src.type}:${src.sourceId}:${src.domainId ?? ""}`}
                        withRemoveButton
                        onRemove={() => onChange(value.filter((_, j) => j !== i))}
                    >
                        {src.label}
                    </Pill>
                ))}
            </Pill.Group>
        ) : (
            <Text size="xs" c="dimmed">None. Clerics usually have two domains; archetypes can add anything.</Text>
        )}
    </Stack>;
};
