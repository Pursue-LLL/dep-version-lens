import * as vscode from 'vscode';
import { IDecorationManager, PackageInfo } from './types';

export class DecorationManager implements IDecorationManager {
  private static instance: DecorationManager;
  private codeLensProvider: PythonVersionCodeLensProvider;
  private enabled: boolean = true;
  private isLoading: boolean = false;

  private constructor() {
    this.codeLensProvider = new PythonVersionCodeLensProvider();
  }

  static getInstance(): DecorationManager {
    if (!DecorationManager.instance) {
      DecorationManager.instance = new DecorationManager();
    }
    return DecorationManager.instance;
  }

  createVersionLens(editor: vscode.TextEditor, packages: PackageInfo[]): void {
    this.codeLensProvider.setPackages(packages);
    // CodeLens会自动刷新
  }

  setLoading(loading: boolean): void {
    this.isLoading = loading;
    this.codeLensProvider.setLoading(loading);
  }

  getLoading(): boolean {
    return this.isLoading;
  }

  clearDecorations(): void {
    this.codeLensProvider.clearPackages();
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) {
      this.codeLensProvider.clearPackages();
    }
    this.codeLensProvider.refresh();
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  updateDecoration(editor: vscode.TextEditor): void {
    // 简化：直接重新解析整个文档
    const parserManager = require('./parserManager').ParserManager.getInstance();
    const packages = parserManager.parseDocument(editor.document);
    this.createVersionLens(editor, packages);
  }

  registerCodeLensProvider(): vscode.Disposable {
    return vscode.languages.registerCodeLensProvider(
      [
        { pattern: '**/requirements*.txt' },
        { pattern: '**/pyproject.toml' },
        { pattern: '**/setup.py' },
        { pattern: '**/Pipfile' },
        { pattern: '**/package.json' }
      ],
      this.codeLensProvider
    );
  }

  dispose(): void {
    this.codeLensProvider.clearPackages();
  }
}

class PythonVersionCodeLensProvider implements vscode.CodeLensProvider {
  private packages: PackageInfo[] = [];
  private _onDidChangeCodeLenses = new vscode.EventEmitter<void>();
  public readonly onDidChangeCodeLenses = this._onDidChangeCodeLenses.event;
  private isLoading: boolean = false;

  setPackages(packages: PackageInfo[]): void {
    this.packages = packages;
    this._onDidChangeCodeLenses.fire();
  }

  clearPackages(): void {
    this.packages = [];
    this._onDidChangeCodeLenses.fire();
  }

  refresh(): void {
    this._onDidChangeCodeLenses.fire();
  }

  setLoading(loading: boolean): void {
    this.isLoading = loading;
    this._onDidChangeCodeLenses.fire();
  }

