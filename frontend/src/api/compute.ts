/** Compute API calls - neural network, CNN, transformer. */

import { apiDelete, apiGet, apiPost } from "./client";
import type {
  NNForwardRequest,
  NNForwardResponse,
  NNTrainRequest,
  NNTrainResponse,
  ConvolveRequest,
  ConvolveResponse,
  PoolingRequest,
  PoolingResponse,
  AttentionRequest,
  AttentionResponse,
  Term,
  NNTrainStepRequest,
  NNTrainStepResponse,
  DatasetInfo,
  DatasetResponse,
  SavedModelSummary,
  SavedModelDetail,
  SaveModelRequest,
} from "@/types/api";

// Neural Network
export const nnForward = (req: NNForwardRequest, signal?: AbortSignal) =>
  apiPost<NNForwardResponse>("/compute/nn/forward", req, signal);

export const nnTrain = (req: NNTrainRequest, signal?: AbortSignal) =>
  apiPost<NNTrainResponse>("/compute/nn/train", req, signal);

// CNN
export const cnnConvolve = (req: ConvolveRequest, signal?: AbortSignal) =>
  apiPost<ConvolveResponse>("/compute/cnn/convolve", req, signal);

export const cnnPool = (req: PoolingRequest, signal?: AbortSignal) =>
  apiPost<PoolingResponse>("/compute/cnn/pool", req, signal);

// Transformer
export const transformerAttention = (req: AttentionRequest, signal?: AbortSignal) =>
  apiPost<AttentionResponse>("/compute/transformer/attention", req, signal);

export const fetchTerms = async (signal?: AbortSignal): Promise<Term[]> => {
  const data = await apiGet<{ terms: Term[] }>("/terms", signal);
  return data.terms;
};

export const fetchTerm = (id: number, signal?: AbortSignal): Promise<Term> =>
  apiGet<Term>(`/terms/${id}`, signal);

// Stepwise training
export const nnTrainStep = (req: NNTrainStepRequest, signal?: AbortSignal) =>
  apiPost<NNTrainStepResponse>("/compute/nn/train/step", req, signal);

// Datasets
export const fetchDatasets = (signal?: AbortSignal): Promise<DatasetInfo[]> => {
  return apiGet<{ datasets: DatasetInfo[] }>("/compute/nn/datasets", signal).then(
    (d) => d.datasets,
  );
};

export const fetchDataset = (name: string, signal?: AbortSignal): Promise<DatasetResponse> =>
  apiGet<DatasetResponse>(`/compute/nn/datasets/${name}`, signal);

// Saved models
export const fetchSavedModels = (signal?: AbortSignal): Promise<SavedModelSummary[]> => {
  return apiGet<{ models: SavedModelSummary[] }>("/compute/nn/models", signal).then(
    (m) => m.models,
  );
};

export const saveModel = (req: SaveModelRequest, signal?: AbortSignal): Promise<SavedModelSummary> =>
  apiPost<SavedModelSummary>("/compute/nn/models", req, signal);

export const loadModel = (id: string, signal?: AbortSignal): Promise<SavedModelDetail> =>
  apiGet<SavedModelDetail>(`/compute/nn/models/${id}`, signal);

export const removeModel = (id: string, signal?: AbortSignal): Promise<{ id: string; deleted: boolean }> =>
  apiDelete<{ id: string; deleted: boolean }>(`/compute/nn/models/${id}`, signal);
