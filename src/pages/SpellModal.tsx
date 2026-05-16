import {
    Badge,
    Center,
    Divider,
    Group,
    Loader,
    Modal,
    ScrollArea,
    SimpleGrid,
    Stack,
    Text,
} from "@mantine/core";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { type SpellDetail, fetchSpell } from "../api";

const schoolColors: Record<string, string> = {
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

function formatComponents(c: SpellDetail["components"]): string {
    const parts: string[] = [];
    if (c.verbal) parts.push("V");
    if (c.somatic) parts.push("S");
    if (c.material) parts.push(c.cost ? `M (${c.cost} gp)` : "M");
    if (c.focus) parts.push("F");
    if (c.divineFocus) parts.push("DF");
    return parts.join(", ") || "—";
}

function StatBlock({ label, value }: { label: string; value: string | null | undefined }) {
    if (!value) return null;
    return (
        <Stack gap={2}>
            <Text size="xs" tt="uppercase" fw={700} c="dimmed" style={{ letterSpacing: "0.06em" }}>
                {label}
            </Text>
            <Text size="sm">{value}</Text>
        </Stack>
    );
}

function LevelSection({ spell }: { spell: SpellDetail }) {
    const entries: string[] = [];

    if (spell.classes.length) {
        const byLevel = new Map<number, string[]>();
        for (const c of spell.classes) {
            if (!byLevel.has(c.level)) byLevel.set(c.level, []);
            byLevel.get(c.level)!.push(c.name);
        }
        const sorted = [...byLevel.entries()].sort(([a], [b]) => a - b);
        for (const [level, names] of sorted) {
            entries.push(`${names.join("/")} ${level}`);
        }
    }

    if (spell.domains.length) {
        const parts = spell.domains.map((d) => `${d.name} ${d.level}`).join(", ");
        entries.push(`Domain — ${parts}`);
    }

    if (spell.subdomains.length) {
        const parts = spell.subdomains.map((d) => `${d.name} ${d.level}`).join(", ");
        entries.push(`Subdomain — ${parts}`);
    }

    if (spell.bloodlines.length) {
        const parts = spell.bloodlines.map((b) => `${b.name} ${b.classLevel}`).join(", ");
        entries.push(`Bloodline — ${parts}`);
    }

    if (spell.patrons.length) {
        const parts = spell.patrons.map((p) => `${p.name} ${p.classLevel}`).join(", ");
        entries.push(`Patron — ${parts}`);
    }

    if (spell.mysteries.length) {
        const parts = spell.mysteries
            .map((m) => `${m.name} ${m.classLevel}${m.note ? ` (${m.note})` : ""}`)
            .join(", ");
        entries.push(`Mystery — ${parts}`);
    }

    if (entries.length === 0) return null;

    return (
        <Stack gap={4}>
            <Text size="xs" tt="uppercase" fw={700} c="dimmed" style={{ letterSpacing: "0.06em" }}>
                Level
            </Text>
            {entries.map((e) => (
                <Text key={e} size="sm">{e}</Text>
            ))}
        </Stack>
    );
}

export function SpellModal() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [opened, setOpened] = useState(true);
    const [spell, setSpell] = useState<SpellDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!id) return;
        setLoading(true);
        setError(null);
        fetchSpell(id)
            .then(setSpell)
            .catch((e: Error) => setError(e.message))
            .finally(() => setLoading(false));
    }, [id]);

    const schoolName = spell?.school?.name ?? null;

    return (
        <Modal
            opened={opened}
            onClose={() => setOpened(false)}
            transitionProps={{ onExited: () => navigate("/spells") }}
            title={
                spell ? (
                    <Text fw={700} size="lg">{spell.name}</Text>
                ) : (
                    <Text fw={700} size="lg" c="dimmed">Loading…</Text>
                )
            }
            size="xl"
            scrollAreaComponent={ScrollArea.Autosize}
        >
            {loading && (
                <Center py="xl"><Loader /></Center>
            )}

            {error && (
                <Text c="red" ta="center" py="xl">{error}</Text>
            )}

            {spell && !loading && (
                <Stack gap="md">
                    {/* School + subschool + descriptors */}
                    <Group gap="xs" wrap="wrap">
                        {schoolName && (
                            <Badge color={schoolColors[schoolName] ?? "gray"} variant="filled" size="md">
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
                    <SimpleGrid cols={{ base: 2, sm: 3 }} spacing="md">
                        <StatBlock label="Casting Time" value={spell.castingTime} />
                        <StatBlock label="Components"   value={formatComponents(spell.components)} />
                        <StatBlock label="Range"        value={spell.range} />
                        {spell.area     && <StatBlock label="Area"    value={spell.area} />}
                        {spell.effect   && <StatBlock label="Effect"  value={spell.effect} />}
                        {spell.targets  && <StatBlock label="Targets" value={spell.targets} />}
                        <StatBlock label="Duration"     value={spell.duration} />
                        <StatBlock label="Saving Throw" value={spell.savingThrow} />
                        <StatBlock label="Spell Resist" value={spell.spellResistance} />
                    </SimpleGrid>

                    <Divider />

                    {/* Level info */}
                    <LevelSection spell={spell} />

                    <Divider />

                    {/* Description */}
                    <Text size="sm" style={{ lineHeight: 1.7 }}>
                        {spell.description}
                    </Text>

                    {/* Mythic / Augmented */}
                    {spell.mythicText && (
                        <>
                            <Divider label="Mythic" labelPosition="left" />
                            <Text size="sm" style={{ lineHeight: 1.7 }}>{spell.mythicText}</Text>
                        </>
                    )}
                    {spell.augmented && (
                        <>
                            <Divider label="Augmented" labelPosition="left" />
                            <Text size="sm" style={{ lineHeight: 1.7 }}>{spell.augmented}</Text>
                        </>
                    )}

                    {/* Permanency / SLA / Race footnotes */}
                    {(spell.permanency || spell.slaLevel || spell.race) && (
                        <>
                            <Divider />
                            <Group gap="xl">
                                {spell.permanency && (
                                    <Stack gap={2}>
                                        <Text size="xs" tt="uppercase" fw={700} c="dimmed" style={{ letterSpacing: "0.06em" }}>
                                            Permanency
                                        </Text>
                                        <Text size="sm">
                                            CL {spell.permanency.cl ?? "—"}
                                            {spell.permanency.cost ? `, ${spell.permanency.cost} gp` : ""}
                                        </Text>
                                    </Stack>
                                )}
                                {spell.slaLevel && (
                                    <Stack gap={2}>
                                        <Text size="xs" tt="uppercase" fw={700} c="dimmed" style={{ letterSpacing: "0.06em" }}>
                                            SLA Level
                                        </Text>
                                        <Text size="sm">{spell.slaLevel}</Text>
                                    </Stack>
                                )}
                                {spell.race && (
                                    <Stack gap={2}>
                                        <Text size="xs" tt="uppercase" fw={700} c="dimmed" style={{ letterSpacing: "0.06em" }}>
                                            Race
                                        </Text>
                                        <Text size="sm">{spell.race}</Text>
                                    </Stack>
                                )}
                            </Group>
                        </>
                    )}

                    {/* Source */}
                    <Text size="xs" c="dimmed" ta="right">
                        Source: {spell.sourcebook}
                        {spell.link && (
                            <> · <a href={spell.link} target="_blank" rel="noreferrer" style={{ color: "inherit" }}>AoN ↗</a></>
                        )}
                    </Text>
                </Stack>
            )}
        </Modal>
    );
}
