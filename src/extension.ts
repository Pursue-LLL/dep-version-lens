import * as vscode from 'vscode';
import { ConfigManager } from './config';
import { FileWatcher } from './fileWatcher';
import { ParserManager } from './parserManager';
import { DecorationManager } from './decorationManager';
import { VersionService } from './versionService';
import { NpmVersionService } from './npmVersionService';
import { PackageInfo } from './types';

// 全局状态管理
let fileWatcher: FileWatcher;
let isVersionLensesEnabled = true; // 默认开启
let toggleCommand: vscode.Disposable | undefined;
let refreshTimer: NodeJS.Timeout | undefined;

// 显示定时消息的函数
function showTimedMessage(message: string, duration: number = 3000, type: 'info' | 'warning' | 'error' = 'info') {
  const showMessage = type === 'warning' ? vscode.window.showWarningMessage : 
                     type === 'error' ? vscode.window.showErrorMessage : 
                     vscode.window.showInformationMessage;
  
  showMessage(message);
  
  // 使用状态栏显示临时消息
  const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBarItem.text = message;
  statusBarItem.show();
  
  setTimeout(() => {
    statusBarItem.dispose();
  }, duration);
}

// 命令处理器映射
const commandHandlers = {
  showVersionLenses: () => toggleVersionLenses(true),
  hideVersionLenses: () => toggleVersionLenses(false),
  refreshVersions,
  updatePackage,
  updateToVersion,
  toggleVersionLenses: () => toggleVersionLensesState(),
  toggleVersionLensesOff: () => toggleVersionLensesState()
};

export function activate(context: vscode.ExtensionContext) {
  console.log('Dep Version Lens extension activated');

  const configManager = ConfigManager.getInstance();
  const decorationManager = DecorationManager.getInstance();

  // 初始化状态
  decorationManager.setEnabled(isVersionLensesEnabled);
  updateToggleCommandState();

  // 初始化文件监控
  fileWatcher = new FileWatcher();
  fileWatcher.onFileChanged(handleFileChange);
  fileWatcher.startWatching();

  // 注册CodeLens提供器
  const codeLensProvider = decorationManager.registerCodeLensProvider();
  context.subscriptions.push(codeLensProvider);

  // 注册所有命令
  Object.entries(commandHandlers).forEach(([id, handler]) => {
    const disposable = vscode.commands.registerCommand(`version-lens.${id}`, handler);
    context.subscriptions.push(disposable);
  });

  // 监听编辑器变化，自动为支持的文件类型启用版本提示
  const editorChangeListener = vscode.window.onDidChangeActiveTextEditor(editor => {
    if (editor && isSupportedFile(editor.document) && isVersionLensesEnabled) {
      // 延迟一点执行，确保编辑器完全加载
      setTimeout(() => {
        if (isVersionLensesEnabled) {
          handleFileChange(editor.document);
        }
      }, 100);
    }
  });
  context.subscriptions.push(editorChangeListener);

  // 监听文档内容变化，实时刷新版本信息
  const documentChangeListener = vscode.workspace.onDidChangeTextDocument(event => {
    if (isVersionLensesEnabled && isSupportedFile(event.document)) {
      // 使用防抖避免频繁刷新
      debounceRefresh(event.document);
    }
  });
  context.subscriptions.push(documentChangeListener);

  // 监听配置变化
  const configListener = vscode.workspace.onDidChangeConfiguration(event => {
    if (event.affectsConfiguration('versionLens')) {
      configManager.refresh();
      fileWatcher.stopWatching();
      fileWatcher.startWatching(); // 重新启动监控以应用新配置
      console.log('Configuration updated');
    }
  });

  context.subscriptions.push(configListener);

  // 如果当前编辑器是支持的文件类型，自动启用
  const activeEditor = vscode.window.activeTextEditor;
  if (activeEditor && isSupportedFile(activeEditor.document) && isVersionLensesEnabled) {
    handleFileChange(activeEditor.document);
  }
}

