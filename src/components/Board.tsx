import { useRef, useState, useEffect, useCallback } from 'react';

/* ================================================================
   DRAWDAMS — Board Component
   Infinite digital whiteboard canvas engine
   
   Fixes in this version:
   - Eraser now truly erases (compositing fixed)
   - Paste image from clipboard (Ctrl+V)
   - Math symbols panel with LaTeX-style symbols
================================================================ */

// ── Types ──
interface Point { x: number; y: number }
interface DrawElement {
  type: string;
  points?: Point[];
  x?: number; y?: number; w?: number; h?: number;
  x1?: number; y1?: number; x2?: number; y2?: number;
  stroke: string; fill: string; useFill: boolean;
  lineWidth: number; opacity: number;
  text?: string; fontFamily?: string; fontSize?: number; fontStyle?: string;
  imgEl?: HTMLImageElement; _src?: string;
}
interface UserData { name: string; email: string; photo: string }

// ── Constants ──
const QUICK_COLORS = ['#FFFFFF','#000000','#EF4444','#3B82F6','#F59E0B','#22C55E','#F97316','#8B5CF6'];
const FILL_COLORS = ['#FBBF24','#EF4444','#F97316','#3B82F6','#22C55E','#8B5CF6','#EC4899','#6C5CE7','#14B8A6','#F43F5E'];
const BG_PRESETS = [
  { bg:'#f0f2f5', label:'Blanco', dark:false, canvasBg:'#ffffff' },
  { bg:'#0f1117', label:'Negro', dark:true, canvasBg:'#0f1117' },
  { bg:'#374151', label:'Gris', dark:true, canvasBg:'#374151' },
  { bg:'#1a2744', label:'Azul oscuro', dark:true, canvasBg:'#1a2744' },
  { bg:'#2d4a3e', label:'Verde pizarrón', dark:true, canvasBg:'#2d4a3e' },
];

// ── Math symbol categories ──
const MATH_SYMBOLS = [
  { label: 'Básicos', symbols: ['+','−','×','÷','=','≠','±','∓','·','∶','∷','∸'] },
  { label: 'Relación', symbols: ['<','>','≤','≥','≪','≫','≈','≡','∝','∼','≅','≃'] },
  { label: 'Conjuntos', symbols: ['∈','∉','⊂','⊃','⊆','⊇','∅','∪','∩','∖','△','⊕'] },
  { label: 'Lógica', symbols: ['∧','∨','¬','⊤','⊥','∀','∃','∄','⊢','⊨','⟹','⟺'] },
  { label: 'Cálculo', symbols: ['∫','∬','∭','∮','∯','∂','∇','∆','∑','∏','lim','∞'] },
  { label: 'Potencias', symbols: ['²','³','⁴','⁵','⁶','⁷','⁸','⁹','ⁿ','⁻¹','√','∛'] },
  { label: 'Fracciones', symbols: ['½','⅓','⅔','¼','¾','⅛','⅜','⅝','⅞','⅙','⅚','⅕'] },
  { label: 'Griegos', symbols: ['α','β','γ','δ','ε','θ','λ','μ','π','σ','φ','ω'] },
  { label: 'Griegos May.', symbols: ['Α','Β','Γ','Δ','Ε','Θ','Λ','Μ','Π','Σ','Φ','Ω'] },
  { label: 'Geom./Otros', symbols: ['°','′','″','⊥','∥','∠','△','▲','◇','□','⬡','∗'] },
];

