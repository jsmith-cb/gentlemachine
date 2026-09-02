import "./styles.css";
import { renderApp } from "./app";

const root = document.querySelector<HTMLDivElement>("#app");

if (!root) {
    throw new Error("App root element not found.");
}

renderApp(root);
