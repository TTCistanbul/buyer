// cardreader.js — shared business-card reader for scan.html and index.html (Tayvan Ticaret Merkezi İstanbul).
// Gemini (Firebase AI Logic, project buyer-c7221) reads the photo and returns every fully visible card;
// fixCard() then applies rules learned from real Turkish fair cards. Exposes window.CardReader.
const FIREBASE_CONFIG={apiKey:"AIzaSyDCm-mdbt8zoA5sTk84OsTA8EHR337mmyI",authDomain:"buyer-c7221.firebaseapp.com",projectId:"buyer-c7221",storageBucket:"buyer-c7221.firebasestorage.app",messagingSenderId:"69344593670",appId:"1:69344593670:web:8bcc15ab876ee062e48087"};
// Fraud Defense (reCAPTCHA Enterprise) SITE key (public) for Firebase App Check — must be the key registered in Firebase > App Check.
const RECAPTCHA_SITE_KEY="6Lfs2C8uAAAAAK7mqkzGVxOqQD6NxuUd_nFHBTxa";
const GEMINI_MODELS=["gemini-3.6-flash","gemini-3.5-flash-lite","gemini-2.5-flash"];
const V="13.4.0", B=`https://www.gstatic.com/firebasejs/${V}/`;

/* ---------- helpers ---------- */
const fold=s=>String(s||"").toLocaleLowerCase("tr").normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/ı/g,"i");
const titleCase=s=>s.split(/\s+/).map(w=>w?w.charAt(0).toLocaleUpperCase("tr")+w.slice(1).toLocaleLowerCase("tr"):w).join(" ");
const FREEMAIL=["gmail","hotmail","yahoo","outlook","yandex","icloud","live","msn","mynet","windowslive","superonline","ttmail","protonmail","aol","gmx","ymail","googlemail"];
const CITIES=["İstanbul","Ankara","İzmir","Bursa","Kocaeli","Konya","Gaziantep","Kayseri","Antalya","Adana","Mersin","Manisa","Denizli","Eskişehir","Sakarya","Tekirdağ","Samsun","Trabzon","Hatay","Kahramanmaraş","Balıkesir","Aydın","Muğla","Malatya","Diyarbakır","Şanlıurfa","Çorum","Afyonkarahisar","Kütahya","Uşak","Bolu","Düzce","Edirne","Kırklareli","Çanakkale","Zonguldak","Ordu","Rize","Erzurum","Van","Sivas","Tokat","Yalova","Bilecik","Karaman","Aksaray","Niğde","Nevşehir","Isparta","Burdur","Osmaniye","Kırıkkale","Kırşehir","Elazığ","Batman","Mardin","Gebze"];
function normPhone(raw){
  raw=String(raw).replace(/\([^)]*\)/g," ").replace(/\s*(pbx|hat|ext|dahili)\b.*$/i,"");
  let d=raw.replace(/[^\d+]/g,""); const plus=d.startsWith("+"); d=d.replace(/\+/g,"");
  if(d.startsWith("0090")) d=d.slice(2);
  if(d.length===13&&d.startsWith("900")) d="90"+d.slice(3);
  if(d.length===12&&d.startsWith("90")) d=d.slice(2);
  else if(d.length===11&&d.startsWith("0")) d=d.slice(1);
  else if(!(d.length===10&&/^[2-5]/.test(d))) return {num:(plus?"+":"")+d,mobile:false,tr:false};
  return {num:`+90 ${d.slice(0,3)} ${d.slice(3,6)} ${d.slice(6,8)} ${d.slice(8)}`,mobile:d.startsWith("5"),tr:true};
}
const IST_DISTRICTS=["adalar","arnavutkoy","atasehir","avcilar","bagcilar","bahcelievler","bakirkoy","basaksehir","bayrampasa","besiktas","beykoz","beylikduzu","beyoglu","buyukcekmece","catalca","cekmekoy","esenler","esenyurt","eyupsultan","eyup","fatih","gaziosmanpasa","gungoren","kadikoy","kagithane","kartal","kucukcekmece","maltepe","pendik","sancaktepe","sariyer","silivri","sultanbeyli","sultangazi","sile","sisli","tuzla","umraniye","uskudar","zeytinburnu","maslak","merter","levent","ikitelli","dudullu","gayrettepe","mecidiyekoy","halkali","ayazaga"];
const FIXCASE=w=>(w.length>1&&w===w.toLocaleUpperCase("tr")&&/[A-ZÇĞİÖŞÜ]/.test(w))?titleCase(w):w;
// Clean one card returned by Gemini, using rules learned from real Turkish cards.
function fixCard(r,defaultCountry){
  const str=v=>(v==null?"":String(v)).replace(/\s+/g," ").trim();
  const o={}; ["firstName","lastName","jobTitle","company","address","city","country"].forEach(k=>o[k]=str(r[k]));
  // names: "Nihat İMİR" -> "Nihat İmir", "Tunç KILINÇEL" -> "Tunç Kılınçel" (Turkish I/ı, İ/i)
  o.firstName=o.firstName.split(" ").map(FIXCASE).join(" "); o.lastName=o.lastName.split(" ").map(FIXCASE).join(" ");
  if(!o.lastName&&o.firstName.includes(" ")){ const w=o.firstName.split(" "); o.lastName=w.pop(); o.firstName=w.join(" "); }
  // email / website
  const em=str(r.email).toLowerCase().replace(/\s/g,"").match(/[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}/);
  o.email=em?em[0]:"";
  const dom=o.email&&!FREEMAIL.some(f=>o.email.split("@")[1].startsWith(f+"."))?o.email.split("@")[1]:"";
  let sites=str(r.website).toLowerCase().split(/[\s,;•|]+/).map(x=>x.replace(/^https?:\/\//,"").replace(/\/$/,"")).filter(x=>/\.[a-z]{2,}/.test(x));
  o.website=(dom&&sites.find(x=>x.includes(dom)))||sites[0]||(dom?"www."+dom:"");
  // phones: classify by the number itself (TR 5xx = mobile), never keep the fax
  const fax=new Set(str(r.fax).split(/[,;\/]| {2,}/).map(x=>normPhone(x).num).filter(Boolean));
  const mob=[],land=[];
  [r.mobile,r.phone,r.otherPhones].forEach((v,i)=>str(v).split(/[,;]| \/ /).forEach(x=>{ x=x.trim(); if(!x) return;
    const p=normPhone(x); if(!p.num||p.num.replace(/\D/g,"").length<10||fax.has(p.num)) return;
    if(p.tr) (p.mobile?mob:land).push(p.num); else if(x.startsWith("+")) (i===0?mob:land).push(p.num); }));  // tax no. etc. dropped
  o.mobile=[...new Set(mob)][0]||""; o.phone=[...new Set(land)][0]||"";
  // city: districts / "İST." -> İstanbul; province names canonical
  const fc=fold(o.city), fa=fold(o.address);
  if(IST_DISTRICTS.includes(fc)||/^ist\.?$/.test(fc)||/istanbul/.test(fc)||(!o.city&&(/\bist\.?$/.test(fa)||/istanbul/.test(fa)))) o.city="İstanbul";
  const cc=CITIES.find(c=>fold(c)===fold(o.city)); if(cc) o.city=cc==="Gebze"?"Kocaeli":cc;
  // country: Türkiye / TURKIYE / Turkey -> the page default
  if(/^(turkiye|turkey|tr)$/.test(fold(o.country))||(!o.country&&o.city)) o.country=defaultCountry||"Turkey";
  o.raw=str(r.raw)?String(r.raw).trim():""; if(str(r.other)) o.raw=(o.raw?o.raw+"\n":"")+"[Not] "+str(r.other);
  return o;
}

/* ---------- Gemini ---------- */
let ready=null;
function init(){
  if(ready) return ready;
  ready=(async()=>{
    const {initializeApp}=await import(B+"firebase-app.js");
    const {getAI,getGenerativeModel,GoogleAIBackend}=await import(B+"firebase-ai.js");
    const app=initializeApp(FIREBASE_CONFIG,"cardreader");
    if(RECAPTCHA_SITE_KEY){ const {initializeAppCheck,ReCaptchaEnterpriseProvider}=await import(B+"firebase-app-check.js");
      // The web app is registered in App Check with Fraud Defense (reCAPTCHA Enterprise); classic reCAPTCHA v3 is retired.
      initializeAppCheck(app,{provider:new ReCaptchaEnterpriseProvider(RECAPTCHA_SITE_KEY),isTokenAutoRefreshEnabled:true}); }
    return {ai:getAI(app,{backend:new GoogleAIBackend()}),getGenerativeModel};
  })();
  ready.catch(()=>{ ready=null; });
  return ready;
}
  const F=["firstName","lastName","jobTitle","company","email","mobile","phone","otherPhones","fax","website","address","city","country","other","raw"];
  const one={type:"object",properties:{...Object.fromEntries(F.map(k=>[k,{type:"string"}])),
    box:{type:"array",items:{type:"integer"},description:"[ymin,xmin,ymax,xmax] of this card in the photo, 0-1000"},
    rotation:{type:"integer",description:"clockwise degrees (0,90,180,270) to turn the card so its text is upright"}},required:[...F,"box","rotation"]};
  const schema={type:"object",properties:{cards:{type:"array",items:one}},required:["cards"]};
  const PROMPT=`You read business cards photographed by trade-office staff at fairs in Türkiye. Most cards are Turkish companies; text may be Turkish, English or both.

WHICH CARDS
- One photo often shows several cards lying on a table. Return one entry in "cards" for EVERY card whose name AND at least one contact detail are fully visible.
- Skip cards that are cut off at the photo edge, hidden under another card, or too blurred to read. Never mix lines from two different cards.
- For each card give "box" = [ymin,xmin,ymax,xmax] (0-1000, relative to the photo) and "rotation" = clockwise degrees needed to make its text upright (cards are sometimes photographed sideways).

FIELDS (use "" when not on the card; never guess or invent)
- firstName = all given names ("Murat George", "Mehmet Ali"); lastName = family name. Turkish cards often print the surname in CAPITALS: write it in normal case using Turkish rules (İMİR → İmir, KILINÇEL → Kılınçel, ŞAHİN → Şahin, DEREBAĞ → Derebağ). Keep ç ğ ı İ ö ş ü.
- jobTitle exactly as printed (Turkish titles stay Turkish, e.g. "Kurucu Ortak", "Firma Yetkilisi").
- company = the legal company name if printed ("... Ltd. Şti.", "... San. ve Tic. A.Ş.", "... LTD."), even when it is small, vertical, or under the logo; otherwise the brand name in the logo. If the card shows two brands, take the one that matches the e-mail domain and put the other brand in "other".
- email: copy carefully, letter by letter. website: without http://; if several, the one matching the e-mail domain first.
- Phones: write Turkish numbers as +90 XXX XXX XX XX (0532… or 0212.481… → +90 532 …, +90 212 …). mobile = GSM/Cep/mobile icon, or any Turkish number starting with 5 (e.g. +90 5xx). phone = Tel/landline/PBX (Turkish numbers starting with 2, 3 or 4). Extra numbers → otherPhones. Fax (Fax, F:, Faks, printer icon) → fax only. Drop notes like "(pbx)", "(4 hat)". A tax number ("VD", "Vergi Dairesi") is NOT a phone.
- address = the street address of the Turkish head office (the first/main one if several offices are listed), without city and country, postal code included. Other offices → "other".
- city = the province (İl): districts and neighbourhoods such as Esenler, Merter, Üsküdar, Kartal, Sarıyer, Ümraniye, Maslak, Arnavutköy belong to İstanbul; "İST." means İstanbul. country in English ("Turkey" for Türkiye).
- other = anything useful that has no field (second brand, other offices, products, tax office).
- raw = all text of that card, line by line.`;
  const BACK=`\n\nThe photos are the FRONT and the BACK of ONE card: return exactly one entry in "cards" combining both sides (box [0,0,1000,1000], rotation 0).`;

// dataUrls: JPEG data: URLs (one photo, or front+back of one card when opts.back).
// Returns [{f:{firstName,lastName,jobTitle,company,email,mobile,phone,website,address,city,country,raw}, box, rot}]
async function read(dataUrls,opts={}){
  const {ai,getGenerativeModel}=await init();
  const parts=[{text:PROMPT+(opts.back?BACK:"")}, ...dataUrls.map(u=>({inlineData:{mimeType:"image/jpeg",data:String(u).split(",")[1]}}))];
  let last;
  for(const m of GEMINI_MODELS){
    try{
      const model=getGenerativeModel(ai,{model:m,generationConfig:{responseMimeType:"application/json",responseJsonSchema:schema,temperature:0}});
      const res=await model.generateContent(parts);
      const r=JSON.parse(res.response.text());
      return (Array.isArray(r.cards)?r.cards:[r]).map(x=>({f:fixCard(x,opts.country),box:x.box,rot:x.rotation}))
        .filter(x=>x.f.email||x.f.lastName||x.f.firstName||x.f.mobile||x.f.company);
    }catch(e){ last=e; const msg=String(e&&e.message||e);
      if(!/not found|404|not supported|unsupported|429|quota|RESOURCE_EXHAUSTED|503|overloaded/i.test(msg)) throw e; }
  }
  throw last;
}
// Shrink a File/Blob/Image to a JPEG data URL small enough to send.
async function fileToJpeg(file,maxSide=1600,q=.8){
  const url=URL.createObjectURL(file); const im=new Image();
  await new Promise((res,rej)=>{im.onload=res;im.onerror=rej;im.src=url;});
  const k=Math.min(1,maxSide/Math.max(im.naturalWidth,im.naturalHeight));
  const cv=document.createElement("canvas"); cv.width=Math.round(im.naturalWidth*k); cv.height=Math.round(im.naturalHeight*k);
  const ctx=cv.getContext("2d"); ctx.fillStyle="#fff"; ctx.fillRect(0,0,cv.width,cv.height); ctx.drawImage(im,0,0,cv.width,cv.height);
  URL.revokeObjectURL(url); return cv.toDataURL("image/jpeg",q);
}
window.CardReader={read,fixCard,normPhone,fileToJpeg,init};
window.dispatchEvent(new Event("cardreader-ready"));
