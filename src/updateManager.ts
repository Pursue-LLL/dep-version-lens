import * as vscode from 'vscode';
import { PackageInfo } from './types';
import { parseVersionSpec } from './utils';

export class UpdateManager {
    private static instance: UpdateManager;

    static getInstance(): UpdateManager {
        if (!UpdateManager.instance) {
            UpdateManager.instance = new UpdateManager();
        }
        return UpdateManager.instance;
    }

    async updatePackageVersion(packageInfo: PackageInfo, newVersion: string): Promise<boolean> {
        const editor = vscode.window.activeTextEditor;
        if (!editor) return false;

        const document = editor.document;
        const line = document.lineAt(packageInfo.line);
        const lineText = line.text;

        try {
            const updatedLine = this.replaceVersion(lineText, packageInfo, newVersion);
            
            const edit = new vscode.WorkspaceEdit();
            edit.replace(document.uri, line.range, updatedLine);
            
            const success = await vscode.workspace.applyEdit(edit);
            if (success) {
                vscode.window.showInformationMessage(`Updated ${packageInfo.name} to ${newVersion}`);
            }
            return success;
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to update ${packageInfo.name}: ${error}`);
            return false;
        }
    }

    private replaceVersion(lineText: string, packageInfo: PackageInfo, newVersion: string): string {
        const { name, currentVersion, versionConstraint = '==' } = packageInfo;
        
        if (!currentVersion) {
            return lineText.replace(name, `${name}==${newVersion}`);
        }

        const oldSpec = `${versionConstraint}${currentVersion}`;
        const newSpec = `${versionConstraint}${newVersion}`;
        return lineText.replace(oldSpec, newSpec);
    }

    async showUpdateOptions(packageInfo: PackageInfo): Promise<void> {
        const options = [
            `Update to latest (${packageInfo.latestVersion})`,
            'Choose specific version',
            'Cancel'
        ];

        const choice = await vscode.window.showQuickPick(options, {
            placeHolder: `Update ${packageInfo.name}?`
        });

        switch (choice) {
            case options[0]:
                await this.updatePackageVersion(packageInfo, packageInfo.latestVersion);
                break;
            case options[1]:
                await this.showVersionPicker(packageInfo);
                break;
        }
    }

    private async showVersionPicker(packageInfo: PackageInfo): Promise<void> {
        const version = await vscode.window.showInputBox({
            prompt: `Enter version for ${packageInfo.name}`,
            value: packageInfo.latestVersion,
            validateInput: (value) => {
                if (!value || !value.match(/^\d+\.\d+/)) {
                    return 'Please enter a valid version number (e.g., 1.2.3)';
                }
                return null;
            }
        });

        if (version) {
            await this.updatePackageVersion(packageInfo, version);
        }
    }
}