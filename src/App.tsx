import type { FC } from "react";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { FeatModal } from "./pages/FeatModal";
import { Feats } from "./pages/Feats";
import { Home } from "./pages/Home";
import { SpellModal } from "./pages/SpellModal";
import { Spells } from "./pages/Spells";
import { Shell } from "./Shell";

// Old hash-router links (/#/spells/<id>?…) → /spells/<id>?…
if (window.location.hash.startsWith("#/")) {
    window.history.replaceState(null, "", window.location.hash.slice(1));
}

const router = createBrowserRouter([
    {
        element: <Shell/>,
        children: [
            {path: "/", element: <Home/>},
            {
                path: "/spells",
                element: <Spells/>,
                children: [{path: ":id", element: <SpellModal/>}],
            },
            {
                path: "/feats",
                element: <Feats/>,
                children: [{path: ":id", element: <FeatModal/>}],
            },
        ],
    },
]);

const App: FC = () => {
    return <RouterProvider router={router}/>;
};

export default App;
