import {
    Badge,
    Button,
    Center,
    Chip,
    Group,
    Loader,
    Stack,
    Table,
    Text,
    TextInput,
    Title,
} from "@mantine/core";
import { useEffect, useRef, useState } from "react";
import { FiSearch } from "react-icons/fi";
import { Outlet, useNavigate } from "react-router-dom";
import { type LookupItem, type SpellListItem, fetchSchools, fetchSpells } from "../api";

const PAGE_SIZE = 50;

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

function useDebounce<T>(value: T, delay: number): T {
    const [debounced, setDebounced] = useState(value);
    useEffect(() => {
        const t = setTimeout(() => setDebounced(value), delay);
        return () => clearTimeout(t);
    }, [value, delay]);
    return debounced;
}

export function Spells() {
    const navigate = useNavigate();

    // Filter state
    const [search, setSearch] = useState("");
    const [selectedSchoolIds, setSelectedSchoolIds] = useState<string[]>([]);
    const debouncedSearch = useDebounce(search, 300);
    const schoolsParam = selectedSchoolIds.join(",");

    // Lookup data
    const [schools, setSchools] = useState<LookupItem[]>([]);

    // Results
    const [results, setResults] = useState<SpellListItem[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Prevent stale responses from a previous fetch overwriting a later one
    const fetchSeq = useRef(0);

    useEffect(() => {
        fetchSchools().then(setSchools).catch(() => {/* non-fatal */});
    }, []);

    // Refetch from scratch whenever filters change
    useEffect(() => {
        const seq = ++fetchSeq.current;
        setLoading(true);
        setError(null);
        fetchSpells({
            q: debouncedSearch || undefined,
            school: schoolsParam || undefined,
            limit: PAGE_SIZE,
            offset: 0,
        })
            .then((data) => {
                if (seq !== fetchSeq.current) return;
                setResults(data.data);
                setTotal(data.total);
            })
            .catch(() => {
                if (seq !== fetchSeq.current) return;
                setError("Failed to load spells.");
            })
            .finally(() => {
                if (seq === fetchSeq.current) setLoading(false);
            });
    }, [debouncedSearch, schoolsParam]);

    function loadMore() {
        setLoadingMore(true);
        fetchSpells({
            q: debouncedSearch || undefined,
            school: schoolsParam || undefined,
            limit: PAGE_SIZE,
            offset: results.length,
        })
            .then((data) => {
                setResults((prev) => [...prev, ...data.data]);
                setTotal(data.total);
            })
            .catch(() => setError("Failed to load more spells."))
            .finally(() => setLoadingMore(false));
    }

    const hasMore = results.length < total;

    return (
        <Stack gap="lg">
            <div>
                <Title order={2}>Spells</Title>
                <Text size="sm" c="dimmed" mt={4}>
                    {loading ? "Loading…" : `Showing ${results.length} of ${total} spells`}
                </Text>
            </div>

            <TextInput
                placeholder="Search by name…"
                leftSection={<FiSearch size={16} />}
                value={search}
                onChange={(e) => setSearch(e.currentTarget.value)}
                maw={400}
            />

            {schools.length > 0 && (
                <Chip.Group multiple value={selectedSchoolIds} onChange={setSelectedSchoolIds}>
                    <Group gap="xs">
                        {schools.map((school) => (
                            <Chip key={school.id} value={school.id} size="sm" variant="outline" color="teal">
                                {school.name}
                            </Chip>
                        ))}
                    </Group>
                </Chip.Group>
            )}

            {error && <Text c="red" size="sm">{error}</Text>}

            <Table.ScrollContainer minWidth={680}>
                <Table striped highlightOnHover withTableBorder withColumnBorders={false}>
                    <Table.Thead>
                        <Table.Tr>
                            <Table.Th style={{ minWidth: 180 }}>Name</Table.Th>
                            <Table.Th style={{ minWidth: 160 }}>School</Table.Th>
                            <Table.Th style={{ minWidth: 220 }}>Descriptors</Table.Th>
                            <Table.Th style={{ minWidth: 160 }}>Sourcebook</Table.Th>
                        </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                        {loading ? (
                            <Table.Tr>
                                <Table.Td colSpan={4}>
                                    <Center py="xl"><Loader size="sm" /></Center>
                                </Table.Td>
                            </Table.Tr>
                        ) : results.length === 0 ? (
                            <Table.Tr>
                                <Table.Td colSpan={4}>
                                    <Text c="dimmed" ta="center" py="xl">No spells match your filters.</Text>
                                </Table.Td>
                            </Table.Tr>
                        ) : (
                            results.map((spell) => (
                                <Table.Tr
                                    key={spell.id}
                                    style={{ cursor: "pointer" }}
                                    onClick={() => navigate(`/spells/${spell.id}`)}
                                >
                                    <Table.Td>
                                        <Text fw={600} size="sm" c="teal.4">{spell.name}</Text>
                                    </Table.Td>
                                    <Table.Td>
                                        {spell.school ? (
                                            <>
                                                <Badge
                                                    color={schoolColors[spell.school] ?? "gray"}
                                                    variant="light"
                                                    size="sm"
                                                >
                                                    {spell.school}
                                                </Badge>
                                                {spell.subschool && (
                                                    <Text size="xs" c="dimmed" mt={2}>{spell.subschool}</Text>
                                                )}
                                            </>
                                        ) : (
                                            <Text size="xs" c="dimmed">see text</Text>
                                        )}
                                    </Table.Td>
                                    <Table.Td>
                                        <Group gap={4} wrap="wrap">
                                            {spell.descriptors.map((d) => (
                                                <Badge key={d} variant="dot" color="gray" size="xs">{d}</Badge>
                                            ))}
                                        </Group>
                                    </Table.Td>
                                    <Table.Td>
                                        <Text size="sm" c="dimmed">{spell.sourcebook}</Text>
                                    </Table.Td>
                                </Table.Tr>
                            ))
                        )}
                    </Table.Tbody>
                </Table>
            </Table.ScrollContainer>

            {hasMore && !loading && (
                <Center>
                    <Button
                        variant="subtle"
                        color="teal"
                        onClick={loadMore}
                        loading={loadingMore}
                    >
                        Load more ({total - results.length} remaining)
                    </Button>
                </Center>
            )}

            <Outlet />
        </Stack>
    );
}
