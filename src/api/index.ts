import type { InferRequestType, InferResponseType } from "hono/client";
import { hc } from "hono/client";
import type { AppType } from "../../worker";

const client = hc<AppType>(window.location.origin);

// ─── Response types (derived from the worker's route return types) ─────────────
// No manual duplication — TypeScript infers these from the Hono app schema.

export type LookupItem = InferResponseType<typeof client.api.schools.$get>[number];
export type DomainWithSubdomains = InferResponseType<typeof client.api.domains.$get>[number];
export type Stats = InferResponseType<typeof client.api.stats.$get>;
export type SpellListResponse = InferResponseType<typeof client.api.spells.$get, 200>;
export type SpellListItem = SpellListResponse["data"][number];
export type SpellDetail = InferResponseType<(typeof client.api.spells)[":id"]["$get"], 200>;
export type FeatListResponse = InferResponseType<typeof client.api.feats.$get, 200>;
export type FeatListItem = FeatListResponse["data"][number];
export type FeatDetail = InferResponseType<(typeof client.api.feats)[":id"]["$get"], 200>;

// ─── Request params (derived from route Zod schemas via InferRequestType) ─────

export type SpellSearchParams = InferRequestType<typeof client.api.spells.$get>["query"];
export type FeatSearchParams = InferRequestType<typeof client.api.feats.$get>["query"];

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Reference data never changes during a session: fetch once, share the promise.
// A failed fetch is forgotten so the next caller retries.
const once = <T>(load: () => Promise<T>): (() => Promise<T>) => {
    let promise: Promise<T> | null = null;
    return () => {
        promise ??= load().catch((e: unknown) => {
            promise = null;
            throw e;
        });
        return promise;
    };
};

// ─── Fetch helpers ────────────────────────────────────────────────────────────

export const fetchSchools = once(async (): Promise<LookupItem[]> => {
    const res = await client.api.schools.$get();
    if (!res.ok) {
        throw new Error("Failed to fetch schools");
    }
    return res.json();
});

export const fetchSubschools = once(async (): Promise<LookupItem[]> => {
    const res = await client.api.subschools.$get();
    if (!res.ok) {
        throw new Error("Failed to fetch subschools");
    }
    return res.json();
});

export const fetchClasses = once(async (): Promise<LookupItem[]> => {
    const res = await client.api.classes.$get();
    if (!res.ok) {
        throw new Error("Failed to fetch classes");
    }
    return res.json();
});

export const fetchBloodlines = once(async (): Promise<LookupItem[]> => {
    const res = await client.api.bloodlines.$get();
    if (!res.ok) {
        throw new Error("Failed to fetch bloodlines");
    }
    return res.json();
});

export const fetchPatrons = once(async (): Promise<LookupItem[]> => {
    const res = await client.api.patrons.$get();
    if (!res.ok) {
        throw new Error("Failed to fetch patrons");
    }
    return res.json();
});

export const fetchMysteries = once(async (): Promise<LookupItem[]> => {
    const res = await client.api.mysteries.$get();
    if (!res.ok) {
        throw new Error("Failed to fetch mysteries");
    }
    return res.json();
});

export const fetchDomains = once(async (): Promise<DomainWithSubdomains[]> => {
    const res = await client.api.domains.$get();
    if (!res.ok) {
        throw new Error("Failed to fetch domains");
    }
    return res.json();
});

export const fetchDescriptors = once(async (): Promise<string[]> => {
    const res = await client.api.descriptors.$get();
    if (!res.ok) {
        throw new Error("Failed to fetch descriptors");
    }
    return res.json();
});

export const fetchFeatTypes = once(async (): Promise<string[]> => {
    const res = await client.api["feat-types"].$get();
    if (!res.ok) {
        throw new Error("Failed to fetch feat types");
    }
    return res.json();
});

export const fetchStats = once(async (): Promise<Stats> => {
    const res = await client.api.stats.$get();
    if (!res.ok) {
        throw new Error("Failed to fetch stats");
    }
    return res.json();
});

export const fetchSpells = async (params: SpellSearchParams): Promise<SpellListResponse> => {
    const res = await client.api.spells.$get({query: params});
    if (!res.ok) {
        throw new Error("Failed to fetch spells");
    }
    return res.json();
};

export const fetchSpell = async (id: string): Promise<SpellDetail> => {
    const res = await client.api.spells[":id"].$get({param: {id}});
    if (res.status === 404) {
        throw new Error("Spell not found");
    }
    if (!res.ok) {
        throw new Error("Failed to fetch spell");
    }
    return res.json();
};

export const fetchFeats = async (params: FeatSearchParams): Promise<FeatListResponse> => {
    const res = await client.api.feats.$get({query: params});
    if (!res.ok) {
        throw new Error("Failed to fetch feats");
    }
    return res.json();
};

export const fetchFeat = async (id: string): Promise<FeatDetail> => {
    const res = await client.api.feats[":id"].$get({param: {id}});
    if (res.status === 404) {
        throw new Error("Feat not found");
    }
    if (!res.ok) {
        throw new Error("Failed to fetch feat");
    }
    return res.json();
};
