import { Badge, Chip, Group, Stack, Table, Text, TextInput, Title } from "@mantine/core";
import { useState } from "react";
import { FiSearch } from "react-icons/fi";
import { Outlet, useNavigate } from "react-router-dom";
import { SPELL_SCHOOLS, schoolColors, spells } from "../data/spells";

export function Spells() {
    const [search, setSearch] = useState("");
    const [schools, setSchools] = useState<string[]>([]);
    const navigate = useNavigate();

    const filtered = spells.filter((spell) => {
        const matchesSearch =
            search === "" ||
            spell.name.toLowerCase().includes(search.toLowerCase()) ||
            spell.school.toLowerCase().includes(search.toLowerCase());
        const matchesSchool = schools.length === 0 || schools.includes(spell.school);
        return matchesSearch && matchesSchool;
    });

    return (
        <Stack gap="lg">
            <div>
                <Title order={2}>Spells</Title>
                <Text size="sm" c="dimmed" mt={4}>
                    Showing {filtered.length} of {spells.length} spells
                </Text>
            </div>

            <TextInput
                placeholder="Search by name or school…"
                leftSection={<FiSearch size={16} />}
                value={search}
                onChange={(e) => setSearch(e.currentTarget.value)}
                maw={400}
            />

            <Chip.Group multiple value={schools} onChange={setSchools}>
                <Group gap="xs">
                    {SPELL_SCHOOLS.map((school) => (
                        <Chip key={school} value={school} size="sm" variant="outline" color="teal">
                            {school}
                        </Chip>
                    ))}
                </Group>
            </Chip.Group>

            <Table.ScrollContainer minWidth={720}>
                <Table striped highlightOnHover withTableBorder withColumnBorders={false}>
                    <Table.Thead>
                        <Table.Tr>
                            <Table.Th style={{ minWidth: 160 }}>Name</Table.Th>
                            <Table.Th style={{ minWidth: 148 }}>School</Table.Th>
                            <Table.Th style={{ minWidth: 200 }}>Level</Table.Th>
                            <Table.Th style={{ minWidth: 130 }}>Casting Time</Table.Th>
                            <Table.Th style={{ minWidth: 140 }}>Save</Table.Th>
                        </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                        {filtered.length === 0 ? (
                            <Table.Tr>
                                <Table.Td colSpan={5}>
                                    <Text c="dimmed" ta="center" py="xl">No spells match your filters.</Text>
                                </Table.Td>
                            </Table.Tr>
                        ) : (
                            filtered.map((spell) => (
                                <Table.Tr
                                    key={spell.id}
                                    style={{ cursor: "pointer" }}
                                    onClick={() => navigate(`/spells/${spell.id}`)}
                                >
                                    <Table.Td>
                                        <Text fw={600} size="sm" c="teal.4">{spell.name}</Text>
                                        {spell.descriptor && (
                                            <Text size="xs" c="dimmed">[{spell.descriptor}]</Text>
                                        )}
                                    </Table.Td>
                                    <Table.Td>
                                        <Badge
                                            color={schoolColors[spell.school] ?? "gray"}
                                            variant="light"
                                            size="sm"
                                        >
                                            {spell.school}
                                        </Badge>
                                        {spell.subschool && (
                                            <Text size="xs" c="dimmed">{spell.subschool}</Text>
                                        )}
                                    </Table.Td>
                                    <Table.Td>
                                        <Text size="sm">{spell.levels}</Text>
                                    </Table.Td>
                                    <Table.Td>
                                        <Text size="sm">{spell.castingTime}</Text>
                                    </Table.Td>
                                    <Table.Td>
                                        <Text size="sm" c="dimmed">{spell.savingThrow}</Text>
                                    </Table.Td>
                                </Table.Tr>
                            ))
                        )}
                    </Table.Tbody>
                </Table>
            </Table.ScrollContainer>

            {/* Child route renders the detail modal here (portaled to body) */}
            <Outlet />
        </Stack>
    );
}
