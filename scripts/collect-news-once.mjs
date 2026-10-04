import {collectOnce} from '../server/news/collector.mjs';
if(process.argv[2]!=='--once')throw Error('Explicit --once required; no automatic schedule');
console.log(JSON.stringify(await collectOnce('.data/news/catalog.json'),null,2));
