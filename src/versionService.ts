import axios, { AxiosInstance, AxiosError } from 'axios';
import { IVersionService, PyPIPackageInfo } from './types';
import { ConfigManager } from './config';

export class VersionService implements IVersionService {
    private static instance: VersionService;
    private client: AxiosInstance;
    private cache = new Map<string, { data: PyPIPackageInfo; timestamp: number }>();
    private readonly retryDelays = [1000, 2000, 4000]; // 指数退避延迟
    private readonly maxRetries = 3;

    private constructor() {
        this.client = axios.create({
            timeout: 10000,
            headers: {
                'User-Agent': 'Python-Version-Lens-VSCode-Extension/1.0.0'
            }
        });
    }

    static getInstance(): VersionService {
        if (!VersionService.instance) {
            VersionService.instance = new VersionService();
        }
        return VersionService.instance;
    }

    async getLatestVersion(packageName: string): Promise<string | null> {
        const packageInfo = await this.getPackageInfo(packageName);
        return packageInfo?.version || null;
    }

    async getPackageInfo(packageName: string): Promise<PyPIPackageInfo | null> {
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
            console.error(`Failed to fetch package info for ${packageName}:`, error);
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

    private async fetchWithRetry(packageName: string, retryCount = 0): Promise<PyPIPackageInfo | null> {
        const config = ConfigManager.getInstance().getConfig();
        const baseUrl = config.customPyPIIndex || 'https://pypi.org';
        const url = `${baseUrl}/pypi/${packageName}/json`;

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

    private transformResponse(data: any): PyPIPackageInfo {
        return {
            name: data.info.name,
            version: data.info.version,
            releases: data.releases,
            info: {
                summary: data.info.summary || '',
                description: data.info.description || '',
                home_page: data.info.home_page || ''
            }
        };
    }

    private updateCache(packageName: string, data: PyPIPackageInfo): void {
        this.cache.set(packageName, {
            data,
            timestamp: Date.now()
        });
    }
}