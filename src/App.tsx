import { createHashRouter, RouterProvider } from "react-router-dom";
import { Feats } from "./pages/Feats";
import { Home } from "./pages/Home";
import { Spells } from "./pages/Spells";
import { Shell } from "./Shell";

const router = createHashRouter([
    {
        element: <Shell />,
        children: [
            { path: "/", element: <Home /> },
            { path: "/spells", element: <Spells /> },
            { path: "/feats", element: <Feats /> },
        ],
    },
]);

function App() {
    return <RouterProvider router={router} />;
}

export default App;
