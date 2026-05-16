import { createHashRouter, RouterProvider } from "react-router-dom";
import { FeatModal } from "./pages/FeatModal";
import { Feats } from "./pages/Feats";
import { Home } from "./pages/Home";
import { SpellModal } from "./pages/SpellModal";
import { Spells } from "./pages/Spells";
import { Shell } from "./Shell";

const router = createHashRouter([
    {
        element: <Shell />,
        children: [
            { path: "/", element: <Home /> },
            {
                path: "/spells",
                element: <Spells />,
                children: [{ path: ":id", element: <SpellModal /> }],
            },
            {
                path: "/feats",
                element: <Feats />,
                children: [{ path: ":id", element: <FeatModal /> }],
            },
        ],
    },
]);

function App() {
    return <RouterProvider router={router} />;
}

export default App;
