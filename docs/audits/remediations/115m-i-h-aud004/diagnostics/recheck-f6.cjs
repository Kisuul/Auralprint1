// Execute the immutable F.6 acceptance against H's portable HTML in memory.
// Only path/root selectors change; original diagnostics and evidence remain intact.
const fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const root=path.resolve(__dirname,'../../../../..');
let source=fs.readFileSync(path.join(root,'docs/audits/remediations/115m-i-f-aud001-aud002/f6/diagnostics/independent.cjs'),'utf8');
source=source.replace("path.resolve(__dirname, '../../../../../..')", "path.resolve(__dirname, '../../../../..')").replace('dist/auralprint_0.1.15m.i.f.html','dist/auralprint_0.1.15m.i.h.html');
const recheck=new Module(__filename,module);recheck.filename=__filename;recheck.paths=module.paths;recheck._compile(source,__filename);
