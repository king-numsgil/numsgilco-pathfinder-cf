import { Badge, Divider, Modal, Stack, Text } from "@mantine/core";
import { type FC, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { feats, featTypeColors } from "../data/feats";

export const FeatModal: FC = () => {
    const {id} = useParams();
    const navigate = useNavigate();
    const [opened, setOpened] = useState(true);

    const feat = feats.find((f) => f.id === Number(id));

    if (!feat) {
        return null;
    }

    return <Modal
        opened={opened}
        onClose={() => setOpened(false)}
        transitionProps={{onExited: () => navigate("/feats")}}
        title={
            <Text fw={700} size="lg">{feat.name}</Text>
        }
        size="md"
    >
        <Stack gap="md">
            <Badge
                color={featTypeColors[feat.type] ?? "gray"}
                variant="filled"
                size="md"
                style={{alignSelf: "flex-start"}}
            >
                {feat.type}
            </Badge>

            <Stack gap={4}>
                <Text size="xs" tt="uppercase" fw={700} c="dimmed" style={{letterSpacing: "0.06em"}}>
                    Prerequisites
                </Text>
                <Text size="sm">{feat.prerequisites}</Text>
            </Stack>

            <Divider/>

            <Stack gap={4}>
                <Text size="xs" tt="uppercase" fw={700} c="dimmed" style={{letterSpacing: "0.06em"}}>
                    Benefit
                </Text>
                <Text size="sm" style={{lineHeight: 1.7}}>
                    {feat.benefit}
                </Text>
            </Stack>
        </Stack>
    </Modal>;
};