export function deactivate() {
  if (fileWatcher) {
    fileWatcher.stopWatching();
  }
  if (refreshTimer) {
    clearTimeout(refreshTimer);
  }
  DecorationManager.getInstance().dispose();
    console.log('Dep Version Lens extension deactivated');
}

function checkEnabled(): boolean {
  const config = ConfigManager.getInstance().getConfig();
  if (!config.enabled) {
    showTimedMessage('Dep Version Lens is disabled in settings', 3000, 'warning');
    return false;
  }
  return true;
}

function toggleVersionLenses(show: boolean) {
  if (!checkEnabled()) return;

  const decorationManager = DecorationManager.getInstance();
  isVersionLensesEnabled = show;

  // 立即更新DecorationManager的状态
  decorationManager.setEnabled(show);

  if (show) {
    const editor = vscode.window.activeTextEditor;
    if (editor && isSupportedFile(editor.document)) {
      handleFileChange(editor.document);
    }
    showTimedMessage('✅ 依赖版本更新提示已开启', 3000);
  } else {
    showTimedMessage('👁️ 依赖版本更新提示已关闭', 3000);
  }

  updateToggleCommandState();
}

function toggleVersionLensesState() {
  if (!checkEnabled()) return;

  isVersionLensesEnabled = !isVersionLensesEnabled;
  toggleVersionLenses(isVersionLensesEnabled);
}

function updateToggleCommandState() {
  // 更新命令的图标和标题以反映当前状态
  vscode.commands.executeCommand('setContext', 'version-lens.lensesEnabled', isVersionLensesEnabled);

  // 强制刷新当前编辑器的CodeLens
  const editor = vscode.window.activeTextEditor;
  if (editor) {
    vscode.commands.executeCommand('vscode.executeCodeLensProvider', editor.document.uri);
  }
}

function refreshVersions() {
  if (!checkEnabled()) return;

  const editor = vscode.window.activeTextEditor;
  if (editor && isSupportedFile(editor.document)) {
    // 清除缓存以强制重新获取版本信息
    const versionService = VersionService.getInstance();
    const npmVersionService = NpmVersionService.getInstance();
    versionService.clearCache();
    npmVersionService.clearCache();
    
    // 重新加载版本信息
    handleFileChange(editor.document);
    
    showTimedMessage('🔄 正在刷新版本信息...', 3000);
  } else {
    showTimedMessage('请打开支持的依赖文件 (requirements.txt, pyproject.toml, setup.py, Pipfile, package.json)', 3000, 'warning');
  }
}

async function updatePackage(packageInfoJson?: string) {
  if (!checkEnabled()) return;

  if (packageInfoJson) {
    try {
      const packageInfo = JSON.parse(packageInfoJson);
      const updateManager = require('./updateManager').UpdateManager.getInstance();
      await updateManager.updatePackageVersion(packageInfo, packageInfo.latestVersion);
    } catch (error) {
      vscode.window.showErrorMessage('Failed to update package');
    }
  } else {
    vscode.window.showInformationMessage('Update Package executed');
  }
}

async function updateToVersion(packageInfo: any, version: string) {
  if (!checkEnabled()) return;

  try {
    const { UpdateManager } = require('./updateManager');
    const updateManager = UpdateManager.getInstance();
    const success = await updateManager.updatePackageVersion(packageInfo, version);

    if (success) {
      // 刷新当前文档的版本信息
      const editor = vscode.window.activeTextEditor;
      if (editor) {
        setTimeout(() => handleFileChange(editor.document), 100);
      }
    }
  } catch (error) {
    showTimedMessage(`更新包版本失败: ${error}`, 3000, 'error');
  }
}

// 导入工具函数
import { isValidPythonPackageName as validatePackageName } from './utils';

function isValidPythonPackageName(name: string): boolean {
  // 提取基础包名（去除extras部分）
  const baseName = name.split('[')[0];
  return validatePackageName(baseName);
}

function isSupportedFile(document: vscode.TextDocument): boolean {
  const fileName = document.fileName.toLowerCase();
  const baseName = fileName.split('/').pop() || '';

  return (fileName.endsWith('.txt') && baseName.includes('requirements')) ||
    fileName.endsWith('pyproject.toml') ||
    fileName.endsWith('setup.py') ||
    baseName === 'pipfile' ||
    baseName === 'package.json';
}

