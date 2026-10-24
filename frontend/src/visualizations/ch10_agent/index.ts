/** Ch10 - Agent Playground: visualization exports. */

import { registerViz } from "../registry";
import { AgentPlaygroundViz } from "./AgentPlaygroundViz";

registerViz("AgentPlaygroundViz", AgentPlaygroundViz);

export { AgentPlaygroundViz };
