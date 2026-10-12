import {
    ActionIcon, Alert, Button, Group, Modal, NumberInput, SegmentedControl, Select, SimpleGrid, Stack, Text, TextInput,
} from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import { type FC, useEffect, useState } from "react";
import { MdAdd, MdRemove } from "react-icons/md";
import { type CharacterDetail, type CharacterInput, fetchClasses, type LookupItem } from "../api";
import { isSpontaneousClass, levelLabel, type SourceEntry, SPELL_LEVELS, toSourceEntry } from "./characterState";
import { SectionLabel } from "./SectionLabel";
import { SourcePicker } from "./SourcePicker";

interface CharacterFormProps {
    opened: boolean;
    onClose: () => void;
    // Editing this character; creating a new one when absent
    character?: CharacterDetail;
    onSubmit: (input: CharacterInput) => Promise<void>;
    onDelete?: () => Promise<void>;
}

const blankInput = (): CharacterInput => ({
    name: "",
    classId: "",
    level: 1,
    prepared: true,
    slots: SPELL_LEVELS.map(() => 0),
});

const toInput = (c: CharacterDetail): CharacterInput => ({
    name: c.name,
    classId: c.classId,
    level: c.level,
    prepared: c.prepared,
    slots: [...c.slots],
});

const MAX_SLOTS = 20;

interface SlotStepperProps {
    level: number;
    value: number;
    onChange: (value: number) => void;
}

// Big −/+ buttons around the count: easy to hit on a phone
const SlotStepper: FC<SlotStepperProps> = ({level, value, onChange}) =>
    <Stack gap={4}>
        <Text size="sm" fw={500}>{levelLabel(level)}</Text>
        <Group gap={6} wrap="nowrap">
            <ActionIcon
                size={42}
                variant="light"
                aria-label={`Fewer ${levelLabel(level).toLowerCase()} slots`}
                disabled={value <= 0}
                onClick={() => onChange(value - 1)}
            >
                <MdRemove size={22}/>
            </ActionIcon>
            <NumberInput
                aria-label={`${levelLabel(level)} slots`}
                size="md"
                min={0}
                max={MAX_SLOTS}
                clampBehavior="strict"
                allowDecimal={false}
                hideControls
                value={value}
                onChange={(v) => onChange(typeof v === "number" ? v : 0)}
                styles={{input: {textAlign: "center", paddingInline: 4}}}
                style={{flex: 1, minWidth: 0}}
            />
            <ActionIcon
                size={42}
                variant="light"
                aria-label={`More ${levelLabel(level).toLowerCase()} slots`}
                disabled={value >= MAX_SLOTS}
                onClick={() => onChange(value + 1)}
            >
                <MdAdd size={22}/>
            </ActionIcon>
        </Group>
    </Stack>;

export const CharacterForm: FC<CharacterFormProps> = ({opened, onClose, character, onSubmit, onDelete}) => {
    // Mounted fresh each time it opens (see callers), so initial state is enough
    const [input, setInput] = useState<CharacterInput>(() => character ? toInput(character) : blankInput());
    const [sources, setSources] = useState<SourceEntry[]>(() => character?.sources.map(toSourceEntry) ?? []);
    const [classes, setClasses] = useState<LookupItem[]>([]);
    const [busy, setBusy] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchClasses().then(setClasses).catch(() => setError("Failed to load classes"));
    }, []);

    const slots = input.slots ?? SPELL_LEVELS.map(() => 0);
    const setSlot = (level: number, value: number) =>
        setInput({...input, slots: slots.map((n, i) => i === level ? value : n)});

    const run = async (action: () => Promise<void>) => {
        setBusy(true);
        setError(null);
        try {
            await action();
        } catch (e) {
            setError(e instanceof Error ? e.message : "Something went wrong");
            setBusy(false);
        }
    };

    const valid = input.name.trim() !== "" && input.classId !== "";
    const isMobile = useMediaQuery("(max-width: 48em)") ?? false;

    return <Modal
        opened={opened}
        onClose={onClose}
        title={character ? "Edit character" : "New character"}
        size="lg"
        fullScreen={isMobile}
        transitionProps={isMobile ? {transition: "fade"} : undefined}
    >
        <form onSubmit={(e) => {
            e.preventDefault();
            if (valid) {
                void run(() => onSubmit({
                    ...input,
                    name: input.name.trim(),
                    sources: sources.map(({type, sourceId, domainId}) => ({type, sourceId, domainId})),
                }));
            }
        }}>
            <Stack gap="md">
                <TextInput
                    label="Name"
                    required
                    data-autofocus
                    value={input.name}
                    onChange={(e) => setInput({...input, name: e.currentTarget.value})}
                />
                <Group grow align="flex-start">
                    <Select
                        label="Class"
                        required
                        searchable
                        data={classes.map((c) => ({value: c.id, label: c.name}))}
                        value={input.classId || null}
                        onChange={(classId) => {
                            const name = classes.find((c) => c.id === classId)?.name ?? "";
                            setInput({...input, classId: classId ?? "", prepared: !isSpontaneousClass(name)});
                        }}
                    />
                    <NumberInput
                        label="Class level"
                        min={1}
                        max={20}
                        clampBehavior="strict"
                        allowDecimal={false}
                        value={input.level}
                        onChange={(v) => setInput({...input, level: typeof v === "number" ? v : 1})}
                    />
                </Group>
                <SegmentedControl
                    data={[
                        {value: "prepared", label: "Prepares spells"},
                        {value: "spontaneous", label: "Casts spontaneously"},
                    ]}
                    value={input.prepared ? "prepared" : "spontaneous"}
                    onChange={(v) => setInput({...input, prepared: v === "prepared"})}
                />
                <SourcePicker value={sources} onChange={setSources}/>
                <Stack gap={6}>
                    <SectionLabel>Spells per day</SectionLabel>
                    <Text size="xs" c="dimmed">
                        Including bonus spells from your ability score. Cantrips are cast at will.
                    </Text>
                    <SimpleGrid cols={2} spacing="md" verticalSpacing="sm">
                        {/* Cantrips are at will: nothing to count */}
                        {SPELL_LEVELS.filter((level) => level > 0).map((level) => (
                            <SlotStepper
                                key={level}
                                level={level}
                                value={slots[level]}
                                onChange={(v) => setSlot(level, v)}
                            />
                        ))}
                    </SimpleGrid>
                </Stack>

                {error && <Alert color="red" variant="light">{error}</Alert>}

                <Group justify="space-between">
                    {onDelete ? (
                        <Button
                            variant={confirmDelete ? "filled" : "subtle"}
                            color="red"
                            disabled={busy}
                            onClick={() => confirmDelete ? void run(onDelete) : setConfirmDelete(true)}
                        >
                            {confirmDelete ? "Really delete?" : "Delete"}
                        </Button>
                    ) : <span/>}
                    <Button type="submit" loading={busy} disabled={!valid}>
                        {character ? "Save" : "Create"}
                    </Button>
                </Group>
            </Stack>
        </form>
    </Modal>;
};
