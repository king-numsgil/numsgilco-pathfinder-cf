import {
    Anchor,
    Badge,
    Button,
    Center,
    Group,
    Indicator,
    Loader,
    Stack,
    Table,
    Text,
    TextInput,
    Title,
    Tooltip,
    UnstyledButton,
} from "@mantine/core";
import { type FC, useEffect, useState } from "react";
import { FiArrowDown, FiFilter, FiSearch } from "react-icons/fi";
import { Link, useNavigate, useOutlet, useSearchParams } from "react-router-dom";
import {
    type DomainWithSubdomains,
    fetchBloodlines,
    fetchClasses,
    fetchDescriptors,
    fetchDisciplines,
    fetchDomains,
    fetchMysteries,
    fetchPatrons,
    fetchSchools,
    fetchSpells,
    fetchSubschools,
    type LookupItem,
    type SpellListItem,
} from "../api";
import { ListError, ListFooter } from "./ListFooter";
import { FROM_LIST, useUrlSearch } from "./listNavigation";
import { SpellFilters } from "./SpellFilters";
import {
    activeFilterCount,
    EMPTY_FILTERS,
    type FilterState,
    filtersFromParams,
    SCHOOL_COLORS,
    type SpellSort,
    sortFromParams,
    spellQueryFromParams,
    withFilters,
} from "./spellFilterState";
import { PAGE_SIZE, useInfiniteList } from "./useInfiniteList";

interface Lookups {
    schools: LookupItem[];
    subschools: LookupItem[];
    descriptors: string[];
    classes: LookupItem[];
    domains: DomainWithSubdomains[];
    bloodlines: LookupItem[];
    patrons: LookupItem[];
    mysteries: LookupItem[];
    disciplines: LookupItem[];
}

const EMPTY_LOOKUPS: Lookups = {
    schools: [],
    subschools: [],
    descriptors: [],
    classes: [],
    domains: [],
    bloodlines: [],
    patrons: [],
    mysteries: [],
    disciplines: [],
};

interface SortHeaderProps {
    label: string;
    column: SpellSort;
    sort: SpellSort;
    onSort: (column: SpellSort) => void;
}

const SortHeader: FC<SortHeaderProps> = ({label, column, sort, onSort}) =>
    <UnstyledButton onClick={() => onSort(column)} fw={700} fz="sm">
        <Group gap={4} wrap="nowrap">
            {label}
            {sort === column && <FiArrowDown size={12}/>}
        </Group>
    </UnstyledButton>;

