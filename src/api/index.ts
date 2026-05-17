import type { InferRequestType, InferResponseType } from "hono/client";
import { hc } from "hono/client";
import type { AppType } from "../../worker";

const client = hc<AppType>(window.location.origin);

// ─── Response types (derived from the worker's route return types) ─────────────
// No manual duplication — TypeScript infers these from the Hono app schema.

export type LookupItem = InferResponseType<typeof client.api.schools.$get>[number];
export type DomainWithSubdomains = InferResponseType<typeof client.api.domains.$get>[number];
export type SpellListResponse = InferResponseType<typeof client.api.spells.$get, 200>;
export type SpellListItem = SpellListResponse["data"][number];
export type SpellDetail = InferResponseType<(typeof client.api.spells)[":id"]["$get"], 200>;
export type FeatListResponse = InferResponseType<typeof client.api.feats.$get, 200>;
export type FeatListItem = FeatListResponse["data"][number];
export type FeatDetail = InferResponseType<(typeof client.api.feats)[":id"]["$get"], 200>;

// ─── Request params (derived from route Zod schemas via InferRequestType) ─────

export type SpellSearchParams = InferRequestType<typeof client.api.spells.$get>["query"];
export type FeatSearchParams = InferRequestType<typeof client.api.feats.$get>["query"];

// ─── Fetch helpers ────────────────────────────────────────────────────────────

export const fetchSchools = async (): Promise<LookupItem[]> => {
    const res = await client.api.schools.$get();
    if (!res.ok) {
        throw new Error("Failed to fetch schools");
    }
    return res.json();
};

export const fetchSubschools = async (): Promise<LookupItem[]> => {
    const res = await client.api.subschools.$get();
    if (!res.ok) {
        throw new Error("Failed to fetch subschools");
    }
    return res.json();
};

export const fetchClasses = async (): Promise<LookupItem[]> => {
    const res = await client.api.classes.$get();
    if (!res.ok) {
        throw new Error("Failed to fetch classes");
    }
    return res.json();
};

export const fetchBloodlines = async (): Promise<LookupItem[]> => {
    const res = await client.api.bloodlines.$get();
    if (!res.ok) {
        throw new Error("Failed to fetch bloodlines");
    }
    return res.json();
};

export const fetchPatrons = async (): Promise<LookupItem[]> => {
    const res = await client.api.patrons.$get();
    if (!res.ok) {
        throw new Error("Failed to fetch patrons");
    }
    return res.json();
};

export const fetchMysteries = async (): Promise<LookupItem[]> => {
    const res = await client.api.mysteries.$get();
    if (!res.ok) {
        throw new Error("Failed to fetch mysteries");
    }
    return res.json();
};

export async function fetchDomains(): Promise<DomainWithSubdomains[]> {
    const res = await client.api.domains.$get();
    if (!res.ok) {
        throw new Error("Failed to fetch domains");
    }
    return res.json();
}

export async function fetchDescriptors(): Promise<string[]> {
    const res = await client.api.descriptors.$get();
    if (!res.ok) {
        throw new Error("Failed to fetch descriptors");
    }
    return res.json();
}

export async function fetchSpells(params: SpellSearchParams): Promise<SpellListResponse> {
    const res = await client.api.spells.$get({query: params});
    if (!res.ok) {
        throw new Error("Failed to fetch spells");
    }
    return res.json();
}

export async function fetchSpell(id: string): Promise<SpellDetail> {
    const res = await client.api.spells[":id"].$get({param: {id}});
    if (res.status === 404) {
        throw new Error("Spell not found");
    }
    if (!res.ok) {
        throw new Error("Failed to fetch spell");
    }
    return res.json();
}

export async function fetchFeatTypes(): Promise<string[]> {
    const res = await client.api["feat-types"].$get();
    if (!res.ok) {
        throw new Error("Failed to fetch feat types");
    }
    return res.json();
}

export async function fetchFeats(params: FeatSearchParams): Promise<FeatListResponse> {
    const res = await client.api.feats.$get({query: params});
    if (!res.ok) {
        throw new Error("Failed to fetch feats");
    }
    return res.json();
}

export async function fetchFeat(id: string): Promise<FeatDetail> {
    const res = await client.api.feats[":id"].$get({param: {id}});
    if (res.status === 404) {
        throw new Error("Feat not found");
    }
    if (!res.ok) {
        throw new Error("Failed to fetch feat");
    }
    return res.json();
}
