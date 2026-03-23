/**
 * Raycaster.jsx  ─  now powered by Three.js
 *
 * Install:  npm install three
 * Drop-in replacement – same props: onEncounter, onPickup
 *
 * Controls:
 *   W / S          – move forward / back
 *   A / D          – strafe left / right
 *   ← →            – turn
 *   Shift          – sprint
 *   SPACE          – cast wand (fires at aimed enemy)
 *   Click canvas   – lock pointer for mouse look
 */

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { worldMap, mapWidth, mapHeight } from './gameMap';

// ─── Constants ─────────────────────────────────────────────────────────────
const WALL_H     = 2.6;
const EYE_H      = 1.05;
const MOVE_SPEED = 0.058;
const ROT_SPEED  = 0.033;
const MOUSE_SENS = 0.0019;
const FOG_NEAR   = 1;
const FOG_FAR    = 16;
const PICKUP_N   = 10;
const TEX        = 128;

// ─── Canvas helper ─────────────────────────────────────────────────────────
const mc = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h || w; return c; };

// ═══════════════════════════════════════════════════════════════════════════
//  WALL TEXTURES
// ═══════════════════════════════════════════════════════════════════════════
function genStone() {
  const c = mc(TEX), ctx = c.getContext('2d');
  ctx.fillStyle = '#5a5550'; ctx.fillRect(0, 0, TEX, TEX);
  for (let i = 0; i < TEX*TEX/4; i++) { const v=(Math.random()*30-15)|0; ctx.fillStyle=`rgb(${90+v},${86+v},${82+v})`; ctx.fillRect((Math.random()*TEX)|0,(Math.random()*TEX)|0,2,2); }
  const bW=32,bH=18; ctx.strokeStyle='#201a14'; ctx.lineWidth=2;
  for (let row=0;row*bH<TEX;row++) { const off=(row%2)*(bW/2); for (let col=-1;col*bW<TEX+bW;col++) { const bx=col*bW+off,by=row*bH,v=(Math.random()*14-7)|0; ctx.fillStyle=`rgb(${82+v},${78+v},${74+v})`; ctx.fillRect(bx+2,by+2,bW-3,bH-3); ctx.strokeRect(bx+1,by+1,bW-2,bH-2); if(Math.random()<0.3){ctx.save();ctx.strokeStyle='#14100c';ctx.lineWidth=1;ctx.beginPath();const sx=bx+4+Math.random()*(bW-8),sy=by+4+Math.random()*(bH-8);ctx.moveTo(sx,sy);ctx.lineTo(sx+(Math.random()-0.5)*14,sy+(Math.random()-0.5)*10);ctx.stroke();ctx.restore();} } }
  for (let i=0;i<5;i++) { const mx=Math.random()*TEX,my=Math.random()*TEX,gr=ctx.createRadialGradient(mx,my,0,mx,my,12); gr.addColorStop(0,'rgba(35,65,22,0.5)'); gr.addColorStop(1,'rgba(35,65,22,0)'); ctx.fillStyle=gr; ctx.fillRect(mx-12,my-12,24,24); }
  for (let i=0;i<3;i++) { ctx.fillStyle='rgba(10,8,20,0.28)'; ctx.fillRect((Math.random()*TEX)|0,0,2,TEX); }
  return c;
}

function genBrick() {
  const c = mc(TEX), ctx = c.getContext('2d');
  ctx.fillStyle='#4a2014'; ctx.fillRect(0,0,TEX,TEX);
  for(let i=0;i<TEX*TEX/6;i++){const v=(Math.random()*20-10)|0;ctx.fillStyle=`rgba(${105+v},${40+v},${18+v},0.6)`;ctx.fillRect((Math.random()*TEX)|0,(Math.random()*TEX)|0,2,2);}
  const bW=28,bH=13;
  for(let row=0;row*bH<TEX;row++){const off=(row%2)*(bW/2);for(let col=-1;col*bW<TEX+bW;col++){const bx=col*bW+off,by=row*bH,v=(Math.random()*18-9)|0;ctx.fillStyle=`rgb(${130+v},${48+v},${24+v})`;ctx.fillRect(bx+2,by+2,bW-3,bH-3);}}
  ctx.fillStyle='#1e1008';
  for(let row=0;row*bH<TEX;row++){ctx.fillRect(0,row*bH,TEX,2);const off=(row%2)*(bW/2);for(let col=-1;col*bW<TEX+bW;col++)ctx.fillRect(col*bW+off,row*bH,2,bH);}
  for(let i=0;i<3;i++){const sx=Math.random()*TEX,sy=Math.random()*TEX,gr=ctx.createRadialGradient(sx,sy,0,sx,sy,20);gr.addColorStop(0,'rgba(0,0,0,0.45)');gr.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=gr;ctx.fillRect(sx-20,sy-20,40,40);}
  return c;
}

function genWood() {
  const c = mc(TEX), ctx = c.getContext('2d');
  ctx.fillStyle='#201004'; ctx.fillRect(0,0,TEX,TEX);
  const pW=20;
  for(let col=0;col*pW<TEX;col++){const v=(Math.random()*16)|0;ctx.fillStyle=`rgb(${48+v},${22+v},${7+v/2})`;ctx.fillRect(col*pW+1,0,pW-1,TEX);ctx.strokeStyle='rgba(0,0,0,0.22)';ctx.lineWidth=1;for(let g=0;g<8;g++){const gx=col*pW+2+Math.random()*(pW-4);ctx.beginPath();ctx.moveTo(gx,0);ctx.lineTo(gx+(Math.random()-0.5)*4,TEX);ctx.stroke();}}
  ctx.fillStyle='#0e0602'; for(let col=1;col*pW<TEX;col++) ctx.fillRect(col*pW,0,2,TEX);
  for(let i=0;i<4;i++){ctx.fillStyle='#140800';ctx.fillRect(0,(TEX/4)*i,TEX,3);}
  for(let i=0;i<3;i++)for(let col=0;col*pW<TEX;col++){const rx=col*pW+pW/2,ry=(TEX/4)*i+TEX/8,rg=ctx.createRadialGradient(rx-1,ry-1,0,rx,ry,4);rg.addColorStop(0,'#686058');rg.addColorStop(1,'#201810');ctx.fillStyle=rg;ctx.beginPath();ctx.arc(rx,ry,3.5,0,Math.PI*2);ctx.fill();}
  // Torch sconce & glow
  ctx.fillStyle='#120a02'; ctx.fillRect(TEX*.45,TEX*.2,TEX*.1,TEX*.35);
  const tg=ctx.createRadialGradient(TEX*.5,TEX*.18,0,TEX*.5,TEX*.25,20);tg.addColorStop(0,'rgba(255,150,18,0.55)');tg.addColorStop(1,'rgba(255,90,0,0)');ctx.fillStyle=tg;ctx.fillRect(TEX*.28,TEX*.04,TEX*.44,TEX*.42);
  return c;
}

