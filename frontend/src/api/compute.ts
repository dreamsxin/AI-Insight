/** Compute API calls - neural network, CNN, transformer. */

import { apiGet, apiPost } from "./client";
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
