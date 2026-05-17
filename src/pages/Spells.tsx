import { Badge, Button, Center, Group, Indicator, Loader, Stack, Table, Text, TextInput, Title } from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import { type FC, useEffect, useRef, useState, useTransition } from "react";
import { FiFilter, FiSearch } from "react-icons/fi";
import { Outlet, useNavigate } from "react-router-dom";
import {
    type DomainWithSubdomains,
    fetchBloodlines,
    fetchClasses,
    fetchDomains,
    fetchMysteries,
    fetchPatrons,
    fetchSchools,
    fetchSpells,
    type LookupItem,
    type SpellListItem,
} from "../api";
import { SpellFilters } from "./SpellFilters";
import { activeFilterCount, EMPTY_FILTERS, type FilterState } from "./spellFilterState";

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

export const Spells: FC = () => {
    const navigate = useNavigate();

    const [search, setSearch] = useState("");
    const [debouncedSearch] = useDebouncedValue(search, 300);

    const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);
    const [drawerOpen, setDrawerOpen] = useState(false);

    // Lookup data
    const [schools, setSchools] = useState<LookupItem[]>([]);
    const [classes, setClasses] = useState<LookupItem[]>([]);
    const [domains, setDomains] = useState<DomainWithSubdomains[]>([]);
    const [bloodlines, setBloodlines] = useState<LookupItem[]>([]);
    const [patrons, setPatrons] = useState<LookupItem[]>([]);
    const [mysteries, setMysteries] = useState<LookupItem[]>([]);

    // Results
    const [results, setResults] = useState<SpellListItem[]>([]);
    const [total, setTotal] = useState(0);
    const [error, setError] = useState<string | null>(null);
    const [hasLoaded, setHasLoaded] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);

    const [isPending, startTransition] = useTransition();

    const fetchSeq = useRef(0);
    const loadMoreSeq = useRef(0);
    const sentinelRef = useRef<HTMLDivElement>(null);
    const isLoadingMoreRef = useRef(false);

    // Load all lookup data in parallel on mount
    useEffect(() => {
        Promise.all([
            fetchSchools(),
            fetchClasses(),
            fetchDomains(),
            fetchBloodlines(),
            fetchPatrons(),
            fetchMysteries(),
        ]).then(([s, c, d, b, p, m]) => {
            setSchools(s);
            setClasses(c);
            setDomains(d);
            setBloodlines(b);
            setPatrons(p);
            setMysteries(m);
        }).catch(() => {/* non-fatal */
        });
    }, []);

    // Stable string keys for array filters (used as effect deps)
    const levelKey = filters.levels.join(",");
    const schoolKey = filters.schoolIds.join(",");
    const classKey = filters.classIds.join(",");
    const domainKey = filters.domainIds.join(",");
    const subdomainKey = filters.subdomainIds.join(",");
    const bloodlineKey = filters.bloodlineIds.join(",");
    const patronKey = filters.patronIds.join(",");
    const mysteryKey = filters.mysteryIds.join(",");

    // Re-fetch first page whenever any filter changes
    useEffect(() => {
        const seq = ++fetchSeq.current;
        ++loadMoreSeq.current;        // invalidate any in-flight loadMore
        isLoadingMoreRef.current = false;

        startTransition(async () => {
            try {
                const data = await fetchSpells({
                    q: debouncedSearch || undefined,
                    level: levelKey || undefined,
                    school: schoolKey || undefined,
                    class: classKey || undefined,
                    domain: domainKey || undefined,
                    subdomain: subdomainKey || undefined,
                    bloodline: bloodlineKey || undefined,
                    patron: patronKey || undefined,
                    mystery: mysteryKey || undefined,
                    limit: PAGE_SIZE,
                    offset: 0,
                });
                if (seq !== fetchSeq.current) {
                    return;
                }
                setResults(data.data);
                setTotal(data.total);
                setError(null);
            } catch {
                if (seq !== fetchSeq.current) {
                    return;
                }
                setError("Failed to load spells.");
            } finally {
                if (seq === fetchSeq.current) {
                    setHasLoaded(true);
                }
            }
        });
    }, [debouncedSearch, levelKey, schoolKey, classKey, domainKey, subdomainKey, bloodlineKey, patronKey, mysteryKey]);

    // Infinite scroll — no dep array so the closure always sees current values.
    // Early-return keeps setup cost near zero when there's nothing to load.
    useEffect(() => {
        const sentinel = sentinelRef.current;
        if (!sentinel || !hasLoaded || isPending || results.length >= total) {
            return;
        }

        const myLmSeq = loadMoreSeq.current;

        const observer = new IntersectionObserver(
            (entries) => {
                if (!entries[0].isIntersecting) {
                    return;
                }
                if (isLoadingMoreRef.current) {
                    return;
                }
                if (loadMoreSeq.current !== myLmSeq) {
                    return;
                }

                isLoadingMoreRef.current = true;
                setLoadingMore(true);
                fetchSpells({
                    q: debouncedSearch || undefined,
                    level: levelKey || undefined,
                    school: schoolKey || undefined,
                    class: classKey || undefined,
                    domain: domainKey || undefined,
                    subdomain: subdomainKey || undefined,
                    bloodline: bloodlineKey || undefined,
                    patron: patronKey || undefined,
                    mystery: mysteryKey || undefined,
                    limit: PAGE_SIZE,
                    offset: results.length,
                }).then((data) => {
                    if (loadMoreSeq.current !== myLmSeq) {
                        return;
                    }
                    setResults((prev) => [...prev, ...data.data]);
                    setTotal(data.total);
                }).catch(() => {
                    setError("Failed to load more spells.");
                }).finally(() => {
                    if (loadMoreSeq.current === myLmSeq) {
                        isLoadingMoreRef.current = false;
                        setLoadingMore(false);
                    }
                });
            },
            {rootMargin: "200px"},
        );

        observer.observe(sentinel);
        return () => observer.disconnect();
    });

    function handleFilterChange<K extends keyof FilterState>(key: K, value: FilterState[K]) {
        setFilters((prev) => ({...prev, [key]: value}));
    }

    const filterCount = activeFilterCount(filters);
    const initialLoading = !hasLoaded;

    return <Stack gap="lg">
        <div>
            <Title order={2}>Spells</Title>
            <Text size="sm" c="dimmed" mt={4}>
                {initialLoading
                    ? "Loading…"
                    : `Showing ${results.length} of ${total} spells`}
            </Text>
        </div>

        <Group gap="sm" align="flex-end">
            <TextInput
                placeholder="Search by name…"
                leftSection={<FiSearch size={16}/>}
                value={search}
                onChange={(e) => setSearch(e.currentTarget.value)}
                style={{flex: 1, maxWidth: 400}}
            />
            <Indicator
                label={filterCount}
                size={16}
                disabled={filterCount === 0}
                color="teal"
            >
                <Button
                    variant={filterCount > 0 ? "light" : "default"}
                    color={filterCount > 0 ? "teal" : undefined}
                    leftSection={<FiFilter size={14}/>}
                    onClick={() => setDrawerOpen(true)}
                >
                    Filters
                </Button>
            </Indicator>
        </Group>

        <SpellFilters
            opened={drawerOpen}
            onClose={() => setDrawerOpen(false)}
            filters={filters}
            onChange={handleFilterChange}
            onClear={() => setFilters(EMPTY_FILTERS)}
            schools={schools}
            classes={classes}
            domains={domains}
            bloodlines={bloodlines}
            patrons={patrons}
            mysteries={mysteries}
        />

        {error && <Text c="red" size="sm">{error}</Text>}

        <Table.ScrollContainer minWidth={680}>
            <Table
                striped
                highlightOnHover
                withTableBorder
                withColumnBorders={false}
                style={{opacity: isPending ? 0.6 : 1, transition: "opacity 0.15s"}}
            >
                <Table.Thead>
                    <Table.Tr>
                        <Table.Th style={{minWidth: 180}}>Name</Table.Th>
                        <Table.Th style={{minWidth: 160}}>School</Table.Th>
                        <Table.Th style={{minWidth: 220}}>Descriptors</Table.Th>
                        <Table.Th style={{minWidth: 160}}>Sourcebook</Table.Th>
                    </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                    {initialLoading ? (
                        <Table.Tr>
                            <Table.Td colSpan={4}>
                                <Center py="xl"><Loader size="sm"/></Center>
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
                                style={{cursor: "pointer"}}
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

        {/* Scroll sentinel — observed by IntersectionObserver to trigger next page */}
        <div ref={sentinelRef} style={{height: 1}}/>

        {loadingMore && (
            <Center py="sm">
                <Loader size="xs" color="teal"/>
            </Center>
        )}

        <Outlet/>
    </Stack>;
};
