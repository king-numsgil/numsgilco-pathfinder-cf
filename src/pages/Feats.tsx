import { Anchor, Badge, Button, Center, Group, Indicator, Loader, Stack, Table, Text, TextInput, Title } from "@mantine/core";
import { type FC, useEffect, useState } from "react";
import { FiFilter, FiSearch } from "react-icons/fi";
import { Link, useNavigate, useOutlet, useSearchParams } from "react-router-dom";
import { type FeatListItem, fetchFeats, fetchFeatTypes } from "../api";
import { FeatFilters } from "./FeatFilters";
import {
    activeFeatFilterCount,
    EMPTY_FEAT_FILTERS,
    FEAT_TYPE_COLORS,
    type FeatFilterState,
    featFiltersFromParams,
    featQueryFromParams,
    withFeatFilters,
} from "./featFilterState";
import { ListError, ListFooter } from "./ListFooter";
import { FROM_LIST, useUrlSearch } from "./listNavigation";
import { PAGE_SIZE, useInfiniteList } from "./useInfiniteList";

export const Feats: FC = () => {
    const navigate = useNavigate();
    const outlet = useOutlet();
    const [searchParams, setSearchParams] = useSearchParams();
    const [search, setSearch] = useUrlSearch();

    const filters = featFiltersFromParams(searchParams);
    const [drawerOpen, setDrawerOpen] = useState(false);

    const [featTypes, setFeatTypes] = useState<string[]>([]);
    const [lookupError, setLookupError] = useState(false);
    const [lookupToken, setLookupToken] = useState(0);

    // Load feat types (cached after the first success)
    useEffect(() => {
        fetchFeatTypes().then((types) => {
            setFeatTypes(types);
            setLookupError(false);
        }).catch(() => {
            setLookupError(true);
        });
    }, [lookupToken]);

    const query = featQueryFromParams(searchParams);
    const list = useInfiniteList<FeatListItem>(
        (offset) => fetchFeats({...query, limit: String(PAGE_SIZE), offset: String(offset)}),
        JSON.stringify(query),
    );

    const setFilters = (next: FeatFilterState) =>
        setSearchParams((prev) => withFeatFilters(prev, next), {replace: true});

    const handleFilterChange = <K extends keyof FeatFilterState>(key: K, value: FeatFilterState[K]) =>
        setFilters({...filters, [key]: value});

    const featLink = (id: string) => ({pathname: `/feats/${id}`, search: searchParams.toString()});

    const filterCount = activeFeatFilterCount(filters);
    const {results, total, hasLoaded, isPending} = list;

    return <Stack gap="lg">
        {!outlet && <title>Feats — Pathfinder 1E</title>}
        <div>
            <Title order={2}>Feats</Title>
            <Text size="sm" c="dimmed" mt={4}>
                {hasLoaded ? `Showing ${results.length} of ${total} feats` : "Loading…"}
            </Text>
        </div>

        <Group gap="sm" align="flex-end">
            <TextInput
                placeholder="Search by name…"
                aria-label="Search feats by name"
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
            lookupError={lookupError}
            onRetryLookups={() => setLookupToken((t) => t + 1)}
        />

        {list.error && <ListError message="Failed to load feats." onRetry={list.retry}/>}

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
                    {results.map((feat) => (
                        <Table.Tr
                            key={feat.id}
                            style={{cursor: "pointer"}}
                            onClick={() => navigate(featLink(feat.id), {state: FROM_LIST})}
                        >
                            <Table.Td>
                                <Anchor
                                    component={Link}
                                    to={featLink(feat.id)}
                                    state={FROM_LIST}
                                    onClick={(e) => e.stopPropagation()}
                                    fw={600}
                                    size="sm"
                                    c="teal.4"
                                >
                                    {feat.name}
                                </Anchor>
                                {feat.multiples && (
                                    <Text span size="xs" c="dimmed" title="Can be taken multiple times"> *</Text>
                                )}
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
                    ))}
                </Table.Tbody>
            </Table>
        </Table.ScrollContainer>

        {/* Outside the table so they stay centred on screen when the table scrolls sideways */}
        {!hasLoaded ? (
            <Center py="xl"><Loader size="sm"/></Center>
        ) : results.length === 0 && (
            <Text c="dimmed" ta="center" py="xl">No feats match your filters.</Text>
        )}

        <ListFooter
            sentinelRef={list.sentinelRef}
            loadingMore={list.loadingMore}
            loadMoreFailed={list.loadMoreFailed}
            onRetry={list.retry}
        />

        {outlet}
    </Stack>;
};
