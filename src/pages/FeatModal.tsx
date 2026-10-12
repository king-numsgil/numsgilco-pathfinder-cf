import {
    Badge,
    Center,
    Divider,
    Group,
    Loader,
    Modal,
    Paper,
    SimpleGrid,
    Stack,
    Text,
} from "@mantine/core";
import { type FC, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { type FeatDetail, fetchFeat } from "../api";
import { FEAT_TYPE_COLORS } from "./featFilterState";
import { useDetailModalLayout } from "./detailModal";
import { useCloseModal, useNestedModalState } from "./listNavigation";
import { Prose } from "./Prose";
import { LabeledSection, SectionLabel } from "./SectionLabel";
import { useDetail } from "./useDetail";

interface InfoBlockProps {
    label: string;
    value: string | null | undefined;
}

const InfoBlock: FC<InfoBlockProps> = ({label, value}) => {
    if (!value) {
        return null;
    }
    return <LabeledSection label={label} gap={4}>
        <Prose>{value}</Prose>
    </LabeledSection>;
};

interface FeatLinkGridProps {
    label: string;
    feats: { id: string; name: string; types: string[]; note?: string | null }[];
}

// Links to related feats. They push history (Back returns to the previous
// feat) and record the modal depth so closing still returns to the list.
const FeatLinkGrid: FC<FeatLinkGridProps> = ({label, feats}) => {
    const location = useLocation();
    const linkState = useNestedModalState();

    return <Stack gap={8}>
        <Group gap="xs" align="baseline">
            <SectionLabel>{label}</SectionLabel>
            <Text size="xs" c="dimmed">({feats.length})</Text>
        </Group>
        <SimpleGrid cols={{base: 2, xs: 3}} spacing={6}>
            {feats.map((f) => (
                <Paper
                    key={f.id}
                    component={Link}
                    to={{pathname: `/feats/${f.id}`, search: location.search}}
                    state={linkState}
                    withBorder
                    p="xs"
                >
                    <Text size="xs" fw={500} c="teal.4" lineClamp={2} lh={1.35}>
                        {f.name}{f.note ? ` (${f.note})` : ""}
                    </Text>
                    {f.types.length > 0 && (
                        <Group gap={4} mt={4}>
                            {f.types.map((t) => (
                                <Badge key={t} color={FEAT_TYPE_COLORS[t] ?? "gray"} variant="light" size="xs">
                                    {t}
                                </Badge>
                            ))}
                        </Group>
                    )}
                </Paper>
            ))}
        </SimpleGrid>
    </Stack>;
};

interface FeatContentProps {
    feat: FeatDetail;
}

const FeatContent: FC<FeatContentProps> = ({feat}) => {
    return <Stack gap="md">
        <Group gap={6} wrap="wrap">
            {feat.types.map((t) => (
                <Badge key={t} color={FEAT_TYPE_COLORS[t] ?? "gray"} variant="filled" size="sm">
                    {t}
                </Badge>
            ))}
            {feat.multiples && (
                <Badge variant="outline" color="gray" size="sm">Can take multiple times</Badge>
            )}
        </Group>

        <InfoBlock label="Prerequisites" value={feat.prerequisites}/>

        <Divider/>

        <InfoBlock label="Benefit" value={feat.benefit}/>
        <InfoBlock label="Normal" value={feat.normal}/>
        <InfoBlock label="Special" value={feat.special}/>
        {feat.extra.map((section, i) => (
            <InfoBlock key={i} label={section.label} value={section.value}/>
        ))}

        {(feat.goal || feat.completionBenefit) && (
            <>
                <Divider/>
                <InfoBlock label="Goal" value={feat.goal}/>
                <InfoBlock label="Completion Benefit" value={feat.completionBenefit}/>
            </>
        )}

        {feat.combatTrick && (
            <>
                <Divider/>
                <InfoBlock label="Combat Trick" value={feat.combatTrick}/>
            </>
        )}

        {feat.mythic && (
            <>
                <Divider label={feat.mythic.name} labelPosition="left"/>
                <InfoBlock label="Prerequisites" value={feat.mythic.prerequisites}/>
                <InfoBlock label="Benefit" value={feat.mythic.benefit}/>
                <InfoBlock label="Special" value={feat.mythic.special}/>
            </>
        )}

        {feat.requires.length > 0 && (
            <>
                <Divider/>
                <FeatLinkGrid label="Requires" feats={feat.requires}/>
            </>
        )}

        {feat.requiredBy.length > 0 && (
            <>
                <Divider/>
                <FeatLinkGrid label="Required by" feats={feat.requiredBy}/>
            </>
        )}

        <Divider/>
        <Text size="xs" c="dimmed" ta="right">
            Source: {feat.sources.map((s) => s.page ? `${s.book} pg. ${s.page}` : s.book).join("; ") || feat.source}
            {feat.link && (
                <> · <a href={feat.link} target="_blank" rel="noreferrer" style={{color: "inherit"}}>AoN ↗</a></>
            )}
        </Text>
    </Stack>;
};

export const FeatModal: FC = () => {
    const {id} = useParams<{ id: string }>();
    const closeModal = useCloseModal("/feats");
    const [opened, setOpened] = useState(true);
    const {data: feat, error} = useDetail(id, fetchFeat);
    const layout = useDetailModalLayout();

    return <Modal
        opened={opened}
        onClose={() => setOpened(false)}
        fullScreen={layout.fullScreen}
        transitionProps={{...layout.transitionProps, onExited: closeModal}}
        title={feat?.name}
        styles={layout.styles}
        size="lg"
        scrollAreaComponent={layout.scrollAreaComponent}
    >
        <title>{`${feat?.name ?? "Feats"} — Pathfinder 1E`}</title>
        {feat ? (
            <FeatContent feat={feat}/>
        ) : error ? (
            <Text c="red" ta="center" py="xl">{error}</Text>
        ) : (
            <Center py="xl"><Loader/></Center>
        )}
    </Modal>;
};
