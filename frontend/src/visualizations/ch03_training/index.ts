/** Ch3 - 调教神经网络的方法: visualization exports. */

import { registerViz } from "../registry";
import { LossFunctionViz } from "./LossFunctionViz";
import { GradientDescentViz } from "./GradientDescentViz";
import { BackpropViz } from "./BackpropViz";

registerViz("LossFunctionViz", LossFunctionViz);
registerViz("GradientDescentViz", GradientDescentViz);
registerViz("BackpropViz", BackpropViz);

export { LossFunctionViz, GradientDescentViz, BackpropViz };
