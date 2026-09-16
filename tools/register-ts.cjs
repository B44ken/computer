const ts = require('typescript'), fs = require('fs');
for (const ext of ['.ts', '.tsx']) require.extensions[ext] = (module, file) => {
    const output = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
        fileName: file, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React, esModuleInterop: true }
    });
    module._compile(output.outputText, file);
};
// Classic JSX permits the existing gate views to be rendered in the same tests.
global.React = require('react');
