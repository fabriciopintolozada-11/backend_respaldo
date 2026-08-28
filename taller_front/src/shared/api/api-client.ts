import axios from 'axios';
import { httpClient } from './http-client';

/**
 * Centralized API Client (Standardized HTTP Client Layer)
 * Provides typed responses, interceptors, simulated network delays, and event subscriptions.
 */

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  timestamp: string;
}

export interface ApiError {
  success: false;
  errorCode: string;
  message: string;
  details?: unknown;
}

export class ApiClientError extends Error {
  readonly errorCode: string;
  readonly details?: unknown;

  constructor(error: ApiError) {
    super(error.message);
    this.name = 'ApiClientError';
    this.errorCode = error.errorCode;
    this.details = error.details;
  }
}

export const isBackendMode = import.meta.env.VITE_DATA_SOURCE !== 'mock';

class ApiClient {
  private delayMs = 180;

  private async simulateNetwork(): Promise<void> {
    if (this.delayMs <= 0) return;
    await new Promise((resolve) => setTimeout(resolve, this.delayMs));
  }

  private async request<T>(path: string, method: 'GET' | 'POST' | 'PATCH', payload?: unknown): Promise<ApiResponse<T>> {
    await this.simulateNetwork();

    try {
      const response = await httpClient.request<T>({
        url: path,
        method,
        data: payload,
      });

      return {
        success: true,
        data: response.data,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      if (axios.isAxiosError(error)) {
         throw new ApiClientError({
          success: false,
          errorCode: error.response ? `HTTP_${error.response.status}` : 'NETWORK_ERROR',
          message: error.response?.data?.message || error.message || 'Error al consultar la API',
          details: error.response?.data,
         });
      }

       throw new ApiClientError({
        success: false,
        errorCode: 'REQUEST_ERROR',
        message: 'Error inesperado al consultar la API',
       });
    }
  }

  async getHttp<T>(path: string): Promise<ApiResponse<T>> {
    return this.request<T>(path, 'GET');
  }

  async postHttp<T, R>(path: string, payload: T): Promise<ApiResponse<R>> {
    return this.request<R>(path, 'POST', payload);
  }

  async patchHttp<T, R>(path: string, payload: T): Promise<ApiResponse<R>> {
    return this.request<R>(path, 'PATCH', payload);
  }

  async get<T>(fetcher: () => T): Promise<ApiResponse<T>> {
    await this.simulateNetwork();
    try {
      const data = fetcher();
      return {
        success: true,
        data,
        timestamp: new Date().toISOString(),
      };
    } catch (err) {
      throw new ApiClientError({
        success: false,
        errorCode: 'FETCH_ERROR',
        message: err instanceof Error ? err.message : 'Error al consultar datos',
      });
    }
  }

  async post<T, R>(mutator: (payload: T) => R, payload: T): Promise<ApiResponse<R>> {
    await this.simulateNetwork();
    try {
      const result = mutator(payload);
      return {
        success: true,
        data: result,
        timestamp: new Date().toISOString(),
      };
    } catch (err) {
      throw new ApiClientError({
        success: false,
        errorCode: 'MUTATION_ERROR',
        message: err instanceof Error ? err.message : 'Error al procesar la solicitud',
      });
    }
  }

  async put<T, R>(mutator: (payload: T) => R, payload: T): Promise<ApiResponse<R>> {
    return this.post(mutator, payload);
  }

  async delete<T, R>(mutator: (payload: T) => R, payload: T): Promise<ApiResponse<R>> {
    return this.post(mutator, payload);
  }
}

export const apiClient = new ApiClient();