  async provideCodeLenses(document: vscode.TextDocument): Promise<vscode.CodeLens[]> {
    // 检查DecorationManager是否启用
    const decorationManager = DecorationManager.getInstance();
    if (!decorationManager.isEnabled()) {
      return [];
    }

    const codeLenses: vscode.CodeLens[] = [];
    const processedPackages = new Set<string>(); // 防止重复处理同一个包

    // 如果正在加载，显示加载状态
    if (this.isLoading && this.packages.length > 0) {
      for (const pkg of this.packages) {
        if (processedPackages.has(pkg.name)) continue;
        processedPackages.add(pkg.name);

        const range = new vscode.Range(pkg.line, 0, pkg.line, 0);
        const codeLens = new vscode.CodeLens(range);
        codeLens.command = {
          title: `$(sync~spin) 正在获取 ${pkg.name} 的版本信息...`,
          command: '',
          tooltip: '正在从仓库获取最新版本信息'
        };
        codeLenses.push(codeLens);
      }
      return codeLenses;
    }

    for (const pkg of this.packages) {
      // 跳过已处理的包
      if (processedPackages.has(pkg.name)) {
        console.log(`Skipping duplicate package: ${pkg.name}`);
        continue;
      }
      processedPackages.add(pkg.name);

      // 确保包有有效的版本信息且不是错误状态
      if (pkg.latestVersion && pkg.currentVersion && 
          pkg.latestVersion !== 'unknown' && pkg.latestVersion !== '') {
        const range = new vscode.Range(pkg.line, 0, pkg.line, 0);

        // 获取所有版本信息
        const isPackageJson = document.fileName.toLowerCase().endsWith('package.json');
        const allVersions = await this.getAllVersions(pkg.name, isPackageJson);
        if (!allVersions.length) continue;

        // 计算四种升级选项，需要传递完整的版本规范（包括约束符）
        const currentVersionSpec = pkg.versionConstraint ? 
          `${pkg.versionConstraint}${pkg.currentVersion}` : 
          pkg.currentVersion || '';
        const upgradeOptions = this.getUpgradeOptions(currentVersionSpec, allVersions);

        // 创建四种升级选项的CodeLens，去除重复版本
        const options = [
          { key: 'satisfies', icon: '✅', label: 'satisfies', version: upgradeOptions.satisfies },
          { key: 'major', icon: '🚀', label: 'major', version: upgradeOptions.major },
          { key: 'minor', icon: '📈', label: 'minor', version: upgradeOptions.minor },
          { key: 'patch', icon: '🔧', label: 'patch', version: upgradeOptions.patch }
        ];

        // 去重：相同版本号的选项只显示优先级最高的
        const versionMap = new Map<string, typeof options[0]>();
        const priority = { satisfies: 4, patch: 3, minor: 2, major: 1 }; // satisfies优先级最高
        
        options.forEach(option => {
          if (option.version) {
            // 对于satisfies选项，即使版本号相同也要显示（因为它表示满足约束的最新版本）
            // 对于其他选项，只有当版本号不同时才显示
            const shouldShow = option.key === 'satisfies' || option.version !== pkg.currentVersion;
            
            if (shouldShow) {
              const existing = versionMap.get(option.version);
              if (!existing || priority[option.key as keyof typeof priority] > priority[existing.key as keyof typeof priority]) {
                versionMap.set(option.version, option);
              }
            }
          }
        });

        // 创建CodeLens
        versionMap.forEach(option => {
          const codeLens = new vscode.CodeLens(range);
          codeLens.command = {
            title: `${option.icon} ${option.version} (${option.label})`,
            command: 'version-lens.updateToVersion',
            arguments: [pkg, option.version],
            tooltip: `更新到${option.label}版本: ${option.version}`
          };
          codeLenses.push(codeLens);
        });
      }
    }

    return codeLenses;
  }

  private async getAllVersions(packageName: string, isPackageJson: boolean = false): Promise<string[]> {
    try {
      if (isPackageJson) {
        // 使用npm版本服务
        const npmVersionService = require('./npmVersionService').NpmVersionService.getInstance();
        const packageInfo = await npmVersionService.getPackageInfo(packageName);

        if (!packageInfo || !packageInfo.versions) {
          return [];
        }

        // 获取所有版本并过滤稳定版本
        const allVersions = Object.keys(packageInfo.versions)
          .filter(v =>
            /^\d+\.\d+(\.\d+)?$/.test(v) && // 只要标准版本格式
            !v.includes('alpha') && !v.includes('beta') && !v.includes('rc') &&
            !v.includes('dev') && !v.includes('pre')
          )
          .sort((a, b) => {
            const { compareVersions } = require('./utils');
            return compareVersions(b, a); // 降序排列
          });

        return allVersions;
      } else {
        // 使用Python版本服务
        const versionService = require('./versionService').VersionService.getInstance();
        // 使用基础包名查询版本信息（去除extras部分）
        const basePackageName = packageName.split('[')[0];
        const packageInfo = await versionService.getPackageInfo(basePackageName);

        if (!packageInfo) {
          return [];
        }

        // 获取所有版本并过滤稳定版本
        const allVersions = Object.keys(packageInfo.releases)
          .filter(v =>
            /^\d+\.\d+(\.\d+)?$/.test(v) && // 只要标准版本格式
            !v.includes('a') && !v.includes('b') && !v.includes('rc') &&
            !v.includes('alpha') && !v.includes('beta') && !v.includes('dev')
          )
          .sort((a, b) => {
            const { compareVersions } = require('./utils');
            return compareVersions(b, a); // 降序排列
          });

        return allVersions;
      }
    } catch (error) {
      console.error(`Failed to get version info for ${packageName}:`, error);
      return [];
    }
  }

  private getUpgradeOptions(currentVersionSpec: string, allVersions: string[]): {
    satisfies: string | null;
    major: string | null;
    minor: string | null;
    patch: string | null;
  } {
    const { getVersionUpgradeOptions } = require('./utils');
    return getVersionUpgradeOptions(currentVersionSpec, allVersions);
  }
}