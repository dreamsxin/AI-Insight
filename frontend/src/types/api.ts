/** Compute API request/response types. */

export interface LayerResult {
  index: number;
  neurons: number;
  z: number[];
  a: number[];
  weights: number[][];
  biases: number[];
}

export interface NNForwardResponse {
  layers: LayerResult[];
  output: number[];
  activation: string;
}

export interface NNForwardRequest {
  layers: number[];
  inputs: number[];
  weights?: number[][][];
  biases?: number[][];
  activation: string;
}

export interface NNTrainRequest {
  layers: number[];
  data: number[][];
  epochs: number;
  learning_rate: number;
  activation: string;
}

export interface NNTrainResponse {
  loss_history: number[];
  final_weights: number[][][];
  final_biases: number[][];
}

export interface ConvolveRequest {
  image: number[][];
  kernel: number[][];
  stride: number;
  padding: number;
}

export interface ConvolveResponse {
  output: number[][];
  steps: ConvolveStep[];
}

export interface ConvolveStep {
  row: number;
  col: number;
  receptive_field: number[][];
  result: number;
}

export interface PoolingRequest {
  feature_map: number[][];
  pool_size: number;
  stride: number;
  mode: string;
}

export interface PoolingResponse {
  output: number[][];
  steps: PoolStep[];
}

export interface PoolStep {
  row: number;
  col: number;
  region: number[][];
  result: number;
}

export interface AttentionRequest {
  sequence: number[][];
  causal_mask: boolean;
}

export interface AttentionResponse {
  q: number[][];
  k: number[][];
  v: number[][];
  scores: number[][];
  weights: number[][];
  output: number[][];
}

export interface Term {
  id: number;
  zh: string;
  en: string;
  category: string;
  short: string;
  detail: string;
}
