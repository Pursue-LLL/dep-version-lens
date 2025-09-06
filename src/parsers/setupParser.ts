import * as vscode from 'vscode';
import { IPackageParser, PackageInfo } from '../types';
import { parseVersionSpec } from '../utils';

export class SetupParser implements IPackageParser {
    canParse(document: vscode.TextDocument): boolean {
        return document.fileName.toLowerCase().endsWith('setup.py');
    }

    parse(document: vscode.TextDocument): PackageInfo[] {
        const packages: PackageInfo[] = [];
        const content = document.getText();
        
        // 使用正则表达式解析setup.py，避免复杂的AST分析
        this.parseInstallRequires(content, packages, document);
        this.parseExtrasRequire(content, packages, document);
        
        return packages;
    }

    private parseInstallRequires(content: string, packages: PackageInfo[], document: vscode.TextDocument): void {
        // 匹配 install_requires = [...]
        const installRequiresMatch = content.match(/install_requires\s*=\s*\[([\s\S]*?)\]/);
        if (!installRequiresMatch) return;

        const requiresContent = installRequiresMatch[1];
        this.extractPackagesFromList(requiresContent, packages, document);
    }

    private parseExtrasRequire(content: string, packages: PackageInfo[], document: vscode.TextDocument): void {
        // 匹配 extras_require = {...}
        const extrasMatch = content.match(/extras_require\s*=\s*\{([\s\S]*?)\}/);
        if (!extrasMatch) return;

        const extrasContent = extrasMatch[1];
        // 提取所有列表中的包
        const listMatches = extrasContent.match(/\[([\s\S]*?)\]/g);
        if (!listMatches) return;

        listMatches.forEach(listMatch => {
            const listContent = listMatch.slice(1, -1); // 移除方括号
            this.extractPackagesFromList(listContent, packages, document);
        });
    }

    private extractPackagesFromList(listContent: string, packages: PackageInfo[], document: vscode.TextDocument): void {
        // 匹配引号内的包名
        const packageMatches = listContent.match(/['"]([^'"]+)['"]/g);
        if (!packageMatches) return;

        packageMatches.forEach(match => {
            const packageSpec = match.slice(1, -1); // 移除引号
            const packageInfo = this.parsePackageSpec(packageSpec, document);
            if (packageInfo) {
                packages.push(packageInfo);
            }
        });
    }

    private parsePackageSpec(spec: string, document: vscode.TextDocument): PackageInfo | null {
        const match = spec.match(/^([a-zA-Z0-9_.-]+)(.*)$/);
        if (!match) return null;

        const packageName = match[1];
        
        // 验证包名格式，过滤掉无效的包名
        if (!this.isValidPythonPackageName(packageName)) {
            console.log(`Skipping invalid package name in parser: ${packageName}`);
            return null;
        }
        
        const versionPart = match[2].split(/[;#]/)[0].trim();
        const { operator, version } = parseVersionSpec(versionPart);

        // 在文档中查找包的位置
        const content = document.getText();
        const lineIndex = this.findPackageLineIndex(content, spec);
        const line = content.split('\n')[lineIndex] || '';
        const startChar = line.indexOf(packageName);

        return {
            name: packageName,
            currentVersion: version || null,
            latestVersion: '',
            line: lineIndex,
            startChar: Math.max(0, startChar),
            endChar: startChar + packageName.length + versionPart.length,
            isOutdated: false,
            versionConstraint: operator,
            filePath: document.fileName
        };
    }

    private findPackageLineIndex(content: string, packageSpec: string): number {
        const lines = content.split('\n');
        return lines.findIndex(line => line.includes(packageSpec)) || 0;
    }

    private isValidPythonPackageName(name: string): boolean {
        // Python包名规则：只能包含字母、数字、连字符和下划线，不能包含斜杠或@符号
        const validPattern = /^[a-zA-Z0-9_-]+$/;
        return validPattern.test(name) && !name.includes('/') && !name.includes('@');
    }
}