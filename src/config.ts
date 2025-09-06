import * as vscode from 'vscode';
import { ExtensionConfig } from './types';

export class ConfigManager {
  private static instance: ConfigManager;
  private config: ExtensionConfig;

  private constructor() {
    this.config = this.loadConfig();
  }

  static getInstance(): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager();
    }
    return ConfigManager.instance;
  }

  getConfig(): ExtensionConfig {
    return this.config;
  }

  refresh(): void {
    this.config = this.loadConfig();
  }

  private loadConfig(): ExtensionConfig {
    const config = vscode.workspace.getConfiguration('versionLens');

    return {
      enabled: config.get('enabled', true),
      cacheTimeout: config.get('cacheTimeout', 3600000),
      supportedFiles: config.get('supportedFiles', [
        'requirements.txt',
        'requirements-*.txt',
        'pyproject.toml',
        'setup.py',
        'Pipfile',
        'package.json'
      ]),
      customPyPIIndex: config.get('customPyPIIndex', ''),
      excludePatterns: config.get('excludePatterns', []),
      decorationStyle: config.get('decorationStyle', {
        color: '#999999',
        fontStyle: 'italic'
      })
    };
  }
}