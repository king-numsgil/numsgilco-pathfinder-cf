import {
    ActionIcon, Alert, Anchor, Badge, Button, Card, Center, Checkbox, Group, Loader, Menu, SimpleGrid, Stack, Tabs, Text,
    Title,
} from "@mantine/core";
import { type FC, type ReactNode, useEffect, useRef, useState } from "react";
import { GiNightSleep } from "react-icons/gi";
import { MdAdd, MdClose, MdDeleteOutline, MdEdit, MdRemove } from "react-icons/md";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
    addKnownSpell, type CharacterDetail, deleteCharacter, fetchCharacter, fetchGranted, type GrantedSpell,
    prepareSpell, removeKnownSpell,
    restCharacter, setPreparedCast, unprepareSpell, updateCharacter,
} from "../api";
import { authClient } from "../api/auth";
import { AddSpellsModal } from "./AddSpellsModal";
import { CharacterForm } from "./CharacterForm";
import { levelLabel, levelsInUse, sourceLabel } from "./characterState";
import { FROM_LIST } from "./listNavigation";
import { SignInPrompt } from "./SignInPrompt";
import { useDetail } from "./useDetail";

type Mutate = (
    action: () => Promise<CharacterDetail>,
    optimistic?: (c: CharacterDetail) => CharacterDetail,
) => void;

interface SpellLinkProps {
    id: string;
    name: string;
    struck?: boolean;
}

// Opens the spell's modal over the spell list; closing it steps back here
const SpellLink: FC<SpellLinkProps> = ({id, name, struck}) =>
    <Anchor
        component={Link}
        to={`/spells/${id}`}
        state={FROM_LIST}
        c="inherit"
        size="sm"
        td={struck ? "line-through" : undefined}
        opacity={struck ? 0.5 : 1}
        style={{flex: 1, minWidth: 0}}
    >
        {name}
    </Anchor>;

interface LevelCardProps {
    level: number;
    badge?: ReactNode;
    children: ReactNode;
}

const LevelCard: FC<LevelCardProps> = ({level, badge, children}) =>
    <Card withBorder padding="sm">
        <Group justify="space-between" mb="xs" wrap="nowrap">
            <Text fw={700}>{levelLabel(level)}</Text>
            {badge}
        </Group>
        <Stack gap={6}>{children}</Stack>
    </Card>;

// One column on phones, two side by side from tablets up
const LevelList = SimpleGrid.withProps({cols: {base: 1, md: 2}, spacing: "sm", verticalSpacing: "sm"});

// Granted levels hold only a few spells each: denser
const GrantedGrid = SimpleGrid.withProps({cols: {base: 1, md: 2, lg: 3, xl: 4}, spacing: "sm", verticalSpacing: "sm"});

interface TodayRowProps {
    children: ReactNode;
}

// Tall rows with room between them: tapped mid-game, on a phone
const TodayRow: FC<TodayRowProps> = ({children}) =>
    <Group gap="sm" wrap="nowrap" mih={44}>{children}</Group>;

interface TabProps {
    character: CharacterDetail;
    mutate: Mutate;
}

