/** Ch1 - 从函数到神经网络: visualization exports. */

import { registerViz } from "../registry";
import { FunctionPlotViz } from "./FunctionPlotViz";
import { ActivationViz } from "./ActivationViz";
import { NeuronBuildViz } from "./NeuronBuildViz";

registerViz("FunctionPlotViz", FunctionPlotViz);
registerViz("ActivationViz", ActivationViz);
registerViz("NeuronBuildViz", NeuronBuildViz);

export { FunctionPlotViz, ActivationViz, NeuronBuildViz };
