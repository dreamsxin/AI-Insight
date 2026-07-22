/** Compute API calls - neural network, CNN, transformer. */

import { apiPost } from "./client";
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
import { apiGet } from "./client";

// Neural Network
export const nnForward = (req: NNForwardRequest) =>
  apiPost<NNForwardResponse>("/compute/nn/forward", req);

export const nnTrain = (req: NNTrainRequest) =>
  apiPost<NNTrainResponse>("/compute/nn/train", req);

// CNN
export const cnnConvolve = (req: ConvolveRequest) =>
  apiPost<ConvolveResponse>("/compute/cnn/convolve", req);

export const cnnPool = (req: PoolingRequest) =>
  apiPost<PoolingResponse>("/compute/cnn/pool", req);

// Transformer
export const transformerAttention = (req: AttentionRequest) =>
  apiPost<AttentionResponse>("/compute/transformer/attention", req);

export const fetchTerms = async (): Promise<Term[]> => {
  const data = await apiGet<{ terms: Term[] }>("/terms");
  return data.terms;
};

export const fetchTerm = (id: number): Promise<Term> =>
  apiGet<Term>(`/terms/${id}`);
