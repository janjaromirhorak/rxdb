
/**
 * Generates the package.json files for the plugins.
 * @link https://github.com/pubkey/rxdb/pull/4196#issuecomment-1364369523
 */

import path from 'path';
import fs from 'fs';
import {
    sync as rimrafSync
} from 'rimraf';
import assert from 'assert';
import { fileURLToPath } from 'node:url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function run() {
    const rootPackageJsonPath = path.join(__dirname, '../', 'package.json');
    const packageJson = JSON.parse(
        await fs.promises.readFile(
            rootPackageJsonPath
        )
    );
    const pluginsFolderPath = path.join(__dirname, '../plugins');

    const pluginsSrcFolderPath = path.join(__dirname, '../src/plugins');

    // recreate plugins folder
    await rimrafSync(pluginsFolderPath, {});
    await fs.promises.mkdir(pluginsFolderPath);

    // write package.json files
    const usedPluginNames = new Set();
    const plugins = packageJson.exports;
    Object.keys(plugins)
        .filter(pluginPath => pluginPath !== '.' && pluginPath !== './package.json')
        .forEach((pluginPath) => {
            console.log(pluginPath);
            const pluginName = pluginPath.split('/').pop();
            usedPluginNames.add(pluginName);

            // Ensure the configuration is correct and all plugins are defined equally
            const pluginRootConfig = plugins[pluginPath];
            if (pluginName !== 'core') {
                assert.strictEqual(
                    pluginRootConfig.types,
                    './dist/types/plugins/' + pluginName + '/index.d.ts'
                );
                assert.strictEqual(
                    pluginRootConfig.require,
                    './dist/cjs/plugins/' + pluginName + '/index.js'
                );
                assert.strictEqual(
                    pluginRootConfig.import,
                    './dist/esm/plugins/' + pluginName + '/index.js'
                );
                assert.strictEqual(
                    pluginRootConfig.default,
                    './dist/esm/plugins/' + pluginName + '/index.js'
                );
            }

            // write plugin package.json
            const pluginFolderName = pluginName === 'core' ? '' : 'plugins/' + pluginName + '/';
            const pluginPackageContent = {
                'name': 'rxdb-plugins-' + pluginName,
                'description': 'This package.json file is generated by the "npm run build:plugins" script, do not edit it manually!',
                'sideEffects': false,
                'types': '../../dist/types/' + pluginFolderName + 'index.d.ts',
                'exports': {
                    '.': {
                        'default': {
                            'types': './index.d.ts',
                            'import': './index.mjs',
                            'default': './index.cjs'
                        }
                    },
                    './package.json': './package.json'
                },
                'main': './index.cjs',
                'module': './index.mjs'
            };

            const pluginFolderPath = path.join(pluginsFolderPath, pluginName);
            fs.mkdirSync(pluginFolderPath);
            fs.writeFileSync(
                path.join(pluginFolderPath, 'package.json'),
                JSON.stringify(pluginPackageContent, null, 4),
                'utf-8'
            );

            // write index file
            fs.writeFileSync(
                path.join(pluginFolderPath, 'index.mjs'),
                'export * from \'../../dist/esm/' + pluginFolderName + 'index.js\';\n',
                'utf-8'
            );
            fs.writeFileSync(
                path.join(pluginFolderPath, 'index.cjs'),
                'const pkg = require(\'../../dist/cjs/' + pluginFolderName + 'index.js\');\n' +
                'module.exports = pkg;\n',
                'utf-8'
            );
            fs.writeFileSync(
                path.join(pluginFolderPath, 'index.ts'),
                'export * from \'../../dist/types/' + pluginFolderName + 'index.d.ts\';\n',
                'utf-8'
            );

            // @link https://stackoverflow.com/q/72457791/3443137
            ['ts', 'mts', 'cts'].forEach(fileEnding => {
                fs.writeFileSync(
                    path.join(pluginFolderPath, 'index.d.' + fileEnding),
                    'export * from \'../../dist/types/' + pluginFolderName + 'index\';\n',
                    'utf-8'
                );
            });


        });



    // ensure we did not forget any plugin
    const pluginsSrc = await fs.promises.readdir(pluginsSrcFolderPath);
    pluginsSrc.forEach(pluginName => {
        if (!usedPluginNames.has(pluginName)) {
            throw new Error('Plugin folders exists but is not defined in package.json: ' + pluginName);
        }
    });

}
run();