async function handleFileChange(document: vscode.TextDocument) {
  if (!checkEnabled() || !isVersionLensesEnabled) return;

  console.log(`File changed: ${document.fileName}`);

  const editor = vscode.window.activeTextEditor;
  if (!editor || editor.document !== document) return;

  const parserManager = ParserManager.getInstance();
  const decorationManager = DecorationManager.getInstance();
  const versionService = VersionService.getInstance();
  const npmVersionService = NpmVersionService.getInstance();

  // 解析文档获取包信息
  const allPackages = parserManager.parseDocument(document);

  // 去重：同一个包名只保留第一个出现的
  const packageMap = new Map<string, PackageInfo>();
  allPackages.forEach(pkg => {
    if (!packageMap.has(pkg.name)) {
      packageMap.set(pkg.name, pkg);
    }
  });
  const packages = Array.from(packageMap.values());

  console.log(`Parsed ${allPackages.length} packages, after dedup: ${packages.length}`);

  // 如果有包需要处理，先显示加载状态
  if (packages.length > 0) {
    decorationManager.setLoading(true);
    decorationManager.createVersionLens(editor, packages);
  }

  // 判断文件类型来选择合适的版本服务
  const isPackageJson = document.fileName.toLowerCase().endsWith('package.json');

  // 获取最新版本信息
  for (const pkg of packages) {
    // 根据文件类型验证包名格式
    if (isPackageJson) {
      // npm包名验证在parser中已经完成
    } else {
      // Python包名验证
      if (!isValidPythonPackageName(pkg.name)) {
        console.log(`Skipping invalid package name: ${pkg.name}`);
        continue;
      }
    }

    // 使用基础包名查询版本信息
    const queryPackageName = pkg.basePackageName || pkg.name.split('[')[0];
    console.log(`Getting version for: ${pkg.name} (query: ${queryPackageName})`);

    try {
      let latestVersion: string | null = null;

      if (isPackageJson) {
        latestVersion = await npmVersionService.getLatestVersion(queryPackageName);
      } else {
        latestVersion = await versionService.getLatestVersion(queryPackageName);
      }

      if (latestVersion) {
        pkg.latestVersion = latestVersion;
        console.log(`Got version for ${pkg.name}: ${latestVersion}`);
      } else {
        console.log(`No version found for ${pkg.name}`);
      }
    } catch (error) {
      console.error(`Failed to get version for ${pkg.name}:`, error);
      // 为无法获取版本的包设置当前版本，避免显示错误
      pkg.latestVersion = pkg.currentVersion || '';
    }
  }

  console.log(`Final packages with versions:`, packages.map(p => `${p.name}: ${p.currentVersion} -> ${p.latestVersion}`));

  // 关闭加载状态并创建最终的版本装饰器
  decorationManager.setLoading(false);
  decorationManager.createVersionLens(editor, packages);
  
  // 更新包信息缓存
  lastParsedPackages.set(document.fileName, packages);
}

// 存储上次解析的包信息，用于检测变化
let lastParsedPackages = new Map<string, PackageInfo[]>();

// 防抖刷新函数
function debounceRefresh(document: vscode.TextDocument) {
  if (refreshTimer) {
    clearTimeout(refreshTimer);
  }

  refreshTimer = setTimeout(() => {
    handleDocumentChange(document);
  }, 500); // 500ms 防抖延迟，给用户足够时间完成编辑
}

