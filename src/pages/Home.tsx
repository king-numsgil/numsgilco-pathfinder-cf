import { Badge, Card, Group, SimpleGrid, Stack, Text, Title } from "@mantine/core";
import type { FC } from "react";
import { GiCrossedSwords, GiSpellBook } from "react-icons/gi";
import { Link } from "react-router-dom";
import * as classes from "./Home.css";

const features = [
    {
        icon: GiSpellBook,
        title: "Spells",
        description: "Browse the complete Pathfinder 1E spell compendium. Filter by school, class, and level.",
        to: "/spells",
        count: "15+ spells",
    },
    {
        icon: GiCrossedSwords,
        title: "Feats",
        description: "Explore every feat available in the Core Rulebook and beyond. Filter by type and prerequisites.",
        to: "/feats",
        count: "18+ feats",
    },
] as const;

export const Home: FC = () => {
    return <Stack gap="xl" maw={960}>
        <div>
            <Group gap="xs" mb={4}>
                <Badge variant="light" color="teal" size="sm" tt="uppercase" style={{letterSpacing: "0.08em"}}>
                    Pathfinder 1E
                </Badge>
            </Group>
            <Title order={1} className={classes.heroTitle}>
                The Reference You Need at the Table
            </Title>
            <Text mt="md" size="lg" c="dimmed" maw={560}>
                A fast, searchable database of Pathfinder First Edition spells and feats.
                Built for players and GMs who want answers without flipping pages.
            </Text>
        </div>

        <SimpleGrid cols={{base: 1, sm: 2}} spacing="lg">
            {features.map((feature) => (
                <Card
                    key={feature.title}
                    component={Link}
                    to={feature.to}
                    padding="xl"
                    radius="md"
                    withBorder
                    className={classes.featureCard}
                >
                    <feature.icon className={classes.featureIcon}/>
                    <Title order={3} mt="md" mb={6}>{feature.title}</Title>
                    <Text size="sm" c="dimmed" mb="md">{feature.description}</Text>
                    <Badge variant="dot" color="teal" size="sm">{feature.count}</Badge>
                </Card>
            ))}
        </SimpleGrid>
    </Stack>;
};
