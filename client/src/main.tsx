import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Set mapbox access token from environment variable
const mapboxToken = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN || '';

if (!mapboxToken) {
  console.warn('Mapbox access token not found. Map functionality will be limited.');
}

// Make token globally available
(window as any).MAPBOX_ACCESS_TOKEN = mapboxToken;

createRoot(document.getElementById("root")!).render(<App />);
