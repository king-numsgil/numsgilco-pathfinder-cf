import { Alert, Badge, Button, Card, Center, Group, Loader, SimpleGrid, Stack, Text, Title } from "@mantine/core";
import { type FC, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { type CharacterSummary, createCharacter, fetchCharacters } from "../api";
import { authClient } from "../api/auth";
import { CharacterForm } from "./CharacterForm";
import { SignInPrompt } from "./SignInPrompt";

interface CharacterListProps {
    userId: string;
}

const CharacterList: FC<CharacterListProps> = ({userId}) => {
    const navigate = useNavigate();
    const [characters, setCharacters] = useState<CharacterSummary[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [creating, setCreating] = useState(false);

    useEffect(() => {
        fetchCharacters()
            .then(setCharacters)
            .catch((e: unknown) => setError(e instanceof Error ? e.message : "Failed to load"));
    }, [userId]);

    if (error) {
        return <Alert color="red" variant="light">{error}</Alert>;
    }
    if (!characters) {
        return <Center py="xl"><Loader/></Center>;
    }

    return <Stack gap="md">
        <Group justify="space-between">
            <Text c="dimmed" size="sm">
                {characters.length === 0 ? "No characters yet." : `${characters.length} character${characters.length === 1 ? "" : "s"}`}
            </Text>
            <Button onClick={() => setCreating(true)}>New character</Button>
        </Group>

        <SimpleGrid cols={{base: 1, sm: 2, lg: 3}} spacing="md">
            {characters.map((c) => (
                <Card key={c.id} component={Link} to={`/characters/${c.id}`} withBorder padding="lg">
                    <Text fw={700} size="lg">{c.name}</Text>
                    <Group gap="xs" mt={6}>
                        <Badge variant="light" color="teal">{c.className} {c.level}</Badge>
                        <Badge variant="outline" color="gray">{c.prepared ? "Prepared" : "Spontaneous"}</Badge>
                    </Group>
                </Card>
            ))}
        </SimpleGrid>

        {creating && (
            <CharacterForm
                opened
                onClose={() => setCreating(false)}
                onSubmit={async (input) => {
                    const id = await createCharacter(input);
                    navigate(`/characters/${id}`);
                }}
            />
        )}
    </Stack>;
};

export const Characters: FC = () => {
    const {data: session, isPending} = authClient.useSession();

    return <Stack gap="lg">
        <title>Spellbooks — Pathfinder 1E</title>
        <Title order={2}>Spellbooks</Title>
        {isPending ? (
            <Center py="xl"><Loader/></Center>
        ) : session ? (
            <CharacterList userId={session.user.id}/>
        ) : (
            <SignInPrompt/>
        )}
    </Stack>;
};
