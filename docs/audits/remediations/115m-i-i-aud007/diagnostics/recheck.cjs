// Read-only path adapter for accepted F/G/H diagnostics, never modifies prior evidence.
// AUD007_BUILD_ROOT=<disposable built checkout> node <this script> f|g|h <original args...>
const fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const root=path.resolve(__dirname,'../../../../..'),buildRoot=process.env.AUD007_BUILD_ROOT||root;
const modes={f:'115m-i-f-aud001-aud002/f6/diagnostics/independent.cjs',g:'115m-i-g-acceptance/diagnostics/integrated.cjs',h:'115m-i-h-aud004/diagnostics/acceptance.cjs'};
const mode=process.argv[2];if(!modes[mode])throw new Error('select f, g or h');
const filename=path.join(root,'docs/audits/remediations',modes[mode]);
let source=fs.readFileSync(filename,'utf8');
const patterns={f:"path.resolve(__dirname, '../../../../../..')",g:"path.resolve(__dirname, '../../../../..')",h:"path.resolve(__dirname,'../../../../..')"};
if(!source.includes(patterns[mode]))throw new Error('original root marker changed');
source=source.replace(patterns[mode],JSON.stringify(buildRoot));
if(mode==='f')source=source.replace('dist/auralprint_0.1.15m.i.f.html','dist/auralprint_0.1.15m.i.h.html');
// H originally samples presentation immediately after canonical source settlement.
// Wait for its normal RAF projection; no UI/source mutation or forced refresh.
if(mode==='h')source=source.replace("const status=await p.locator('#audioStatus').textContent();","await p.waitForFunction(()=>/permission|denied/i.test(document.getElementById('audioStatus').textContent));const status=await p.locator('#audioStatus').textContent();");
process.argv=[process.argv[0],filename,...process.argv.slice(3)];
const diagnostic=new Module(filename,module);diagnostic.filename=filename;diagnostic.paths=module.paths;diagnostic._compile(source,filename);
