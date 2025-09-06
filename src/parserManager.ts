import * as vscode from 'vscode';
import { IParserManager, IPackageParser, PackageInfo } from './types';
import { RequirementsParser } from './parsers/requirementsParser';
import { PyprojectParser } from './parsers/pyprojectParser';
import { SetupParser } from './parsers/setupParser';
import { PipfileParser } from './parsers/pipfileParser';
import { PackageJsonParser } from './parsers/packageJsonParser';
import { shouldExcludePackage } from './utils';
import { ConfigManager } from './config';

export class ParserManager implements IParserManager {
    private static instance: ParserManager;
    private parsers: IPackageParser[];

    private constructor() {
        this.parsers = [
            new RequirementsParser(),
            new PyprojectParser(),
            new SetupParser(),
            new PipfileParser(),
            new PackageJsonParser()
        ];
    }

    static getInstance(): ParserManager {
        if (!ParserManager.instance) {
            ParserManager.instance = new ParserManager();
        }
        return ParserManager.instance;
    }

    parseDocument(document: vscode.TextDocument): PackageInfo[] {
        const parser = this.parsers.find(p => p.canParse(document));
        if (!parser) return [];

        const packages = parser.parse(document);
        return this.filterPackages(packages);
    }

    getSupportedFileTypes(): string[] {
        const config = ConfigManager.getInstance().getConfig();
        return config.supportedFiles;
    }

    private filterPackages(packages: PackageInfo[]): PackageInfo[] {
        const config = ConfigManager.getInstance().getConfig();
        return packages.filter(pkg => !shouldExcludePackage(pkg.name, config.excludePatterns));
    }
}