export const Spells: FC = () => {
    const navigate = useNavigate();
    const outlet = useOutlet();
    const [searchParams, setSearchParams] = useSearchParams();
    const [search, setSearch] = useUrlSearch();

    const filters = filtersFromParams(searchParams);
    const sort = sortFromParams(searchParams);
    const [drawerOpen, setDrawerOpen] = useState(false);

    const [lookups, setLookups] = useState<Lookups>(EMPTY_LOOKUPS);
    const [lookupError, setLookupError] = useState(false);
    const [lookupToken, setLookupToken] = useState(0);

    // Load all lookup data in parallel (cached after the first success)
    useEffect(() => {
        Promise.all([
            fetchSchools(),
            fetchSubschools(),
            fetchDescriptors(),
            fetchClasses(),
            fetchDomains(),
            fetchBloodlines(),
            fetchPatrons(),
            fetchMysteries(),
            fetchDisciplines(),
        ]).then(([schools, subschools, descriptors, classes, domains, bloodlines, patrons, mysteries, disciplines]) => {
            setLookups({schools, subschools, descriptors, classes, domains, bloodlines, patrons, mysteries, disciplines});
            setLookupError(false);
        }).catch(() => {
            setLookupError(true);
        });
    }, [lookupToken]);

    const query = spellQueryFromParams(searchParams);
    const list = useInfiniteList<SpellListItem>(
        (offset) => fetchSpells({...query, limit: String(PAGE_SIZE), offset: String(offset)}),
        JSON.stringify(query),
    );

    const setFilters = (next: FilterState) =>
        setSearchParams((prev) => withFilters(prev, next), {replace: true});

    const handleFilterChange = <K extends keyof FilterState>(key: K, value: FilterState[K]) =>
        setFilters({...filters, [key]: value});

    const handleSort = (column: SpellSort) =>
        setSearchParams((prev) => {
            const next = new URLSearchParams(prev);
            if (column === "name") {
                next.delete("sort");
            } else {
                next.set("sort", column);
            }
            return next;
        }, {replace: true});

    const spellLink = (id: string) => ({pathname: `/spells/${id}`, search: searchParams.toString()});

    const filterCount = activeFilterCount(filters);
    const {results, total, hasLoaded, isPending} = list;

    return <Stack gap="lg">
        {!outlet && <title>Spells — Pathfinder 1E</title>}
        <div>
            <Title order={2}>Spells</Title>
            <Text size="sm" c="dimmed" mt={4}>
                {hasLoaded ? `Showing ${results.length} of ${total} spells` : "Loading…"}
            </Text>
        </div>

        <Group gap="sm" align="flex-end">
            <TextInput
                placeholder="Search by name…"
                aria-label="Search spells by name"
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
            lookupError={lookupError}
            onRetryLookups={() => setLookupToken((t) => t + 1)}
            {...lookups}
        />

        {list.error && <ListError message="Failed to load spells." onRetry={list.retry}/>}

        <Table.ScrollContainer minWidth={740}>
            <Table
                striped
                highlightOnHover
                withTableBorder
                withColumnBorders={false}
                style={{opacity: isPending ? 0.6 : 1, transition: "opacity 0.15s"}}
            >
                <Table.Thead>
                    <Table.Tr>
                        <Table.Th style={{minWidth: 180}} aria-sort={sort === "name" ? "ascending" : undefined}>
                            <SortHeader label="Name" column="name" sort={sort} onSort={handleSort}/>
                        </Table.Th>
                        <Table.Th style={{width: 70}} aria-sort={sort === "level" ? "ascending" : undefined}>
                            <Tooltip
                                label="Lowest level among the selected sources, or any source if none is selected"
                                multiline
                                w={240}
                            >
                                <span>
                                    <SortHeader label="Level" column="level" sort={sort} onSort={handleSort}/>
                                </span>
                            </Tooltip>
                        </Table.Th>
                        <Table.Th style={{minWidth: 160}}>School</Table.Th>
                        <Table.Th style={{minWidth: 220}}>Descriptors</Table.Th>
                        <Table.Th style={{minWidth: 160}}>Sourcebook</Table.Th>
                    </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                    {results.map((spell) => (
                        <Table.Tr
                            key={spell.id}
                            style={{cursor: "pointer"}}
                            onClick={() => navigate(spellLink(spell.id), {state: FROM_LIST})}
                        >
                            <Table.Td>
                                <Anchor
                                    component={Link}
                                    to={spellLink(spell.id)}
                                    state={FROM_LIST}
                                    onClick={(e) => e.stopPropagation()}
                                    fw={600}
                                    size="sm"
                                    c="teal.4"
                                >
                                    {spell.name}
                                </Anchor>
                            </Table.Td>
                            <Table.Td>
                                <Text size="sm">{spell.level ?? "—"}</Text>
                            </Table.Td>
                            <Table.Td>
                                {spell.school ? (
                                    <>
                                        <Badge
                                            color={SCHOOL_COLORS[spell.school] ?? "gray"}
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
                    ))}
                </Table.Tbody>
            </Table>
        </Table.ScrollContainer>

        {/* Outside the table so they stay centred on screen when the table scrolls sideways */}
        {!hasLoaded ? (
            <Center py="xl"><Loader size="sm"/></Center>
        ) : results.length === 0 && (
            <Text c="dimmed" ta="center" py="xl">No spells match your filters.</Text>
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
