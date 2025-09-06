import * as assert from 'assert';
import * as vscode from 'vscode';
import { RequirementsParser } from '../../parsers/requirementsParser';

suite('RequirementsParser Test Suite', () => {
    let parser: RequirementsParser;

    setup(() => {
        parser = new RequirementsParser();
    });

    test('Should identify requirements.txt files', () => {
        const mockDoc = {
            fileName: '/path/to/requirements.txt'
        } as vscode.TextDocument;
        
        assert.ok(parser.canParse(mockDoc));
    });

    test('Should parse package with version', () => {
        const content = 'requests==2.28.0\nnumpy>=1.21.0\ndjango~=4.0.0';
        const mockDoc = {
            fileName: 'requirements.txt',
            getText: () => content
        } as vscode.TextDocument;

        const packages = parser.parse(mockDoc);
        
        assert.strictEqual(packages.length, 3);
        assert.strictEqual(packages[0].name, 'requests');
        assert.strictEqual(packages[0].currentVersion, '2.28.0');
        assert.strictEqual(packages[0].versionConstraint, '==');
    });

    test('Should skip comments and empty lines', () => {
        const content = '# This is a comment\n\nrequests==2.28.0\n# Another comment';
        const mockDoc = {
            fileName: 'requirements.txt',
            getText: () => content
        } as vscode.TextDocument;

        const packages = parser.parse(mockDoc);
        
        assert.strictEqual(packages.length, 1);
        assert.strictEqual(packages[0].name, 'requests');
    });

    test('Should handle packages without versions', () => {
        const content = 'requests\nnumpy\ndjango';
        const mockDoc = {
            fileName: 'requirements.txt',
            getText: () => content
        } as vscode.TextDocument;

        const packages = parser.parse(mockDoc);
        
        assert.strictEqual(packages.length, 3);
        assert.strictEqual(packages[0].currentVersion, null);
    });
});