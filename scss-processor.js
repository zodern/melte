import { resolve } from 'path';
import { transformer } from 'svelte-preprocess/dist/transformers/scss';

const appdir = process.cwd();

const includePaths = [
    resolve(appdir),
    resolve(appdir, 'node_modules'),
];

export async function processCode (file, filename, { content }) {
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
