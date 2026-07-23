/** Ch3 - 调教神经网络的方法: visualization exports. */

import { registerViz } from "../registry";
import { LossFunctionViz } from "./LossFunctionViz";
import { GradientDescentViz } from "./GradientDescentViz";
import { BackpropViz } from "./BackpropViz";
import { LiveTrainViz } from "./LiveTrainViz";
import { DigitClassifyViz } from "./DigitClassifyViz";

registerViz("LossFunctionViz", LossFunctionViz);
registerViz("GradientDescentViz", GradientDescentViz);
registerViz("BackpropViz", BackpropViz);
registerViz("LiveTrainViz", LiveTrainViz);
registerViz("DigitClassifyViz", DigitClassifyViz);

export { LossFunctionViz, GradientDescentViz, BackpropViz, LiveTrainViz, DigitClassifyViz };
