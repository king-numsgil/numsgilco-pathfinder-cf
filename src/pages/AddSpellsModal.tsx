import { Badge, Button, Center, Checkbox, Group, Loader, Modal, Select, Stack, Text, TextInput } from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import { type FC, useEffect, useState } from "react";
import { type CharacterDetail, type CharacterSource, fetchSpells, type SpellListItem } from "../api";
import { levelLabel, SPELL_LEVELS } from "./characterState";

const RESULT_LIMIT = 50;

// Spell levels the character has slots for, as the search's `level` param.
// Cantrips always count (spontaneous casters cast them at will, so their slot
// count is often left at 0); no slots set at all means no filter.
const castableLevels = (slots: number[]): string | undefined => {
    if (!slots.some((n) => n > 0)) {
        return undefined;
    }
    return slots.flatMap((n, level) => level === 0 || n > 0 ? [level] : []).join(",");
};

type SourceParams = Partial<Record<CharacterSource["type"], string>>;

// Comma-separated IDs per source type, as the spell search takes them. A
// subdomain also brings its domain, whose list it only partly replaces.
const sourceParams = (sources: CharacterSource[]): SourceParams => {
    const ids: Record<keyof SourceParams, string[]> = {
        domain: [], subdomain: [], bloodline: [], patron: [], mystery: [], discipline: [],
    };
    for (const src of sources) {
        ids[src.type].push(src.sourceId);
        if (src.domainId) {
            ids.domain.push(src.domainId);
        }
    }
    const params: SourceParams = {};
    for (const type of Object.keys(ids) as (keyof SourceParams)[]) {
        if (ids[type].length) {
            params[type] = [...new Set(ids[type])].join(",");
        }
    }
    return params;
};

interface AddSpellsModalProps {
    character: CharacterDetail;
    onClose: () => void;
    onAdd: (spellId: string, level: number) => void;
}

interface Results {
    key: string;
    spells: SpellListItem[];
    total: number;
}

export const AddSpellsModal: FC<AddSpellsModalProps> = ({character, onClose, onAdd}) => {
    const [search, setSearch] = useState("");
    const [q] = useDebouncedValue(search.trim(), 300);
    const [classOnly, setClassOnly] = useState(true);
    // null: the spell's own level (on the class list, else its lowest)
    const [levelOverride, setLevelOverride] = useState<number | null>(null);
    const [results, setResults] = useState<Results | null>(null);
    const [error, setError] = useState<string | null>(null);

    // The class list plus every source's list (the API ORs them); a subdomain
    // also brings its domain, whose list it only partly replaces
    const {domain, subdomain, bloodline, patron, mystery, discipline} = classOnly ? sourceParams(character.sources) : {};
    const classId = classOnly ? character.classId : undefined;
    const level = castableLevels(character.slots);
    const key = [q, classId, domain, subdomain, bloodline, patron, mystery, discipline, level].join("|");
    useEffect(() => {
        fetchSpells({
            q: q || undefined,
            level,
            class: classId, domain, subdomain, bloodline, patron, mystery, discipline,
            sort: classId ? "level" : "name",
            limit: String(RESULT_LIMIT),
        })
            .then((res) => setResults({key, spells: res.data, total: res.total}))
            .catch((e: unknown) => setError(e instanceof Error ? e.message : "Search failed"));
    }, [key, q, classId, domain, subdomain, bloodline, patron, mystery, discipline, level]);

    const current = results?.key === key ? results : null;
    const known = new Set(character.spells.map((s) => s.id));

    return <Modal opened onClose={onClose} title={`Add spells — ${character.name}`} size="lg">
        <Stack gap="sm">
            <TextInput
                placeholder="Search spells…"
                data-autofocus
                value={search}
                onChange={(e) => setSearch(e.currentTarget.value)}
            />
            <Group justify="space-between" gap="xs">
                <Checkbox
                    label={character.sources.length ? `${character.className} & feature lists only` : `${character.className} list only`}
                    checked={classOnly}
                    onChange={(e) => setClassOnly(e.currentTarget.checked)}
                />
                <Select
                    aria-label="Add at level"
                    size="xs"
                    w={150}
                    data={[
                        {value: "auto", label: "Spell's level"},
                        ...SPELL_LEVELS.map((l) => ({value: String(l), label: `At ${levelLabel(l).toLowerCase()}`})),
                    ]}
                    value={levelOverride === null ? "auto" : String(levelOverride)}
                    onChange={(v) => setLevelOverride(v === null || v === "auto" ? null : Number(v))}
                    allowDeselect={false}
                />
            </Group>

            {error ? (
                <Text c="red" size="sm">{error}</Text>
            ) : !current ? (
                <Center py="lg"><Loader size="sm"/></Center>
            ) : current.spells.length === 0 ? (
                <Text c="dimmed" size="sm" ta="center" py="lg">No spells found.</Text>
            ) : (
                <Stack gap={4}>
                    {current.spells.map((spell) => {
                        const level = levelOverride ?? spell.level ?? 0;
                        const added = known.has(spell.id);
                        return <Group key={spell.id} gap="xs" wrap="nowrap">
                            <Badge circle variant="light" color="teal">{level}</Badge>
                            <Stack gap={0} style={{flex: 1, minWidth: 0}}>
                                <Text size="sm" fw={500}>{spell.name}</Text>
                                {spell.school && <Text size="xs" c="dimmed">{spell.school}</Text>}
                            </Stack>
                            <Button
                                size="xs"
                                variant={added ? "subtle" : "light"}
                                disabled={added}
                                onClick={() => onAdd(spell.id, level)}
                            >
                                {added ? "Added" : "Add"}
                            </Button>
                        </Group>;
                    })}
                    {current.total > current.spells.length && (
                        <Text size="xs" c="dimmed" ta="center" pt="xs">
                            Showing {current.spells.length} of {current.total} — refine the search.
                        </Text>
                    )}
                </Stack>
            )}
        </Stack>
    </Modal>;
};
