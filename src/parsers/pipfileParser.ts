import * as vscode from 'vscode';
import * as TOML from '@iarna/toml';
import { IPackageParser, PackageInfo } from '../types';
import { parseVersionSpec } from '../utils';

export class PipfileParser implements IPackageParser {
    canParse(document: vscode.TextDocument): boolean {
        return document.fileName.toLowerCase().endsWith('pipfile');
    }

    parse(document: vscode.TextDocument): PackageInfo[] {
        const packages: PackageInfo[] = [];
        const content = document.getText();
        
        try {
            const parsed = TOML.parse(content);
            
            // 解析 [packages] 和 [dev-packages]
            this.parsePackageSection(parsed.packages, packages, document);
            this.parsePackageSection(parsed['dev-packages'], packages, document);
            
        } catch (error) {
            console.error('Failed to parse Pipfile:', error);
        }

        return packages;
    }

    private parsePackageSection(section: any, packages: PackageInfo[], document: vscode.TextDocument): void {
        if (!section || typeof section !== 'object') return;

        Object.entries(section).forEach(([name, version]) => {
            const packageInfo = this.parsePackageDep(name, version as any, document);
            if (packageInfo) {
                packages.push(packageInfo);
            }
        });
    }

    private parsePackageDep(name: string, version: any, document: vscode.TextDocument): PackageInfo | null {
        // 验证包名格式，过滤掉无效的包名
        if (!this.isValidPythonPackageName(name)) {
            console.log(`Skipping invalid package name in parser: ${name}`);
            return null;
        }
        
        let versionStr = '';
        
        if (typeof version === 'string') {
            versionStr = version;
        } else if (typeof version === 'object' && version.version) {
            versionStr = version.version;
        } else if (version === '*') {
            versionStr = ''; // 任意版本
        }

        const { operator, version: cleanVersion } = parseVersionSpec(versionStr);
        
        // 在文档中查找包的位置
        const content = document.getText();
        const lineIndex = this.findPackageLineIndex(content, name);
        const line = content.split('\n')[lineIndex] || '';
        const startChar = line.indexOf(name);

        return {
            name,
            currentVersion: cleanVersion || null,
            latestVersion: '',
            line: lineIndex,
            startChar: Math.max(0, startChar),
            endChar: startChar + name.length + versionStr.length,
            isOutdated: false,
            versionConstraint: operator,
            filePath: document.fileName
        };
    }

    private findPackageLineIndex(content: string, packageName: string): number {
        const lines = content.split('\n');
        return lines.findIndex(line => line.includes(`${packageName} =`)) || 0;
    }

    private isValidPythonPackageName(name: string): boolean {
        // Python包名规则：只能包含字母、数字、连字符和下划线，不能包含斜杠或@符号
        const validPattern = /^[a-zA-Z0-9_-]+$/;
        return validPattern.test(name) && !name.includes('/') && !name.includes('@');
    }
}