function genFloor() {
  const c = mc(TEX), ctx = c.getContext('2d');
  ctx.fillStyle='#1c1810'; ctx.fillRect(0,0,TEX,TEX);
  for(let i=0;i<TEX*TEX/3;i++){const v=(Math.random()*18-9)|0;ctx.fillStyle=`rgb(${40+v},${36+v},${32+v})`;ctx.fillRect((Math.random()*TEX)|0,(Math.random()*TEX)|0,2,2);}
  ctx.strokeStyle='#0e0c08'; ctx.lineWidth=1;
  for(let i=0;i<4;i++){ctx.beginPath();ctx.moveTo(Math.random()*TEX,Math.random()*TEX);ctx.lineTo(Math.random()*TEX,Math.random()*TEX);ctx.stroke();}
  return c;
}

function genCeiling() {
  const c = mc(TEX), ctx = c.getContext('2d');
  ctx.fillStyle='#0a0810'; ctx.fillRect(0,0,TEX,TEX);
  for(let i=0;i<TEX*TEX/5;i++){const v=(Math.random()*12-6)|0;ctx.fillStyle=`rgb(${20+v},${18+v},${24+v})`;ctx.fillRect((Math.random()*TEX)|0,(Math.random()*TEX)|0,2,2);}
  return c;
}

