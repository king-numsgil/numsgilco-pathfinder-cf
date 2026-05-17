import { Badge, Button, Center, Group, Indicator, Loader, Stack, Table, Text, TextInput, Title } from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import { type FC, useEffect, useRef, useState, useTransition } from "react";
import { FiFilter, FiSearch } from "react-icons/fi";
import { Outlet, useNavigate } from "react-router-dom";
import { fetchFeatTypes, fetchFeats, type FeatListItem } from "../api";
import { FeatFilters } from "./FeatFilters";
import { activeFeatFilterCount, EMPTY_FEAT_FILTERS, FEAT_TYPE_COLORS, type FeatFilterState } from "./featFilterState";

const PAGE_SIZE = 50;

export const Feats: FC = () => {
    const navigate = useNavigate();

    const [search, setSearch] = useState("");
    const [debouncedSearch] = useDebouncedValue(search, 300);

    const [filters, setFilters] = useState<FeatFilterState>(EMPTY_FEAT_FILTERS);
    const [drawerOpen, setDrawerOpen] = useState(false);

    const [featTypes, setFeatTypes] = useState<string[]>([]);

    const [results, setResults] = useState<FeatListItem[]>([]);
    const [total, setTotal] = useState(0);
    const [error, setError] = useState<string | null>(null);
    const [hasLoaded, setHasLoaded] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);

    const [isPending, startTransition] = useTransition();

    const fetchSeq = useRef(0);
    const loadMoreSeq = useRef(0);
    const sentinelRef = useRef<HTMLDivElement>(null);
    const isLoadingMoreRef = useRef(false);

    // Load feat types on mount
    useEffect(() => {
        fetchFeatTypes().then(setFeatTypes).catch(() => {/* non-fatal */});
    }, []);

    // Stable string keys for array / derived filter values
    const typeKey = filters.types.join(",");

    // Re-fetch first page whenever any filter changes
    useEffect(() => {
        const seq = ++fetchSeq.current;
        ++loadMoreSeq.current;
        isLoadingMoreRef.current = false;

        startTransition(async () => {
            try {
                const data = await fetchFeats({
                    q: debouncedSearch || undefined,
                    type: typeKey || undefined,
                    maxBab: filters.maxBab || undefined,
                    maxCl: filters.maxCl || undefined,
                    limit: String(PAGE_SIZE),
                    offset: "0",
                });
                if (seq !== fetchSeq.current) return;
                setResults(data.data);
                setTotal(data.total);
                setError(null);
            } catch {
                if (seq !== fetchSeq.current) return;
                setError("Failed to load feats.");
            } finally {
                if (seq === fetchSeq.current) setHasLoaded(true);
            }
        });
    }, [debouncedSearch, typeKey, filters.maxBab, filters.maxCl]);

    // Infinite scroll — no dep array so closure always sees current values
    useEffect(() => {
        const sentinel = sentinelRef.current;
        if (!sentinel || !hasLoaded || isPending || results.length >= total) return;

        const myLmSeq = loadMoreSeq.current;

        const observer = new IntersectionObserver(
            (entries) => {
                if (!entries[0].isIntersecting) return;
                if (isLoadingMoreRef.current) return;
                if (loadMoreSeq.current !== myLmSeq) return;

                isLoadingMoreRef.current = true;
                setLoadingMore(true);
                fetchFeats({
                    q: debouncedSearch || undefined,
                    type: typeKey || undefined,
                    maxBab: filters.maxBab || undefined,
                    maxCl: filters.maxCl || undefined,
                    limit: String(PAGE_SIZE),
                    offset: String(results.length),
                }).then((data) => {
                    if (loadMoreSeq.current !== myLmSeq) return;
                    setResults((prev) => [...prev, ...data.data]);
                    setTotal(data.total);
                }).catch(() => {
                    setError("Failed to load more feats.");
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

    function handleFilterChange<K extends keyof FeatFilterState>(key: K, value: FeatFilterState[K]) {
        setFilters((prev) => ({...prev, [key]: value}));
    }

    const filterCount = activeFeatFilterCount(filters);
    const initialLoading = !hasLoaded;

    return <Stack gap="lg">
        <div>
            <Title order={2}>Feats</Title>
            <Text size="sm" c="dimmed" mt={4}>
                {initialLoading
                    ? "Loading…"
                    : `Showing ${results.length} of ${total} feats`}
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

        <FeatFilters
            opened={drawerOpen}
            onClose={() => setDrawerOpen(false)}
            filters={filters}
            onChange={handleFilterChange}
            onClear={() => setFilters(EMPTY_FEAT_FILTERS)}
            featTypes={featTypes}
        />

        {error && <Text c="red" size="sm">{error}</Text>}

        <Table.ScrollContainer minWidth={640}>
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
                        <Table.Th style={{minWidth: 200}}>Type</Table.Th>
                        <Table.Th style={{minWidth: 240}}>Prerequisites</Table.Th>
                        <Table.Th style={{minWidth: 140}}>Source</Table.Th>
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
                                <Text c="dimmed" ta="center" py="xl">No feats match your filters.</Text>
                            </Table.Td>
                        </Table.Tr>
                    ) : (
                        results.map((feat) => (
                            <Table.Tr
                                key={feat.id}
                                style={{cursor: "pointer"}}
                                onClick={() => navigate(`/feats/${feat.id}`)}
                            >
                                <Table.Td>
                                    <Text fw={600} size="sm" c="teal.4">
                                        {feat.name}
                                        {feat.multiples && (
                                            <Text span size="xs" c="dimmed"> *</Text>
                                        )}
                                    </Text>
                                </Table.Td>
                                <Table.Td>
                                    <Group gap={4} wrap="wrap">
                                        {feat.types.map((t) => (
                                            <Badge
                                                key={t}
                                                color={FEAT_TYPE_COLORS[t] ?? "gray"}
                                                variant="light"
                                                size="sm"
                                            >
                                                {t}
                                            </Badge>
                                        ))}
                                    </Group>
                                </Table.Td>
                                <Table.Td>
                                    <Text size="sm" c="dimmed" lineClamp={1}>
                                        {feat.prerequisites ?? "—"}
                                    </Text>
                                </Table.Td>
                                <Table.Td>
                                    <Text size="sm" c="dimmed">{feat.source}</Text>
                                </Table.Td>
                            </Table.Tr>
                        ))
                    )}
                </Table.Tbody>
            </Table>
        </Table.ScrollContainer>

        <div ref={sentinelRef} style={{height: 1}}/>

        {loadingMore && (
            <Center py="sm">
                <Loader size="xs" color="teal"/>
            </Center>
        )}

        <Outlet/>
    </Stack>;
};
