import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ClerkProvider } from "@clerk/react";
import App from "./App.tsx";
import "./index.css";

const clerkPublishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

if (!clerkPublishableKey) {
  console.error("Missing VITE_CLERK_PUBLISHABLE_KEY. Clerk may never finish loading.");
}

createRoot(document.getElementById("root")!).render(
	<StrictMode>
		<ClerkProvider publishableKey={clerkPublishableKey} afterSignOutUrl="/">
			<App />
		</ClerkProvider>
	</StrictMode>
);
