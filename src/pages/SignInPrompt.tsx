import { Button, Card, Stack, Text, Title } from "@mantine/core";
import type { FC } from "react";
import { FaDiscord } from "react-icons/fa";
import { signInWithDiscord } from "../api/auth";

export const SignInPrompt: FC = () =>
    <Card withBorder padding="xl" maw={480}>
        <Stack gap="sm" align="flex-start">
            <Title order={3}>Sign in to keep spellbooks</Title>
            <Text size="sm" c="dimmed">
                Track your characters' spells known and today's prepared spells, on any device.
            </Text>
            <Button leftSection={<FaDiscord size={18}/>} color="indigo" onClick={() => void signInWithDiscord()}>
                Sign in with Discord
            </Button>
        </Stack>
    </Card>;