// Prepared caster's day: tick off spells as they're cast
const PreparedToday: FC<TabProps> = ({character, mutate}) => {
    const levels = levelsInUse(character);
    if (levels.length === 0) {
        return <Text c="dimmed" size="sm">Set your spells per day (Edit) and prepare spells from the Spellbook tab.</Text>;
    }

    const toggle = (preparedId: string, cast: boolean) => mutate(
        () => setPreparedCast(character.id, preparedId, cast),
        (c) => ({...c, preparedSpells: c.preparedSpells.map((p) => p.id === preparedId ? {...p, cast} : p)}),
    );

    return <LevelList>
        {levels.map((level) => {
            const prepared = character.preparedSpells.filter((p) => p.level === level);
            const left = prepared.filter((p) => !p.cast).length;
            const slots = character.slots[level];
            return <LevelCard
                key={level}
                level={level}
                badge={<Group gap={6}>
                    {level > 0 && prepared.length > 0 && (
                        <Badge variant="light" color={left ? "teal" : "gray"}>{left} left</Badge>
                    )}
                    <Badge variant="outline" color={prepared.length > slots ? "red" : "gray"}>
                        {prepared.length}/{slots} prepared
                    </Badge>
                </Group>}
            >
                {prepared.length === 0 && <Text size="sm" c="dimmed">Nothing prepared.</Text>}
                {prepared.map((p) => (
                    <TodayRow key={p.id}>
                        {level > 0 && (
                            <Checkbox
                                size="md"
                                aria-label={`Cast ${p.name}`}
                                checked={p.cast}
                                onChange={(e) => toggle(p.id, e.currentTarget.checked)}
                            />
                        )}
                        <SpellLink id={p.spellId} name={p.name} struck={p.cast}/>
                        <ActionIcon
                            size="lg"
                            variant="subtle"
                            color="gray"
                            aria-label={`Unprepare ${p.name}`}
                            onClick={() => mutate(
                                () => unprepareSpell(character.id, p.id),
                                (c) => ({...c, preparedSpells: c.preparedSpells.filter((x) => x.id !== p.id)}),
                            )}
                        >
                            <MdClose size={18}/>
                        </ActionIcon>
                    </TodayRow>
                ))}
            </LevelCard>;
        })}
    </LevelList>;
};

// Spontaneous caster's day: spend slots by level
const SpontaneousToday: FC<TabProps> = ({character, mutate}) => {
    const levels = levelsInUse(character);
    if (levels.length === 0) {
        return <Text c="dimmed" size="sm">Set your spells per day (Edit) and add spells known from the Spellbook tab.</Text>;
    }

    const setUsed = (level: number, used: number) => {
        const slotsUsed = character.slotsUsed.map((n, i) => i === level ? used : n);
        mutate(() => updateCharacter(character.id, {slotsUsed}), (c) => ({...c, slotsUsed}));
    };

    return <LevelList>
        {levels.map((level) => {
            const known = character.spells.filter((s) => s.level === level);
            const slots = character.slots[level];
            const used = Math.min(character.slotsUsed[level], slots);
            const left = slots - used;
            const tracked = level > 0;
            return <LevelCard
                key={level}
                level={level}
                badge={tracked ? <Group gap={6} wrap="nowrap">
                    <ActionIcon
                        size="lg"
                        variant="light"
                        aria-label={`Restore a level ${level} slot`}
                        disabled={used === 0}
                        onClick={() => setUsed(level, used - 1)}
                    >
                        <MdAdd size={18}/>
                    </ActionIcon>
                    <Badge variant="light" color={left ? "teal" : "gray"}>{left}/{slots} left</Badge>
                    <ActionIcon
                        size="lg"
                        variant="light"
                        aria-label={`Spend a level ${level} slot`}
                        disabled={left === 0}
                        onClick={() => setUsed(level, used + 1)}
                    >
                        <MdRemove size={18}/>
                    </ActionIcon>
                </Group> : <Badge variant="outline" color="gray">At will</Badge>}
            >
                {known.length === 0 && <Text size="sm" c="dimmed">No spells known.</Text>}
                {known.map((s) => (
                    <TodayRow key={s.id}>
                        <SpellLink id={s.id} name={s.name}/>
                        {tracked && (
                            <Button size="sm" variant="light" disabled={left === 0} onClick={() => setUsed(level, used + 1)}>
                                Cast
                            </Button>
                        )}
                    </TodayRow>
                ))}
            </LevelCard>;
        })}
    </LevelList>;
};

