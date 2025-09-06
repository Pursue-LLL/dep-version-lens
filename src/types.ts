import * as vscode from 'vscode';

export interface PackageInfo {
  name: string;
  basePackageName?: string; // 用于版本查询的基础包名（不包含extras）
  currentVersion: string | null;
  latestVersion: string;
  line: number;
  startChar: number;
  endChar: number;
  isOutdated: boolean;
  versionConstraint?: string;
  filePath: string;
}

export interface PyPIPackageInfo {
  name: string;
  version: string;
  releases: { [version: string]: any };
  info: {
    summary: string;
    description: string;
    home_page: string;
  };
}

export interface CacheEntry {
  packageName: string;
  versionInfo: PyPIPackageInfo;
  timestamp: number;
  ttl: number;
}

export interface ExtensionConfig {
  enabled: boolean;
  cacheTimeout: number;
  supportedFiles: string[];
  customPyPIIndex?: string;
  excludePatterns: string[];
  decorationStyle: {
    color: string;
    backgroundColor?: string;
    fontStyle?: string;
  };
}


export interface IFileWatcher {
  startWatching(): void;
  stopWatching(): void;
  onFileChanged(callback: (document: vscode.TextDocument) => void): void;
}

export interface IDecorationManager {
  createVersionLens(editor: vscode.TextEditor, packages: PackageInfo[]): void;
  clearDecorations(editor: vscode.TextEditor): void;
  updateDecoration(editor: vscode.TextEditor, packageInfo: PackageInfo): void;
}

export interface IVersionService {
  getLatestVersion(packageName: string): Promise<string | null>;
  getPackageInfo(packageName: string): Promise<PyPIPackageInfo | null>;
  clearCache(): void;
  isCacheValid(packageName: string): boolean;
}

export interface IParserManager {
  parseDocument(document: vscode.TextDocument): PackageInfo[];
  getSupportedFileTypes(): string[];
}

export interface IPackageParser {
  canParse(document: vscode.TextDocument): boolean;
  parse(document: vscode.TextDocument): PackageInfo[];
}