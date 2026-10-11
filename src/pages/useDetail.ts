import { useEffect, useState } from "react";

type Result<T> = { id: string; data: T } | { id: string; error: string };

/**
 * Fetches a detail record by ID. Results are tagged with the ID they belong to,
 * so when the ID changes the stale result is simply ignored (→ loading) instead
 * of being reset synchronously inside the effect.
 */
export const useDetail = <T>(id: string | undefined, fetcher: (id: string) => Promise<T>) => {
    const [result, setResult] = useState<Result<T> | null>(null);

    useEffect(() => {
        if (!id) {
            return;
        }
        let active = true;
        fetcher(id)
            .then((data) => {
                if (active) {
                    setResult({id, data});
                }
            })
            .catch((e: unknown) => {
                if (active) {
                    setResult({id, error: e instanceof Error ? e.message : "Failed to load"});
                }
            });
        return () => {
            active = false;
        };
    }, [id, fetcher]);

    const current = result?.id === id ? result : null;
    return {
        data: current && "data" in current ? current.data : null,
        error: current && "error" in current ? current.error : null,
    };
};
