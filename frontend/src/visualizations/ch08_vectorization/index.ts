/** Ch8 - 向量化 (Vectorization): visualization exports. */

import { registerViz } from "../registry";
import { TokenizerViz } from "./TokenizerViz";
import { EmbeddingPipelineViz } from "./EmbeddingPipelineViz";
import { EmbeddingSpaceViz } from "./EmbeddingSpaceViz";

registerViz("TokenizerViz", TokenizerViz);
registerViz("EmbeddingPipelineViz", EmbeddingPipelineViz);
registerViz("EmbeddingSpaceViz", EmbeddingSpaceViz);

export { TokenizerViz, EmbeddingPipelineViz, EmbeddingSpaceViz };
