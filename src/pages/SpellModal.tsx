import { Badge, Center, Divider, Group, Loader, Modal, ScrollArea, SimpleGrid, Stack, Text } from "@mantine/core";
import { type FC, Fragment, useState } from "react";
import { useParams } from "react-router-dom";
import { fetchSpell, type SpellDetail } from "../api";
import { useDetailModalLayout } from "./detailModal";
import { useCloseModal } from "./listNavigation";
import { LabeledSection } from "./SectionLabel";
import * as classes from "./SpellModal.css";
import { SCHOOL_COLORS } from "./spellFilterState";
import { useDetail } from "./useDetail";

// Source text uses newlines for paragraphs and bullet lists
const PROSE_STYLE = {lineHeight: 1.7, whiteSpace: "pre-line"} as const;

function formatComponents(c: SpellDetail["components"]): string {
    const parts: string[] = [];
    if (c.verbal) {
        parts.push("V");
    }
    if (c.somatic) {
        parts.push("S");
    }
    if (c.material) {
        parts.push(c.cost ? `M (${c.cost} gp)` : "M");
    }
    if (c.focus) {
        parts.push("F");
    }
    if (c.divineFocus) {
        parts.push("DF");
    }
    return parts.join(", ") || "—";
}

// "Name 2 (class level 5)" — bloodline, patron and mystery spells are granted
// at a class level that differs from the spell's level
const formatGranted = (s: { name: string; level: number; classLevel: number }) =>
    `${s.name} ${s.level} (class level ${s.classLevel})`;

interface StatBlockProps {
    label: string;
    value: string | null | undefined;
}

const StatBlock: FC<StatBlockProps> = ({label, value}) => {
    if (!value) {
        return null;
    }
    return <LabeledSection label={label} gap={2}>
        <Text size="sm">{value}</Text>
    </LabeledSection>;
};

interface LevelSectionProps {
    spell: SpellDetail;
}

// One row per class level ("2 · Cleric, Oracle, Wizard"), then one row per
// other source type ("Domain · Fire 2, Sun 2"). Values are comma lists so
// they wrap on narrow screens.
const LevelSection: FC<LevelSectionProps> = ({spell}) => {
    const byLevel = new Map<number, string[]>();
    for (const c of spell.classes) {
        byLevel.set(c.level, [...(byLevel.get(c.level) ?? []), c.name]);
    }
    const classRows = [...byLevel.entries()]
        .sort(([a], [b]) => a - b)
        .map(([level, names]) => ({level, names: names.sort((a, b) => a.localeCompare(b)).join(", ")}));

    const sourceRows = [
        {label: "Domain", value: spell.domains.map((d) => `${d.name} ${d.level}`)},
        {label: "Subdomain", value: spell.subdomains.map((d) => `${d.name} ${d.level}`)},
        {label: "Bloodline", value: spell.bloodlines.map(formatGranted)},
        {label: "Patron", value: spell.patrons.map(formatGranted)},
        {
            label: "Mystery",
            value: spell.mysteries.map((m) => `${formatGranted(m)}${m.note ? ` — ${m.note}` : ""}`),
        },
    ].filter((row) => row.value.length > 0);

    if (classRows.length === 0 && sourceRows.length === 0) {
        return null;
    }

    return <LabeledSection label="Level" gap={8}>
        <div className={classes.levelGrid}>
            {classRows.map(({level, names}) => (
                <Fragment key={`class-${level}`}>
                    <Badge circle variant="light" color="teal" size="md">{level}</Badge>
                    <Text size="sm">{names}</Text>
                </Fragment>
            ))}
            {sourceRows.map(({label, value}) => (
                <Fragment key={label}>
                    <Text size="xs" fw={700} c="dimmed">{label}</Text>
                    <Text size="sm">{value.join(", ")}</Text>
                </Fragment>
            ))}
        </div>
    </LabeledSection>;
};

interface SpellContentProps {
    spell: SpellDetail;
}

