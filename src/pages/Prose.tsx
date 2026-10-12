import { List, Stack, Table, Text } from "@mantine/core";
import type { FC } from "react";
import Markdown, { type Components } from "react-markdown";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";

// Codex text is Markdown: *spell names*, **bold** labels, tables and lists.
// Single newlines are line breaks (remark-breaks), as in the source pages.
const REMARK_PLUGINS = [remarkGfm, remarkBreaks];

const heading: Components["h1"] = ({children}) => <Text size="sm" fw={700}>{children}</Text>;

// Every component receives the hast `node`; it's dropped so it doesn't reach the DOM
const COMPONENTS: Components = {
    p: ({children}) => <Text size="sm" lh={1.7}>{children}</Text>,
    h1: heading,
    h2: heading,
    h3: heading,
    h4: heading,
    h5: heading,
    h6: heading,
    ul: ({children}) => <List size="sm" spacing={4} withPadding>{children}</List>,
    ol: ({children}) => <List type="ordered" size="sm" spacing={4} withPadding>{children}</List>,
    li: ({children}) => <List.Item>{children}</List.Item>,
    // Wide tables scroll sideways on phones instead of squashing
    table: ({children}) => <Table.ScrollContainer minWidth={420} type="native">
        <Table striped withTableBorder withColumnBorders fz="xs" verticalSpacing={4}>{children}</Table>
    </Table.ScrollContainer>,
    thead: ({children}) => <Table.Thead>{children}</Table.Thead>,
    tbody: ({children}) => <Table.Tbody>{children}</Table.Tbody>,
    tr: ({children}) => <Table.Tr>{children}</Table.Tr>,
    th: ({children}) => <Table.Th>{children}</Table.Th>,
    td: ({children}) => <Table.Td>{children}</Table.Td>,
    a: ({href, children}) => <a href={href} target="_blank" rel="noreferrer">{children}</a>,
};

interface ProseProps {
    children: string;
}

export const Prose: FC<ProseProps> = ({children}) =>
    <Stack gap="sm">
        <Markdown remarkPlugins={REMARK_PLUGINS} components={COMPONENTS}>{children}</Markdown>
    </Stack>;
