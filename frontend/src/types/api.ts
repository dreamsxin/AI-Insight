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

// ---------------------------------------------------------------------------
// Stepwise training
// ---------------------------------------------------------------------------

export interface OptimizerState {
  m_w: number[][][];
  v_w: number[][][];
  m_b: number[][];
  v_b: number[][];
  t: number;
}

export interface NNTrainStepRequest {
  layers: number[];
  data: number[][];
  epochs: number;
  learning_rate: number;
  activation: string;
  seed: number;
  weights?: number[][][];
  biases?: number[][];
  return_predictions?: boolean;
  optimizer_state?: OptimizerState;
}

export interface NNTrainStepResponse {
  loss_history: number[];
  weights: number[][][];
  biases: number[][];
  predictions?: number[][];
  accuracy?: number | null;
  optimizer_state: OptimizerState;
}

// ---------------------------------------------------------------------------
// Datasets
// ---------------------------------------------------------------------------

export interface DatasetInfo {
  name: string;
  description: string;
  sample_count: number;
  input_dim: number;
  output_dim: number;
  n_classes: number;
  suggested_layers: number[];
}

export interface DatasetResponse {
  name: string;
  description: string;
  data: number[][];
  points: number[][];
  suggested_layers: number[];
  input_dim: number;
  output_dim: number;
  n_classes: number;
}

// ---------------------------------------------------------------------------
// Saved models
// ---------------------------------------------------------------------------

export interface SavedModelSummary {
  id: string;
  name: string;
  dataset: string;
  layers: number[];
  epoch: number;
  loss: number;
  accuracy?: number | null;
  created_at: string;
  updated_at: string;
}

export interface SavedModelDetail extends SavedModelSummary {
  activation: string;
  weights: number[][][];
  biases: number[][];
  optimizer_state?: OptimizerState | null;
}

export interface SaveModelRequest {
  name: string;
  dataset: string;
  layers: number[];
  activation: string;
  weights: number[][][];
  biases: number[][];
  epoch: number;
  loss: number;
  accuracy?: number | null;
  overwrite_id?: string;
  optimizer_state?: OptimizerState | null;
}
