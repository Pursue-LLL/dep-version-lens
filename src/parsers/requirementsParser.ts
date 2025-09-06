import * as vscode from 'vscode';
import { IPackageParser, PackageInfo } from '../types';
import { parseVersionSpec, parsePEP508PackageSpec, isValidPythonPackageName } from '../utils';

export class RequirementsParser implements IPackageParser {
    canParse(document: vscode.TextDocument): boolean {
        const fileName = document.fileName.toLowerCase();
        return fileName.includes('requirements') && fileName.endsWith('.txt');
    }

    parse(document: vscode.TextDocument): PackageInfo[] {
        const packages: PackageInfo[] = [];
        const lines = document.getText().split('\n');

        lines.forEach((line, lineIndex) => {
            const packageInfo = this.parseLine(line, lineIndex, document.fileName);
            if (packageInfo) {
                packages.push(packageInfo);
            }
        });

        return packages;
    }

    private parseLine(line: string, lineIndex: number, filePath: string): PackageInfo | null {
        // 清理行内容
        const cleanLine = line.trim();
        
        // 跳过空行、注释和选项行
        if (!cleanLine || cleanLine.startsWith('#') || cleanLine.startsWith('-')) {
            return null;
        }

        // 解析 PEP 508 包规范
        const parsed = parsePEP508PackageSpec(cleanLine);
        if (!parsed) return null;

        const { fullName, baseName, versionPart } = parsed;
        
        // 验证基础包名格式
        if (!isValidPythonPackageName(baseName)) {
            console.log(`Skipping invalid package name in parser: ${baseName}`);
            return null;
        }
        
        // 解析版本规范
        const { operator, version } = parseVersionSpec(versionPart);
        
        // 计算字符位置
        const startChar = line.indexOf(fullName);
        const endChar = startChar + fullName.length + versionPart.length;

        return {
            name: fullName,
            basePackageName: baseName,
            currentVersion: version || null,
            latestVersion: '',
            line: lineIndex,
            startChar,
            endChar,
            isOutdated: false,
            versionConstraint: operator,
            filePath
        };
    }


}