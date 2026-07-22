/** Application entry point. */

import "./styles/global.css";
import "./styles/components.css";
import { App } from "./core/App";

const app = new App(document.getElementById("app")!);
app.init();
