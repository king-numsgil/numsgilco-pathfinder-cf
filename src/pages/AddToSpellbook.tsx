import { Button, Loader, Menu, Text } from "@mantine/core";
import { type FC, useState } from "react";
import { MdBookmarkAdd } from "react-icons/md";
import { addKnownSpell, type CharacterSummary, fetchCharacters, type SpellDetail } from "../api";
import { authClient } from "../api/auth";
import { levelLabel, spellLevelFor } from "./characterState";

interface AddToSpellbookProps {
    spell: SpellDetail;
}

/** Adds the spell to one of the signed-in user's characters. */
export const AddToSpellbook: FC<AddToSpellbookProps> = ({spell}) => {
    const {data: session} = authClient.useSession();
    const [characters, setCharacters] = useState<CharacterSummary[] | null>(null);
    const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);

    if (!session) {
        return null;
    }

    const add = (c: CharacterSummary) => {
        const level = spellLevelFor(spell, c.classId);
        addKnownSpell(c.id, spell.id, level)
            .then(() => setStatus({ok: true, text: `Added to ${c.name} (${levelLabel(level).toLowerCase()})`}))
            .catch((e: unknown) => setStatus({ok: false, text: e instanceof Error ? e.message : "Failed to add"}));
    };

    return <>
        <Menu
            position="bottom-end"
            withArrow
            onOpen={() => {
                setStatus(null);
                fetchCharacters().then(setCharacters).catch(() => setCharacters([]));
            }}
        >
            <Menu.Target>
                <Button size="compact-sm" variant="light" leftSection={<MdBookmarkAdd size={16}/>}>
                    Add to spellbook
                </Button>
            </Menu.Target>
            <Menu.Dropdown>
                {characters === null ? (
                    <Menu.Item disabled><Loader size="xs"/></Menu.Item>
                ) : characters.length === 0 ? (
                    <Menu.Item disabled>No characters yet</Menu.Item>
                ) : characters.map((c) => (
                    <Menu.Item key={c.id} onClick={() => add(c)}>
                        {c.name} <Text span size="xs" c="dimmed">· {c.className} {c.level}</Text>
                    </Menu.Item>
                ))}
            </Menu.Dropdown>
        </Menu>
        {status && <Text size="xs" c={status.ok ? "teal" : "red"}>{status.text}</Text>}
    </>;
};
