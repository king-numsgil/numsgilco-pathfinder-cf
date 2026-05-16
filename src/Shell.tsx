import { AppShell, Burger, Group, NavLink, ScrollArea, Text } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { type IconType } from "react-icons";
import { GiCompass, GiCrossedSwords, GiSpellBook } from "react-icons/gi";
import { NavLink as RouterNavLink, Outlet, useLocation } from "react-router-dom";
import * as classes from "./Shell.css";

interface NavItem {
    label: string;
    to: string;
    icon: IconType;
}

const navItems: NavItem[] = [
    { label: "Home", to: "/", icon: GiCompass },
    { label: "Spells", to: "/spells", icon: GiSpellBook },
    { label: "Feats", to: "/feats", icon: GiCrossedSwords },
];

export function Shell() {
    const [opened, { toggle, close }] = useDisclosure();
    const location = useLocation();

    const isActive = (to: string) =>
        to === "/" ? location.pathname === "/" : location.pathname.startsWith(to);

    return (
        <AppShell
            header={{ height: 60 }}
            navbar={{ width: 240, breakpoint: "sm", collapsed: { mobile: !opened } }}
            padding="md"
        >
            <AppShell.Header className={classes.header}>
                <Group h="100%" px="md" gap="sm">
                    <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" />
                    <Text className={classes.brand} fw={700} size="xl">
                        Pathfinder
                    </Text>
                </Group>
            </AppShell.Header>

            <AppShell.Navbar className={classes.navbar}>
                <ScrollArea p="md">
                    {navItems.map((item) => (
                        <NavLink
                            key={item.label}
                            component={RouterNavLink}
                            to={item.to}
                            label={item.label}
                            active={isActive(item.to)}
                            leftSection={<item.icon size={18} />}
                            onClick={close}
                            mb={4}
                        />
                    ))}
                </ScrollArea>
            </AppShell.Navbar>

            <AppShell.Main>
                <Outlet />
            </AppShell.Main>
        </AppShell>
    );
}
