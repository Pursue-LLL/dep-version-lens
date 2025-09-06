import * as vscode from 'vscode';
import { IFileWatcher } from './types';
import { ConfigManager } from './config';

export class FileWatcher implements IFileWatcher {
    private watchers: vscode.FileSystemWatcher[] = [];
    private debounceTimers = new Map<string, NodeJS.Timeout>();
    private changeCallback?: (document: vscode.TextDocument) => void;
    private readonly debounceDelay = 150; // 150ms防抖，更快响应

    startWatching(): void {
        this.stopWatching(); // 清理现有监听器
        
        const config = ConfigManager.getInstance().getConfig();
        const patterns = config.supportedFiles;
        
        // 为每个文件模式创建监听器
        patterns.forEach((pattern: string) => {
            const watcher = vscode.workspace.createFileSystemWatcher(`**/${pattern}`);
            
            // 监听文件变化事件
            watcher.onDidChange(uri => this.handleFileChange(uri));
            watcher.onDidCreate(uri => this.handleFileChange(uri));
            
            this.watchers.push(watcher);
        });

        // 监听文档打开和变化
        vscode.workspace.onDidOpenTextDocument(doc => this.handleDocumentEvent(doc));
        vscode.workspace.onDidChangeTextDocument(event => this.handleDocumentEvent(event.document));
    }

    stopWatching(): void {
        this.watchers.forEach(watcher => watcher.dispose());
        this.watchers = [];
        this.debounceTimers.forEach(timer => clearTimeout(timer));
        this.debounceTimers.clear();
    }

    onFileChanged(callback: (document: vscode.TextDocument) => void): void {
        this.changeCallback = callback;
    }

    private async handleFileChange(uri: vscode.Uri): Promise<void> {
        try {
            const document = await vscode.workspace.openTextDocument(uri);
            if (this.isSupportedFile(document)) {
                this.debounceFileChange(document);
            }
        } catch (error) {
            console.error('Error opening document:', error);
        }
    }

    private handleDocumentEvent(document: vscode.TextDocument): void {
        if (this.isSupportedFile(document)) {
            this.debounceFileChange(document);
        }
    }

    private debounceFileChange(document: vscode.TextDocument): void {
        const key = document.uri.toString();
        
        // 清除现有定时器
        const existingTimer = this.debounceTimers.get(key);
        if (existingTimer) {
            clearTimeout(existingTimer);
        }

        // 设置新的防抖定时器
        const timer = setTimeout(() => {
            this.debounceTimers.delete(key);
            if (this.changeCallback) {
                this.changeCallback(document);
            }
        }, this.debounceDelay);

        this.debounceTimers.set(key, timer);
    }

    private isSupportedFile(document: vscode.TextDocument): boolean {
        const config = ConfigManager.getInstance().getConfig();
        const fileName = document.fileName.toLowerCase();
        
        return config.supportedFiles.some((pattern: string) => {
            // 简单的glob模式匹配
            const regex = pattern.replace(/\*/g, '.*').replace(/\?/g, '.');
            return new RegExp(regex + '$').test(fileName);
        });
    }
}