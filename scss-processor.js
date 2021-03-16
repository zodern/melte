import { resolve } from 'path';

const appdir = process.cwd();

const includePaths = [
    resolve(appdir),
    resolve(appdir, 'node_modules'),
];

export async function processCode (file, filename, { content }) {
    const transformer = require('svelte-preprocess/dist/transformers/scss');

    try {
        return await transformer({
            content,
            filename,
            options: { includePaths, sourceMap: true }
        });
    } catch (e) {
        file.error(e);
        return { code: '' };
    }
}
