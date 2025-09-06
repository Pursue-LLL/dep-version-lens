import * as vscode from 'vscode';
import * as TOML from '@iarna/toml';
import { IPackageParser, PackageInfo } from '../types';
import { parseVersionSpec, parsePEP508PackageSpec, isValidPythonPackageName } from '../utils';

export class PyprojectParser implements IPackageParser {
    canParse(document: vscode.TextDocument): boolean {
        return document.fileName.toLowerCase().endsWith('pyproject.toml');
    }

    parse(document: vscode.TextDocument): PackageInfo[] {
        const packages: PackageInfo[] = [];
        const content = document.getText();
        
        console.log(`Parsing pyproject.toml: ${document.fileName}`);
        
        try {
            const parsed = TOML.parse(content);
            
            // 解析PEP 621格式 [project.dependencies]
            this.parsePEP621Dependencies(parsed, packages, document);
            
            // 解析Poetry格式 [tool.poetry.dependencies]
            this.parsePoetryDependencies(parsed, packages, document);
            
        } catch (error) {
            console.error('Failed to parse pyproject.toml:', error);
        }

        console.log(`Parsed ${packages.length} packages from pyproject.toml:`, packages.map(p => p.name));
        return packages;
    }

    private parsePEP621Dependencies(parsed: any, packages: PackageInfo[], document: vscode.TextDocument): void {
        const project = parsed.project;
        if (!project) return;

        // 解析标准依赖
        const deps = project.dependencies;
        if (Array.isArray(deps)) {
            deps.forEach((dep: string) => {
                const pkg = this.parseDepString(dep, document);
                if (pkg) packages.push(pkg);
            });
        }

        // 解析 override-dependencies
        const overrideDeps = project['override-dependencies'];
        if (Array.isArray(overrideDeps)) {
            overrideDeps.forEach((dep: string) => {
                const pkg = this.parseDepString(dep, document);
                if (pkg) packages.push(pkg);
            });
        }

        // 解析 dev-dependencies
        const devDeps = project['dev-dependencies'];
        if (Array.isArray(devDeps)) {
            devDeps.forEach((dep: string) => {
                const pkg = this.parseDepString(dep, document);
                if (pkg) packages.push(pkg);
            });
        }
    }

    private parsePoetryDependencies(parsed: any, packages: PackageInfo[], document: vscode.TextDocument): void {
        // 解析 Poetry 主依赖
        const mainDeps = parsed.tool?.poetry?.dependencies;
        if (mainDeps && typeof mainDeps === 'object') {
            this.parsePoetrySection(mainDeps, packages, document);
        }
        
        // 解析 Poetry 开发依赖
        const devDeps = parsed.tool?.poetry?.group?.dev?.dependencies;
        if (devDeps && typeof devDeps === 'object') {
            this.parsePoetrySection(devDeps, packages, document);
        }
    }

    private parsePoetrySection(deps: any, packages: PackageInfo[], document: vscode.TextDocument): void {
        Object.entries(deps).forEach(([name, version]) => {
            if (name === 'python') return;
            
            const pkg = this.parsePoetryDep(name, version as any, document);
            if (pkg) packages.push(pkg);
        });
    }

    private parseDepString(depString: string, document: vscode.TextDocument): PackageInfo | null {
        const parsed = parsePEP508PackageSpec(depString);
        if (!parsed) return null;

        const { fullName, baseName, versionPart } = parsed;
        
        // 验证基础包名格式
        if (!isValidPythonPackageName(baseName)) {
            console.log(`Skipping invalid package name in parser: ${baseName}`);
            return null;
        }
        
        const { operator, version } = parseVersionSpec(versionPart);
        return this.createPackageInfo(fullName, version, operator, document, depString, baseName);
    }

    private parsePoetryDep(name: string, version: any, document: vscode.TextDocument): PackageInfo | null {
        const basePackageName = name.split('[')[0]; // 提取基础包名
        
        // 验证基础包名格式，过滤掉无效的包名
        if (!isValidPythonPackageName(basePackageName)) {
            console.log(`Skipping invalid package name in parser: ${basePackageName}`);
            return null;
        }
        
        let versionStr = '';
        let searchText = '';
        
        if (typeof version === 'string') {
            // 简单字符串版本: package = "^1.0.0"
            versionStr = version;
            searchText = `${name} = "${versionStr}"`;
        } else if (typeof version === 'object' && version !== null) {
            // 对象格式的依赖
            if (version.version) {
                // 标准对象格式: package = { version = "^1.0.0", extras = ["extra"] }
                versionStr = version.version;
                searchText = `${name} = {`;
            } else {
                // 其他对象格式（如git、path等），无法提取版本信息
                console.log(`Skipping non-version dependency ${name}: ${JSON.stringify(version)}`);
                return null; // 跳过这些依赖，因为它们没有版本信息
            }
        } else {
            // 无版本信息的依赖
            versionStr = '';
            searchText = name;
        }

        const { operator, version: cleanVersion } = parseVersionSpec(versionStr);
        return this.createPackageInfo(name, cleanVersion, operator, document, searchText, basePackageName);
    }

    private createPackageInfo(name: string, version: string | null, operator: string, document: vscode.TextDocument, searchText: string, basePackageName?: string): PackageInfo {
        const content = document.getText();
        const lineIndex = this.findLineIndex(content, searchText);
        const line = content.split('\n')[lineIndex] || '';
        const startChar = line.indexOf(name);
        
        return {
            name,
            basePackageName: basePackageName || name, // 用于版本查询的基础包名
            currentVersion: version,
            latestVersion: '',
            line: lineIndex,
            startChar: Math.max(0, startChar),
            endChar: startChar + name.length + (version ? version.length + operator.length : 0),
            isOutdated: false,
            versionConstraint: operator,
            filePath: document.fileName
        };
    }

    private findLineIndex(content: string, searchText: string): number {
        const lines = content.split('\n');
        
        // 首先尝试精确匹配
        let lineIndex = lines.findIndex(line => line.includes(searchText));
        
        if (lineIndex === -1) {
            // 如果精确匹配失败，尝试匹配包名
            const packageName = searchText.split('=')[0].trim();
            lineIndex = lines.findIndex(line => {
                const trimmedLine = line.trim();
                return trimmedLine.startsWith(packageName + ' =') || 
                       trimmedLine.startsWith(packageName + '=');
            });
        }
        
        return Math.max(0, lineIndex);
    }


}