// ═══════════════════════════════════════════════════════════════════════════
//  ANIMATED DRAGON (12 frames)
// ═══════════════════════════════════════════════════════════════════════════
function genDragonFrame(phase) {
  const c = mc(TEX), ctx = c.getContext('2d');
  const cx = TEX*.5, base = TEX*.88;
  const wF = Math.sin(phase)*.44, fU = Math.cos(phase);
  const breathe = Math.sin(phase*1.5) > 0.55;

  ctx.fillStyle='rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(cx,base,TEX*.18,TEX*.024,0,0,Math.PI*2); ctx.fill();

  // Wings
  [[-1,-.3],[1,.3]].forEach(([dir,baseRot]) => {
    ctx.save(); ctx.translate(cx+dir*TEX*.17,base-TEX*.36); ctx.rotate(baseRot+dir*wF*.9);
    ctx.fillStyle='#200828';
    ctx.beginPath(); ctx.moveTo(0,0);
    ctx.bezierCurveTo(dir*TEX*.14,-TEX*.04-fU*TEX*.07,dir*TEX*.40,-TEX*.07-fU*TEX*.16,dir*TEX*.44,-TEX*.01-fU*TEX*.11);
    ctx.bezierCurveTo(dir*TEX*.38,TEX*.09,dir*TEX*.19,TEX*.15,0,TEX*.03); ctx.closePath(); ctx.fill();
    ctx.strokeStyle='#3a0a50'; ctx.lineWidth=1.5;
    for(let i=0;i<3;i++){const t=(i+1)/4; ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(dir*TEX*.4*t,(-TEX*.05-fU*TEX*.14)*t); ctx.stroke();}
    ctx.strokeStyle='rgba(80,10,80,0.28)'; ctx.lineWidth=0.5;
    for(let i=0;i<5;i++){ctx.beginPath();ctx.moveTo(dir*TEX*.01*i,TEX*.02*i);ctx.lineTo(dir*TEX*.28+dir*TEX*.015*i,-TEX*.03-fU*TEX*.09+TEX*.02*i);ctx.stroke();}
    ctx.restore();
  });

  // Tail
  ctx.strokeStyle='#28100e'; ctx.lineWidth=7; ctx.lineCap='round';
  ctx.beginPath(); ctx.moveTo(cx-TEX*.14,base-TEX*.14); ctx.quadraticCurveTo(cx-TEX*.48,base-TEX*.04,cx-TEX*.52,base-TEX*.38); ctx.stroke();
  ctx.lineWidth=3; ctx.strokeStyle='#3c1418';
  ctx.beginPath(); ctx.moveTo(cx-TEX*.14,base-TEX*.14); ctx.quadraticCurveTo(cx-TEX*.46,base-TEX*.04,cx-TEX*.5,base-TEX*.36); ctx.stroke();
  ctx.fillStyle='#3c0c14'; ctx.beginPath(); ctx.moveTo(cx-TEX*.52,base-TEX*.38); ctx.lineTo(cx-TEX*.62,base-TEX*.49); ctx.lineTo(cx-TEX*.47,base-TEX*.41); ctx.closePath(); ctx.fill();

  // Body
  const bGr=ctx.createRadialGradient(cx-TEX*.05,base-TEX*.3,0,cx,base-TEX*.26,TEX*.23);
  bGr.addColorStop(0,'#4a1830'); bGr.addColorStop(0.6,'#2a0c1c'); bGr.addColorStop(1,'#0e0408');
  ctx.fillStyle=bGr; ctx.beginPath(); ctx.ellipse(cx,base-TEX*.26,TEX*.21,TEX*.24,0,0,Math.PI*2); ctx.fill();
  ctx.strokeStyle='#3a1020'; ctx.lineWidth=0.8;
  for(let row=0;row<4;row++)for(let col=-2;col<=2;col++){const sx=cx+col*TEX*.07+(row%2)*TEX*.035,sy=base-TEX*.12-row*TEX*.065;ctx.beginPath();ctx.arc(sx,sy,TEX*.029,Math.PI,Math.PI*2);ctx.stroke();}

  // Legs
  ctx.strokeStyle='#1e0810'; ctx.lineWidth=5; ctx.lineCap='round';
  [[cx-TEX*.12,1],[cx+TEX*.12,-1]].forEach(([lx,d])=>{
    ctx.beginPath();ctx.moveTo(lx,base-TEX*.06);ctx.lineTo(lx+d*TEX*.07,base+TEX*.06);ctx.stroke();
    ctx.lineWidth=2.5;
    for(let t=0;t<3;t++){const a=(t-1)*.5;ctx.beginPath();ctx.moveTo(lx+d*TEX*.07,base+TEX*.06);ctx.lineTo(lx+d*(TEX*.13+Math.sin(a)*TEX*.07),base+TEX*.12);ctx.stroke();}
    ctx.lineWidth=5;
  });

  // Neck
  ctx.strokeStyle='#250c14'; ctx.lineWidth=9; ctx.lineCap='round';
  ctx.beginPath(); ctx.moveTo(cx,base-TEX*.48); ctx.quadraticCurveTo(cx+TEX*.11,base-TEX*.62,cx+TEX*.09,base-TEX*.7); ctx.stroke();
  ctx.lineWidth=5; ctx.strokeStyle='#3a1020';
  ctx.beginPath(); ctx.moveTo(cx,base-TEX*.48); ctx.quadraticCurveTo(cx+TEX*.09,base-TEX*.6,cx+TEX*.07,base-TEX*.68); ctx.stroke();
  ctx.fillStyle='#5c2438';
  for(let i=0;i<4;i++){const nx=cx+TEX*.02+i*TEX*.023,ny=base-TEX*.51-i*TEX*.052;ctx.beginPath();ctx.moveTo(nx-2.5,ny);ctx.lineTo(nx,ny-TEX*.042+i*TEX*.007);ctx.lineTo(nx+2.5,ny);ctx.closePath();ctx.fill();}

  // Head
  const hx=cx+TEX*.09,hy=base-TEX*.78;
  const hGr=ctx.createRadialGradient(hx-TEX*.04,hy,0,hx,hy,TEX*.155);
  hGr.addColorStop(0,'#561626'); hGr.addColorStop(0.65,'#2c0a16'); hGr.addColorStop(1,'#140408');
  ctx.fillStyle=hGr; ctx.beginPath(); ctx.ellipse(hx,hy,TEX*.15,TEX*.125,0.22,0,Math.PI*2); ctx.fill();

  // Horns
  [[hx-TEX*.065,hy-TEX*.075,hx-TEX*.145,hy-TEX*.24,hx-TEX*.035,hy-TEX*.075],[hx+TEX*.04,hy-TEX*.08,hx+TEX*.085,hy-TEX*.26,hx+TEX*.125,hy-TEX*.085]].forEach(([x1,y1,x2,y2,x3,y3])=>{
    ctx.fillStyle='#300a14'; ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.lineTo(x3,y3); ctx.closePath(); ctx.fill();
    ctx.fillStyle='#521422'; ctx.beginPath(); ctx.moveTo((x1+x3)/2,(y1+y3)/2); ctx.lineTo(x2+TEX*.01,y2+TEX*.035); ctx.lineTo((x1+x3)/2+TEX*.018,(y1+y3)/2); ctx.closePath(); ctx.fill();
  });

  // Snout & nostrils
  ctx.fillStyle='#361020'; ctx.beginPath(); ctx.ellipse(hx+TEX*.115,hy+TEX*.04,TEX*.077,TEX*.052,0.18,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='#160606'; ctx.beginPath(); ctx.ellipse(hx+TEX*.15,hy+TEX*.02,TEX*.013,TEX*.011,0,0,Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(hx+TEX*.125,hy+TEX*.04,TEX*.011,TEX*.009,0,0,Math.PI*2); ctx.fill();

  // Jaw
  const jawDrop = breathe ? TEX*.04 : TEX*.01;
  ctx.fillStyle='#18060c'; ctx.beginPath(); ctx.ellipse(hx+TEX*.095,hy+TEX*.1+jawDrop,TEX*.077,TEX*.028+jawDrop*.5,0.14,0,Math.PI*2); ctx.fill();
  if(breathe){ctx.fillStyle='#d8ceb8';for(let t=0;t<4;t++){ctx.beginPath();ctx.moveTo(hx+TEX*.06+t*TEX*.037,hy+TEX*.072);ctx.lineTo(hx+TEX*.065+t*TEX*.037,hy+TEX*.1+jawDrop);ctx.lineTo(hx+TEX*.082+t*TEX*.037,hy+TEX*.072);ctx.closePath();ctx.fill();}}

  // Eyes
  [[hx-TEX*.038,hy-TEX*.028],[hx+TEX*.042,hy-TEX*.032]].forEach(([ex,ey])=>{
    ctx.fillStyle='#000'; ctx.beginPath(); ctx.ellipse(ex,ey,TEX*.04,TEX*.04,0,0,Math.PI*2); ctx.fill();
    const eg=ctx.createRadialGradient(ex,ey,0,ex,ey,TEX*.038);
    eg.addColorStop(0,'rgba(255,70,0,1)'); eg.addColorStop(0.5,'rgba(205,24,0,0.85)'); eg.addColorStop(1,'rgba(150,0,0,0)');
    ctx.fillStyle=eg; ctx.beginPath(); ctx.ellipse(ex,ey,TEX*.038,TEX*.038,0,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='rgba(0,0,0,0.82)'; ctx.beginPath(); ctx.ellipse(ex,ey,TEX*.008,TEX*.026,0,0,Math.PI*2); ctx.fill();
    const glow=ctx.createRadialGradient(ex,ey,0,ex,ey,TEX*.09);
    glow.addColorStop(0,`rgba(255,55,0,${breathe?.48:.22})`); glow.addColorStop(1,'rgba(255,55,0,0)');
    ctx.fillStyle=glow; ctx.fillRect(ex-TEX*.09,ey-TEX*.09,TEX*.18,TEX*.18);
  });

  // Fire breath
  if(breathe){
    for(let fi=0;fi<14;fi++){
      const fp=Math.random(),fx=hx+TEX*.19+fp*TEX*.58,fy=hy+TEX*.065+(Math.random()-.5)*TEX*.055*fp,fr=(TEX*.048+Math.random()*TEX*.038)*(1-fp*.5),fa=(1-fp)*.9;
      const fGr=ctx.createRadialGradient(fx,fy,0,fx,fy,fr);
      fGr.addColorStop(0,`rgba(255,255,200,${fa})`); fGr.addColorStop(0.3,`rgba(255,${Math.floor(200*(1-fp))},0,${fa*.85})`); fGr.addColorStop(1,'rgba(180,20,0,0)');
      ctx.fillStyle=fGr; ctx.beginPath(); ctx.arc(fx,fy,fr,0,Math.PI*2); ctx.fill();
    }
    const fL=ctx.createRadialGradient(hx+TEX*.19,hy+TEX*.065,0,hx+TEX*.19,hy+TEX*.065,TEX*.24);
    fL.addColorStop(0,'rgba(255,140,0,0.38)'); fL.addColorStop(1,'rgba(255,140,0,0)');
    ctx.fillStyle=fL; ctx.fillRect(hx,hy-TEX*.17,TEX*.44,TEX*.35);
  }
  return c;
}

// ═══════════════════════════════════════════════════════════════════════════
//  ANIMATED GOBLIN (8 frames)
// ═══════════════════════════════════════════════════════════════════════════
function genGoblinFrame(phase) {
  const c = mc(TEX), ctx = c.getContext('2d');
  const cx=TEX*.5, base=TEX*.87, bob=Math.sin(phase)*3, as=Math.sin(phase)*.34;

  ctx.fillStyle='rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(cx,base+bob*.2,TEX*.13,TEX*.023,0,0,Math.PI*2); ctx.fill();

  // Legs
  ctx.fillStyle='#285020';
  ctx.beginPath(); ctx.ellipse(cx-TEX*.08,base-TEX*.1+Math.abs(bob)*.28,TEX*.052,TEX*.115,0.1+as*.2,0,Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(cx+TEX*.08,base-TEX*.1-Math.abs(bob)*.28,TEX*.052,TEX*.115,-0.1-as*.2,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='#180e08';
  ctx.beginPath(); ctx.ellipse(cx-TEX*.1,base,TEX*.065,TEX*.038,0.3,0,Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(cx+TEX*.1,base,TEX*.065,TEX*.038,-0.3,0,Math.PI*2); ctx.fill();

  // Body
  const bGr=ctx.createRadialGradient(cx-TEX*.04,base-TEX*.29+bob,0,cx,base-TEX*.25+bob,TEX*.18);
  bGr.addColorStop(0,'#489040'); bGr.addColorStop(1,'#285028');
  ctx.fillStyle=bGr; ctx.beginPath(); ctx.ellipse(cx,base-TEX*.25+bob,TEX*.155,TEX*.18,0,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='#382808'; ctx.beginPath();
  ctx.moveTo(cx-TEX*.14,base-TEX*.11+bob); ctx.lineTo(cx-TEX*.085,base-TEX*.29+bob); ctx.lineTo(cx,base-TEX*.19+bob); ctx.lineTo(cx+TEX*.085,base-TEX*.29+bob); ctx.lineTo(cx+TEX*.14,base-TEX*.11+bob); ctx.closePath(); ctx.fill();
  ctx.fillStyle='#583010'; ctx.fillRect(cx-TEX*.155,base-TEX*.155+bob,TEX*.31,TEX*.028);
  ctx.fillStyle='#c0a020'; ctx.fillRect(cx-TEX*.024,base-TEX*.17+bob,TEX*.048,TEX*.052);

  // Arms
  ctx.fillStyle='#387030';
  ctx.beginPath(); ctx.ellipse(cx-TEX*.22,base-TEX*.22+bob-as*TEX*.05,TEX*.047,TEX*.115,0.2+as,0,Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(cx-TEX*.25,base-TEX*.1+bob-as*TEX*.08,TEX*.047,TEX*.038,0,0,Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(cx+TEX*.22,base-TEX*.23+bob+as*TEX*.05,TEX*.047,TEX*.125,-0.24-as,0,Math.PI*2); ctx.fill();

  // Club
  ctx.save(); ctx.translate(cx+TEX*.23,base-TEX*.11+bob+as*TEX*.06); ctx.rotate(0.28+as);
  ctx.fillStyle='#583010'; ctx.fillRect(-TEX*.023,-TEX*.25,TEX*.046,TEX*.25);
  const cGr=ctx.createRadialGradient(0,-TEX*.29,0,0,-TEX*.27,TEX*.088);cGr.addColorStop(0,'#643810');cGr.addColorStop(1,'#281008');
  ctx.fillStyle=cGr; ctx.beginPath(); ctx.ellipse(0,-TEX*.29,TEX*.088,TEX*.075,0,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='#888';
  [[TEX*.078,-TEX*.37,TEX*.135,-TEX*.44,TEX*.038,-TEX*.35],[-(TEX*.078),-TEX*.35,-(TEX*.135),-TEX*.43,-(TEX*.038),-TEX*.33]].forEach(([x1,y1,x2,y2,x3,y3])=>{ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.lineTo(x3,y3);ctx.closePath();ctx.fill();});
  ctx.restore();

  // Head
  const hGr=ctx.createRadialGradient(cx-TEX*.038,base-TEX*.55+bob,0,cx,base-TEX*.53+bob,TEX*.145);
  hGr.addColorStop(0,'#509048'); hGr.addColorStop(1,'#2c5e26');
  ctx.fillStyle=hGr; ctx.beginPath(); ctx.ellipse(cx,base-TEX*.54+bob,TEX*.135,TEX*.15,0,0,Math.PI*2); ctx.fill();

  // Ears
  [[-0.15,-0.09,-0.22,-0.18,-0.1],[0.15,-0.09,0.22,-0.18,0.1]].forEach(([dx,dy,ex,ey,dx2])=>{
    ctx.fillStyle='#387030'; ctx.beginPath(); ctx.moveTo(cx+dx*TEX,base+(dy-.455)*TEX+bob); ctx.lineTo(cx+ex*TEX,base+(ey-.455)*TEX+bob); ctx.lineTo(cx+dx2*TEX,base+(dy-.455)*TEX+bob); ctx.closePath(); ctx.fill();
    ctx.fillStyle='#489040'; ctx.beginPath(); ctx.moveTo(cx+dx*TEX*.84,base+(dy-.455)*TEX+bob); ctx.lineTo(cx+ex*TEX*.9,base+(ey-.445)*TEX+bob); ctx.lineTo(cx+dx2*TEX*.84,base+(dy-.455)*TEX+bob); ctx.closePath(); ctx.fill();
  });

  // Eyes
  [[cx-TEX*.053,base-TEX*.565+bob],[cx+TEX*.053,base-TEX*.565+bob]].forEach(([ex,ey])=>{
    ctx.fillStyle='#000'; ctx.beginPath(); ctx.ellipse(ex,ey,TEX*.034,TEX*.036,0,0,Math.PI*2); ctx.fill();
    const eg=ctx.createRadialGradient(ex,ey,0,ex,ey,TEX*.03);eg.addColorStop(0,'rgba(255,18,0,1)');eg.addColorStop(0.55,'rgba(195,8,0,0.8)');eg.addColorStop(1,'rgba(170,0,0,0)');
    ctx.fillStyle=eg; ctx.beginPath(); ctx.ellipse(ex,ey,TEX*.03,TEX*.032,0,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='rgba(255,90,55,0.55)'; ctx.beginPath(); ctx.arc(ex+TEX*.009,ey-TEX*.011,TEX*.008,0,Math.PI*2); ctx.fill();
  });

  // Nose + mouth
  ctx.fillStyle='#2c5e26'; ctx.beginPath(); ctx.ellipse(cx,base-TEX*.52+bob,TEX*.019,TEX*.022,0,0,Math.PI*2); ctx.fill();
  ctx.strokeStyle='#160808'; ctx.lineWidth=2; ctx.beginPath(); ctx.arc(cx,base-TEX*.498+bob,TEX*.058,.2,Math.PI-.2); ctx.stroke();
  ctx.fillStyle='#e4dccc'; for(let t=0;t<4;t++) ctx.fillRect(cx-TEX*.048+t*TEX*.031,base-TEX*.498+bob,TEX*.019,TEX*.02);
  return c;
}

// ═══════════════════════════════════════════════════════════════════════════
//  SCARY MUSIC
// ═══════════════════════════════════════════════════════════════════════════
class ScaryMusic {
  constructor() { this.ctx=null; this.master=null; this.nodes=[]; this.timers=[]; this.alive=false; }
  start() {
    if(this.alive) return;
    try {
      this.ctx = new (window.AudioContext||window.webkitAudioContext)();
      this.master = this.ctx.createGain(); this.master.gain.value=0.5; this.master.connect(this.ctx.destination);
      this.alive = true;
      this._drone(); this._heartbeat(); this._wind(); this._stabs(); this._descent();
    } catch(e) { console.warn('Audio failed',e); }
  }
  _drone() {
    [[55,'sawtooth',.13],[55.4,'sawtooth',.09],[82.4,'sine',.065],[110,'triangle',.048],[146.8,'sine',.038]].forEach(([freq,type,vol],i)=>{
      const o=this.ctx.createOscillator(),g=this.ctx.createGain(),lpf=this.ctx.createBiquadFilter();
      o.type=type; o.frequency.value=freq; lpf.type='lowpass'; lpf.frequency.value=320+i*70; lpf.Q.value=1.4; g.gain.value=vol;
      const lfo=this.ctx.createOscillator(),lg=this.ctx.createGain(); lfo.frequency.value=0.07+i*.055; lg.gain.value=vol*.25; lfo.connect(lg); lg.connect(g.gain); lfo.start();
      o.connect(lpf); lpf.connect(g); g.connect(this.master); o.start(); this.nodes.push(o,lfo);
    });
  }
  _heartbeat() {
    const b=()=>{
      if(!this.alive) return; const now=this.ctx.currentTime;
      [[0,64,28,.3],[0.27,54,24,.2]].forEach(([delay,f1,f2,vol])=>{
        const o=this.ctx.createOscillator(),g=this.ctx.createGain(); o.type='sine';
        o.frequency.setValueAtTime(f1,now+delay); o.frequency.exponentialRampToValueAtTime(f2,now+delay+.2);
        g.gain.setValueAtTime(vol,now+delay); g.gain.exponentialRampToValueAtTime(.001,now+delay+.32);
        o.connect(g); g.connect(this.master); o.start(now+delay); o.stop(now+delay+.45);
      });
      this.timers.push(setTimeout(b,1300+Math.random()*280));
    };
    this.timers.push(setTimeout(b,700));
  }
  _wind() {
    const sr=this.ctx.sampleRate,buf=this.ctx.createBuffer(1,sr*3,sr),d=buf.getChannelData(0);
    for(let i=0;i<d.length;i++) d[i]=Math.random()*2-1;
    const src=this.ctx.createBufferSource(); src.buffer=buf; src.loop=true;
    const bp=this.ctx.createBiquadFilter(); bp.type='bandpass'; bp.frequency.value=580; bp.Q.value=0.38;
    const g=this.ctx.createGain(); g.gain.value=0.035;
    const lfo=this.ctx.createOscillator(),lg=this.ctx.createGain(); lfo.frequency.value=0.038; lg.gain.value=0.024; lfo.connect(lg); lg.connect(g.gain); lfo.start();
    src.connect(bp); bp.connect(g); g.connect(this.master); src.start(); this.nodes.push(src,lfo);
  }
  _stabs() {
    const s=()=>{
      if(!this.alive) return; const now=this.ctx.currentTime;
      [196,233.1,277.2,311.1,370].slice(0,2+(Math.random()*3|0)).forEach(freq=>{
        const o=this.ctx.createOscillator(),g=this.ctx.createGain(),f=this.ctx.createBiquadFilter();
        o.type='sawtooth'; o.frequency.value=freq*(Math.random()<.22?.5:1); f.type='lowpass'; f.frequency.value=1000;
        g.gain.setValueAtTime(.001,now); g.gain.linearRampToValueAtTime(.1,now+.1); g.gain.exponentialRampToValueAtTime(.001,now+2.6);
        o.connect(f); f.connect(g); g.connect(this.master); o.start(now); o.stop(now+3);
      });
      this.timers.push(setTimeout(s,5000+Math.random()*8500));
    };
    this.timers.push(setTimeout(s,3500+Math.random()*3500));
  }
  _descent() {
    const notes=[220,207.7,196,185,174.6,164.8,155.6,146.8,138.6,130.8,123.5,116.5,110]; let idx=0;
    const p=()=>{
      if(!this.alive) return; const now=this.ctx.currentTime,freq=notes[idx++%notes.length];
      const o=this.ctx.createOscillator(),g=this.ctx.createGain(),f=this.ctx.createBiquadFilter();
      o.type='triangle'; o.frequency.value=freq; f.type='bandpass'; f.frequency.value=freq*1.5; f.Q.value=2.8;
      g.gain.setValueAtTime(0,now); g.gain.linearRampToValueAtTime(.05,now+.45); g.gain.setValueAtTime(.05,now+1.1); g.gain.exponentialRampToValueAtTime(.001,now+3);
      o.connect(f); f.connect(g); g.connect(this.master); o.start(now); o.stop(now+3.5);
      this.timers.push(setTimeout(p,2200+Math.random()*1600));
    };
    this.timers.push(setTimeout(p,2400));
  }
  fireBlast() {
    if(!this.ctx) return; const now=this.ctx.currentTime;
    [[750,155,0,.2],[185,38,.11,.17]].forEach(([f1,f2,delay,vol])=>{
      const o=this.ctx.createOscillator(),g=this.ctx.createGain(); o.type='sawtooth';
      o.frequency.setValueAtTime(f1,now+delay); o.frequency.exponentialRampToValueAtTime(f2,now+delay+.16);
      g.gain.setValueAtTime(vol,now+delay); g.gain.exponentialRampToValueAtTime(.001,now+delay+.26);
      o.connect(g); g.connect(this.master); o.start(now+delay); o.stop(now+delay+.32);
    });
    const o=this.ctx.createOscillator(),g=this.ctx.createGain(); o.type='sine'; o.frequency.value=435;
    g.gain.setValueAtTime(.07,now+.04); g.gain.exponentialRampToValueAtTime(.001,now+.45);
    o.connect(g); g.connect(this.master); o.start(now+.04); o.stop(now+.55);
  }
  stop() {
    this.alive=false; this.timers.forEach(clearTimeout);
    this.nodes.forEach(n=>{try{n.stop();}catch(_){}});
    if(this.ctx) this.ctx.close();
  }
}

// ═══════════════════════════════════════════════════════════════════════════
//  MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════
export default function Raycaster({ onEncounter, onPickup }) {
  const mountRef    = useRef(null);
  const minimapRef  = useRef(null);
  const [hint, setHint] = useState('click_to_start');   // 'click_to_start' | 'playing'
  const [flash, setFlash] = useState(0);                // screen flash 0-1

  const onEncounterRef = useRef(onEncounter);
  const onPickupRef    = useRef(onPickup);
  useEffect(() => { onEncounterRef.current = onEncounter; }, [onEncounter]);
  useEffect(() => { onPickupRef.current    = onPickup;    }, [onPickup]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // ── Renderer ────────────────────────────────────────────────
    const W = container.clientWidth, H = container.clientHeight;
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.setSize(W, H);
    renderer.shadowMap.enabled  = true;
    renderer.shadowMap.type     = THREE.PCFSoftShadowMap;
    renderer.toneMapping        = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.9;
    container.appendChild(renderer.domElement);

    // ── Main scene ──────────────────────────────────────────────
    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x050208, FOG_NEAR, FOG_FAR);
    scene.background = new THREE.Color(0x050208);

    // ── Camera ──────────────────────────────────────────────────
    const camera = new THREE.PerspectiveCamera(72, W / H, 0.05, 50);

    // ── Textures ────────────────────────────────────────────────
    const toTex = (canvas, rx=1, ry=1) => {
      const t = new THREE.CanvasTexture(canvas);
      t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry); return t;
    };
    const stoneTex  = toTex(genStone());
    const brickTex  = toTex(genBrick());
    const woodTex   = toTex(genWood());
    const floorTex  = toTex(genFloor(), mapWidth/2, mapHeight/2);
    const ceilTex   = toTex(genCeiling(), mapWidth/2, mapHeight/2);

    // ── Materials ───────────────────────────────────────────────
    const makeMat = (tex) => new THREE.MeshLambertMaterial({ map: tex });
    const mats = { 1: makeMat(stoneTex), 3: makeMat(brickTex), 4: makeMat(woodTex) };

    // ── Ambient ─────────────────────────────────────────────────
    scene.add(new THREE.AmbientLight(0x180a08, 0.8));

    // ── Floor & Ceiling ─────────────────────────────────────────
    const floorMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(mapWidth, mapHeight),
      new THREE.MeshLambertMaterial({ map: floorTex })
    );
    floorMesh.rotation.x = -Math.PI / 2;
    floorMesh.position.set(mapWidth / 2, 0, mapHeight / 2);
    floorMesh.receiveShadow = true;
    scene.add(floorMesh);

    const ceilMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(mapWidth, mapHeight),
      new THREE.MeshLambertMaterial({ map: ceilTex })
    );
    ceilMesh.rotation.x = Math.PI / 2;
    ceilMesh.position.set(mapWidth / 2, WALL_H, mapHeight / 2);
    scene.add(ceilMesh);

    // ── Walls ───────────────────────────────────────────────────
    const wallGeom = new THREE.BoxGeometry(1, WALL_H, 1);
    for (let x = 0; x < mapWidth; x++) {
      for (let z = 0; z < mapHeight; z++) {
        const t = worldMap[x][z];
        if (!t || t === 2) continue;
        const m = new THREE.Mesh(wallGeom, mats[t] || mats[1]);
        m.position.set(x + 0.5, WALL_H / 2, z + 0.5);
        m.castShadow = m.receiveShadow = true;
        scene.add(m);
      }
    }

    // ── Torches (fixed lights) ───────────────────────────────────
    const fixedTorches = [];
    for (let x = 1; x < mapWidth - 1; x++) {
      for (let z = 1; z < mapHeight - 1; z++) {
        if (worldMap[x][z] !== 0) continue;
        const adj = [worldMap[x+1]?.[z], worldMap[x-1]?.[z], worldMap[x]?.[z+1], worldMap[x]?.[z-1]];
        if (adj.some(v => v && v !== 2) && Math.random() < 0.12) {
          const l = new THREE.PointLight(0xff6010, 1.8, 7, 2);
          l.position.set(x + 0.5, WALL_H * 0.72, z + 0.5);
          scene.add(l);
          // Small flame sphere
          const flame = new THREE.Mesh(
            new THREE.SphereGeometry(0.06, 6, 6),
            new THREE.MeshBasicMaterial({ color: 0xff8820 })
          );
          flame.position.copy(l.position);
          scene.add(flame);
          fixedTorches.push({ light: l, base: l.intensity, flame });
        }
      }
    }

    // ── Player torch (moves with camera) ───────────────────────
    const playerLight = new THREE.PointLight(0xff7820, 3.0, 10, 2);
    playerLight.castShadow = true;
    playerLight.shadow.mapSize.setScalar(512);
    playerLight.shadow.camera.near = 0.1;
    playerLight.shadow.camera.far  = 10;
    scene.add(playerLight);

    // ── Enemy sprites ───────────────────────────────────────────
    const dragonFrames = Array.from({ length: 12 }, (_, i) => genDragonFrame((i / 12) * Math.PI * 2));
    const goblinFrames = Array.from({ length: 8  }, (_, i) => genGoblinFrame((i /  8) * Math.PI * 2));

    const enemies = [];
    for (let x = 0; x < mapWidth; x++) {
      for (let z = 0; z < mapHeight; z++) {
        if (worldMap[x][z] !== 2) continue;
        const type  = Math.random() < 0.45 ? 'dragon' : 'goblin';
        const frames= type === 'dragon' ? dragonFrames : goblinFrames;
        const tex   = new THREE.CanvasTexture(frames[0]);
        const sp    = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true }));
        const scale = type === 'dragon' ? 2.4 : 1.9;
        sp.scale.set(scale, scale, 1);
        sp.position.set(x + 0.5, scale * 0.5, z + 0.5);
        scene.add(sp);
        // Enemy glow (red for dragon, green for goblin)
        const eLight = new THREE.PointLight(type === 'dragon' ? 0xff2200 : 0x40ee20, 1.2, 5, 2);
        eLight.position.copy(sp.position);
        scene.add(eLight);
        enemies.push({ x: x + 0.5, z: z + 0.5, type, frames, tex, sp, eLight, frameIdx: Math.random() * frames.length });
      }
    }

    // ── Pickups ─────────────────────────────────────────────────
    const open = [];
    for (let x = 2; x < mapWidth - 2; x++)
      for (let z = 2; z < mapHeight - 2; z++)
        if (worldMap[x][z] === 0) open.push({ x: x + 0.5, z: z + 0.5 });
    open.sort(() => Math.random() - 0.5);

    const pickups = [];
    for (let i = 0; i < Math.min(PICKUP_N, open.length); i++) {
      const isCoin = i % 3 !== 0;
      const col = isCoin ? 0xffd020 : 0x20dd55;
      const geom = isCoin
        ? new THREE.CylinderGeometry(0.18, 0.18, 0.06, 12)
        : new THREE.SphereGeometry(0.14, 10, 10);
      const mat  = new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 0.6, roughness: 0.3, metalness: isCoin ? 0.8 : 0.1 });
      const mesh = new THREE.Mesh(geom, mat);
      mesh.position.set(open[i].x, 0.28, open[i].z);
      mesh.castShadow = true;
      scene.add(mesh);
      const pLight = new THREE.PointLight(col, 0.8, 3, 2);
      pLight.position.copy(mesh.position);
      scene.add(pLight);
      pickups.push({ ...open[i], type: isCoin ? 'coin' : 'potion', mesh, light: pLight, collected: false, phase: Math.random() * Math.PI * 2 });
    }

    // ── Weapon scene ────────────────────────────────────────────
    const weaponScene  = new THREE.Scene();
    const weaponCamera = new THREE.PerspectiveCamera(62, W / H, 0.01, 10);
    weaponScene.add(new THREE.AmbientLight(0x705030, 1.1));
    const weaponPointLight = new THREE.PointLight(0x4060ff, 1.5, 3);
    weaponPointLight.position.set(0, 0.3, -0.3);
    weaponScene.add(weaponPointLight);

    const wGroup = new THREE.Group();
    // Handle – tapered dark wood cylinder
    const handleMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.022, 0.036, 0.65, 10),
      new THREE.MeshLambertMaterial({ color: 0x1e0c04 })
    );
    handleMesh.rotation.z = 0.18;
    wGroup.add(handleMesh);
    // Leather wraps (thin tori)
    for (let i = 0; i < 5; i++) {
      const wrap = new THREE.Mesh(
        new THREE.TorusGeometry(0.028, 0.008, 5, 16),
        new THREE.MeshLambertMaterial({ color: 0x3a1606 })
      );
      wrap.rotation.y = Math.PI / 2; wrap.position.y = -0.22 + i * 0.11;
      wrap.rotation.z = 0.18; wGroup.add(wrap);
    }
    // Metal band
    const band = new THREE.Mesh(
      new THREE.TorusGeometry(0.034, 0.01, 5, 20),
      new THREE.MeshStandardMaterial({ color: 0x807060, metalness: 0.9, roughness: 0.3 })
    );
    band.rotation.y = Math.PI / 2; band.position.y = 0.3; band.rotation.z = 0.18; wGroup.add(band);
    // Orb
    const orbMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.068, 14, 14),
      new THREE.MeshStandardMaterial({ color: 0x3050ee, emissive: 0x1030bb, emissiveIntensity: 1.4, roughness: 0.05, metalness: 0.2 })
    );
    orbMesh.position.set(0, 0.36, 0); wGroup.add(orbMesh);
    // Inner orb sparkle
    const innerOrb = new THREE.Mesh(
      new THREE.SphereGeometry(0.03, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xaaccff })
    );
    innerOrb.position.set(-0.022, 0.375, 0.022); wGroup.add(innerOrb);
    // Beam (hidden normally)
    const beamMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.012, 0.025, 2.8, 6),
      new THREE.MeshBasicMaterial({ color: 0x88aaff, transparent: true, opacity: 0.7 })
    );
    beamMesh.rotation.x = Math.PI / 2; beamMesh.position.set(0, 0.36, -1.45); beamMesh.visible = false;
    wGroup.add(beamMesh);
    // Burst rings (hidden)
    const rings = Array.from({ length: 3 }, (_, i) => {
      const r = new THREE.Mesh(
        new THREE.TorusGeometry(0.08 + i * 0.08, 0.012, 4, 20),
        new THREE.MeshBasicMaterial({ color: 0x8899ff, transparent: true, opacity: 0.6 - i * 0.15 })
      );
      r.position.set(0, 0.36, -0.05); r.visible = false; wGroup.add(r); return r;
    });

    wGroup.position.set(0.28, -0.34, -0.52);
    weaponScene.add(wGroup);

    // ── Player state ────────────────────────────────────────────
    let px = 2.5, pz = 2.5, yaw = 0;
    camera.position.set(px, EYE_H, pz);
    const keys = {};
    let fireFlashVal = 0;
    let bobPhase = 0;
    let torchFlicker = 1;
    let frameCount = 0;
    const notifs = [];

    // ── Pointer lock ────────────────────────────────────────────
    const music = new ScaryMusic();
    const canvas = renderer.domElement;
    canvas.addEventListener('click', () => { canvas.requestPointerLock(); music.start(); setHint('playing'); });
    document.addEventListener('pointerlockchange', () => {
      if (document.pointerLockElement !== canvas) setHint('click_to_start');
    });
    window.addEventListener('mousemove', e => {
      if (document.pointerLockElement !== canvas) return;
      yaw -= e.movementX * MOUSE_SENS;
    });

    // ── Keyboard ────────────────────────────────────────────────
    const onKD = e => {
      keys[e.key] = true;
      if ((e.key === ' ' || e.code === 'Space') && fireFlashVal <= 0) {
        e.preventDefault();
        fireFlashVal = 1.0;
        music.fireBlast();
        // Aim check
        const forward = new THREE.Vector3(); camera.getWorldDirection(forward);
        let hit = null, bestDot = 0.84;
        enemies.forEach(en => {
          if (worldMap[Math.floor(en.x)][Math.floor(en.z)] !== 2) return;
          const dx = en.x - px, dz = en.z - pz, dist = Math.sqrt(dx*dx + dz*dz);
          if (dist > 7) return;
          const dot = (dx/dist)*forward.x + (dz/dist)*forward.z;
          if (dot > bestDot) { bestDot = dot; hit = en; }
        });
        if (hit) {
          worldMap[Math.floor(hit.x)][Math.floor(hit.z)] = 0;
          setTimeout(() => onEncounterRef.current(), 320);
        }
      }
    };
    const onKU = e => { keys[e.key] = false; };
    window.addEventListener('keydown', onKD);
    window.addEventListener('keyup', onKU);

    // ── Collision helper ────────────────────────────────────────
    const canWalk = (x, z) => {
      if (x < 0 || x >= mapWidth || z < 0 || z >= mapHeight) return false;
      const t = worldMap[Math.floor(x)][Math.floor(z)];
      return t === 0 || t === 2;
    };

    // ── Resize ──────────────────────────────────────────────────
    const onResize = () => {
      const w = container.clientWidth, h = container.clientHeight;
      renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix();
    };
    window.addEventListener('resize', onResize);

    // ── Minimap draw ────────────────────────────────────────────
    const drawMinimap = () => {
      const mc2 = minimapRef.current; if (!mc2) return;
      const mctx = mc2.getContext('2d'); if (!mctx) return;
      const ts = 4, mW = mapWidth*ts, mH = mapHeight*ts;
      mc2.width = mW; mc2.height = mH;
      mctx.fillStyle='rgba(4,3,2,0.88)'; mctx.fillRect(0,0,mW,mH);
      for(let x=0;x<mapWidth;x++)for(let z=0;z<mapHeight;z++){const t=worldMap[x][z];mctx.fillStyle=t===1?'#4a3a24':t===3?'#5a2818':t===4?'#3a2210':t===2?'rgba(180,40,20,0.55)':'#14110d';mctx.fillRect(x*ts,z*ts,ts,ts);}
      pickups.forEach(p=>{if(p.collected)return;mctx.fillStyle=p.type==='coin'?'#c8a020':'#20c050';mctx.beginPath();mctx.arc(p.x*ts,p.z*ts,2,0,Math.PI*2);mctx.fill();});
      enemies.forEach(e=>{if(worldMap[Math.floor(e.x)][Math.floor(e.z)]!==2)return;mctx.fillStyle='rgba(220,40,20,0.9)';mctx.beginPath();mctx.arc(e.x*ts,e.z*ts,2.5,0,Math.PI*2);mctx.fill();});
      const ppx=px*ts, ppz=pz*ts;
      const fw=new THREE.Vector3(); camera.getWorldDirection(fw);
      mctx.fillStyle='#e8d070'; mctx.beginPath(); mctx.arc(ppx,ppz,3,0,Math.PI*2); mctx.fill();
      mctx.strokeStyle='#e8d070'; mctx.lineWidth=1.5;
      mctx.beginPath(); mctx.moveTo(ppx,ppz); mctx.lineTo(ppx+fw.x*10,ppz+fw.z*10); mctx.stroke();
    };

    // ── Game loop ───────────────────────────────────────────────
    let rafId;
    const loop = () => {
      rafId = requestAnimationFrame(loop);
      frameCount++;

      // Movement
      const sprint = keys['Shift'] ? 1.65 : 1;
      const ms = MOVE_SPEED * sprint;
      const fw = new THREE.Vector3(); camera.getWorldDirection(fw); fw.y = 0; fw.normalize();
      const right = new THREE.Vector3().crossVectors(fw, new THREE.Vector3(0,1,0)).normalize();
      let moving = false;

      const tryMove = (dx, dz) => {
        const M = 0.3;
        if (canWalk(px+dx+Math.sign(dx)*M, pz) && canWalk(px+dx-Math.sign(dx)*M, pz)) { px += dx; moving = true; }
        if (canWalk(px, pz+dz+Math.sign(dz)*M) && canWalk(px, pz+dz-Math.sign(dz)*M)) { pz += dz; moving = true; }
      };

      if (keys['w'] || keys['ArrowUp'])    tryMove( fw.x*ms,  fw.z*ms);
      if (keys['s'] || keys['ArrowDown'])  tryMove(-fw.x*ms, -fw.z*ms);
      if (keys['a'])                        tryMove(-right.x*ms, -right.z*ms);
      if (keys['d'])                        tryMove( right.x*ms,  right.z*ms);
      if (keys['ArrowLeft'])               { yaw += ROT_SPEED; }
      if (keys['ArrowRight'])              { yaw -= ROT_SPEED; }

      // Step on enemy
      if (worldMap[Math.floor(px)][Math.floor(pz)] === 2) {
        worldMap[Math.floor(px)][Math.floor(pz)] = 0;
        cancelAnimationFrame(rafId);
        onEncounterRef.current(); return;
      }

      // Pickups
      pickups.forEach(pu => {
        if (pu.collected) return;
        const dx=px-pu.x, dz=pz-pu.z;
        if (dx*dx+dz*dz < 0.35) {
          pu.collected = true; pu.mesh.visible = false; pu.light.visible = false;
          const [txt,col] = pu.type==='coin' ? ['+15 Gold 💰','#f0d040'] : ['+20 Health 🧪','#50e070'];
          notifs.push({ text: txt, color: col, life: 90, y: 0 });
          setFlash(0.5); setTimeout(() => setFlash(0), 400);
          onPickupRef.current?.(pu.type==='coin'?'gold':'health', pu.type==='coin'?15:20);
        }
      });

      // Camera
      camera.position.set(px, EYE_H + (moving ? Math.sin(bobPhase*8)*0.04 : 0), pz);
      camera.rotation.order = 'YXZ'; camera.rotation.y = yaw; camera.rotation.x = 0;
      if (moving) bobPhase += sprint > 1 ? 0.1 : 0.065;

      // Player torch flicker
      torchFlicker += (Math.random()-0.5)*0.035;
      torchFlicker = Math.max(0.82, Math.min(1.0, torchFlicker));
      playerLight.position.copy(camera.position).add(new THREE.Vector3(fw.x*0.5, 0.1, fw.z*0.5));
      playerLight.intensity = 3.0 * torchFlicker;

      // Fixed torches flicker
      fixedTorches.forEach(t => {
        t.light.intensity = t.base * (0.88 + Math.random()*0.24);
        t.flame.material.color.setHSL(0.06+Math.random()*0.04, 1, 0.5+Math.random()*0.2);
      });

      // Enemy animation + glow pulse
      enemies.forEach(en => {
        en.frameIdx += 0.14;
        const idx = Math.floor(en.frameIdx) % en.frames.length;
        en.tex.image = en.frames[idx]; en.tex.needsUpdate = true;
        if (worldMap[Math.floor(en.x)][Math.floor(en.z)] !== 2) {
          en.sp.visible = false; en.eLight.visible = false;
        } else {
          en.eLight.intensity = 0.9 + Math.sin(frameCount*0.08)*0.4;
        }
      });

      // Pickup float
      pickups.forEach(pu => {
        if (pu.collected) return;
        pu.mesh.position.y = 0.28 + Math.sin(frameCount*0.045 + pu.phase)*0.1;
        pu.mesh.rotation.y += 0.025;
      });

      // Fire flash decay
      if (fireFlashVal > 0) {
        fireFlashVal = Math.max(0, fireFlashVal - 0.05);
        const orbMat = orbMesh.material;
        orbMat.emissiveIntensity = 1.4 + fireFlashVal * 5;
        weaponPointLight.intensity = 1.5 + fireFlashVal * 6;
        beamMesh.visible = fireFlashVal > 0.1;
        beamMesh.material.opacity = fireFlashVal * 0.8;
        rings.forEach((r, i) => { r.visible = fireFlashVal > 0.2; r.scale.setScalar(1 + (1-fireFlashVal)*(i+1)*1.2); r.material.opacity = fireFlashVal*(0.55-i*.14); });
        if (fireFlashVal > 0.55) setFlash(fireFlashVal * 0.5);
        else setFlash(0);
      } else {
        orbMesh.material.emissiveIntensity = 1.4 + Math.sin(frameCount*0.09)*0.3;
        weaponPointLight.intensity = 1.5 + Math.sin(frameCount*0.07)*0.4;
        beamMesh.visible = false; rings.forEach(r => r.visible = false);
      }

      // Wand sway
      const sway = Math.sin(frameCount*0.025)*0.04;
      const walkSway = moving ? Math.sin(bobPhase*8)*0.018 : 0;
      wGroup.rotation.z = 0.18 + sway;
      wGroup.rotation.x = walkSway;
      wGroup.position.y = -0.34 + (moving ? Math.sin(bobPhase*8)*0.025 : 0);

      // Render
      renderer.autoClear = true;
      renderer.render(scene, camera);
      renderer.autoClear = false; renderer.clearDepth();
      renderer.render(weaponScene, weaponCamera);
      renderer.autoClear = true;

      // Minimap (every 4 frames)
      if (frameCount % 4 === 0) drawMinimap();
    };

    loop();

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('keydown', onKD);
      window.removeEventListener('keyup', onKU);
      window.removeEventListener('resize', onResize);
      music.stop();
      renderer.dispose();
      if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement);
    };
  }, []);

  return (
    <div style={{ width:'100%', height:'100%', position:'relative', background:'#050208', overflow:'hidden' }}>
      {/* Three.js canvas mount */}
      <div ref={mountRef} style={{ width:'100%', height:'100%' }} />

      {/* Screen flash overlay */}
      {flash > 0 && (
        <div style={{ position:'absolute', inset:0, background:`rgba(80,110,255,${flash})`, pointerEvents:'none', transition:'opacity 0.1s' }} />
      )}

      {/* Minimap */}
      <canvas ref={minimapRef} style={{ position:'absolute', top:12, right:12, border:'1px solid #3a2a14', outline:'1px solid #5a4020', imageRendering:'pixelated', opacity:0.9 }} />

      {/* Compass */}
      <div style={{ position:'absolute', top:12, left:'50%', transform:'translateX(-50%)', fontFamily:"'Cinzel',serif", fontSize:10, color:'#7a5828', letterSpacing:6, background:'rgba(4,3,2,0.7)', padding:'4px 14px', border:'1px solid #2a1e0e', borderRadius:2 }}>
        SHADOW KEEP
      </div>

      {/* Click-to-start overlay */}
      {hint === 'click_to_start' && (
        <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', background:'rgba(3,2,6,0.55)', pointerEvents:'none' }}>
          <div style={{ fontFamily:"'Cinzel',serif", color:'#c8a96e', fontSize:13, letterSpacing:4, marginBottom:10, textShadow:'0 0 20px #c8a96e88' }}>CLICK TO ENTER THE DUNGEON</div>
          <div style={{ fontFamily:"'Crimson Text',serif", color:'#5a4020', fontSize:12, letterSpacing:2 }}>mouse look · music · full controls</div>
        </div>
      )}

      {/* Controls */}
      <div style={{ position:'absolute', bottom:14, left:14, fontFamily:"'Crimson Text',serif", fontSize:11, color:'rgba(130,90,40,0.55)', lineHeight:1.9, letterSpacing:0.5, pointerEvents:'none' }}>
        <div>W A S D · move &amp; strafe</div>
        <div>← → · turn &nbsp;|&nbsp; Shift · sprint</div>
        <div>SPACE · cast wand</div>
      </div>

      {/* Floating notifs */}
      <div style={{ position:'absolute', top:'32%', left:0, right:0, display:'flex', flexDirection:'column', alignItems:'center', gap:8, pointerEvents:'none' }}>
        {/* Rendered via canvas in loop, but CSS fallback shown on pickup */}
      </div>
    </div>
  );
}
