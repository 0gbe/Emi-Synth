import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { SynthApp } from "@/components/synth/synth-app";
import "./styles.css";

const root = document.getElementById("app");
if (!root) throw new Error("Missing #app");

createRoot(root).render(
  <StrictMode>
    <SynthApp />
  </StrictMode>,
);
