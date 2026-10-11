import { useDebouncedCallback } from "@mantine/hooks";
import { useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";

// Router state of a detail-modal history entry: whether the modal was opened
// from its list page, and how many modal entries deep this one is (1 = the
// entry opened from the list; each in-modal link to another record adds one)
interface ModalState {
    fromList: boolean;
    depth: number;
}

export const FROM_LIST: ModalState = {fromList: true, depth: 1};

const readModalState = (state: unknown): ModalState => {
    if (typeof state !== "object" || state === null) {
        return {fromList: false, depth: 1};
    }
    const fromList = "fromList" in state && state.fromList === true;
    const depth = "depth" in state && typeof state.depth === "number" ? state.depth : 1;
    return {fromList, depth};
};

/** State for a link from the current modal to another record (pushes history). */
export const useNestedModalState = (): ModalState => {
    const {fromList, depth} = readModalState(useLocation().state);
    return {fromList, depth: depth + 1};
};

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
 * Closing a detail modal: if it was opened from the list, step back past every
 * modal entry (including in-modal hops between records) so Back from the list
 * doesn't reopen anything. Otherwise (deep link, new tab) replace the entry
 * with the list, keeping the current filters.
 */
export const useCloseModal = (listPath: string): (() => void) => {
    const navigate = useNavigate();
    const location = useLocation();

    return () => {
        const {fromList, depth} = readModalState(location.state);
        if (fromList) {
            navigate(-depth);
        } else {
            navigate({pathname: listPath, search: location.search}, {replace: true});
        }
    };
};
