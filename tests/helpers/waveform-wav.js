// Small header fixture; declared payload bytes are modeled, never allocated.
function pcmHeader({frames=13,rate=44100,channels=2,bits=16,extensible=false}={}) {
  const fmtBytes=extensible?40:16, headerBytes=12+8+fmtBytes+8;
  const dataBytes=frames*channels*(bits/8), fileSize=headerBytes+dataBytes+(dataBytes%2);
  const bytes=new ArrayBuffer(headerBytes),v=new DataView(bytes);
  const tag=(at,s)=>[...s].forEach((c,i)=>v.setUint8(at+i,c.charCodeAt(0)));
  tag(0,'RIFF');v.setUint32(4,fileSize-8,true);tag(8,'WAVE');tag(12,'fmt ');v.setUint32(16,fmtBytes,true);
  v.setUint16(20,extensible?65534:1,true);v.setUint16(22,channels,true);v.setUint32(24,rate,true);
  v.setUint32(28,rate*channels*bits/8,true);v.setUint16(32,channels*bits/8,true);v.setUint16(34,bits,true);
  if(extensible){v.setUint16(36,22,true);v.setUint16(38,bits,true);v.setUint32(40,channels===6?63:0,true);[1,0,0,0,0,0,16,0,128,0,0,170,0,56,155,113].forEach((b,i)=>v.setUint8(44+i,b))}
  tag(headerBytes-8,'data');v.setUint32(headerBytes-4,dataBytes,true);
  return {bytes,fileSize};
}
export {pcmHeader};
