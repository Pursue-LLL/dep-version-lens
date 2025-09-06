import axios, { AxiosInstance, AxiosError } from 'axios';
import { ConfigManager } from './config';

export interface NpmPackageInfo {
    name: string;
    version: string;
    versions: { [version: string]: any };
    description?: string;
    homepage?: string;
}

export class NpmVersionService {
    private static instance: NpmVersionService;
    private client: AxiosInstance;
    private cache = new Map<string, { data: NpmPackageInfo; timestamp: number }>();
    private readonly retryDelays = [1000, 2000, 4000];
    private readonly maxRetries = 3;

    private constructor() {
        this.client = axios.create({
            timeout: 10000,
            headers: {
                'User-Agent': 'Version-Lens-VSCode-Extension/1.0.0'
            }
        });
    }

    static getInstance(): NpmVersionService {
        if (!NpmVersionService.instance) {
            NpmVersionService.instance = new NpmVersionService();
        }
        return NpmVersionService.instance;
    }

    async getLatestVersion(packageName: string): Promise<string | null> {
        const packageInfo = await this.getPackageInfo(packageName);
        return packageInfo?.version || null;
    }

    async getPackageInfo(packageName: string): Promise<NpmPackageInfo | null> {
        // 检查缓存
        if (this.isCacheValid(packageName)) {
            return this.cache.get(packageName)!.data;
        }

        try {
            const data = await this.fetchWithRetry(packageName);
            if (data) {
                this.updateCache(packageName, data);
            }
            return data;
        } catch (error) {
            console.error(`Failed to fetch npm package info for ${packageName}:`, error);
            return null;
        }
    }

    clearCache(): void {
        this.cache.clear();
    }

    isCacheValid(packageName: string): boolean {
        const cached = this.cache.get(packageName);
        if (!cached) return false;

        const config = ConfigManager.getInstance().getConfig();
        const now = Date.now();
        return (now - cached.timestamp) < config.cacheTimeout;
    }

    private async fetchWithRetry(packageName: string, retryCount = 0): Promise<NpmPackageInfo | null> {
        // 使用npm registry API
        const url = `https://registry.npmjs.org/${encodeURIComponent(packageName)}`;

        try {
            const response = await this.client.get(url);
            return this.transformResponse(response.data);
        } catch (error) {
            if (retryCount < this.maxRetries && this.shouldRetry(error as AxiosError)) {
                await this.delay(this.retryDelays[retryCount] || 4000);
                return this.fetchWithRetry(packageName, retryCount + 1);
            }
            throw error;
        }
    }

    private shouldRetry(error: AxiosError): boolean {
        if (!error.response) return true; // 网络错误，重试
        const status = error.response.status;
        // 只对服务器错误和限流重试，404表示包不存在，不需要重试
        return status >= 500 || status === 429;
    }

    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    private transformResponse(data: any): NpmPackageInfo {
        return {
            name: data.name,
            version: data['dist-tags']?.latest || Object.keys(data.versions || {}).pop() || '',
            versions: data.versions || {},
            description: data.description || '',
            homepage: data.homepage || ''
        };
    }

    private updateCache(packageName: string, data: NpmPackageInfo): void {
        this.cache.set(packageName, {
            data,
            timestamp: Date.now()
        });
    }
}