import "./styles/planner.css";
import "./styles/sidebar.css";
import "./styles/employee-planning.css";
import { renderApp } from "./app";

const root = document.querySelector<HTMLDivElement>("#app");

if (!root) {
    throw new Error("App root element not found.");
}

renderApp(root);
