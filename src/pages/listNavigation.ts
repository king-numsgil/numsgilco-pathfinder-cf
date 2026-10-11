import { useDebouncedCallback } from "@mantine/hooks";
import { useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";

// Router state attached when a detail modal is opened from its list page
export const FROM_LIST = {fromList: true} as const;

const isFromList = (state: unknown): boolean =>
    typeof state === "object" && state !== null && "fromList" in state;

/**
 * Search box bound to the `q` URL param. The input updates immediately; the URL
 * (and therefore the fetch) follows after a 300 ms debounce.
 */
export const useUrlSearch = (): [string, (value: string) => void] => {
    const [searchParams, setSearchParams] = useSearchParams();
    const [search, setSearch] = useState(searchParams.get("q") ?? "");

    const writeQuery = useDebouncedCallback((value: string) => {
        setSearchParams((prev) => {
            const next = new URLSearchParams(prev);
            if (value.trim()) {
                next.set("q", value.trim());
            } else {
                next.delete("q");
            }
            return next;
        }, {replace: true});
    }, 300);

    const onChange = (value: string) => {
        setSearch(value);
        writeQuery(value);
    };

    return [search, onChange];
};

/**
 * Closing a detail modal: if it was opened from the list, step back in history
 * so Back doesn't reopen it. Otherwise (deep link, new tab) replace the entry
 * with the list, keeping the current filters.
 */
export const useCloseModal = (listPath: string): (() => void) => {
    const navigate = useNavigate();
    const location = useLocation();

    return () => {
        if (isFromList(location.state)) {
            navigate(-1);
        } else {
            navigate({pathname: listPath, search: location.search}, {replace: true});
        }
    };
};
