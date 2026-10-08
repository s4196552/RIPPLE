/** Ripple pitch demo. Original capture pixels are composed only in the video pipeline. */
const fs = require('fs');
const path = require('path');
const {spawnSync} = require('child_process');
const sharp = require('sharp');
const OUT = path.resolve(__dirname, '..');
const ROOT = path.resolve(OUT, '../..');
const WORK = path.join(OUT, 'work');
const CAP = path.join(ROOT, 'docs/demo-screenshots');
const LOGO = path.join(ROOT, 'assets/logo/ripple-original-1.png');
const W = 1920, H = 1080, FPS = 30, transition = 0.65;
fs.mkdirSync(WORK, {recursive:true});
const esc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;');
const text = (x,y,s,size=28,color='#b8b4c9',extra='') => `<text x="${x}" y="${y}" fill="${color}" font-family="Segoe UI" font-size="${size}" ${extra}>${esc(s)}</text>`;
const title = (lines,x=132,y=340,size=78,center=false) => lines.map((s,i)=>text(x,y+i*98,s,size,'#f4efe5',`font-family="Georgia" ${center?'text-anchor="middle"':''}`.replace('font-family="Georgia"','style="font-family:Georgia"'))).join('');
const svg = body => `<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080" viewBox="0 0 1920 1080">${body}</svg>`;
const bg = (n,frame='') => svg(`<defs><radialGradient id="g"><stop stop-color="#282044"/><stop offset=".5" stop-color="#101025"/><stop offset="1" stop-color="#080911"/></radialGradient><linearGradient id="line"><stop stop-color="#dec89f" stop-opacity=".6"/><stop offset="1" stop-color="#847ab2" stop-opacity=".06"/></linearGradient><radialGradient id="spot"><stop stop-color="#3b2863" stop-opacity=".36"/><stop offset="1" stop-color="#100d22" stop-opacity="0"/></radialGradient></defs><rect width="1920" height="1080" fill="#080911"/><ellipse cx="1450" cy="400" rx="1180" ry="960" fill="url(#g)"/><ellipse cx="1410" cy="950" rx="880" ry="260" fill="url(#spot)"/>${[400,560,720,880].map(r=>`<circle cx="1475" cy="490" r="${r}" fill="none" stroke="url(#line)" stroke-width="1" opacity="${n===0||n===6?'.7':'.42'}"/>`).join('')}<path d="M132 972H1788" stroke="#65577d" stroke-opacity=".4"/><path d="M132 972H${132+(n+1)/7*1656}" stroke="#c8b68e" stroke-width="2"/>${frame}`);
const phoneFrame = (x,y,w,h) => `<rect x="${x-16}" y="${y-16}" width="${w+32}" height="${h+32}" rx="42" fill="#030408" stroke="#a79e9f" stroke-opacity=".6" stroke-width="2"/><rect x="${x-10}" y="${y-10}" width="${w+20}" height="${h+20}" rx="37" fill="#10101a" stroke="#847a8b" stroke-opacity=".35"/>`;
const panelFrame = (x,y,w,h) => `<rect x="${x-14}" y="${y-14}" width="${w+28}" height="${h+28}" rx="28" fill="#0b0918" stroke="#b5a589" stroke-opacity=".45"/>`;
const chrome = (n,label) => text(208,124,'Ripple',42,'#f3efe8','font-weight="600"')+text(1040,117,'PRODUCT WALKTHROUGH',16,'#b9b0c7','text-anchor="end" letter-spacing="3"')+text(132,1017,'PUBLIC RECORDS. MARKET CONTEXT.',17,'#ada6bc','letter-spacing="2.2"')+text(1788,1017,`${String(n+1).padStart(2,'0')}  /  07`,17,'#c9b797','text-anchor="end" letter-spacing="2"')+text(132,239,label,17,'#d1bd94','letter-spacing="4"');
const scenes = [
 {name:'opening',duration:6,kind:'title'},
 {name:'signals',duration:9,label:'01 / UNIFIED SIGNALS',heading:['One feed.','Four perspectives.'],body:['Congress. Insiders. Policy. Stocks.','Public activity, brought into focus.'],file:'06-feed-personal.png',x:1236,y:72,w:396,h:857,mode:'phone'},
 {name:'trades',duration:9,label:'02 / DISCLOSED TRADES',heading:['Every trade,','in context.'],body:['Read the disclosure.','See the price reaction.','Return to the original source.'],file:'08-trades-table.png',crop:[0,215,1170,1420],x:1028,y:183,w:730,h:886,mode:'panel'},
 {name:'timeline',duration:9,label:'03 / SHARED TIMELINE',heading:['See the sequence.','Find the context.'],body:['Bring every source onto one axis.','Explore how public events align.'],file:'11-timeline-90d.png',crop:[0,185,1170,1020],x:964,y:216,w:824,h:718,mode:'panel'},
 {name:'follow',duration:8,label:'04 / FOLLOW WHAT MATTERS',heading:['Start with','your interests.'],body:['Choose a source.','Find a person, company or topic.','Make the feed your own.'],file:'02-add-choose-source.png',second:'04-add-member-added.png',x:1236,y:72,w:396,h:857,mode:'phone'},
 {name:'watchlist',duration:9,label:'05 / PERSONAL WATCHLIST',heading:['Your people.','Your perspective.'],body:['A focused watchlist across sources.','Keep the subjects that matter close.'],file:'13-watchlist.png',x:1236,y:72,w:396,h:857,mode:'phone'},
 {name:'closing',duration:6,kind:'title'}
];
// Trade crop fits the safe area, leaving the footer clean.
scenes[2].h = 730; scenes[2].w = Math.round(730*1170/1420); scenes[2].x = 1125; scenes[2].y = 196;
function run(args) {
 const r=spawnSync('ffmpeg',['-hide_banner','-loglevel','warning','-y',...args],{cwd:WORK,stdio:'inherit'});
 if(r.status!==0) throw Error(`ffmpeg failed (${r.status})`);
}
async function png(name,body) {await sharp(Buffer.from(body)).png().toFile(path.join(WORK,name));}
async function makeAssets() {
 for(let i=0;i<scenes.length;i++) {
  const s=scenes[i];
  const frame=s.mode==='phone'?phoneFrame(s.x,s.y,s.w,s.h):s.mode==='panel'?panelFrame(s.x,s.y,s.w,s.h):'';
  await png(`${i}-bg.png`,bg(i,frame));
  let copy='';
  if(s.kind==='title') {
   copy=text(960,160,i===0?'RIPPLE / PRODUCT DEMO':'RIPPLE',19,'#d0bd95','text-anchor="middle" letter-spacing="6"');
   copy+=title(i===0?['A clearer view of','what moves markets.']:['Public records.','A clearer perspective.'],960,501,88,true);
   copy+=text(960,725,i===0?'Public disclosures. Market context. One focused feed.':'Congress  /  Insiders  /  Policy  /  Stocks',29,'#bdb6cd','text-anchor="middle"');
   copy+=text(960,1009,'CAPTURED APP INTERFACE  /  PRODUCT DEMONSTRATION',16,'#9f98b0','text-anchor="middle" letter-spacing="2"');
  } else {
   copy=chrome(i,s.label)+title(s.heading,132,374,s.name==='timeline'?70:79);
   copy+=s.body.map((b,j)=>text(136,612+j*44,b,28)).join('');
   copy+=text(136,864,'CAPTURED APP INTERFACE',15,'#9d94ac','letter-spacing="3"');
   copy+=`<path d="M136 816H470" stroke="#c4ac83" stroke-width="1"/>`;
  }
  await png(`${i}-copy.png`,svg(copy));
  if(s.file) await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${s.w}" height="${s.h}"><rect width="${s.w}" height="${s.h}" rx="${s.mode==='phone'?25:14}" fill="white"/></svg>`)).removeAlpha().png().toFile(path.join(WORK,`${i}-mask.png`));
 }
}
function encodeScene(i) {
 const s=scenes[i], D=s.duration;
 const args=['-loop','1','-framerate','30','-i',`${i}-bg.png`,'-loop','1','-framerate','30','-i',`${i}-copy.png`,'-loop','1','-framerate','30','-i',LOGO];
 let filter=`[0:v]format=rgba,setsar=1[b];[1:v]format=rgba,fade=t=in:st=0.25:d=0.7:alpha=1[c];[2:v]scale=${s.kind==='title'?116:58}:-1,format=rgba[l];`;
 if(s.file) {
  args.push('-loop','1','-framerate','30','-i',path.join(CAP,s.file),'-loop','1','-framerate','30','-i',`${i}-mask.png`);
  const crop=s.crop?`crop=${s.crop[2]}:${s.crop[3]}:${s.crop[0]}:${s.crop[1]},`:'';
  filter+=`[3:v]${crop}scale=${s.w}:${s.h}:flags=lanczos,format=rgba[p];[4:v]format=gray[m];[p][m]alphamerge[screen];[b][screen]overlay=${s.x}:${s.y}:shortest=1[withscreen];`;
  let base='withscreen';
  if(s.second) {
   args.push('-loop','1','-framerate','30','-i',path.join(CAP,s.second));
   filter+=`[5:v]scale=${s.w}:${s.h}:flags=lanczos,format=rgba,fade=t=in:st=4:d=0.45:alpha=1[next];[withscreen][next]overlay=${s.x}:${s.y}:shortest=1[twoscreens];`;
   base='twoscreens';
  }
  filter+=`[${base}][l]overlay=132:77:shortest=1[branded];[branded][c]overlay=0:0:shortest=1[composed];`;
 } else {
  filter+=`[b][l]overlay=902:242:shortest=1[branded];[branded][c]overlay=0:0:shortest=1[composed];`;
 }
 // Gentle whole-frame push; oversampling avoids stepwise motion.
 filter+=`[composed]scale=2880:1620,zoompan=z='1+0.018*on/${D*FPS}':x='iw/2-iw/zoom/2':y='ih/2-ih/zoom/2':d=1:s=1920x1080:fps=30,setsar=1,format=yuv420p[out]`;
 fs.writeFileSync(path.join(WORK,`${i}.filter`),filter);
 args.push('-filter_complex_threads','1','-/filter_complex',`${i}.filter`,'-map','[out]','-t',String(D),'-an','-c:v','libx264','-preset','fast','-crf','18','-threads','4','-pix_fmt','yuv420p',`${i}.mp4`);
 console.log(`Rendering ${i+1}/${scenes.length}: ${s.name}`); run(args);
}
function soundtrack(duration) {
 const rate=44100, count=Math.ceil(duration*rate), channels=2;
 const wav=Buffer.alloc(44+count*4);
 wav.write('RIFF',0);wav.writeUInt32LE(wav.length-8,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(channels,22);wav.writeUInt32LE(rate,24);wav.writeUInt32LE(rate*4,28);wav.writeUInt16LE(4,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(count*4,40);
 const chords=[[47,54,59,62],[43,50,57,62],[50,57,62,66],[45,52,59,64]];
 const hz=n=>440*Math.pow(2,(n-69)/12), TAU=2*Math.PI;
 const melody=[71,74,78,74,69,74,78,81,74,78,81,78,71,76,80,76];
 for(let n=0;n<count;n++) {
  const t=n/rate;let l=0,r=0;
  // Overlapping, softly voiced sustained chords with subtle stereo beating.
  for(let k=Math.max(0,Math.floor(t/8)-1);k<=Math.floor(t/8);k++) {
   const age=t-k*8;if(age<0||age>10)continue;
   const env=Math.min(1,age/2)*Math.min(1,(10-age)/2)*.023;
   chords[k%4].forEach((m,j)=>{const f=hz(m);l+=env*(Math.sin(TAU*f*t)+.18*Math.sin(TAU*f*2*t))/(1+j*.23);r+=env*(Math.sin(TAU*f*1.001*t+.2)+.18*Math.sin(TAU*f*2.001*t))/(1+j*.23);});
  }
  for(let k=Math.max(0,Math.floor(t/1.6)-3);k<=Math.floor(t/1.6);k++) {
   const age=t-k*1.6-.35;if(age<0)continue;
   const env=(1-Math.exp(-age*90))*Math.exp(-age*1.45)*.042;
   const f=hz(melody[k%melody.length]);const pluck=env*(Math.sin(TAU*f*age)+.22*Math.sin(TAU*f*2.001*age)+.08*Math.sin(TAU*f*3.99*age));
   l+=pluck*(k%2?.65:1);r+=pluck*(k%2?1:.65);
  }
  const fade=Math.min(1,t/3)*Math.min(1,(duration-t)/4);
  wav.writeInt16LE(Math.round(Math.tanh(l)*fade*26000),44+n*4);wav.writeInt16LE(Math.round(Math.tanh(r)*fade*26000),46+n*4);
 }
 fs.writeFileSync(path.join(WORK,'original-ambient.wav'),wav);
}
function finish() {
 const total=scenes.reduce((a,s)=>a+s.duration,0)-transition*(scenes.length-1);
 const args=[];scenes.forEach((s,i)=>args.push('-i',`${i}.mp4`));
 let f=scenes.map((s,i)=>`[${i}:v]settb=AVTB,setpts=PTS-STARTPTS[v${i}]`).join(';')+';';
 let elapsed=scenes[0].duration;
 for(let i=1;i<scenes.length;i++) {const offset=elapsed-transition;f+=`[${i===1?'v0':'x'+(i-1)}][v${i}]xfade=transition=fade:duration=${transition}:offset=${offset.toFixed(3)}[x${i}];`;elapsed+=scenes[i].duration-transition;}
 f+=`[x6]fade=t=in:st=0:d=0.6,fade=t=out:st=${(total-1).toFixed(3)}:d=1,format=yuv420p[out]`;
 fs.writeFileSync(path.join(WORK,'finish.filter'),f);
 console.log('Finishing transitions and silent master');
 run([...args,'-filter_complex_threads','1','-/filter_complex','finish.filter','-map','[out]','-an','-c:v','libx264','-preset','fast','-crf','17','-threads','4','-movflags','+faststart',path.join(OUT,'Ripple-Pitch-Demo-Silent-1080p.mp4')]);
 soundtrack(total);
 console.log('Mixing original ambient soundtrack');
 run(['-i',path.join(OUT,'Ripple-Pitch-Demo-Silent-1080p.mp4'),'-i','original-ambient.wav','-map','0:v','-map','1:a','-c:v','copy','-af','loudnorm=I=-23:TP=-2:LRA=7','-c:a','aac','-b:a','192k','-ar','48000','-shortest','-movflags','+faststart',path.join(OUT,'Ripple-Pitch-Demo-1080p.mp4')]);
 fs.writeFileSync(path.join(OUT,'source','scene-manifest.json'),JSON.stringify({width:W,height:H,fps:FPS,duration:total,transition,scenes},null,2));
 console.log(`Complete: ${total.toFixed(2)} seconds`);
}
(async()=>{await makeAssets();const selection=process.argv.find(a=>a.startsWith('--scenes='))?.split('=')[1].split(',').map(Number);for(let i=0;i<scenes.length;i++)if(!selection||selection.includes(i))encodeScene(i);finish();})().catch(e=>{console.error(e);process.exit(1)});

