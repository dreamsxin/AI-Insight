/** Ch9 - AI 术语 (Terms): visualization exports. */

import { registerViz } from "../registry";
import { TermGridViz } from "./TermGridViz";
import { TermDetailViz } from "./TermDetailViz";

registerViz("TermGridViz", TermGridViz);
registerViz("TermDetailViz", TermDetailViz);

export { TermGridViz, TermDetailViz };
