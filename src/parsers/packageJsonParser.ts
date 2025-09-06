import * as vscode from 'vscode';
import { IPackageParser, PackageInfo } from '../types';

export class PackageJsonParser implements IPackageParser {
    canParse(document: vscode.TextDocument): boolean {
        const fileName = document.fileName.toLowerCase();
        return fileName.endsWith('package.json');
    }

    parse(document: vscode.TextDocument): PackageInfo[] {
        const packages: PackageInfo[] = [];
        const content = document.getText();
        
        console.log(`Parsing package.json: ${document.fileName}`);
        
        try {
            const parsed = JSON.parse(content);
            
            // 解析 dependencies
            if (parsed.dependencies) {
                this.parseDependencies(parsed.dependencies, packages, document, 'dependencies');
            }
            
            // 解析 devDependencies
            if (parsed.devDependencies) {
                this.parseDependencies(parsed.devDependencies, packages, document, 'devDependencies');
            }
            
            // 解析 peerDependencies
            if (parsed.peerDependencies) {
                this.parseDependencies(parsed.peerDependencies, packages, document, 'peerDependencies');
            }
            
        } catch (error) {
            console.error('Failed to parse package.json:', error);
        }

        console.log(`Parsed ${packages.length} packages from package.json:`, packages.map(p => p.name));
        return packages;
    }

    private parseDependencies(deps: any, packages: PackageInfo[], document: vscode.TextDocument, section: string): void {
        Object.entries(deps).forEach(([name, version]) => {
            const pkg = this.parsePackage(name, version as string, document, section);
            if (pkg) packages.push(pkg);
        });
    }

    private parsePackage(name: string, version: string, document: vscode.TextDocument, section: string): PackageInfo | null {
        // 验证包名格式 (npm包名规则)
        if (!this.isValidNpmPackageName(name)) {
            console.log(`Skipping invalid npm package name: ${name}`);
            return null;
        }
        
        // 解析版本信息
        const { operator, cleanVersion } = this.parseNpmVersion(version);
        
        // 查找在文档中的位置
        const lineInfo = this.findPackageLocation(document, name, section);
        
        return {
            name,
            basePackageName: name, // npm包名就是基础包名
            currentVersion: cleanVersion,
            latestVersion: '',
            line: lineInfo.line,
            startChar: lineInfo.startChar,
            endChar: lineInfo.endChar,
            isOutdated: false,
            versionConstraint: operator,
            filePath: document.fileName
        };
    }

    private isValidNpmPackageName(name: string): boolean {
        // npm包名规则：可以包含字母、数字、连字符、下划线、点号和斜杠（用于scoped包）
        const npmPackageRegex = /^(@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/;
        return npmPackageRegex.test(name);
    }

    private parseNpmVersion(version: string): { operator: string; cleanVersion: string } {
        // 处理npm版本格式：^1.0.0, ~1.0.0, >=1.0.0, 1.0.0, latest等
        const versionRegex = /^([~^>=<]*)(.+)$/;
        const match = version.match(versionRegex);
        
        if (match) {
            return {
                operator: match[1] || '',
                cleanVersion: match[2]
            };
        }
        
        return {
            operator: '',
            cleanVersion: version
        };
    }

    private findPackageLocation(document: vscode.TextDocument, packageName: string, section: string): { line: number; startChar: number; endChar: number } {
        const content = document.getText();
        const lines = content.split('\n');
        
        let inSection = false;
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmedLine = line.trim();
            
            // 检查是否进入目标section
            if (trimmedLine.includes(`"${section}"`)) {
                inSection = true;
                continue;
            }
            
            // 如果在section中，查找包名
            if (inSection) {
                // 精确匹配包名（避免部分匹配）
                const packagePattern = new RegExp(`"${packageName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"\\s*:`);
                if (packagePattern.test(line)) {
                    const startChar = line.indexOf(`"${packageName}"`);
                    const endChar = line.length;
                    return { line: i, startChar, endChar };
                }
                
                // 检查是否离开了section（遇到闭合大括号）
                if (trimmedLine === '}') {
                    inSection = false;
                }
            }
        }
        
        // 如果没找到，返回默认值
        return { line: 0, startChar: 0, endChar: 0 };
    }
}