const SpellContent: FC<SpellContentProps> = ({spell}) => {
    const schoolName = spell.school?.name ?? null;

    return <Stack gap="md">
        {/* School + subschool + descriptors */}
        <Group gap="xs" wrap="wrap">
            {schoolName && (
                <Badge color={SCHOOL_COLORS[schoolName] ?? "gray"} variant="filled" size="md">
                    {schoolName}
                    {spell.subschool ? ` (${spell.subschool.name})` : ""}
                </Badge>
            )}
            {spell.descriptors.map((d) => (
                <Badge key={d} variant="outline" color="gray" size="sm">{d}</Badge>
            ))}
            {spell.deity && (
                <Badge variant="light" color="yellow" size="sm">{spell.deity.name}</Badge>
            )}
        </Group>

        {/* Casting stats */}
        <SimpleGrid cols={{base: 2, sm: 3}} spacing="md">
            <StatBlock label="Casting Time" value={spell.castingTime}/>
            <StatBlock label="Components" value={formatComponents(spell.components)}/>
            <StatBlock label="Range" value={spell.range}/>
            <StatBlock label="Area" value={spell.area}/>
            <StatBlock label="Effect" value={spell.effect}/>
            <StatBlock label="Targets" value={spell.targets}/>
            <StatBlock label="Duration" value={spell.duration}/>
            <StatBlock label="Saving Throw" value={spell.savingThrow}/>
            <StatBlock label="Spell Resist" value={spell.spellResistance}/>
        </SimpleGrid>

        <Divider/>
        <LevelSection spell={spell}/>
        <Divider/>
        <Text size="sm" style={PROSE_STYLE}>{spell.description}</Text>

        {spell.mythicText && (
            <>
                <Divider label="Mythic" labelPosition="left"/>
                <Text size="sm" style={PROSE_STYLE}>{spell.mythicText}</Text>
            </>
        )}
        {spell.augmented && (
            <>
                <Divider label="Augmented" labelPosition="left"/>
                <Text size="sm" style={PROSE_STYLE}>{spell.augmented}</Text>
            </>
        )}

        {(spell.permanency || spell.slaLevel !== null || spell.race) && (
            <>
                <Divider/>
                <Group gap="xl">
                    {spell.permanency && (
                        <LabeledSection label="Permanency" gap={2}>
                            <Text size="sm">
                                CL {spell.permanency.cl ?? "—"}
                                {spell.permanency.cost ? `, ${spell.permanency.cost} gp` : ""}
                            </Text>
                        </LabeledSection>
                    )}
                    {spell.slaLevel !== null && (
                        <LabeledSection label="SLA Level" gap={2}>
                            <Text size="sm">{spell.slaLevel}</Text>
                        </LabeledSection>
                    )}
                    {spell.race && (
                        <LabeledSection label="Race" gap={2}>
                            <Text size="sm">{spell.race}</Text>
                        </LabeledSection>
                    )}
                </Group>
            </>
        )}

        <Text size="xs" c="dimmed" ta="right">
            Source: {spell.sourcebook}
            {spell.link && (
                <> · <a href={spell.link} target="_blank" rel="noreferrer" style={{color: "inherit"}}>AoN ↗</a></>
            )}
        </Text>
    </Stack>;
};

export const SpellModal: FC = () => {
    const {id} = useParams<{ id: string }>();
    const closeModal = useCloseModal("/spells");
    const [opened, setOpened] = useState(true);
    const {data: spell, error} = useDetail(id, fetchSpell);
    const layout = useDetailModalLayout();

    return <Modal
        opened={opened}
        onClose={() => setOpened(false)}
        fullScreen={layout.fullScreen}
        transitionProps={{...layout.transitionProps, onExited: closeModal}}
        title={spell?.name}
        styles={layout.styles}
        size="xl"
        scrollAreaComponent={ScrollArea.Autosize}
    >
        <title>{`${spell?.name ?? "Spells"} — Pathfinder 1E`}</title>
        {spell ? (
            <SpellContent spell={spell}/>
        ) : error ? (
            <Text c="red" ta="center" py="xl">{error}</Text>
        ) : (
            <Center py="xl"><Loader/></Center>
        )}
    </Modal>;
};
