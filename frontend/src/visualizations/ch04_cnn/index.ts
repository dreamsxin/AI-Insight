/** Ch4 - 卷积神经网络 (CNN): visualization exports. */

import { registerViz } from "../registry";
import { ImageMatrixViz } from "./ImageMatrixViz";
import { ConvolutionViz } from "./ConvolutionViz";
import { FeatureMapViz } from "./FeatureMapViz";
import { PoolingViz } from "./PoolingViz";

registerViz("ImageMatrixViz", ImageMatrixViz);
registerViz("ConvolutionViz", ConvolutionViz);
registerViz("FeatureMapViz", FeatureMapViz);
registerViz("PoolingViz", PoolingViz);

export { ImageMatrixViz, ConvolutionViz, FeatureMapViz, PoolingViz };
