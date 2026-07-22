/** Ch2 - 计算神经网络的参数: visualization exports. */

import { registerViz } from "../registry";
import { NetworkGraphViz } from "./NetworkGraphViz";
import { ForwardPassViz } from "./ForwardPassViz";
import { MatrixMultViz } from "./MatrixMultViz";

registerViz("NetworkGraphViz", NetworkGraphViz);
registerViz("ForwardPassViz", ForwardPassViz);
registerViz("MatrixMultViz", MatrixMultViz);

export { NetworkGraphViz, ForwardPassViz, MatrixMultViz };
