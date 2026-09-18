import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {demoData} from '../demo/data.mjs';
const target=new URL('../public/demo/',import.meta.url);
await mkdir(target,{recursive:true});
for(const name of ['index.html','style.css','app.mjs'])await writeFile(new URL(name,target),await readFile(new URL('../demo/'+name,import.meta.url)));
await writeFile(new URL('data.mjs',target),'export const demoData = '+JSON.stringify(demoData)+';\n');
console.log('Built self-contained synthetic demo: 10 fictional people, 2 seasons, no backend.');
