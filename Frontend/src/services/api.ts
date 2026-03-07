import axios, { AxiosInstance, AxiosError } from "axios";
import {
  AircraftListResponse,
  ConflictResponse,
  PredictedConflictResponse,
  WeatherGridResponse,
  WeatherAdvisoryResponse,
  SnapshotResponse,
} from "../types";

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

class ApiService {
  private client: AxiosInstance;
  private token: string | null = null;
  private loginPromise: Promise<void> | null = null;

  constructor() {
    this.client = axios.create({
      baseURL: BASE_URL,
      timeout: 15_000,
      headers: { "Content-Type": "application/json" },
    });

    // Attach token to every request
    this.client.interceptors.request.use((config) => {
      if (this.token) config.headers.Authorization = `Bearer ${this.token}`;
      return config;
    });

    // Auto re-login on 401
    this.client.interceptors.response.use(
      (res) => res,
      async (err: AxiosError) => {
        if (err.response?.status === 401 && !this.loginPromise) {
          await this.login();
          return this.client.request(err.config!);
        }
        return Promise.reject(err);
      }
    );
  }

  async login(): Promise<void> {
    if (this.loginPromise) return this.loginPromise;
    this.loginPromise = (async () => {
      try {
        const res = await axios.post(`${BASE_URL}/api/v1/auth/token`, {
          username: "admin",
          password: "secret",
        });
        this.token = res.data.access_token;
      } catch (e) {
        console.error("[AeroIntel] Auth failed:", e);
      } finally {
        this.loginPromise = null;
      }
    })();
    return this.loginPromise;
  }

  // ── Endpoints ──────────────────────────────────────────────────────────────

  async getAircraft(): Promise<AircraftListResponse> {
    const res = await this.client.get<AircraftListResponse>("/api/v1/aircraft");
    return res.data;
  }

  async getConflicts(): Promise<ConflictResponse> {
    const res = await this.client.get<ConflictResponse>("/api/v1/conflicts");
    return res.data;
  }

  async getPredictedConflicts(): Promise<PredictedConflictResponse> {
    const res = await this.client.get<PredictedConflictResponse>("/api/v1/conflicts/predicted");
    return res.data;
  }

  async getWeather(): Promise<WeatherGridResponse> {
    const res = await this.client.get<WeatherGridResponse>("/api/v1/weather");
    return res.data;
  }

  async getWeatherAdvisories(): Promise<WeatherAdvisoryResponse> {
    const res = await this.client.get<WeatherAdvisoryResponse>("/api/v1/weather/advisories");
    return res.data;
  }

  async getSnapshot(): Promise<SnapshotResponse> {
    const res = await this.client.get<SnapshotResponse>("/api/v1/snapshot");
    return res.data;
  }

  async checkHealth(): Promise<boolean> {
    try {
      await axios.get(`${BASE_URL}/health/live`, { timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  }
}

export const api = new ApiService();
