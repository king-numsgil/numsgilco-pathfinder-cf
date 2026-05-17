import {
    Badge,
    Center,
    Divider,
    Group,
    Loader,
    Modal,
    Paper,
    ScrollArea,
    SimpleGrid,
    Stack,
    Text,
} from "@mantine/core";
import { type FC, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { type FeatDetail, fetchFeat } from "../api";
import { FEAT_TYPE_COLORS } from "./featFilterState";

function InfoBlock({label, value}: { label: string; value: string | null | undefined }) {
    if (!value) {
        return null;
    }
    return <Stack gap={4}>
        <Text size="xs" tt="uppercase" fw={700} c="dimmed" style={{letterSpacing: "0.06em"}}>
            {label}
        </Text>
        <Text size="sm" style={{lineHeight: 1.7}}>{value}</Text>
    </Stack>;
}

// Keyed by feat ID so it always starts with a fresh (loading) state
const FeatContent: FC<{ id: string }> = ({id}) => {
    const navigate = useNavigate();
    const [feat, setFeat] = useState<FeatDetail | null>(null);
    const [error, setError] = useState<string | null>(null);
    const loading = feat === null && error === null;

    useEffect(() => {
        let active = true;
        fetchFeat(id)
            .then((data) => {
                if (active) {
                    setFeat(data);
                }
            })
            .catch((e: Error) => {
                if (active) {
                    setError(e.message);
                }
            });
        return () => {
            active = false;
        };
    }, [id]);

    if (loading) {
        return <Center py="xl"><Loader/></Center>;
    }
    if (error) {
        return <Text c="red" ta="center" py="xl">{error}</Text>;
    }
    if (!feat) {
        return null;
    }

    return <Stack gap="md">
        <Stack gap={6}>
            <Text fw={700} size="xl">{feat.name}</Text>
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
        </Stack>

        {feat.prerequisites && (
            <InfoBlock label="Prerequisites" value={feat.prerequisites}/>
        )}

        <Divider/>

        <InfoBlock label="Benefit" value={feat.benefit}/>

        {feat.normal && <InfoBlock label="Normal" value={feat.normal}/>}
        {feat.special && <InfoBlock label="Special" value={feat.special}/>}
        {feat.note && <InfoBlock label="Note" value={feat.note}/>}

        {(feat.goal || feat.completionBenefit) && (
            <>
                <Divider/>
                {feat.goal && <InfoBlock label="Goal" value={feat.goal}/>}
                {feat.completionBenefit && (
                    <InfoBlock label="Completion Benefit" value={feat.completionBenefit}/>
                )}
            </>
        )}

        {feat.requires.length > 0 && (
            <>
                <Divider/>
                <Stack gap={8}>
                    <Group gap="xs" align="baseline">
                        <Text size="xs" tt="uppercase" fw={700} c="dimmed" style={{letterSpacing: "0.06em"}}>
                            Requires
                        </Text>
                        <Text size="xs" c="dimmed">({feat.requires.length})</Text>
                    </Group>
                    <SimpleGrid cols={{base: 2, xs: 3}} spacing={6}>
                        {feat.requires.map((r) => (
                            <Paper
                                key={r.id}
                                withBorder
                                p="xs"
                                onClick={() => navigate(`/feats/${r.id}`)}
                                style={{cursor: "pointer"}}
                            >
                                <Text size="xs" fw={500} c="teal.4" lineClamp={2} lh={1.35}>
                                    {r.name}{r.note ? ` (${r.note})` : ""}
                                </Text>
                            </Paper>
                        ))}
                    </SimpleGrid>
                </Stack>
            </>
        )}

        {feat.requiredBy.length > 0 && (
            <>
                <Divider/>
                <Stack gap={8}>
                    <Group gap="xs" align="baseline">
                        <Text size="xs" tt="uppercase" fw={700} c="dimmed" style={{letterSpacing: "0.06em"}}>
                            Required by
                        </Text>
                        <Text size="xs" c="dimmed">({feat.requiredBy.length})</Text>
                    </Group>
                    <SimpleGrid cols={{base: 2, xs: 3}} spacing={6}>
                        {feat.requiredBy.map((r) => (
                            <Paper
                                key={r.id}
                                withBorder
                                p="xs"
                                onClick={() => navigate(`/feats/${r.id}`)}
                                style={{cursor: "pointer"}}
                            >
                                <Text size="xs" fw={500} c="teal.4" lineClamp={2} lh={1.35}>
                                    {r.name}
                                </Text>
                            </Paper>
                        ))}
                    </SimpleGrid>
                </Stack>
            </>
        )}

        <Divider/>
        <Text size="xs" c="dimmed" ta="right">Source: {feat.source}</Text>
    </Stack>;
};

export const FeatModal: FC = () => {
    const {id} = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [opened, setOpened] = useState(true);

    return <Modal
        opened={opened}
        onClose={() => setOpened(false)}
        transitionProps={{onExited: () => navigate("/feats")}}
        title={null}
        size="lg"
        scrollAreaComponent={ScrollArea.Autosize}
    >
        {id && <FeatContent key={id} id={id}/>}
    </Modal>;
};
