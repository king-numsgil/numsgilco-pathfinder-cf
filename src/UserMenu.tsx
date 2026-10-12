import { Avatar, Button, Menu, UnstyledButton } from "@mantine/core";
import type { FC } from "react";
import { FaDiscord } from "react-icons/fa";
import { authClient, signInWithDiscord, signOut } from "./api/auth";

export const UserMenu: FC = () => {
    const {data: session, isPending} = authClient.useSession();

    if (isPending) {
        return null;
    }
    if (!session) {
        return <Button
            size="xs"
            variant="light"
            color="indigo"
            leftSection={<FaDiscord size={16}/>}
            onClick={() => void signInWithDiscord()}
        >
            Sign in
        </Button>;
    }

    return <Menu position="bottom-end" withArrow>
        <Menu.Target>
            <UnstyledButton aria-label="Account">
                <Avatar src={session.user.image} alt={session.user.name} name={session.user.name} size="md"/>
            </UnstyledButton>
        </Menu.Target>
        <Menu.Dropdown>
            <Menu.Label>{session.user.name}</Menu.Label>
            <Menu.Item onClick={() => void signOut()}>Sign out</Menu.Item>
        </Menu.Dropdown>
    </Menu>;
};
