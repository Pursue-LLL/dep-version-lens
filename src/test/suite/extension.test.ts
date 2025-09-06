import * as assert from 'assert';
import * as vscode from 'vscode';

suite('Extension Test Suite', () => {
    vscode.window.showInformationMessage('Start all tests.');

    test('Extension should be present', () => {
        assert.ok(vscode.extensions.getExtension('python-version-lens.python-version-lens'));
    });

    test('Extension should activate', async () => {
        const extension = vscode.extensions.getExtension('python-version-lens.python-version-lens');
        if (extension) {
            await extension.activate();
            assert.ok(extension.isActive);
        }
    });

    test('Commands should be registered', async () => {
        const commands = await vscode.commands.getCommands(true);
        const expectedCommands = [
            'python-version-lens.showVersionLenses',
            'python-version-lens.hideVersionLenses',
            'python-version-lens.refreshVersions',
            'python-version-lens.updatePackage'
        ];

        expectedCommands.forEach(command => {
            assert.ok(commands.includes(command), `Command ${command} should be registered`);
        });
    });
});