export default function Board({ user, onLogout }: { user: UserData; onLogout: () => void }) {
  // ══════════════════════════════════════════════════════════════
  // STATE
  // ══════════════════════════════════════════════════════════════
  const [tool, setTool] = useState('pen');
  const [darkMode, setDarkMode] = useState(false);
  const [strokeColor, setStrokeColor] = useState('#1a1d26');
  const [fillColor, setFillColor] = useState('#4f6ef7');
  const [hasFill, setHasFill] = useState(true);
  const [lineW, setLineW] = useState(3);
  const [opacityVal, setOpacityVal] = useState(100);
  const [smoothVal, setSmoothVal] = useState(6);
  const [bgType, setBgType] = useState<'dots'|'grid'|'none'>('dots');
  const [fontFam, setFontFam] = useState("'Segoe UI',system-ui,sans-serif");
  const [fontSz, setFontSz] = useState(20);
  const [fontSt, setFontSt] = useState('normal');
  const [showModal, setShowModal] = useState(false);
  const [showSB, setShowSB] = useState(true);
  const [selIdx, setSelIdx] = useState(-1);
  const [textOverlay, setTextOverlay] = useState<{left:number;top:number;cx:number;cy:number}|null>(null);
  const [toastMsg, setToastMsg] = useState('');
  const [showMathPanel, setShowMathPanel] = useState(false);
  const [mathCat, setMathCat] = useState(0);
  const toastTimer = useRef(0);

  // ══════════════════════════════════════════════════════════════
  // REFS
  // ══════════════════════════════════════════════════════════════
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);

  const vp = useRef({ x: 0, y: 0, scale: 1 });
  const els = useRef<DrawElement[]>([]);
  const undoStack = useRef<string[]>([]);
  const redoStack = useRef<string[]>([]);
  const cur = useRef<DrawElement|null>(null);
  const isDrawing = useRef(false);
  const isPanning = useRef(false);
  const spaceDown = useRef(false);
  const panOrigin = useRef({ x:0, y:0 });
  const rawPts = useRef<Point[]>([]);
  const dragMode = useRef('');
  const dragOff = useRef({ x:0, y:0 });
  const rHandle = useRef('');
  const rBBox = useRef<any>(null);
  const bgIdx = useRef(0);

  // State mirrors for canvas event handlers
  const toolR = useRef(tool);
  const darkR = useRef(darkMode);
  const strokeR = useRef(strokeColor);
  const fillR = useRef(fillColor);
  const hasFillR = useRef(hasFill);
  const lineWR = useRef(lineW);
  const opR = useRef(opacityVal/100);
  const smoothR = useRef(smoothVal);
  const bgTypeR = useRef(bgType);
  const fontFamR = useRef(fontFam);
  const fontSzR = useRef(fontSz);
  const fontStR = useRef(fontSt);
  const selIdxR = useRef(selIdx);

  // Function refs
  const redrawFn = useRef(()=>{});
  const pushUndoFn = useRef(()=>{});
  const undoFn = useRef(()=>{});
  const redoFn = useRef(()=>{});
  const resetViewFn = useRef(()=>{});
  const loadImageFn = useRef((_f:File)=>{});
  const loadImageDataURLFn = useRef((_src:string)=>{});
  const commitTextFn = useRef(()=>{});
  const setCursorFn = useRef((_c:string)=>{});

  // Sync state → refs
  useEffect(()=>{ toolR.current=tool; },[tool]);
  useEffect(()=>{ darkR.current=darkMode; },[darkMode]);
  useEffect(()=>{ strokeR.current=strokeColor; },[strokeColor]);
  useEffect(()=>{ fillR.current=fillColor; },[fillColor]);
  useEffect(()=>{ hasFillR.current=hasFill; },[hasFill]);
  useEffect(()=>{ lineWR.current=lineW; },[lineW]);
  useEffect(()=>{ opR.current=opacityVal/100; },[opacityVal]);
  useEffect(()=>{ smoothR.current=smoothVal; },[smoothVal]);
  useEffect(()=>{ bgTypeR.current=bgType; },[bgType]);
  useEffect(()=>{ fontFamR.current=fontFam; },[fontFam]);
  useEffect(()=>{ fontSzR.current=fontSz; },[fontSz]);
  useEffect(()=>{ fontStR.current=fontSt; },[fontSt]);
  useEffect(()=>{ selIdxR.current=selIdx; },[selIdx]);

  // Theme sync
  useEffect(()=>{
    document.documentElement.setAttribute('data-theme', darkMode?'dark':'light');
  },[darkMode]);

  // ══════════════════════════════════════════════════════════════
  // TOAST
  // ══════════════════════════════════════════════════════════════
  const showToast = useCallback((msg:string)=>{
    setToastMsg(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(()=>setToastMsg(''), 2400);
  },[]);
  const showToastR = useRef(showToast);
  showToastR.current = showToast;

  // ══════════════════════════════════════════════════════════════
  // COORDINATE HELPERS
  // ══════════════════════════════════════════════════════════════
  const s2c = useCallback((sx:number,sy:number)=>({
    x:(sx-vp.current.x)/vp.current.scale,
    y:(sy-vp.current.y)/vp.current.scale,
  }),[]);
  const c2s = useCallback((cx:number,cy:number)=>({
    x:cx*vp.current.scale+vp.current.x,
    y:cy*vp.current.scale+vp.current.y,
  }),[]);

  // ══════════════════════════════════════════════════════════════
  // MAIN CANVAS ENGINE
  // ══════════════════════════════════════════════════════════════
  useEffect(()=>{
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if(!canvas||!wrap) return;
    const ctx = canvas.getContext('2d')!;

    function ptr(e:PointerEvent){
      const r=canvas!.getBoundingClientRect();
      const sx=e.clientX-r.left, sy=e.clientY-r.top;
      return {sx,sy,...s2c(sx,sy)};
    }

    function resize(){
      canvas!.width = wrap!.clientWidth;
      canvas!.height = wrap!.clientHeight;
      doRedraw();
    }

    // ── Background ──
    function drawBg(){
      const w=canvas!.width, h=canvas!.height;
      ctx!.clearRect(0,0,w,h);
      const preset = BG_PRESETS[bgIdx.current];
      ctx!.fillStyle = preset.canvasBg;
      ctx!.fillRect(0,0,w,h);
      const bgt = bgTypeR.current;
      if(bgt==='none') return;
      const sp=Math.max(12,24*vp.current.scale);
      const ox=((vp.current.x%sp)+sp)%sp;
      const oy=((vp.current.y%sp)+sp)%sp;
      const isDark = preset.dark;
      if(bgt==='dots'){
        ctx!.fillStyle = isDark?'rgba(255,255,255,0.10)':'rgba(0,0,0,0.10)';
        const r=Math.max(0.8,1.2*vp.current.scale);
        for(let x=ox;x<w+sp;x+=sp) for(let y=oy;y<h+sp;y+=sp){
          ctx!.beginPath(); ctx!.arc(x,y,r,0,Math.PI*2); ctx!.fill();
        }
      } else {
        ctx!.strokeStyle = isDark?'rgba(255,255,255,0.06)':'rgba(0,0,0,0.06)';
        ctx!.lineWidth=1; ctx!.beginPath();
        for(let x=ox;x<w;x+=sp){ctx!.moveTo(x,0);ctx!.lineTo(x,h);}
        for(let y=oy;y<h;y+=sp){ctx!.moveTo(0,y);ctx!.lineTo(w,y);}
        ctx!.stroke();
      }
    }

    // ── Render a single element ──
    // NOTE: eraser uses destination-out, so it must be drawn AFTER the background
    // on a canvas that already has the background painted. We render directly on
    // the main canvas (not an offscreen), which is why drawBg() is called first.
    function renderEl(c:CanvasRenderingContext2D, el:DrawElement){
      c.save();
      c.globalAlpha=el.opacity??1;
      c.strokeStyle=el.stroke??'#000';
      c.fillStyle=el.fill??'transparent';
      c.lineWidth=(el.lineWidth??2)*vp.current.scale;
      c.lineCap='round'; c.lineJoin='round';

      switch(el.type){
        case 'pen':{
          const pts=el.points; if(!pts||pts.length<2) break;
          c.beginPath();
          const p0=c2s(pts[0].x,pts[0].y); c.moveTo(p0.x,p0.y);
          for(let i=1;i<pts.length-1;i++){
            const mid=c2s((pts[i].x+pts[i+1].x)/2,(pts[i].y+pts[i+1].y)/2);
            const cp=c2s(pts[i].x,pts[i].y);
            c.quadraticCurveTo(cp.x,cp.y,mid.x,mid.y);
          }
          const last=c2s(pts[pts.length-1].x,pts[pts.length-1].y);
          c.lineTo(last.x,last.y); c.stroke(); break;
        }
        case 'eraser':{
          // ── ERASER FIX: use destination-out to cut through drawn content ──
          // This works because we draw the solid background first, then elements,
          // so destination-out removes pixels back to the bg color (canvas default).
          const pts=el.points; if(!pts||pts.length<1) break;
          c.globalCompositeOperation='destination-out';
          c.globalAlpha=1;
          c.strokeStyle='rgba(0,0,0,1)';
          c.fillStyle='rgba(0,0,0,1)';
          c.lineWidth=(el.lineWidth??20)*vp.current.scale;
          if(pts.length===1){
            const p=c2s(pts[0].x,pts[0].y);
            c.beginPath();c.arc(p.x,p.y,(el.lineWidth??20)*vp.current.scale/2,0,Math.PI*2);c.fill();
          } else {
            c.beginPath();
            const p0=c2s(pts[0].x,pts[0].y); c.moveTo(p0.x,p0.y);
            for(let i=1;i<pts.length-1;i++){
              const mid=c2s((pts[i].x+pts[i+1].x)/2,(pts[i].y+pts[i+1].y)/2);
              const cp=c2s(pts[i].x,pts[i].y);
              c.quadraticCurveTo(cp.x,cp.y,mid.x,mid.y);
            }
            const last=c2s(pts[pts.length-1].x,pts[pts.length-1].y);
            c.lineTo(last.x,last.y); c.stroke();
          }
          c.globalCompositeOperation='source-over'; break;
        }
        case 'line':{
          const a=c2s(el.x1!,el.y1!),b=c2s(el.x2!,el.y2!);
          c.beginPath();c.moveTo(a.x,a.y);c.lineTo(b.x,b.y);c.stroke(); break;
        }
        case 'arrow':{
          const a=c2s(el.x1!,el.y1!),b=c2s(el.x2!,el.y2!);
          const angle=Math.atan2(b.y-a.y,b.x-a.x);
          const hw=Math.max(12,(el.lineWidth??2)*vp.current.scale*5);
          c.beginPath();c.moveTo(a.x,a.y);c.lineTo(b.x,b.y);c.stroke();
          c.save(); c.fillStyle=el.stroke; c.globalAlpha=el.opacity??1;
          c.translate(b.x,b.y); c.rotate(angle);
          c.beginPath(); c.moveTo(0,0);
          c.lineTo(-hw,-hw*0.38); c.lineTo(-hw*0.7,0); c.lineTo(-hw,hw*0.38);
          c.closePath(); c.fill(); c.restore(); break;
        }
        case 'rect':{
          const tl=c2s(el.x!,el.y!);
          const sw=el.w!*vp.current.scale, sh=el.h!*vp.current.scale;
          if(el.useFill) c.fillRect(tl.x,tl.y,sw,sh);
          c.strokeRect(tl.x,tl.y,sw,sh); break;
        }
        case 'circle':{
          const cx2=(el.x!+el.w!/2)*vp.current.scale+vp.current.x;
          const cy2=(el.y!+el.h!/2)*vp.current.scale+vp.current.y;
          c.beginPath();
          c.ellipse(cx2,cy2,Math.abs(el.w!*vp.current.scale/2),Math.abs(el.h!*vp.current.scale/2),0,0,Math.PI*2);
          if(el.useFill) c.fill(); c.stroke(); break;
        }
        case 'triangle':{
          const tl=c2s(el.x!,el.y!);
          const sw=el.w!*vp.current.scale,sh=el.h!*vp.current.scale;
          c.beginPath();
          c.moveTo(tl.x+sw/2,tl.y); c.lineTo(tl.x+sw,tl.y+sh); c.lineTo(tl.x,tl.y+sh);
          c.closePath();
          if(el.useFill) c.fill(); c.stroke(); break;
        }
        case 'text':{
          const pos=c2s(el.x!,el.y!);
          const fs=(el.fontSize??20)*vp.current.scale;
          c.font=`${el.fontStyle??'normal'} ${fs}px ${el.fontFamily??'sans-serif'}`;
          c.fillStyle=el.stroke; c.textBaseline='top';
          (el.text??'').split('\n').forEach((ln,i)=>c.fillText(ln,pos.x,pos.y+i*fs*1.45));
          break;
        }
        case 'image':{
          if(!el.imgEl) break;
          const tl=c2s(el.x!,el.y!);
          c.drawImage(el.imgEl,tl.x,tl.y,el.w!*vp.current.scale,el.h!*vp.current.scale);
          break;
        }
      }
      c.restore();
    }

    // ── Selection overlay ──
    function renderSel(el:DrawElement){
      const bb=getBBox(el); if(!bb) return;
      const tl=c2s(bb.x,bb.y);
      const bw=bb.w*vp.current.scale, bh=bb.h*vp.current.scale;
      ctx!.save();
      ctx!.strokeStyle='#6C5CE7'; ctx!.lineWidth=1.5;
      ctx!.setLineDash([5,3]); ctx!.globalAlpha=1;
      ctx!.strokeRect(tl.x-6,tl.y-6,bw+12,bh+12);
      ctx!.setLineDash([]);
      const corners=[[tl.x-6,tl.y-6],[tl.x+bw+6,tl.y-6],[tl.x-6,tl.y+bh+6],[tl.x+bw+6,tl.y+bh+6]];
      corners.forEach(([hx,hy])=>{
        ctx!.fillStyle='#fff'; ctx!.strokeStyle='#6C5CE7'; ctx!.lineWidth=1.5;
        ctx!.beginPath();
        ctx!.rect(hx-5,hy-5,10,10);
        ctx!.fill(); ctx!.stroke();
      });
      ctx!.restore();
    }

    // ── Full redraw (FIXED: background first, then elements directly on main ctx) ──
    function doRedraw(){
      // 1. Draw the background (fills canvas with solid color + dots/grid)
      drawBg();
      // 2. Draw all elements directly on the main canvas so eraser destination-out works
      els.current.forEach(el=>renderEl(ctx!,el));
      if(cur.current) renderEl(ctx!,cur.current);
      // 3. Draw selection overlay on top
      if(selIdxR.current>=0&&selIdxR.current<els.current.length)
        renderSel(els.current[selIdxR.current]);
    }
    redrawFn.current=doRedraw;

    // ── Bounding box ──
    function getBBox(el:DrawElement){
      const lw2=(el.lineWidth??2)/2;
      switch(el.type){
        case 'pen':case 'eraser':{
          if(!el.points||el.points.length===0) return null;
          let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;
          el.points.forEach(p=>{if(p.x<x0)x0=p.x;if(p.x>x1)x1=p.x;if(p.y<y0)y0=p.y;if(p.y>y1)y1=p.y;});
          return {x:x0-lw2,y:y0-lw2,w:x1-x0+lw2*2,h:y1-y0+lw2*2};
        }
        case 'line':case 'arrow':{
          const x0=Math.min(el.x1!,el.x2!),y0=Math.min(el.y1!,el.y2!);
          return {x:x0-lw2,y:y0-lw2,w:Math.abs(el.x2!-el.x1!)+lw2*2||8,h:Math.abs(el.y2!-el.y1!)+lw2*2||8};
        }
        case 'rect':case 'circle':case 'triangle':case 'image':{
          return {x:el.w!>=0?el.x!:el.x!+el.w!,y:el.h!>=0?el.y!:el.y!+el.h!,w:Math.abs(el.w!)||8,h:Math.abs(el.h!)||8};
        }
        case 'text':{
          const lines=(el.text||'').split('\n');
          const maxL=Math.max(...lines.map(l=>l.length),4);
          const fs=el.fontSize??20;
          return {x:el.x!,y:el.y!,w:maxL*fs*0.55,h:lines.length*fs*1.45+4};
        }
        default: return null;
      }
    }

    // ── Hit test ──
    function hitTest(el:DrawElement,cx:number,cy:number){
      const bb=getBBox(el); if(!bb) return false;
      const pad=8/vp.current.scale;
      return cx>=bb.x-pad&&cx<=bb.x+bb.w+pad&&cy>=bb.y-pad&&cy<=bb.y+bb.h+pad;
    }
    function hitHandle(el:DrawElement,sx:number,sy:number){
      const bb=getBBox(el); if(!bb) return '';
      const corners:{[k:string]:{x:number;y:number}}={
        nw:c2s(bb.x,bb.y), ne:c2s(bb.x+bb.w,bb.y),
        sw:c2s(bb.x,bb.y+bb.h), se:c2s(bb.x+bb.w,bb.y+bb.h)
      };
      for(const [dir,pos] of Object.entries(corners)){
        if(Math.abs(sx-pos.x)<=10&&Math.abs(sy-pos.y)<=10) return dir;
      }
      return '';
    }

    // ── Smooth points ──
    function smoothPts(pts:Point[],level:number){
      if(pts.length<3||level===0) return [...pts];
      const t=level/10;
      const out=[pts[0]];
      for(let i=1;i<pts.length-1;i++){
        const p=pts[i],prev=pts[i-1],next=pts[i+1];
        out.push({x:p.x*(1-t)+(prev.x+next.x)/2*t,y:p.y*(1-t)+(prev.y+next.y)/2*t});
      }
      out.push(pts[pts.length-1]);
      return out;
    }

    // ── Move element ──
    function moveEl(el:DrawElement,dx:number,dy:number){
      if(!dx&&!dy) return;
      switch(el.type){
        case 'pen':case 'eraser': el.points=el.points!.map(p=>({x:p.x+dx,y:p.y+dy})); break;
        case 'line':case 'arrow': el.x1!+=dx;el.y1!+=dy;el.x2!+=dx;el.y2!+=dy; break;
        default: el.x!+=dx;el.y!+=dy;
      }
    }

    // ── Apply resize ──
    function applyResize(el:DrawElement,handle:string,x:number,y:number){
      if(!el||!rBBox.current) return;
      if(!['rect','circle','triangle','image'].includes(el.type)) return;
      const bb=rBBox.current;
      const right=bb.x+bb.w, bottom=bb.y+bb.h;
      if(handle.includes('e')) el.w=x-el.x!;
      if(handle.includes('s')) el.h=y-el.y!;
      if(handle.includes('w')){el.x=x;el.w=right-x;}
      if(handle.includes('n')){el.y=y;el.h=bottom-y;}
    }

    // ── Serialize / Deserialize ──
    function serialize(){
      return JSON.stringify(els.current.map(el=>{
        const c={...el}; if(c.imgEl){c._src=c.imgEl.src;delete c.imgEl;} return c;
      }));
    }
    function deserialize(json:string):DrawElement[]{
      return JSON.parse(json).map((el:DrawElement)=>{
        if(el._src){const img=new Image();img.src=el._src;img.onload=()=>doRedraw();el.imgEl=img;delete el._src;}
        return el;
      });
    }

    // ── Undo / Redo ──
    function pushUndo(){
      undoStack.current.push(serialize());
      if(undoStack.current.length>80) undoStack.current.shift();
      redoStack.current=[];
    }
    pushUndoFn.current=pushUndo;
    function doUndo(){
      if(!undoStack.current.length){showToastR.current('Nada que deshacer');return;}
      redoStack.current.push(serialize());
      els.current=deserialize(undoStack.current.pop()!);
      selIdxR.current=-1; setSelIdx(-1); doRedraw();
      showToastR.current('↩ Deshacer');
    }
    undoFn.current=doUndo;
    function doRedo(){
      if(!redoStack.current.length){showToastR.current('Nada que rehacer');return;}
      undoStack.current.push(serialize());
      els.current=deserialize(redoStack.current.pop()!);
      selIdxR.current=-1; setSelIdx(-1); doRedraw();
      showToastR.current('↪ Rehacer');
    }
    redoFn.current=doRedo;

    // ── Style snapshot ──
    function styleSnap(){
      return {
        stroke:strokeR.current,
        fill:hasFillR.current?fillR.current:'transparent',
        useFill:hasFillR.current,
        lineWidth:lineWR.current,
        opacity:opR.current,
        fontFamily:fontFamR.current,
        fontSize:fontSzR.current,
        fontStyle:fontStR.current,
      };
    }

    // ── Cursor ──
    function getCursor(){
      const map:{[k:string]:string}={pen:'crosshair',eraser:'cell',select:'default',text:'text',line:'crosshair',arrow:'crosshair',rect:'crosshair',circle:'crosshair',triangle:'crosshair'};
      return map[toolR.current]||'default';
    }
    setCursorFn.current=(c:string)=>{canvas!.style.cursor=c;};

    // ── Commit text ──
    let textOverlayState = { cx:0, cy:0 };
    function commitText(){
      const ta=textAreaRef.current;
      if(!ta) return;
      const val=ta.value;
      if(val.trim()){
        pushUndo();
        els.current.push({
          type:'text',text:val,
          x:textOverlayState.cx,y:textOverlayState.cy,
          ...styleSnap(),
        });
        doRedraw();
      }
    }
    commitTextFn.current=commitText;

    // ── Reset view ──
    function resetView(){
      vp.current={x:0,y:0,scale:1};
      doRedraw();
      showToastR.current('Vista restablecida');
    }
    resetViewFn.current=resetView;

    // ── Cycle background ──
    function cycleBg(){
      bgIdx.current=(bgIdx.current+1)%BG_PRESETS.length;
      const preset=BG_PRESETS[bgIdx.current];
      setDarkMode(preset.dark); darkR.current=preset.dark;
      document.documentElement.setAttribute('data-theme',preset.dark?'dark':'light');
      doRedraw();
      showToastR.current('🎨 Fondo: '+preset.label);
    }

    // ── Save / Load ──
    function saveBoard(){
      const data={version:'1.0',vp:{...vp.current},bgIdx:bgIdx.current,
        elements:els.current.map(el=>{const c={...el};if(c.imgEl){c._src=c.imgEl.src;delete c.imgEl;}return c;})};
      try{
        localStorage.setItem('drawdams_v1',JSON.stringify(data));
        showToastR.current('💾 Guardado');
      }catch(err){showToastR.current('❌ Error al guardar');}
    }

    function loadBoard(){
      const raw=localStorage.getItem('drawdams_v1');
      if(!raw){showToastR.current('📂 No hay datos guardados');return;}
      try{
        const data=JSON.parse(raw);
        vp.current=data.vp||{x:0,y:0,scale:1};
        bgIdx.current=data.bgIdx||0;
        const preset=BG_PRESETS[bgIdx.current];
        setDarkMode(preset.dark); darkR.current=preset.dark;
        document.documentElement.setAttribute('data-theme',preset.dark?'dark':'light');
        els.current=(data.elements||[]).map((el:DrawElement)=>{
          if(el._src){const img=new Image();img.src=el._src;img.onload=()=>doRedraw();el.imgEl=img;delete el._src;}
          return el;
        });
        undoStack.current=[]; redoStack.current=[];
        selIdxR.current=-1; setSelIdx(-1);
        doRedraw();
        showToastR.current('📂 Cargado');
      }catch(err){showToastR.current('❌ Error al cargar');}
    }

    // ── Delete selected ──
    function deleteSelected(){
      if(selIdxR.current<0) return;
      pushUndo();
      els.current.splice(selIdxR.current,1);
      selIdxR.current=-1; setSelIdx(-1);
      doRedraw();
      showToastR.current('✕ Eliminado');
    }

    // ── Load image from File ──
    function loadImageFile(file:File){
      const reader=new FileReader();
      reader.onload=ev=>{
        loadImageFromDataURL(ev.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
    loadImageFn.current=loadImageFile;

    // ── Load image from data URL (used for file AND clipboard paste) ──
    function loadImageFromDataURL(src:string){
      const imgEl=new Image();
      imgEl.onload=()=>{
        const center=s2c(canvas!.width/2,canvas!.height/2);
        const MAX=500;
        let w=imgEl.width,h=imgEl.height;
        if(w>MAX){h=h*MAX/w;w=MAX;} if(h>MAX){w=w*MAX/h;h=MAX;}
        pushUndo();
        els.current.push({type:'image',imgEl,x:center.x-w/2,y:center.y-h/2,w,h,
          stroke:'#000',fill:'transparent',useFill:false,lineWidth:1,opacity:1});
        setTool('select'); toolR.current='select';
        selIdxR.current=els.current.length-1; setSelIdx(els.current.length-1);
        doRedraw();
        showToastR.current('Imagen añadida 🖼️');
      };
      imgEl.src=src;
    }
    loadImageDataURLFn.current=loadImageFromDataURL;

    // ═══ POINTER EVENTS ═══
    function onPointerDown(e:PointerEvent){
      canvas!.setPointerCapture(e.pointerId);
      const {sx,sy,x,y}=ptr(e);

      if(e.button===1||(e.button===0&&spaceDown.current)){
        isPanning.current=true;
        panOrigin.current={x:sx-vp.current.x,y:sy-vp.current.y};
        canvas!.style.cursor='grabbing'; return;
      }
      if(e.button!==0) return;

      if(toolR.current!=='text'){
        commitTextFn.current();
        setTextOverlay(null);
      }

      if(toolR.current==='select'){
        if(selIdxR.current>=0){
          const h=hitHandle(els.current[selIdxR.current],sx,sy);
          if(h){dragMode.current='resize';rHandle.current=h;rBBox.current={...getBBox(els.current[selIdxR.current])};return;}
        }
        let found=-1;
        for(let i=els.current.length-1;i>=0;i--){
          if(hitTest(els.current[i],x,y)){found=i;break;}
        }
        if(found>=0){
          selIdxR.current=found; setSelIdx(found);
          const bb=getBBox(els.current[found]);
          dragOff.current={x:x-(bb?.x??x),y:y-(bb?.y??y)};
          dragMode.current='move'; isDrawing.current=true;
        } else {
          selIdxR.current=-1; setSelIdx(-1);
        }
        doRedraw(); return;
      }

      if(toolR.current==='text'){
        const sc=c2s(x,y);
        const wr=wrap!.getBoundingClientRect();
        textOverlayState={cx:x,cy:y};
        setTextOverlay({left:sc.x+wr.left,top:sc.y+wr.top,cx:x,cy:y});
        setTimeout(()=>textAreaRef.current?.focus(),10);
        return;
      }

      isDrawing.current=true;
      rawPts.current=[{x,y}];

      if(toolR.current==='pen'||toolR.current==='eraser'){
        cur.current={
          type:toolR.current,points:[{x,y}],
          stroke:strokeR.current,fill:'transparent',useFill:false,
          lineWidth:toolR.current==='eraser'?lineWR.current*4:lineWR.current,
          opacity:1,
        };
      } else {
        cur.current={type:toolR.current,x,y,w:0,h:0,x1:x,y1:y,x2:x,y2:y,...styleSnap()};
      }
    }

    function onPointerMove(e:PointerEvent){
      const {sx,sy,x,y}=ptr(e);

      if(toolR.current==='select'&&selIdxR.current>=0&&!isDrawing.current){
        const h=hitHandle(els.current[selIdxR.current],sx,sy);
        if(h){
          const cursors:{[k:string]:string}={nw:'nw-resize',ne:'ne-resize',sw:'sw-resize',se:'se-resize'};
          canvas!.style.cursor=cursors[h]||'default';
        } else {
          canvas!.style.cursor=getCursor();
        }
      }

      if(isPanning.current){
        vp.current.x=sx-panOrigin.current.x;
        vp.current.y=sy-panOrigin.current.y;
        doRedraw(); return;
      }

      if(toolR.current==='select'){
        if(dragMode.current==='move'&&isDrawing.current&&selIdxR.current>=0){
          const bb=getBBox(els.current[selIdxR.current]);
          const tx=x-dragOff.current.x, ty=y-dragOff.current.y;
          const dx=tx-(bb?.x??0), dy=ty-(bb?.y??0);
          moveEl(els.current[selIdxR.current],dx,dy);
          doRedraw(); return;
        }
        if(dragMode.current==='resize'&&selIdxR.current>=0){
          applyResize(els.current[selIdxR.current],rHandle.current,x,y);
          doRedraw(); return;
        }
        return;
      }

      if(!isDrawing.current||!cur.current) return;

      if(cur.current.type==='pen'||cur.current.type==='eraser'){
        rawPts.current.push({x,y});
        cur.current.points=smoothPts(rawPts.current,smoothR.current);
        doRedraw(); return;
      }

      cur.current.x2=x; cur.current.y2=y;
      cur.current.w=x-cur.current.x!; cur.current.h=y-cur.current.y!;

      if(e.shiftKey&&['rect','circle','triangle'].includes(cur.current.type)){
        const side=Math.sign(cur.current.w)*Math.max(Math.abs(cur.current.w),Math.abs(cur.current.h));
        cur.current.w=side; cur.current.h=side;
      }
      if(e.shiftKey&&['line','arrow'].includes(cur.current.type)){
        const dx2=x-cur.current.x1!,dy2=y-cur.current.y1!;
        const angle=Math.round(Math.atan2(dy2,dx2)/(Math.PI/4))*(Math.PI/4);
        const dist=Math.sqrt(dx2*dx2+dy2*dy2);
        cur.current.x2=cur.current.x1!+Math.cos(angle)*dist;
        cur.current.y2=cur.current.y1!+Math.sin(angle)*dist;
      }
      doRedraw();
    }

    function onPointerUp(_e:PointerEvent){
      if(isPanning.current){
        isPanning.current=false;
        canvas!.style.cursor=spaceDown.current?'grab':getCursor();
        return;
      }
      if(dragMode.current==='move'||dragMode.current==='resize'){
        if(isDrawing.current){pushUndo();isDrawing.current=false;}
        dragMode.current=''; return;
      }
      if(!isDrawing.current) return;
      isDrawing.current=false;
      if(toolR.current==='select') return;
      if(!cur.current) return;

      if(['pen','eraser'].includes(cur.current.type)){
        if(!cur.current.points||cur.current.points.length<2){cur.current=null;doRedraw();return;}
        cur.current.points=smoothPts(rawPts.current,smoothR.current);
      }
      if(['rect','circle','triangle'].includes(cur.current.type)){
        if(Math.abs(cur.current.w!)<4&&Math.abs(cur.current.h!)<4){cur.current=null;return;}
      }
      if(['line','arrow'].includes(cur.current.type)){
        const dx2=cur.current.x2!-cur.current.x1!,dy2=cur.current.y2!-cur.current.y1!;
        if(Math.sqrt(dx2*dx2+dy2*dy2)<4){cur.current=null;return;}
      }

      pushUndo();
      els.current.push(cur.current);
      cur.current=null;
      doRedraw();
    }

    // ═══ WHEEL ZOOM ═══
    function onWheel(e:WheelEvent){
      e.preventDefault();
      const r=canvas!.getBoundingClientRect();
      const sx=e.clientX-r.left, sy=e.clientY-r.top;
      const dir=e.deltaY<0?1:-1;
      const step=e.ctrlKey?0.04:0.12;
      const factor=1+dir*step;
      const ns=Math.max(0.04,Math.min(30,vp.current.scale*factor));
      vp.current.x=sx-(sx-vp.current.x)*(ns/vp.current.scale);
      vp.current.y=sy-(sy-vp.current.y)*(ns/vp.current.scale);
      vp.current.scale=ns;
      doRedraw();
    }

    // ═══ KEYBOARD ═══
    function onKeyDown(e:KeyboardEvent){
      const tag=(document.activeElement?.tagName)??'';
      if(tag==='TEXTAREA'||tag==='INPUT'||tag==='SELECT') return;

      if(e.code==='Space'&&!e.ctrlKey){
        if(!spaceDown.current){spaceDown.current=true;canvas!.style.cursor='grab';}
        e.preventDefault(); return;
      }

      if(e.ctrlKey||e.metaKey){
        switch(e.key.toLowerCase()){
          case 'z':e.preventDefault();doUndo();return;
          case 'y':e.preventDefault();doRedo();return;
          case 's':e.preventDefault();saveBoard();return;
        }
        return;
      }

      const toolKeys:{[k:string]:string}={p:'pen',e:'eraser',v:'select',t:'text',r:'rect',c:'circle',l:'line',a:'arrow',g:'triangle'};
      if(toolKeys[e.key.toLowerCase()]){setTool(toolKeys[e.key.toLowerCase()]);return;}

      switch(e.key.toLowerCase()){
        case 'i':fileInputRef.current?.click();return;
        case 'd':cycleBg();return;
        case '0':resetView();return;
      }
      if(e.key==='Delete'||e.key==='Backspace'){if(selIdxR.current>=0)deleteSelected();return;}
      if(e.key==='Escape'){setSelIdx(-1);selIdxR.current=-1;doRedraw();return;}
    }

    function onKeyUp(e:KeyboardEvent){
      if(e.code==='Space'){
        spaceDown.current=false;
        canvas!.style.cursor=isPanning.current?'grabbing':getCursor();
      }
    }

    // ═══ PASTE FROM CLIPBOARD ═══
    function onPaste(e:ClipboardEvent){
      const tag=(document.activeElement?.tagName)??'';
      if(tag==='TEXTAREA'||tag==='INPUT') return;
      const items=e.clipboardData?.items;
      if(!items) return;
      for(let i=0;i<items.length;i++){
        if(items[i].type.startsWith('image/')){
          e.preventDefault();
          const file=items[i].getAsFile();
          if(file) loadImageFile(file);
          return;
        }
      }
    }

    // ═══ DRAG & DROP ═══
    function onDragOver(e:DragEvent){e.preventDefault();wrap!.style.outline='3px dashed var(--accent)';}
    function onDragLeave(){wrap!.style.outline='';}
    function onDrop(e:DragEvent){
      e.preventDefault();wrap!.style.outline='';
      const file=[...e.dataTransfer!.files].find(f=>f.type.startsWith('image/'));
      if(file) loadImageFile(file);
    }

    // ═══ ATTACH EVENTS ═══
    resize();
    window.addEventListener('resize',resize);
    canvas.addEventListener('pointerdown',onPointerDown);
    canvas.addEventListener('pointermove',onPointerMove);
    canvas.addEventListener('pointerup',onPointerUp);
    canvas.addEventListener('pointercancel',onPointerUp);
    canvas.addEventListener('wheel',onWheel,{passive:false});
    document.addEventListener('keydown',onKeyDown);
    document.addEventListener('keyup',onKeyUp);
    document.addEventListener('paste',onPaste);
    wrap.addEventListener('dragover',onDragOver);
    wrap.addEventListener('dragleave',onDragLeave);
    wrap.addEventListener('drop',onDrop);

    // Auto-load
    if(localStorage.getItem('drawdams_v1')){
      loadBoard();
    }

    // Welcome text if empty
    if(els.current.length===0){
      const cx=canvas.width/2,cy=canvas.height/2;
      const c=s2c(cx,cy);
      els.current.push({
        type:'text',text:'¡Bienvenido a Drawdams! ✏️\nElige una herramienta y empieza a crear.\nD = cambiar fondo · Ctrl+Z = deshacer · Rueda = zoom · Ctrl+V = pegar imagen',
        x:c.x-280,y:c.y-50,
        stroke:'#6b7280',fill:'transparent',useFill:false,lineWidth:1,opacity:0.7,
        fontFamily:"'Inter',sans-serif",fontSize:15,fontStyle:'normal',
      });
      doRedraw();
    }

    return ()=>{
      window.removeEventListener('resize',resize);
      canvas.removeEventListener('pointerdown',onPointerDown);
      canvas.removeEventListener('pointermove',onPointerMove);
      canvas.removeEventListener('pointerup',onPointerUp);
      canvas.removeEventListener('pointercancel',onPointerUp);
      canvas.removeEventListener('wheel',onWheel);
      document.removeEventListener('keydown',onKeyDown);
      document.removeEventListener('keyup',onKeyUp);
      document.removeEventListener('paste',onPaste);
      wrap.removeEventListener('dragover',onDragOver);
      wrap.removeEventListener('dragleave',onDragLeave);
      wrap.removeEventListener('drop',onDrop);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);

  // ══════════════════════════════════════════════════════════════
  // UI CALLBACKS
  // ══════════════════════════════════════════════════════════════
  const handleToolChange = useCallback((t:string)=>{
    setTool(t); toolR.current=t;
    if(t!=='text'&&textOverlay){commitTextFn.current();setTextOverlay(null);}
    const cursors:{[k:string]:string}={pen:'crosshair',eraser:'cell',select:'default',text:'text',line:'crosshair',arrow:'crosshair',rect:'crosshair',circle:'crosshair',triangle:'crosshair'};
    setCursorFn.current(cursors[t]||'default');
  },[textOverlay]);

  const handleThemeToggle = useCallback(()=>{
    setDarkMode(d=>{const nv=!d;darkR.current=nv;document.documentElement.setAttribute('data-theme',nv?'dark':'light');return nv;});
    redrawFn.current();
  },[]);

  const handleExportPNG = useCallback(()=>{
    const canvas=canvasRef.current; if(!canvas) return;
    const exp=document.createElement('canvas');
    exp.width=canvas.width; exp.height=canvas.height;
    const ec=exp.getContext('2d')!;
    const preset=BG_PRESETS[bgIdx.current];
    ec.fillStyle=preset.canvasBg;
    ec.fillRect(0,0,exp.width,exp.height);
    ec.drawImage(canvas,0,0);
    exp.toBlob(blob=>{
      if(!blob) return;
      const a=document.createElement('a');
      a.download='drawdams.png';
      a.href=URL.createObjectURL(blob); a.click();
      showToast('📷 Exportado como PNG');
    },'image/png');
  },[showToast]);

  const handleExportSVG = useCallback(()=>{
    const canvas=canvasRef.current; if(!canvas) return;
    const W=canvas.width, H=canvas.height;
    const esc=(s:string)=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    let svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">`;
    const preset=BG_PRESETS[bgIdx.current];
    svg+=`<rect width="${W}" height="${H}" fill="${preset.canvasBg}"/>`;
    const v=vp.current;
    const c2sFn=(cx:number,cy:number)=>({x:cx*v.scale+v.x,y:cy*v.scale+v.y});
    els.current.forEach(el=>{
      const sw=(el.lineWidth??2)*v.scale;
      const al=el.opacity??1;
      const st=el.stroke??'#000';
      const fl=el.useFill?(el.fill??'none'):'none';
      switch(el.type){
        case 'pen':{
          if(!el.points?.length) break;
          const d=el.points.map((p,i)=>{const s=c2sFn(p.x,p.y);return i===0?`M${s.x.toFixed(1)},${s.y.toFixed(1)}`:`L${s.x.toFixed(1)},${s.y.toFixed(1)}`;}).join(' ');
          svg+=`<path d="${d}" stroke="${st}" stroke-width="${sw}" fill="none" opacity="${al}" stroke-linecap="round" stroke-linejoin="round"/>`; break;
        }
        case 'line':case 'arrow':{
          const a=c2sFn(el.x1!,el.y1!),b=c2sFn(el.x2!,el.y2!);
          svg+=`<line x1="${a.x.toFixed(1)}" y1="${a.y.toFixed(1)}" x2="${b.x.toFixed(1)}" y2="${b.y.toFixed(1)}" stroke="${st}" stroke-width="${sw}" opacity="${al}" stroke-linecap="round"/>`;
          if(el.type==='arrow'){
            const angle=Math.atan2(b.y-a.y,b.x-a.x),hw=Math.max(12,sw*5);
            const hx1=b.x-Math.cos(angle-0.35)*hw,hy1=b.y-Math.sin(angle-0.35)*hw;
            const hx2=b.x-Math.cos(angle+0.35)*hw,hy2=b.y-Math.sin(angle+0.35)*hw;
            svg+=`<polygon points="${b.x.toFixed(1)},${b.y.toFixed(1)} ${hx1.toFixed(1)},${hy1.toFixed(1)} ${hx2.toFixed(1)},${hy2.toFixed(1)}" fill="${st}" opacity="${al}"/>`;
          } break;
        }
        case 'rect':{
          const tl=c2sFn(el.x!,el.y!);
          svg+=`<rect x="${tl.x.toFixed(1)}" y="${tl.y.toFixed(1)}" width="${(el.w!*v.scale).toFixed(1)}" height="${(el.h!*v.scale).toFixed(1)}" stroke="${st}" fill="${fl}" stroke-width="${sw}" opacity="${al}"/>`; break;
        }
        case 'circle':{
          const cx2=(el.x!+el.w!/2)*v.scale+v.x,cy2=(el.y!+el.h!/2)*v.scale+v.y;
          svg+=`<ellipse cx="${cx2.toFixed(1)}" cy="${cy2.toFixed(1)}" rx="${Math.abs(el.w!*v.scale/2).toFixed(1)}" ry="${Math.abs(el.h!*v.scale/2).toFixed(1)}" stroke="${st}" fill="${fl}" stroke-width="${sw}" opacity="${al}"/>`; break;
        }
        case 'triangle':{
          const tl=c2sFn(el.x!,el.y!),sw2=el.w!*v.scale,sh2=el.h!*v.scale;
          svg+=`<polygon points="${(tl.x+sw2/2).toFixed(1)},${tl.y.toFixed(1)} ${(tl.x+sw2).toFixed(1)},${(tl.y+sh2).toFixed(1)} ${tl.x.toFixed(1)},${(tl.y+sh2).toFixed(1)}" stroke="${st}" fill="${fl}" stroke-width="${sw}" opacity="${al}"/>`; break;
        }
        case 'text':{
          const pos=c2sFn(el.x!,el.y!),fs=(el.fontSize??20)*v.scale,lh=fs*1.45;
          (el.text??'').split('\n').forEach((ln,i)=>{
            svg+=`<text x="${pos.x.toFixed(1)}" y="${(pos.y+i*lh+fs).toFixed(1)}" font-size="${fs.toFixed(1)}" font-family="${esc(el.fontFamily??'sans-serif')}" font-style="${el.fontStyle??'normal'}" fill="${st}" opacity="${al}">${esc(ln)}</text>`;
          }); break;
        }
      }
    });
    svg+='</svg>';
    const blob=new Blob([svg],{type:'image/svg+xml'});
    const a=document.createElement('a');
    a.download='drawdams.svg'; a.href=URL.createObjectURL(blob); a.click();
    showToast('🖊 Exportado como SVG');
  },[showToast]);

  const handleSaveToDrive = useCallback(()=>{
    showToast('☁️ Sube a Drive: exporta PNG y guárdalo manualmente');
  },[showToast]);

  const handleClear = useCallback(()=>{
    if(els.current.length===0){showToast('El lienzo ya está vacío');return;}
    if(!confirm('¿Limpiar toda la pizarra? Esta acción no se puede deshacer.')) return;
    pushUndoFn.current();
    els.current=[]; selIdxR.current=-1; setSelIdx(-1); cur.current=null;
    redrawFn.current();
    showToast('🗑️ Pizarra limpiada');
  },[showToast]);

  const handleSave = useCallback(()=>{
    const data={version:'1.0',vp:{...vp.current},bgIdx:bgIdx.current,
      elements:els.current.map(el=>{const c={...el};if((c as any).imgEl){(c as any)._src=(c as any).imgEl.src;delete (c as any).imgEl;}return c;})};
    try{localStorage.setItem('drawdams_v1',JSON.stringify(data));showToast('💾 Guardado');}
    catch(e){showToast('❌ Error al guardar');}
  },[showToast]);

  const handleLoad = useCallback(()=>{
    const raw=localStorage.getItem('drawdams_v1');
    if(!raw){showToast('📂 No hay datos guardados');return;}
    try{
      const data=JSON.parse(raw);
      vp.current=data.vp||{x:0,y:0,scale:1};
      bgIdx.current=data.bgIdx||0;
      const preset=BG_PRESETS[bgIdx.current];
      setDarkMode(preset.dark);darkR.current=preset.dark;
      document.documentElement.setAttribute('data-theme',preset.dark?'dark':'light');
      els.current=(data.elements||[]).map((el:any)=>{
        if(el._src){const img=new Image();img.src=el._src;img.onload=()=>redrawFn.current();el.imgEl=img;delete el._src;}
        return el;
      });
      undoStack.current=[];redoStack.current=[];
      selIdxR.current=-1;setSelIdx(-1);
      redrawFn.current();
      showToast('📂 Cargado');
    }catch(e){showToast('❌ Error al cargar');}
  },[showToast]);

  const handleFileChange = useCallback((e:React.ChangeEvent<HTMLInputElement>)=>{
    if(e.target.files?.[0]) loadImageFn.current(e.target.files[0]);
    e.target.value='';
  },[]);

  const handleTextKeyDown = useCallback((e:React.KeyboardEvent<HTMLTextAreaElement>)=>{
    if(e.key==='Escape'){setTextOverlay(null);e.stopPropagation();}
    if(e.key==='Enter'&&(e.ctrlKey||e.metaKey)){
      e.preventDefault();
      commitTextFn.current();
      setTextOverlay(null);
    }
  },[]);

  // Insert math symbol into active text area or as new text element
  const handleInsertSymbol = useCallback((sym:string)=>{
    const ta=textAreaRef.current;
    if(ta&&textOverlay){
      const start=ta.selectionStart??ta.value.length;
      const end=ta.selectionEnd??ta.value.length;
      const newVal=ta.value.slice(0,start)+sym+ta.value.slice(end);
      ta.value=newVal;
      const pos=start+sym.length;
      ta.setSelectionRange(pos,pos);
      ta.focus();
    } else {
      // Place as new text in the center of the canvas
      const canvas=canvasRef.current;
      if(!canvas) return;
      const center=((vp:any)=>({
        x:(canvas.width/2-vp.x)/vp.scale,
        y:(canvas.height/2-vp.y)/vp.scale,
      }))(vp.current);
      pushUndoFn.current();
      els.current.push({
        type:'text',text:sym,
        x:center.x,y:center.y,
        stroke:strokeColor,fill:'transparent',useFill:false,
        lineWidth:1,opacity:opacityVal/100,
        fontFamily:fontFam,fontSize:fontSz*2,fontStyle:fontSt,
      });
      redrawFn.current();
      showToast(`Símbolo ${sym} añadido`);
    }
  },[textOverlay,strokeColor,opacityVal,fontFam,fontSz,fontSt,showToast]);

  // Selection bar actions
  const handleSelDup = useCallback(()=>{
    if(selIdx<0) return;
    pushUndoFn.current();
    const copy=JSON.parse(JSON.stringify(els.current[selIdx]));
    if(copy._src){const img=new Image();img.src=copy._src;copy.imgEl=img;delete copy._src;}
    const moveElFn=(el:any,dx:number,dy:number)=>{
      switch(el.type){
        case 'pen':case 'eraser':el.points=el.points.map((p:Point)=>({x:p.x+dx,y:p.y+dy}));break;
        case 'line':case 'arrow':el.x1+=dx;el.y1+=dy;el.x2+=dx;el.y2+=dy;break;
        default:el.x+=dx;el.y+=dy;
      }
    };
    moveElFn(copy,20,20);
    els.current.push(copy);
    const ni=els.current.length-1;
    selIdxR.current=ni; setSelIdx(ni);
    redrawFn.current();
    showToast('⧉ Duplicado');
  },[selIdx,showToast]);

  const handleSelFront = useCallback(()=>{
    if(selIdx<0||selIdx>=els.current.length-1) return;
    pushUndoFn.current();
    const [el]=els.current.splice(selIdx,1);
    els.current.push(el);
    const ni=els.current.length-1;
    selIdxR.current=ni; setSelIdx(ni);
    redrawFn.current();
    showToast('⬆ Al frente');
  },[selIdx,showToast]);

  const handleSelBack = useCallback(()=>{
    if(selIdx<=0) return;
    pushUndoFn.current();
    const [el]=els.current.splice(selIdx,1);
    els.current.unshift(el);
    selIdxR.current=0; setSelIdx(0);
    redrawFn.current();
    showToast('⬇ Al fondo');
  },[selIdx,showToast]);

  const handleSelDel = useCallback(()=>{
    if(selIdx<0) return;
    pushUndoFn.current();
    els.current.splice(selIdx,1);
    selIdxR.current=-1; setSelIdx(-1);
    redrawFn.current();
    showToast('✕ Eliminado');
  },[selIdx,showToast]);

  // ══════════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════════
  const toolIcons:{[k:string]:string}={pen:'✏️',eraser:'🧹',select:'🖱️',text:'T',line:'╱',arrow:'→',rect:'▭',circle:'○',triangle:'△'};
  const toolLabel=(t:string)=>(toolIcons[t]||'')+' '+t.charAt(0).toUpperCase()+t.slice(1);

  return (
    <div style={{width:'100%',height:'100%'}}>

      {/* ═══ TOOLBAR ═══ */}
      <div className="toolbar" role="toolbar" aria-label="Herramientas">
        <div className="tb-logo" title="Drawdams">D</div>

        <button className={`tb-btn ${tool==='pen'?'active':''}`} onClick={()=>handleToolChange('pen')} aria-label="Lápiz">
          <svg viewBox="0 0 24 24"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4 12.5-12.5z"/></svg>
          <span className="tip">Lápiz <kbd>P</kbd></span>
        </button>
        <button className={`tb-btn ${tool==='eraser'?'active':''}`} onClick={()=>handleToolChange('eraser')} aria-label="Borrador">
          <svg viewBox="0 0 24 24"><path d="M20 20H7L3 16l10-10 7 7-3.5 3.5"/><path d="M6 17L17 6"/></svg>
          <span className="tip">Borrador <kbd>E</kbd></span>
        </button>
        <button className={`tb-btn ${tool==='select'?'active':''}`} onClick={()=>handleToolChange('select')} aria-label="Seleccionar">
          <svg viewBox="0 0 24 24"><path d="M5 3l14 9-7 1-3 7z"/></svg>
          <span className="tip">Seleccionar <kbd>V</kbd></span>
        </button>
        <button className={`tb-btn text-icon ${tool==='text'?'active':''}`} onClick={()=>handleToolChange('text')} aria-label="Texto">
          T
          <span className="tip">Texto <kbd>T</kbd></span>
        </button>

        <div className="tb-sep"/>

        <button className={`tb-btn ${tool==='line'?'active':''}`} onClick={()=>handleToolChange('line')} aria-label="Línea">
          <svg viewBox="0 0 24 24"><line x1="5" y1="19" x2="19" y2="5"/></svg>
          <span className="tip">Línea <kbd>L</kbd></span>
        </button>
        <button className={`tb-btn ${tool==='arrow'?'active':''}`} onClick={()=>handleToolChange('arrow')} aria-label="Flecha">
          <svg viewBox="0 0 24 24"><line x1="5" y1="19" x2="19" y2="5"/><polyline points="9 5 19 5 19 15"/></svg>
          <span className="tip">Flecha <kbd>A</kbd></span>
        </button>
        <button className={`tb-btn ${tool==='rect'?'active':''}`} onClick={()=>handleToolChange('rect')} aria-label="Rectángulo">
          <svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="1"/></svg>
          <span className="tip">Rectángulo <kbd>R</kbd></span>
        </button>
        <button className={`tb-btn ${tool==='circle'?'active':''}`} onClick={()=>handleToolChange('circle')} aria-label="Círculo">
          <svg viewBox="0 0 24 24"><ellipse cx="12" cy="12" rx="9" ry="7"/></svg>
          <span className="tip">Círculo <kbd>C</kbd></span>
        </button>
        <button className={`tb-btn ${tool==='triangle'?'active':''}`} onClick={()=>handleToolChange('triangle')} aria-label="Triángulo">
          <svg viewBox="0 0 24 24"><polygon points="12,4 22,20 2,20"/></svg>
          <span className="tip">Triángulo <kbd>G</kbd></span>
        </button>

        <div className="tb-sep"/>

        <button className="tb-btn" onClick={()=>fileInputRef.current?.click()} aria-label="Subir imagen">
          <svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
          <span className="tip">Imagen <kbd>I</kbd> / Ctrl+V</span>
        </button>

        {/* Math symbols button */}
        <button className={`tb-btn ${showMathPanel?'active':''}`}
          onClick={()=>setShowMathPanel(p=>!p)} aria-label="Símbolos matemáticos">
          <span style={{fontSize:15,fontWeight:700,fontFamily:'serif'}}>∑</span>
          <span className="tip">Símbolos matemáticos</span>
        </button>

        <div className="tb-spacer"/>

        <button className="tb-btn" onClick={()=>undoFn.current()} aria-label="Deshacer">
          <svg viewBox="0 0 24 24"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-5.36"/></svg>
          <span className="tip">Deshacer <kbd>Ctrl+Z</kbd></span>
        </button>
        <button className="tb-btn" onClick={()=>redoFn.current()} aria-label="Rehacer">
          <svg viewBox="0 0 24 24"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-.49-5.36"/></svg>
          <span className="tip">Rehacer <kbd>Ctrl+Y</kbd></span>
        </button>
        <button className="tb-btn" onClick={handleThemeToggle} aria-label="Tema">
          <svg viewBox="0 0 24 24">{darkMode
            ? <><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></>
            : <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
          }</svg>
          <span className="tip">Tema oscuro/claro</span>
        </button>
        <button className="tb-btn" onClick={()=>setShowModal(true)} aria-label="Atajos">
          <svg viewBox="0 0 24 24"><rect x="2" y="6" width="20" height="14" rx="2"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M8 14h8"/></svg>
          <span className="tip">Atajos de teclado</span>
        </button>
      </div>

      {/* ═══ CANVAS ═══ */}
      <div className="canvas-wrap" ref={wrapRef}>
        <canvas ref={canvasRef}/>
      </div>

      {/* ═══ HUD ═══ */}
      <div className="hud" aria-live="polite">
        <span>🔍 <b>{Math.round(vp.current.scale*100)}%</b></span>
        <div className="hud-sep"/>
        <span>Herramienta: <b>{toolLabel(tool)}</b></span>
        <div className="hud-sep"/>
        <span>Fondo: <b>{BG_PRESETS[bgIdx.current].label}</b></span>
      </div>

      {/* ═══ USER BAR ═══ */}
      <div className="top-bar">
        <div className="user-avatar">{user.name.charAt(0)}</div>
        <span>{user.name}</span>
        <button className="logout-btn" onClick={onLogout}>Salir</button>
      </div>

      {/* ═══ MATH SYMBOLS PANEL ═══ */}
      {showMathPanel&&(
        <div className="math-panel">
          <div className="math-panel-header">
            <span style={{fontWeight:600,fontSize:13}}>Símbolos matemáticos</span>
            <button className="modal-close-btn" style={{width:24,height:24,fontSize:13}}
              onClick={()=>setShowMathPanel(false)}>✕</button>
          </div>
          <div className="math-cats">
            {MATH_SYMBOLS.map((cat,i)=>(
              <button key={i} className={`math-cat-btn ${mathCat===i?'active':''}`}
                onClick={()=>setMathCat(i)}>{cat.label}</button>
            ))}
          </div>
          <div className="math-grid">
            {MATH_SYMBOLS[mathCat].symbols.map((sym,i)=>(
              <button key={i} className="math-sym-btn"
                title={`Insertar ${sym}`}
                onClick={()=>handleInsertSymbol(sym)}>
                {sym}
              </button>
            ))}
          </div>
          <div style={{padding:'6px 10px',fontSize:10,color:'var(--text2)',borderTop:'1px solid var(--border)'}}>
            {textOverlay ? 'Se insertará en el texto activo' : 'Se colocará en el centro del lienzo'}
          </div>
        </div>
      )}

      {/* ═══ RIGHT PANEL ═══ */}
      <div className="panel" role="complementary" aria-label="Propiedades">

        {/* Colors */}
        <div className="panel-section">
          <div className="pn-title">Colores</div>
          <div className="color-pair">
            <div className="color-swatch-wrap">
              <div className="color-swatch-label">Trazo</div>
              <input type="color" className="color-swatch" value={strokeColor}
                onChange={e=>{setStrokeColor(e.target.value);strokeR.current=e.target.value;}} title="Color de trazo"/>
            </div>
            <div className="color-swatch-wrap">
              <div className="color-swatch-label">Relleno</div>
              <input type="color" className="color-swatch" value={fillColor}
                onChange={e=>{setFillColor(e.target.value);fillR.current=e.target.value;}} title="Color de relleno"/>
            </div>
          </div>

          {(tool==='text')&&(
            <div style={{marginTop:8}}>
              <div style={{fontSize:10,color:'var(--text2)',marginBottom:4}}>Color de texto</div>
              <div className="quick-palette">
                {QUICK_COLORS.map(c=>(
                  <button key={c} className={`pal-color ${strokeColor===c?'active':''}`}
                    style={{background:c,border:c==='#FFFFFF'?'2px solid var(--border)':'2px solid transparent'}}
                    onClick={()=>{setStrokeColor(c);strokeR.current=c;}}/>
                ))}
              </div>
            </div>
          )}

          {['rect','circle','triangle','line','arrow'].includes(tool)&&(
            <div style={{marginTop:8}}>
              <div style={{fontSize:10,color:'var(--text2)',marginBottom:4}}>Color de contorno</div>
              <div className="quick-palette">
                {QUICK_COLORS.map(c=>(
                  <button key={c} className={`pal-color ${strokeColor===c?'active':''}`}
                    style={{background:c,border:c==='#FFFFFF'?'2px solid var(--border)':'2px solid transparent'}}
                    onClick={()=>{setStrokeColor(c);strokeR.current=c;}}/>
                ))}
              </div>
            </div>
          )}

          {['rect','circle','triangle'].includes(tool)&&(
            <div style={{marginTop:8}}>
              <div style={{fontSize:10,color:'var(--text2)',marginBottom:4}}>Color de relleno</div>
              <div className="quick-palette">
                {FILL_COLORS.map(c=>(
                  <button key={c} className={`pal-color ${hasFill&&fillColor===c?'active':''}`}
                    style={{background:c}} onClick={()=>{setFillColor(c);fillR.current=c;setHasFill(true);hasFillR.current=true;}}/>
                ))}
                <button className={`no-fill-btn ${!hasFill?'active':''}`} onClick={()=>{setHasFill(false);hasFillR.current=false;}} title="Sin relleno">⊘</button>
              </div>
            </div>
          )}

          <div className="toggle-group" style={{marginTop:8}}>
            <button className={`tog-btn ${hasFill?'active':''}`} onClick={()=>{setHasFill(true);hasFillR.current=true;}}>Relleno</button>
            <button className={`tog-btn ${!hasFill?'active':''}`} onClick={()=>{setHasFill(false);hasFillR.current=false;}}>Sin relleno</button>
          </div>
        </div>

        {/* Stroke */}
        <div className="panel-section">
          <div className="pn-title">Trazo</div>
          <div className="slider-row">
            <div className="slider-label">Grosor <strong>{lineW}</strong> px</div>
            <input type="range" min="1" max="80" value={lineW}
              onChange={e=>{const v=+e.target.value;setLineW(v);lineWR.current=v;}}/>
          </div>
          <div className="slider-row">
            <div className="slider-label">Opacidad <strong>{opacityVal}</strong>%</div>
            <input type="range" min="5" max="100" value={opacityVal}
              onChange={e=>{const v=+e.target.value;setOpacityVal(v);opR.current=v/100;}}/>
          </div>
          <div className="slider-row">
            <div className="slider-label">Suavizado <strong>{smoothVal}</strong></div>
            <input type="range" min="0" max="10" value={smoothVal}
              onChange={e=>{const v=+e.target.value;setSmoothVal(v);smoothR.current=v;}}/>
          </div>
        </div>

        {/* Text */}
        <div className="panel-section">
          <div className="pn-title">Texto</div>
          <select className="pn-select" value={fontFam}
            onChange={e=>{setFontFam(e.target.value);fontFamR.current=e.target.value;}}>
            <option value="'Segoe UI',system-ui,sans-serif">Segoe UI</option>
            <option value="'Inter',sans-serif">Inter</option>
            <option value="Arial,sans-serif">Arial</option>
            <option value="'Georgia',serif">Georgia</option>
            <option value="'Courier New',monospace">Courier New</option>
            <option value="Impact,sans-serif">Impact</option>
            <option value="Verdana,sans-serif">Verdana</option>
          </select>
          <div className="pn-row">
            <input type="number" className="pn-num" value={fontSz} min={8} max={300} placeholder="Tamaño"
              onChange={e=>{const v=+e.target.value||20;setFontSz(v);fontSzR.current=v;}}/>
            <select className="pn-select" value={fontSt}
              onChange={e=>{setFontSt(e.target.value);fontStR.current=e.target.value;}}>
              <option value="normal">Normal</option>
              <option value="bold">Negrita</option>
              <option value="italic">Cursiva</option>
              <option value="bold italic">Bold+Italic</option>
            </select>
          </div>
        </div>

        {/* Background */}
        <div className="panel-section">
          <div className="pn-title">Fondo</div>
          <div className="toggle-group">
            <button className={`tog-btn ${bgType==='dots'?'active':''}`} onClick={()=>{setBgType('dots');bgTypeR.current='dots';redrawFn.current();}}>· Puntos</button>
            <button className={`tog-btn ${bgType==='grid'?'active':''}`} onClick={()=>{setBgType('grid');bgTypeR.current='grid';redrawFn.current();}}>⊞ Cuadrícula</button>
            <button className={`tog-btn ${bgType==='none'?'active':''}`} onClick={()=>{setBgType('none');bgTypeR.current='none';redrawFn.current();}}>Ninguno</button>
          </div>
          <div style={{marginTop:6}}>
            <div className="toggle-group">
              {BG_PRESETS.map((p,i)=>(
                <button key={i} className={`tog-btn ${bgIdx.current===i?'active':''}`}
                  onClick={()=>{
                    bgIdx.current=i;setDarkMode(p.dark);darkR.current=p.dark;
                    document.documentElement.setAttribute('data-theme',p.dark?'dark':'light');
                    redrawFn.current();
                  }}>{p.label}</button>
              ))}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="panel-section">
          <div className="pn-title">Acciones</div>
          <div className="action-grid">
            <button className="act-btn" onClick={handleSave}>💾 Guardar</button>
            <button className="act-btn" onClick={handleLoad}>📂 Cargar</button>
            <button className="act-btn" onClick={handleExportPNG}>📷 PNG</button>
            <button className="act-btn" onClick={handleExportSVG}>🖊 SVG</button>
            <button className="act-btn drive full" onClick={handleSaveToDrive}>☁️ Guardar en Drive</button>
            <button className="act-btn danger full" onClick={handleClear}>🗑️ Limpiar pizarra</button>
          </div>
        </div>

        {/* Google Drive info */}
        <div className="panel-section">
          <div className="pn-title" style={{color:'var(--text2)'}}>Google Drive</div>
          <div style={{fontSize:10,color:'var(--text2)',lineHeight:1.6}}>
            Para guardar en Drive automáticamente necesitas una <b>API Key de Google</b>. Exporta el PNG y súbelo manualmente por ahora. <a href="https://console.cloud.google.com" target="_blank" rel="noreferrer" style={{color:'var(--accent)'}}>Crear proyecto</a>
          </div>
        </div>

        {/* Footer */}
        <div className="panel-footer">
          <strong>Drawdams v1.1</strong><br/>
          Código abierto · Licencia MIT<br/>
          <a href="https://github.com/drawdams" target="_blank" rel="noreferrer">★ GitHub</a>
        </div>
      </div>

      {/* ═══ TEXT OVERLAY ═══ */}
      {textOverlay&&(
        <div className="text-wrap" style={{left:textOverlay.left,top:textOverlay.top}}>
          <textarea ref={textAreaRef} className="text-area" rows={2}
            placeholder="Escribe… (Ctrl+Enter para confirmar)"
            style={{
              fontSize:(fontSz*vp.current.scale)+'px',
              fontFamily:fontFam,
              fontStyle:fontSt.includes('italic')?'italic':'normal',
              fontWeight:fontSt.includes('bold')?'700':'400',
              color:strokeColor,
            }}
            onKeyDown={handleTextKeyDown}/>
        </div>
      )}

      {/* ═══ TOAST ═══ */}
      <div className={`toast ${toastMsg?'show':''}`}>{toastMsg}</div>

      {/* ═══ SELECTION BAR ═══ */}
      {selIdx>=0&&(
        <div className="sel-bar">
          <span style={{fontSize:12,color:'var(--text)'}}>1 elemento seleccionado</span>
          <div className="hud-sep"/>
          <button className="sel-bar-btn" onClick={handleSelDup}>⧉ Duplicar</button>
          <button className="sel-bar-btn" onClick={handleSelFront}>⬆ Al frente</button>
          <button className="sel-bar-btn" onClick={handleSelBack}>⬇ Al fondo</button>
          <button className="sel-bar-btn danger" onClick={handleSelDel}>✕ Eliminar</button>
        </div>
      )}

      {/* ═══ SHORTCUTS BAR ═══ */}
      {showSB&&(
        <div className="shortcuts-bar">
          <span className="sc-tag"><span className="key">D</span> Cambiar fondo</span>
          <span className="sc-tag"><span className="key">Ctrl+Z</span> Deshacer</span>
          <span className="sc-tag"><span className="key">Ctrl+Y</span> Rehacer</span>
          <span className="sc-tag"><span className="key">Espacio+Arrastrar</span> Mover lienzo</span>
          <span className="sc-tag"><span className="key">Scroll</span> Zoom</span>
          <span className="sc-tag"><span className="key">Ctrl+V</span> Pegar imagen</span>
          <button className="sb-toggle" onClick={()=>setShowSB(false)} title="Ocultar">✕</button>
        </div>
      )}
      {!showSB&&(
        <button style={{position:'fixed',bottom:8,right:'calc(var(--pn-w) + 12px)',zIndex:190,
          background:'var(--surface)',border:'1px solid var(--border)',borderRadius:'8px',
          padding:'4px 10px',fontSize:11,color:'var(--text2)',cursor:'pointer',display:'flex',alignItems:'center',gap:4}}
          onClick={()=>setShowSB(true)}>
          ⌨️ Atajos
        </button>
      )}

      {/* ═══ SHORTCUTS MODAL ═══ */}
      {showModal&&(
        <div className="modal-bg" onClick={e=>{if(e.target===e.currentTarget)setShowModal(false);}}>
          <div className="modal-box">
            <div className="modal-header">
              <h2>⌨️ Atajos de teclado</h2>
              <button className="modal-close-btn" onClick={()=>setShowModal(false)}>✕</button>
            </div>
            <div className="shortcut-grid">
              <div className="sc-item"><span className="key">P</span>Lápiz</div>
              <div className="sc-item"><span className="key">E</span>Borrador</div>
              <div className="sc-item"><span className="key">V</span>Seleccionar</div>
              <div className="sc-item"><span className="key">T</span>Texto</div>
              <div className="sc-item"><span className="key">R</span>Rectángulo</div>
              <div className="sc-item"><span className="key">C</span>Círculo</div>
              <div className="sc-item"><span className="key">L</span>Línea</div>
              <div className="sc-item"><span className="key">A</span>Flecha</div>
              <div className="sc-item"><span className="key">G</span>Triángulo</div>
              <div className="sc-item"><span className="key">I</span>Subir imagen</div>
              <div className="sc-item"><span className="key">Ctrl+V</span>Pegar imagen</div>
              <div className="sc-item"><span className="key">Ctrl Z</span>Deshacer</div>
              <div className="sc-item"><span className="key">Ctrl Y</span>Rehacer</div>
              <div className="sc-item"><span className="key">Ctrl S</span>Guardar</div>
              <div className="sc-item"><span className="key">Del</span>Eliminar selección</div>
              <div className="sc-item"><span className="key">Esc</span>Deseleccionar</div>
              <div className="sc-item"><span className="key">D</span>Cambiar fondo</div>
              <div className="sc-item"><span className="key">Rueda</span>Zoom</div>
              <div className="sc-item"><span className="key">Espacio+drag</span>Paneo</div>
              <div className="sc-item"><span className="key">Ctrl+Enter</span>Confirmar texto</div>
              <div className="sc-item"><span className="key">0</span>Restablecer vista</div>
            </div>
          </div>
        </div>
      )}

      {/* Hidden file input */}
      <input type="file" ref={fileInputRef} accept="image/*" style={{display:'none'}} onChange={handleFileChange}/>
    </div>
  );
}
