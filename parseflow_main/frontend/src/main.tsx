import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ClerkProvider } from "@clerk/react";
import App from "./App.tsx";
import "./index.css";

const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

if (!publishableKey) {
	throw new Error("Missing VITE_CLERK_PUBLISHABLE_KEY. Add it to your frontend env file.");
}

createRoot(document.getElementById("root")!).render(
	<StrictMode>
		<ClerkProvider publishableKey={publishableKey} afterSignOutUrl="/login">
			<App />
		</ClerkProvider>
	</StrictMode>
);
