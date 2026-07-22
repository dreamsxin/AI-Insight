/** Ch7 - Transformer 整体架构: visualization exports. */

import { registerViz } from "../registry";
import { ArchitectureViz } from "./ArchitectureViz";
import { EncoderDetailViz } from "./EncoderDetailViz";
import { DataFlowViz } from "./DataFlowViz";

registerViz("ArchitectureViz", ArchitectureViz);
registerViz("EncoderDetailViz", EncoderDetailViz);
registerViz("DataFlowViz", DataFlowViz);

export { ArchitectureViz, EncoderDetailViz, DataFlowViz };
