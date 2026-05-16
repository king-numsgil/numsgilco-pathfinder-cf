import { Badge, Chip, Group, Stack, Table, Text, TextInput, Title } from "@mantine/core";
import { useState } from "react";
import { FiSearch } from "react-icons/fi";
import { FEAT_TYPES, featTypeColors, feats } from "../data/feats";

export function Feats() {
    const [search, setSearch] = useState("");
    const [types, setTypes] = useState<string[]>([]);

    const filtered = feats.filter((feat) => {
        const matchesSearch =
            search === "" ||
            feat.name.toLowerCase().includes(search.toLowerCase()) ||
            feat.prerequisites.toLowerCase().includes(search.toLowerCase());
        const matchesType = types.length === 0 || types.includes(feat.type);
        return matchesSearch && matchesType;
    });

    return (
        <Stack gap="lg">
            <div>
                <Title order={2}>Feats</Title>
                <Text size="sm" c="dimmed" mt={4}>
                    Showing {filtered.length} of {feats.length} feats
                </Text>
            </div>

            <TextInput
                placeholder="Search by name or prerequisites…"
                leftSection={<FiSearch size={16} />}
                value={search}
                onChange={(e) => setSearch(e.currentTarget.value)}
                maw={400}
            />

            <Chip.Group multiple value={types} onChange={setTypes}>
                <Group gap="xs">
                    {FEAT_TYPES.map((type) => (
                        <Chip key={type} value={type} size="sm" variant="outline" color="teal">
                            {type}
                        </Chip>
                    ))}
                </Group>
            </Chip.Group>

            <Table.ScrollContainer minWidth={640}>
                <Table striped highlightOnHover withTableBorder withColumnBorders={false}>
                    <Table.Thead>
                        <Table.Tr>
                            <Table.Th>Name</Table.Th>
                            <Table.Th>Type</Table.Th>
                            <Table.Th>Prerequisites</Table.Th>
                            <Table.Th>Benefit</Table.Th>
                        </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                        {filtered.length === 0 ? (
                            <Table.Tr>
                                <Table.Td colSpan={4}>
                                    <Text c="dimmed" ta="center" py="xl">No feats match your filters.</Text>
                                </Table.Td>
                            </Table.Tr>
                        ) : (
                            filtered.map((feat) => (
                                <Table.Tr key={feat.id} style={{ cursor: "pointer" }}>
                                    <Table.Td>
                                        <Text fw={600} size="sm" c="teal.4">{feat.name}</Text>
                                    </Table.Td>
                                    <Table.Td>
                                        <Badge
                                            color={featTypeColors[feat.type] ?? "gray"}
                                            variant="light"
                                            size="sm"
                                        >
                                            {feat.type}
                                        </Badge>
                                    </Table.Td>
                                    <Table.Td>
                                        <Text size="sm" c="dimmed">{feat.prerequisites}</Text>
                                    </Table.Td>
                                    <Table.Td maw={320}>
                                        <Text size="sm" lineClamp={2}>{feat.benefit}</Text>
                                    </Table.Td>
                                </Table.Tr>
                            ))
                        )}
                    </Table.Tbody>
                </Table>
            </Table.ScrollContainer>
        </Stack>
    );
}