// Spells known / the spellbook, with prepare and remove
const KnownSpells: FC<TabProps> = ({character, mutate}) => {
    const [adding, setAdding] = useState(false);
    const levels = levelsInUse(character).filter((l) => character.spells.some((s) => s.level === l));

    return <Stack gap="sm">
        <Group>
            <Button leftSection={<MdAdd/>} onClick={() => setAdding(true)}>Add spells</Button>
        </Group>
        {levels.length === 0 && <Text c="dimmed" size="sm">No spells yet.</Text>}
        <LevelList>{levels.map((level) => {
            const known = character.spells.filter((s) => s.level === level);
            return <LevelCard key={level} level={level} badge={<Badge variant="outline" color="gray">{known.length}</Badge>}>
                {known.map((s) => (
                    <Group key={s.id} gap="xs" wrap="nowrap">
                        <SpellLink id={s.id} name={s.name}/>
                        {character.prepared && (
                            <Button
                                size="compact-xs"
                                variant="light"
                                onClick={() => mutate(() => prepareSpell(character.id, s.id, level))}
                            >
                                Prepare
                            </Button>
                        )}
                        <ActionIcon
                            variant="subtle"
                            color="gray"
                            aria-label={`Remove ${s.name}`}
                            onClick={() => mutate(
                                () => removeKnownSpell(character.id, s.id),
                                (c) => ({...c, spells: c.spells.filter((x) => x.id !== s.id)}),
                            )}
                        >
                            <MdDeleteOutline/>
                        </ActionIcon>
                    </Group>
                ))}
            </LevelCard>;
        })}</LevelList>
        {adding && (
            <AddSpellsModal
                character={character}
                onClose={() => setAdding(false)}
                onAdd={(spellId, level) => mutate(() => addKnownSpell(character.id, spellId, level))}
            />
        )}
    </Stack>;
};

interface GrantedResult {
    key: string;
    spells: GrantedSpell[] | null;
    error: string | null;
}

// Spells from the character's domains, bloodlines…, recomputed by the server
// whenever sources, class level or spell slots change
const Granted: FC<TabProps> = ({character, mutate}) => {
    const [result, setResult] = useState<GrantedResult | null>(null);
    const sourcesKey = character.sources.map((s) => s.id).join(",");
    const slotsKey = character.slots.join(",");
    const key = `${character.id}|${sourcesKey}|${character.level}|${slotsKey}`;

    useEffect(() => {
        fetchGranted(character.id)
            .then((spells) => setResult({key, spells, error: null}))
            .catch((e: unknown) => setResult({key, spells: null, error: e instanceof Error ? e.message : "Failed to load"}));
    }, [key, character.id]);

    const current = result?.key === key ? result : null;
    if (!current) {
        return <Center py="lg"><Loader size="sm"/></Center>;
    }
    const {spells: granted, error} = current;
    if (error || !granted) {
        return <Alert color="red" variant="light">{error}</Alert>;
    }
    if (granted.length === 0) {
        return <Text c="dimmed" size="sm">No spells granted at this level yet.</Text>;
    }

    const known = new Set(character.spells.map((s) => s.id));
    const levels = [...new Set(granted.map((s) => s.level))];

    return <GrantedGrid>
        {levels.map((level) => (
            <LevelCard key={level} level={level}>
                {granted.filter((s) => s.level === level).map((s) => (
                    <Group key={s.spellId} gap="xs" wrap="nowrap">
                        <Stack gap={0} style={{flex: 1, minWidth: 0}}>
                            <SpellLink id={s.spellId} name={s.notes.length ? `${s.name} (${s.notes.join("; ")})` : s.name}/>
                            <Text size="xs" c="dimmed">{s.sources.join(", ")}</Text>
                        </Stack>
                        {character.prepared && (
                            <Button
                                size="compact-xs"
                                variant="light"
                                onClick={() => mutate(() => prepareSpell(character.id, s.spellId, level))}
                            >
                                Prepare
                            </Button>
                        )}
                        {known.has(s.spellId) ? (
                            <Badge variant="outline" color="gray" size="sm">Known</Badge>
                        ) : (
                            <Button
                                size="compact-xs"
                                variant="subtle"
                                onClick={() => mutate(() => addKnownSpell(character.id, s.spellId, level))}
                            >
                                Add
                            </Button>
                        )}
                    </Group>
                ))}
            </LevelCard>
        ))}
    </GrantedGrid>;
};

interface SpellbookViewProps {
    id: string;
}

