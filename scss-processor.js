import { resolve } from 'path';
import { transformer } from 'svelte-preprocess/dist/transformers/scss';

export async function processCode (file, filename, { content, attributes }) {
    const appdir = process.env.PWD || process.cwd();

    const includePaths = [
        resolve(appdir),
        resolve(appdir, 'node_modules'),
    ];

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
