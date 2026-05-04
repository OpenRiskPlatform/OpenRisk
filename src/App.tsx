import { RouterProvider, createRouter } from "@tanstack/react-router";
import { Toaster } from "sonner";
import { routeTree } from "./routeTree.gen";

// Create router instance
const router = createRouter({ routeTree });

// Register router for type safety
declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

function App() {
  return (
    <>
      <RouterProvider router={router} />
      <Toaster position="bottom-left" richColors closeButton expand />
    </>
  );
}

export default App;
