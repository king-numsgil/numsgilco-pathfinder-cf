import { Badge, Divider, Group, Modal, SimpleGrid, Stack, Text } from "@mantine/core";
import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { schoolColors, spells } from "../data/spells";

function StatBlock({ label, value }: { label: string; value: string }) {
    return (
        <Stack gap={2}>
            <Text size="xs" tt="uppercase" fw={700} c="dimmed" style={{ letterSpacing: "0.06em" }}>
                {label}
            </Text>
            <Text size="sm">{value}</Text>
        </Stack>
    );
}

export function SpellModal() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [opened, setOpened] = useState(true);

    const spell = spells.find((s) => s.id === Number(id));

    if (!spell) return null;

    return (
        <Modal
            opened={opened}
            onClose={() => setOpened(false)}
            transitionProps={{ onExited: () => navigate("/spells") }}
            title={
                <Text fw={700} size="lg">{spell.name}</Text>
            }
            size="lg"
        >
            <Stack gap="md">
                <Group gap="xs" wrap="wrap">
                    <Badge
                        color={schoolColors[spell.school] ?? "gray"}
                        variant="filled"
                        size="md"
                    >
                        {spell.school}
                    </Badge>
                    {spell.subschool && (
                        <Text size="sm" c="dimmed">({spell.subschool})</Text>
                    )}
                    {spell.descriptor && (
                        <Badge variant="outline" color="gray" size="md">
                            {spell.descriptor}
                        </Badge>
                    )}
                </Group>

                <SimpleGrid cols={{ base: 2, xs: 3 }} spacing="md">
                    <StatBlock label="Casting Time" value={spell.castingTime} />
                    <StatBlock label="Components"   value={spell.components} />
                    <StatBlock label="Range"        value={spell.range} />
                    <StatBlock label="Duration"     value={spell.duration} />
                    <StatBlock label="Saving Throw" value={spell.savingThrow} />
                    <StatBlock label="Spell Resist" value={spell.sr} />
                </SimpleGrid>

                <Divider />

                <Stack gap={6}>
                    <Text size="xs" tt="uppercase" fw={700} c="dimmed" style={{ letterSpacing: "0.06em" }}>
                        Level
                    </Text>
                    <Text size="sm">{spell.levels}</Text>
                </Stack>

                <Divider />

                <Text size="sm" style={{ lineHeight: 1.7 }}>
                    {spell.description}
                </Text>
            </Stack>
        </Modal>
    );
}
