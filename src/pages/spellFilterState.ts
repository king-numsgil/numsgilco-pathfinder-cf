export type FilterState = {
    levels: string[];
    schoolIds: string[];
    subschoolIds: string[];
    descriptors: string[];
    classIds: string[];
    domainIds: string[];
    subdomainIds: string[];
    bloodlineIds: string[];
    patronIds: string[];
    mysteryIds: string[];
};

export const EMPTY_FILTERS: FilterState = {
    levels: [],
    schoolIds: [],
    subschoolIds: [],
    descriptors: [],
    classIds: [],
    domainIds: [],
    subdomainIds: [],
    bloodlineIds: [],
    patronIds: [],
    mysteryIds: [],
};

export function activeFilterCount(f: FilterState): number {
    return Object.values(f).filter((arr) => arr.length > 0).length;
}