const SpellbookView: FC<SpellbookViewProps> = ({id}) => {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const {data: loaded, error: loadError} = useDetail(id, fetchCharacter);
    // Latest state from a mutation; supersedes the initial load
    const [updated, setUpdated] = useState<CharacterDetail | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [editing, setEditing] = useState(false);
    // Only the newest mutation's response is applied, so quick taps can't regress
    const seq = useRef(0);

    const character = updated?.id === id ? updated : loaded;

    const mutate: Mutate = (action, optimistic) => {
        const before = character;
        const mine = ++seq.current;
        if (optimistic && before) {
            setUpdated(optimistic(before));
        }
        setError(null);
        action()
            .then((next) => {
                if (mine === seq.current) {
                    setUpdated(next);
                }
            })
            .catch((e: unknown) => {
                setError(e instanceof Error ? e.message : "Something went wrong");
                if (mine === seq.current && before) {
                    setUpdated(before);
                }
            });
    };

    if (!character) {
        return loadError
            ? <Alert color="red" variant="light">{loadError}</Alert>
            : <Center py="xl"><Loader/></Center>;
    }

    const hasSources = character.sources.length > 0;
    const requested = searchParams.get("tab");
    const tab = requested === "book" || (requested === "granted" && hasSources) ? requested : "today";

    return <Stack gap="md">
        <title>{`${character.name} — Pathfinder 1E`}</title>
        <Group justify="space-between" align="flex-start">
            <div>
                <Title order={2}>{character.name}</Title>
                <Group gap="xs" mt={4}>
                    <Badge variant="light" color="teal">{character.className} {character.level}</Badge>
                    <Badge variant="outline" color="gray">{character.prepared ? "Prepared" : "Spontaneous"}</Badge>
                    {character.sources.map((s) => (
                        <Badge key={s.id} variant="light" color="grape">
                            {sourceLabel(s.name, s.type, s.domainName)}
                        </Badge>
                    ))}
                </Group>
            </div>
            <Group gap="xs">
                <Menu position="bottom-end" withArrow>
                    <Menu.Target>
                        <Button variant="light" leftSection={<GiNightSleep size={16}/>}>Rest</Button>
                    </Menu.Target>
                    <Menu.Dropdown>
                        <Menu.Label>Start a new day?</Menu.Label>
                        <Menu.Item onClick={() => mutate(() => restCharacter(character.id))}>
                            Restore all spell slots
                        </Menu.Item>
                    </Menu.Dropdown>
                </Menu>
                <ActionIcon variant="light" size="lg" aria-label="Edit character" onClick={() => setEditing(true)}>
                    <MdEdit/>
                </ActionIcon>
            </Group>
        </Group>

        {error && <Alert color="red" variant="light" withCloseButton onClose={() => setError(null)}>{error}</Alert>}

        <Tabs
            value={tab}
            onChange={(v) => setSearchParams(v && v !== "today" ? {tab: v} : {}, {replace: true})}
        >
            <Tabs.List mb="md">
                <Tabs.Tab value="today">Today</Tabs.Tab>
                <Tabs.Tab value="book">{character.prepared ? "Spellbook" : "Spells known"}</Tabs.Tab>
                {hasSources && <Tabs.Tab value="granted">Granted</Tabs.Tab>}
            </Tabs.List>
            <Tabs.Panel value="today">
                {character.prepared
                    ? <PreparedToday character={character} mutate={mutate}/>
                    : <SpontaneousToday character={character} mutate={mutate}/>}
            </Tabs.Panel>
            <Tabs.Panel value="book">
                <KnownSpells character={character} mutate={mutate}/>
            </Tabs.Panel>
            {hasSources && (
                <Tabs.Panel value="granted">
                    <Granted character={character} mutate={mutate}/>
                </Tabs.Panel>
            )}
        </Tabs>

        {editing && (
            <CharacterForm
                opened
                character={character}
                onClose={() => setEditing(false)}
                onSubmit={async (input) => {
                    setUpdated(await updateCharacter(character.id, input));
                    setEditing(false);
                }}
                onDelete={async () => {
                    await deleteCharacter(character.id);
                    navigate("/characters", {replace: true});
                }}
            />
        )}
    </Stack>;
};

export const Spellbook: FC = () => {
    const {id} = useParams<{ id: string }>();
    const {data: session, isPending} = authClient.useSession();

    if (isPending) {
        return <Center py="xl"><Loader/></Center>;
    }
    if (!session) {
        return <SignInPrompt/>;
    }
    return <Stack>
        <Anchor component={Link} to="/characters" size="sm" c="dimmed">← Spellbooks</Anchor>
        {id && <SpellbookView key={id} id={id}/>}
    </Stack>;
};