// 智能处理文档变化
async function handleDocumentChange(document: vscode.TextDocument) {
  if (!checkEnabled() || !isVersionLensesEnabled) return;

  const editor = vscode.window.activeTextEditor;
  if (!editor || editor.document !== document) return;

  const parserManager = ParserManager.getInstance();
  const decorationManager = DecorationManager.getInstance();
  
  // 解析当前文档获取包信息
  const currentPackages = parserManager.parseDocument(document);
  const documentKey = document.fileName;
  const lastPackages = lastParsedPackages.get(documentKey) || [];
  
  // 检测变化的包
  const changedPackages = detectPackageChanges(lastPackages, currentPackages);
  
  if (changedPackages.length > 0) {
    console.log(`Detected changes in packages:`, changedPackages.map(p => `${p.name}: ${p.currentVersion}`));
    
    // 显示加载状态
    decorationManager.setLoading(true);
    decorationManager.createVersionLens(editor, currentPackages);
    
    // 只为变化的包获取版本信息
    await updateChangedPackagesVersions(changedPackages, document);
    
    // 更新所有包的显示（包括未变化的）
    const allPackages = mergePackageVersions(currentPackages, lastPackages);
    
    // 关闭加载状态并更新显示
    decorationManager.setLoading(false);
    decorationManager.createVersionLens(editor, allPackages);
    
    // 更新缓存
    lastParsedPackages.set(documentKey, allPackages);
    
    showTimedMessage(`🔄 已更新 ${changedPackages.length} 个依赖的版本信息`, 2000);
  }
}

// 检测包变化
function detectPackageChanges(oldPackages: PackageInfo[], newPackages: PackageInfo[]): PackageInfo[] {
  const changedPackages: PackageInfo[] = [];
  const oldPackageMap = new Map<string, PackageInfo>();
  
  // 创建旧包的映射
  oldPackages.forEach(pkg => {
    oldPackageMap.set(pkg.name, pkg);
  });
  
  // 检测新增或版本变化的包
  newPackages.forEach(newPkg => {
    const oldPkg = oldPackageMap.get(newPkg.name);
    
    if (!oldPkg || oldPkg.currentVersion !== newPkg.currentVersion) {
      changedPackages.push(newPkg);
    }
  });
  
  return changedPackages;
}

// 只更新变化包的版本信息
async function updateChangedPackagesVersions(changedPackages: PackageInfo[], document: vscode.TextDocument) {
  const versionService = VersionService.getInstance();
  const npmVersionService = NpmVersionService.getInstance();
  const isPackageJson = document.fileName.toLowerCase().endsWith('package.json');
  
  for (const pkg of changedPackages) {
    // 根据文件类型验证包名格式
    if (!isPackageJson) {
      if (!isValidPythonPackageName(pkg.name)) {
        console.log(`Skipping invalid package name: ${pkg.name}`);
        continue;
      }
    }
    
    const queryPackageName = pkg.basePackageName || pkg.name.split('[')[0];
    console.log(`Updating version for changed package: ${pkg.name} (query: ${queryPackageName})`);
    
    try {
      let latestVersion: string | null = null;
      
      if (isPackageJson) {
        latestVersion = await npmVersionService.getLatestVersion(queryPackageName);
      } else {
        latestVersion = await versionService.getLatestVersion(queryPackageName);
      }
      
      if (latestVersion) {
        pkg.latestVersion = latestVersion;
        console.log(`Updated version for ${pkg.name}: ${latestVersion}`);
      } else {
        console.log(`No version found for ${pkg.name}`);
        pkg.latestVersion = pkg.currentVersion || '';
      }
    } catch (error) {
      console.error(`Failed to get version for ${pkg.name}:`, error);
      pkg.latestVersion = pkg.currentVersion || '';
    }
  }
}

// 合并包版本信息（保留未变化包的版本信息）
function mergePackageVersions(currentPackages: PackageInfo[], lastPackages: PackageInfo[]): PackageInfo[] {
  const lastPackageMap = new Map<string, PackageInfo>();
  
  // 创建上次包信息的映射
  lastPackages.forEach(pkg => {
    lastPackageMap.set(pkg.name, pkg);
  });
  
  // 合并版本信息
  return currentPackages.map(currentPkg => {
    const lastPkg = lastPackageMap.get(currentPkg.name);
    
    // 如果包没有变化且之前有版本信息，保留之前的版本信息
    if (lastPkg && lastPkg.currentVersion === currentPkg.currentVersion && lastPkg.latestVersion) {
      return {
        ...currentPkg,
        latestVersion: lastPkg.latestVersion
      };
    }
    
    return currentPkg;
  });
}