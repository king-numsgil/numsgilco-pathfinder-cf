import { useEffect, useEffectEvent, useRef, useState, useTransition } from "react";

export const PAGE_SIZE = 50;

interface Page<T> {
    data: T[];
    total: number;
}

/**
 * Paged list with infinite scroll. Reloads from the first page whenever
 * `queryKey` changes; attach `sentinelRef` to an element below the list.
 *
 * A failed page load stops auto-loading until `retry()` is called, so a
 * persistent error can't turn into an endless request loop.
 */
export const useInfiniteList = <T>(fetchPage: (offset: number) => Promise<Page<T>>, queryKey: string) => {
    const [results, setResults] = useState<T[]>([]);
    const [total, setTotal] = useState(0);
    const [hasLoaded, setHasLoaded] = useState(false);
    const [error, setError] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [loadMoreFailed, setLoadMoreFailed] = useState(false);
    const [reloadToken, setReloadToken] = useState(0);
    const [isPending, startTransition] = useTransition();

    // Bumped on every first-page load; stale responses compare against it
    const seq = useRef(0);
    const sentinelRef = useRef<HTMLDivElement>(null);

    const loadFirstPage = useEffectEvent(() => {
        const mySeq = ++seq.current;
        startTransition(async () => {
            try {
                const page = await fetchPage(0);
                if (mySeq !== seq.current) {
                    return;
                }
                setResults(page.data);
                setTotal(page.total);
                setError(false);
                setLoadMoreFailed(false);
            } catch {
                if (mySeq === seq.current) {
                    setError(true);
                }
            } finally {
                if (mySeq === seq.current) {
                    setHasLoaded(true);
                    setLoadingMore(false);
                }
            }
        });
    });

    const loadNextPage = useEffectEvent(() => {
        const mySeq = seq.current;
        setLoadingMore(true);
        fetchPage(results.length)
            .then((page) => {
                if (mySeq !== seq.current) {
                    return;
                }
                setResults((prev) => [...prev, ...page.data]);
                setTotal(page.total);
            })
            .catch(() => {
                if (mySeq === seq.current) {
                    setLoadMoreFailed(true);
                }
            })
            .finally(() => {
                if (mySeq === seq.current) {
                    setLoadingMore(false);
                }
            });
    });

    useEffect(() => {
        loadFirstPage();
    }, [queryKey, reloadToken]);

    const canLoadMore = hasLoaded && !isPending && !error && !loadingMore && !loadMoreFailed
        && results.length < total;

    useEffect(() => {
        const sentinel = sentinelRef.current;
        if (!sentinel || !canLoadMore) {
            return;
        }
        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting) {
                    observer.disconnect();
                    loadNextPage();
                }
            },
            {rootMargin: "200px"},
        );
        observer.observe(sentinel);
        return () => observer.disconnect();
    }, [canLoadMore]);

    const retry = () => {
        if (error) {
            setReloadToken((t) => t + 1);
        } else {
            setLoadMoreFailed(false);
        }
    };

    return {results, total, hasLoaded, isPending, error, loadingMore, loadMoreFailed, retry, sentinelRef};
};
