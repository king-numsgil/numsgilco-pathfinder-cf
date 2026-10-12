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
export type CharacterSummary = InferResponseType<typeof client.api.characters.$get, 200>[number];
export type CharacterDetail = InferResponseType<(typeof client.api.characters)[":id"]["$get"], 200>;
export type CharacterSource = CharacterDetail["sources"][number];
export type GrantedSpell = InferResponseType<(typeof client.api.characters)[":id"]["granted"]["$get"], 200>[number];

// ─── Request params (derived from route Zod schemas via InferRequestType) ─────

export type SpellSearchParams = InferRequestType<typeof client.api.spells.$get>["query"];
export type FeatSearchParams = InferRequestType<typeof client.api.feats.$get>["query"];
export type CharacterInput = InferRequestType<typeof client.api.characters.$post>["json"];
export type CharacterPatch = InferRequestType<(typeof client.api.characters)[":id"]["$patch"]>["json"];
export type SourceInput = NonNullable<CharacterInput["sources"]>[number];

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

// ─── Characters (signed-in user's spellbooks) ─────────────────────────────────

// The API's own message ("Sign in required", "Not found") when it sent one
const failure = async (res: { json: () => Promise<unknown> }, fallback: string): Promise<Error> => {
    const body = await res.json().catch(() => null);
    const message = typeof body === "object" && body !== null && "error" in body && typeof body.error === "string"
        ? body.error
        : fallback;
    return new Error(message);
};

export const fetchCharacters = async (): Promise<CharacterSummary[]> => {
    const res = await client.api.characters.$get();
    if (!res.ok) {
        throw await failure(res, "Failed to fetch characters");
    }
    return res.json();
};

export const fetchCharacter = async (id: string): Promise<CharacterDetail> => {
    const res = await client.api.characters[":id"].$get({param: {id}});
    if (!res.ok) {
        throw await failure(res, "Failed to fetch character");
    }
    return res.json();
};

export const fetchGranted = async (id: string): Promise<GrantedSpell[]> => {
    const res = await client.api.characters[":id"].granted.$get({param: {id}});
    if (!res.ok) {
        throw await failure(res, "Failed to fetch granted spells");
    }
    return res.json();
};

export const createCharacter = async (input: CharacterInput): Promise<string> => {
    const res = await client.api.characters.$post({json: input});
    if (!res.ok) {
        throw await failure(res, "Failed to create character");
    }
    return (await res.json()).id;
};

export const updateCharacter = async (id: string, patch: CharacterPatch): Promise<CharacterDetail> => {
    const res = await client.api.characters[":id"].$patch({param: {id}, json: patch});
    if (!res.ok) {
        throw await failure(res, "Failed to save character");
    }
    return res.json();
};

export const deleteCharacter = async (id: string): Promise<void> => {
    const res = await client.api.characters[":id"].$delete({param: {id}});
    if (!res.ok) {
        throw await failure(res, "Failed to delete character");
    }
};

export const restCharacter = async (id: string): Promise<CharacterDetail> => {
    const res = await client.api.characters[":id"].rest.$post({param: {id}});
    if (!res.ok) {
        throw await failure(res, "Failed to rest");
    }
    return res.json();
};

export const addKnownSpell = async (id: string, spellId: string, level: number): Promise<CharacterDetail> => {
    const res = await client.api.characters[":id"].spells[":spellId"].$put({param: {id, spellId}, json: {level}});
    if (!res.ok) {
        throw await failure(res, "Failed to add spell");
    }
    return res.json();
};

export const removeKnownSpell = async (id: string, spellId: string): Promise<CharacterDetail> => {
    const res = await client.api.characters[":id"].spells[":spellId"].$delete({param: {id, spellId}});
    if (!res.ok) {
        throw await failure(res, "Failed to remove spell");
    }
    return res.json();
};

export const prepareSpell = async (id: string, spellId: string, level: number): Promise<CharacterDetail> => {
    const res = await client.api.characters[":id"].prepared.$post({param: {id}, json: {spellId, level}});
    if (!res.ok) {
        throw await failure(res, "Failed to prepare spell");
    }
    return res.json();
};

export const setPreparedCast = async (id: string, preparedId: string, cast: boolean): Promise<CharacterDetail> => {
    const res = await client.api.characters[":id"].prepared[":preparedId"].$patch({param: {id, preparedId}, json: {cast}});
    if (!res.ok) {
        throw await failure(res, "Failed to update spell");
    }
    return res.json();
};

export const unprepareSpell = async (id: string, preparedId: string): Promise<CharacterDetail> => {
    const res = await client.api.characters[":id"].prepared[":preparedId"].$delete({param: {id, preparedId}});
    if (!res.ok) {
        throw await failure(res, "Failed to remove spell");
    }
    return res.json();
};
