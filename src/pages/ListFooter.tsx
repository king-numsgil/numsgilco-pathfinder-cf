import { Button, Center, Group, Loader, Text } from "@mantine/core";
import type { FC, RefObject } from "react";

interface ListErrorProps {
    message: string;
    onRetry: () => void;
}

export const ListError: FC<ListErrorProps> = ({message, onRetry}) =>
    <Group gap="sm">
        <Text c="red" size="sm">{message}</Text>
        <Button size="compact-xs" variant="light" color="red" onClick={onRetry}>Retry</Button>
    </Group>;

interface ListFooterProps {
    sentinelRef: RefObject<HTMLDivElement | null>;
    loadingMore: boolean;
    loadMoreFailed: boolean;
    onRetry: () => void;
}

// Scroll sentinel (observed to trigger the next page) plus load-more status
export const ListFooter: FC<ListFooterProps> = ({sentinelRef, loadingMore, loadMoreFailed, onRetry}) =>
    <>
        <div ref={sentinelRef} style={{height: 1}}/>
        {loadingMore && (
            <Center py="sm">
                <Loader size="xs" color="teal"/>
            </Center>
        )}
        {loadMoreFailed && (
            <Center py="sm">
                <ListError message="Failed to load more results." onRetry={onRetry}/>
            </Center>
        )}
    </>;
