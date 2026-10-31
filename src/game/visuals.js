import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';

let soldierAsset;
const waitingActors = new Set();
const animatedActors = new Set();

export const soldierReady = new Promise(resolve => {
  new GLTFLoader().load('/images/soldier.glb', asset => {
    soldierAsset = asset;
    for (const actor of waitingActors) installModel(actor);
    waitingActors.clear();
    resolve(true);
  }, undefined, error => { console.warn('Using fallback operative:', error); resolve(false); });
});

export function surfaceTexture(type) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext('2d');
  const palettes = { plaster: ['#c2bca8', '#9c9784'], brick: ['#976b50', '#6c4e3b'], roof: ['#86513b', '#66432f'], ground: ['#7c8055', '#555c3b'], wood: ['#66513a', '#453b2b'], road: ['#60605a', '#494d44'], concrete: ['#9d9c95', '#7b7a73'], container: ['#b9b9b9', '#7d7d7d'], camo: ['#5d6647', '#3f4733'], camoRed: ['#6b5a4a', '#4b3d33'] };
  const [base, dark] = palettes[type] || palettes.plaster;
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 10000; i++) {
    ctx.fillStyle = Math.random() > .5 ? '#ffffff0b' : '#00000014';
    const s = Math.random() * 3 + 1;
    ctx.fillRect(Math.random() * 256, Math.random() * 256, s, s);
  }
  ctx.strokeStyle = dark;
  ctx.globalAlpha = .5;
  if (type === 'roof' || type === 'brick') {
    for (let y = 0; y < 256; y += 24) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(256, y); ctx.stroke();
      for (let x = (y % 48 ? -25 : 0); x < 256; x += 50) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + 24); ctx.stroke(); }
    }
  } else if (type === 'wood') {
    for (let y = 0; y < 256; y += 5) { ctx.beginPath(); ctx.moveTo(0, y); ctx.bezierCurveTo(70, y + 7, 170, y - 7, 256, y); ctx.stroke(); }
  } else if (type === 'plaster') {
    for (let i = 0; i < 35; i++) { const x = Math.random() * 256, y = Math.random() * 256; ctx.fillStyle = '#6a705416'; ctx.fillRect(x, y, Math.random() * 35, Math.random() * 40); }
  } else if (type === 'concrete') {
    ctx.globalAlpha = .35;
    for (let i = 0; i < 60; i++) { ctx.fillStyle = Math.random() > .5 ? '#00000022' : '#ffffff18'; ctx.beginPath(); ctx.ellipse(Math.random() * 256, Math.random() * 256, Math.random() * 30 + 6, Math.random() * 14 + 3, Math.random() * 3, 0, 7); ctx.fill(); }
    ctx.strokeStyle = '#00000055'; ctx.lineWidth = 1.5;
    for (let i = 0; i < 6; i++) { ctx.beginPath(); let x = Math.random() * 256, y = Math.random() * 256; ctx.moveTo(x, y); for (let k = 0; k < 6; k++) { x += Math.random() * 30 - 15; y += Math.random() * 30 - 15; ctx.lineTo(x, y); } ctx.stroke(); }
    ctx.globalAlpha = .8; ctx.strokeStyle = '#00000044'; ctx.lineWidth = 2; ctx.strokeRect(1, 1, 254, 254);
  } else if (type === 'container') {
    // Corrugated steel: vertical ribs with rust streaks.
    ctx.globalAlpha = 1;
    for (let x = 0; x < 256; x += 16) {
      const g = ctx.createLinearGradient(x, 0, x + 16, 0);
      g.addColorStop(0, '#00000000'); g.addColorStop(.35, '#ffffff1a'); g.addColorStop(.6, '#00000033'); g.addColorStop(1, '#00000000');
      ctx.fillStyle = g; ctx.fillRect(x, 0, 16, 256);
    }
    ctx.globalAlpha = .25;
    for (let i = 0; i < 18; i++) { ctx.fillStyle = '#5a3b22'; const x = Math.random() * 256; ctx.fillRect(x, Math.random() * 120, 3 + Math.random() * 4, 60 + Math.random() * 120); }
  } else if (type === 'camo' || type === 'camoRed') {
    ctx.globalAlpha = .9;
    const tones = type === 'camo' ? ['#75805a', '#4a5238', '#2f3526', '#8a8f6a'] : ['#8a7a5c', '#5a4a3a', '#3a3028', '#9c8c70'];
    for (let i = 0; i < 90; i++) { ctx.fillStyle = tones[i % tones.length]; ctx.beginPath(); ctx.ellipse(Math.random() * 256, Math.random() * 256, 12 + Math.random() * 28, 8 + Math.random() * 18, Math.random() * 3, 0, 7); ctx.fill(); }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.repeat.set(type === 'ground' ? 110 : 1, type === 'ground' ? 110 : 1);
  texture.anisotropy = 4;
  return texture;
}

const metal = new THREE.MeshStandardMaterial({ color: 0x333a38, metalness: .78, roughness: .38 });
const gunmetal = new THREE.MeshStandardMaterial({ color: 0x23282b, metalness: .85, roughness: .3 });
const black = new THREE.MeshStandardMaterial({ color: 0x171d1b, roughness: .74, metalness: .22 });
const polymer = new THREE.MeshStandardMaterial({ color: 0x1e2224, roughness: .88, metalness: .05 });
const tan = new THREE.MeshStandardMaterial({ color: 0x8c8060, roughness: .61, metalness: .32 });
const fde = new THREE.MeshStandardMaterial({ color: 0x7d6b4c, roughness: .8, metalness: .1 });
const walnut = new THREE.MeshStandardMaterial({ color: 0x76513b, roughness: .63, map: surfaceTexture('wood') });
const glass = new THREE.MeshStandardMaterial({ color: 0x315f68, roughness: .1, metalness: .65 });
const brass = new THREE.MeshStandardMaterial({ color: 0xb08d3c, roughness: .4, metalness: .9 });
const flashMat = new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: .95, depthWrite: false, side: THREE.DoubleSide });

function box(parent, dimensions, position, material) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...dimensions), material);
  mesh.position.set(...position);
  mesh.castShadow = true;
  parent.add(mesh);
  return mesh;
}

function cylinder(parent, radius, length, position, material) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, length, 16), material);
  mesh.rotation.x = Math.PI / 2;
  mesh.position.set(...position);
  mesh.castShadow = true;
  parent.add(mesh);
  return mesh;
}

export function makeOptic(scope) {
  const optic = new THREE.Group();
  if (!scope) return optic;
  box(optic, [.055, .025, .16], [0, 0, 0], black);
  if (scope === 'Red Dot' || scope === 'Holographic') {
    box(optic, [.07, .07, .045], [0, .045, -.01], metal);
    box(optic, [.05, .045, .048], [0, .045, -.012], glass);
  } else {
    cylinder(optic, .029, .25, [0, .045, -.04], black);
    cylinder(optic, .045, .07, [0, .045, -.16], metal);
    cylinder(optic, .038, .045, [0, .045, .1], black);
    cylinder(optic, .037, .003, [0, .045, -.197], glass);
    box(optic, [.04, .04, .04], [0, .085, -.02], black);
    box(optic, [.035, .035, .04], [.035, .05, -.02], black);
  }
  return optic;
}

/* Weapon profiles drive proportions so each gun reads as its real counterpart. */
const PROFILES = {
  M416:  { kind: 'rifle', finish: 'tan', barrel: .34, rail: true, foregrip: true, mag: 'straight', stock: 'collapsible', muzzle: 'birdcage' },
  SCAR:  { kind: 'rifle', finish: 'fde', barrel: .33, rail: true, foregrip: false, mag: 'straight', stock: 'folding', muzzle: 'birdcage' },
  M762:  { kind: 'rifle', finish: 'black', barrel: .32, rail: true, foregrip: true, mag: 'curved', stock: 'collapsible', muzzle: 'brake' },
  AKM:   { kind: 'rifle', finish: 'wood', barrel: .36, rail: false, foregrip: false, mag: 'curved', stock: 'fixedWood', muzzle: 'slant' },
  Groza: { kind: 'rifle', finish: 'black', barrel: .22, rail: true, foregrip: true, mag: 'curved', stock: 'bullpup', muzzle: 'suppressor' },
  DP28:  { kind: 'rifle', finish: 'wood', barrel: .42, rail: false, foregrip: false, mag: 'pan', stock: 'fixedWood', muzzle: 'cone', bipod: true },
  Mini14:{ kind: 'sniper', finish: 'wood', barrel: .45, rail: false, foregrip: false, mag: 'short', stock: 'fixedWood', muzzle: 'plain' },
  KAR98K:{ kind: 'sniper', finish: 'wood', barrel: .5, rail: false, foregrip: false, mag: 'internal', stock: 'fullWood', muzzle: 'plain', bolt: true, iron: true },
  AWM:   { kind: 'sniper', finish: 'olive', barrel: .55, rail: true, foregrip: false, mag: 'short', stock: 'thumbhole', muzzle: 'brake', bolt: true, bipod: true },
  UMP45: { kind: 'smg', finish: 'black', barrel: .18, rail: true, foregrip: false, mag: 'straightLong', stock: 'folding', muzzle: 'plain' },
  Vector:{ kind: 'smg', finish: 'black', barrel: .14, rail: true, foregrip: true, mag: 'straightLong', stock: 'folding', muzzle: 'plain', compact: true },
  S686:  { kind: 'shotgun', finish: 'wood', barrel: .56, rail: false, foregrip: false, mag: 'none', stock: 'fullWood', muzzle: 'double' },
  S12K:  { kind: 'shotgun', finish: 'black', barrel: .4, rail: true, foregrip: false, mag: 'drum', stock: 'collapsible', muzzle: 'plain' },
  P92:   { kind: 'pistol', finish: 'black', slide: .21 },
  P1911: { kind: 'pistol', finish: 'metal', slide: .2 },
};
const FINISH = { tan, fde, black: polymer, wood: walnut, metal, olive: new THREE.MeshStandardMaterial({ color: 0x4f5a3f, roughness: .85, metalness: .05 }) };

function addMuzzleFlash(gun, z) {
  const flash = new THREE.Group();
  for (let i = 0; i < 3; i++) {
    const petal = new THREE.Mesh(new THREE.PlaneGeometry(.16, .38), flashMat);
    petal.rotation.z = i * Math.PI / 3; petal.rotation.x = Math.PI / 2; flash.add(petal);
  }
  const core = new THREE.Mesh(new THREE.SphereGeometry(.05, 8, 6), flashMat); flash.add(core);
  flash.position.set(0, .02, z - .12); flash.visible = false;
  gun.add(flash); gun.userData.flash = flash;
}

export function makeWeapon(kind, scope = null, id = '') {
  const gun = new THREE.Group();
  const p = PROFILES[id] || { kind, finish: kind === 'sniper' || kind === 'shotgun' ? 'wood' : 'black', barrel: kind === 'sniper' ? .45 : .3, rail: kind !== 'sniper', mag: 'straight', stock: 'collapsible', muzzle: 'plain' };
  const finish = FINISH[p.finish] || polymer;
  if (p.kind === 'pistol') {
    const slide = box(gun, [.05, .055, p.slide], [0, .03, -.1], p.finish === 'metal' ? metal : gunmetal);
    box(gun, [.046, .04, p.slide - .02], [0, -.005, -.09], finish);
    cylinder(gun, .012, .06, [0, .035, -.21], gunmetal);
    const grip = box(gun, [.05, .12, .065], [0, -.075, -.02], polymer); grip.rotation.x = -.25;
    box(gun, [.03, .04, .03], [0, -.02, -.06], black); // trigger guard
    const trigger = new THREE.Mesh(new THREE.TorusGeometry(.028, .005, 4, 12), gunmetal); trigger.rotation.y = Math.PI / 2; trigger.position.set(0, -.04, -.07); gun.add(trigger);
    for (let z = -.16; z < -.03; z += .012) box(gun, [.052, .012, .004], [0, .04, z], black); // slide serrations
    box(gun, [.012, .014, .012], [0, .06, -.19], black); box(gun, [.03, .014, .012], [0, .06, -.02], black); // sights
    box(gun, [.04, .02, .07], [0, .015, -.19], black); // rail
    addMuzzleFlash(gun, -.2);
    slide.userData.slide = true;
    gun.userData.kind = kind; return gun;
  }
  const sniper = p.kind === 'sniper', shotgun = p.kind === 'shotgun', smg = p.kind === 'smg';
  const receiverLen = p.stock === 'bullpup' ? .36 : .3;
  // Receiver / upper
  box(gun, [.064, .075, receiverLen], [0, .01, -.16], p.finish === 'wood' ? gunmetal : finish);
  box(gun, [.06, .05, receiverLen - .04], [0, -.045, -.15], p.finish === 'wood' ? gunmetal : finish);
  // Charging handle / ejection port
  box(gun, [.07, .02, .05], [0, .03, -.08], black); box(gun, [.02, .02, .02], [.04, .02, -.2], gunmetal);
  // Handguard
  const hgLen = sniper ? .36 : smg ? .18 : .26;
  const hgZ = -.3 - hgLen / 2 - (p.compact ? -.04 : 0);
  if (p.finish === 'wood') { box(gun, [.07, .07, hgLen], [0, 0, hgZ], walnut); }
  else {
    box(gun, [.062, .062, hgLen], [0, 0, hgZ], finish);
    if (p.rail) { for (let z = hgZ + hgLen / 2 - .015; z > hgZ - hgLen / 2; z -= .02) { box(gun, [.07, .008, .009], [0, .039, z], gunmetal); box(gun, [.008, .07, .009], [0, 0, z], gunmetal); } }
    for (let z = hgZ + hgLen / 2 - .04; z > hgZ - hgLen / 2 + .02; z -= .035) for (const side of [-1, 1]) box(gun, [.004, .012, .022], [side * .032, -.015, z], black); // vents
  }
  // Barrel + muzzle device
  const bz0 = hgZ - hgLen / 2;
  cylinder(gun, .012, p.barrel, [0, .02, bz0 - p.barrel / 2 + .02], gunmetal);
  const mz = bz0 - p.barrel + .02;
  if (p.muzzle === 'birdcage') { cylinder(gun, .018, .07, [0, .02, mz - .02], black); for (let i = 0; i < 4; i++) box(gun, [.004, .038, .05], [0, .02, mz - .02], gunmetal).rotation.z = i * Math.PI / 4; }
  else if (p.muzzle === 'brake') { box(gun, [.034, .034, .08], [0, .02, mz - .02], gunmetal); for (const z of [-.04, -.015, .01]) box(gun, [.05, .012, .012], [0, .02, mz + z], black); }
  else if (p.muzzle === 'slant') { const s = box(gun, [.026, .026, .05], [0, .02, mz - .01], gunmetal); s.rotation.x = .5; }
  else if (p.muzzle === 'suppressor') cylinder(gun, .024, .18, [0, .02, mz - .07], polymer);
  else if (p.muzzle === 'cone') cylinder(gun, .022, .05, [0, .02, mz - .02], gunmetal);
  else if (p.muzzle === 'double') { cylinder(gun, .013, p.barrel, [-.016, .02, bz0 - p.barrel / 2 + .02], gunmetal); cylinder(gun, .013, p.barrel, [.016, .02, bz0 - p.barrel / 2 + .02], gunmetal); }
  if (shotgun && p.mag === 'drum') box(gun, [.08, .08, .08], [0, -.08, -.2], polymer);
  if (p.muzzle === 'double' || p.mag === 'none') { /* break action, no tube */ }
  else if (shotgun) cylinder(gun, .014, .34, [0, -.015, bz0 - .14], gunmetal);
  addMuzzleFlash(gun, mz);
  // Front sight post / gas block
  box(gun, [.016, .04, .02], [0, .065, bz0 - .02], black); box(gun, [.028, .028, .04], [0, .03, bz0 - .01], gunmetal);
  // Rear sight / top rail
  if (p.rail) { box(gun, [.045, .015, receiverLen], [0, .055, -.16], gunmetal); for (let z = -.03; z > -.3; z -= .02) box(gun, [.05, .007, .009], [0, .066, z], black); }
  else if (p.iron) box(gun, [.03, .02, .03], [0, .06, -.13], black);
  // Pistol grip & trigger
  const grip = box(gun, [.046, .13, .06], [0, -.11, -.045], p.finish === 'wood' ? walnut : polymer); grip.rotation.x = -.22;
  const trigger = new THREE.Mesh(new THREE.TorusGeometry(.03, .005, 4, 12), gunmetal); trigger.rotation.y = Math.PI / 2; trigger.position.set(0, -.075, -.11); gun.add(trigger);
  box(gun, [.012, .01, .025], [0, -.07, -.12], black);
  // Magazine
  if (p.mag === 'curved') { const m = box(gun, [.05, .2, .075], [0, -.14, -.19], gunmetal); m.rotation.x = -.35; box(gun, [.052, .06, .077], [0, -.2, -.22], gunmetal).rotation.x = -.6; }
  else if (p.mag === 'straight' || p.mag === 'straightLong') { box(gun, [.048, p.mag === 'straightLong' ? .25 : .2, .07], [0, p.mag === 'straightLong' ? -.17 : -.14, -.19], polymer).rotation.x = -.1; box(gun, [.05, .015, .072], [0, -.24, -.2], black); }
  else if (p.mag === 'short') box(gun, [.046, .09, .07], [0, -.09, -.19], gunmetal);
  else if (p.mag === 'pan') { const pan = new THREE.Mesh(new THREE.CylinderGeometry(.09, .09, .03, 24), gunmetal); pan.position.set(0, .1, -.22); gun.add(pan); }
  // Stock
  if (p.stock === 'collapsible') { box(gun, [.034, .034, .18], [0, .01, .07], gunmetal); box(gun, [.05, .11, .09], [0, -.02, .17], polymer); box(gun, [.055, .13, .02], [0, -.02, .22], black); }
  else if (p.stock === 'folding') { box(gun, [.03, .05, .2], [0, .0, .08], polymer); box(gun, [.05, .11, .025], [0, -.02, .19], black); }
  else if (p.stock === 'fixedWood' || p.stock === 'fullWood') { const st = box(gun, [.055, .085, .24], [0, -.025, .1], walnut); st.rotation.x = .08; box(gun, [.06, .13, .03], [0, -.05, .225], black); if (p.stock === 'fullWood') box(gun, [.07, .06, .5], [0, -.045, -.3], walnut); }
  else if (p.stock === 'thumbhole') { box(gun, [.05, .09, .26], [0, -.03, .1], finish); box(gun, [.06, .14, .03], [0, -.04, .24], black); box(gun, [.05, .05, .08], [0, .04, .2], finish); }
  else if (p.stock === 'bullpup') { box(gun, [.06, .1, .16], [0, -.02, .05], polymer); box(gun, [.062, .12, .02], [0, -.02, .14], black); }
  // Extras
  if (p.foregrip) box(gun, [.03, .09, .035], [0, -.07, hgZ + .03], polymer);
  if (p.bolt) { const b = cylinder(gun, .007, .07, [.045, .035, -.1], gunmetal); b.rotation.set(0, 0, Math.PI / 2); const knob = new THREE.Mesh(new THREE.SphereGeometry(.012, 8, 6), gunmetal); knob.position.set(.08, .02, -.1); gun.add(knob); }
  if (p.bipod) for (const side of [-1, 1]) { const leg = box(gun, [.008, .14, .008], [side * .025, -.07, bz0 - .04], gunmetal); leg.rotation.z = side * .25; }
  if (sniper && !p.iron) cylinder(gun, .004, .04, [0, .075, -.4], black);
  // Sling swivel + brass detail
  cylinder(gun, .006, .02, [0, -.05, .23], brass);
  if (scope) { const optic = makeOptic(scope); optic.position.set(0, p.rail ? .075 : .07, -.16); gun.add(optic); }
  gun.userData.kind = kind;
  return gun;
}

export function flashOperativeMuzzle(actor) {
  const weapon = actor?.userData?.weapon; const flash = weapon?.userData?.flash;
  if (!flash) return;
  flash.visible = true; flash.rotation.z = Math.random() * Math.PI; flash.scale.setScalar(.8 + Math.random() * .5);
  clearTimeout(flash.userData.t); flash.userData.t = setTimeout(() => { flash.visible = false; }, 55);
}

const camoTex = [surfaceTexture('camo'), surfaceTexture('camoRed')];
const TEAM_TINT = [0x9fb3c8, 0xc9a090];
const TEAM_PATCH = [0x3b82f6, 0xef4444];

function installModel(actor) {
  if (!soldierAsset) return;
  const model = clone(soldierAsset.scene);
  model.updateMatrixWorld(true);
  model.traverse(object => { if (object.isSkinnedMesh) object.skeleton.update(); });
  const bounds = new THREE.Box3().setFromObject(model);
  const scale = 1.82 / (bounds.max.y - bounds.min.y);
  model.scale.multiplyScalar(scale);
  model.position.y = -bounds.min.y * scale;
  model.rotation.y = 0;
  const team = actor.userData.team ?? 0;
  model.traverse(object => {
    if (object.isMesh) {
      object.castShadow = true;
      object.receiveShadow = true;
      object.material = object.material.clone();
      object.material.roughness = .92;
      object.material.metalness = .04;
      object.material.color?.multiply(new THREE.Color(TEAM_TINT[team]));
      object.userData.baseColor = object.material.color?.clone();
    }
  });
  actor.userData.fallback.visible = false;
  actor.add(model);
  const mixer = new THREE.AnimationMixer(model);
  const actions = {};
  for (const animation of soldierAsset.animations) actions[animation.name.toLowerCase()] = mixer.clipAction(animation);
  const idle = actions.idle || Object.values(actions)[0];
  idle?.play();
  Object.assign(actor.userData, { mixer, actions, current: idle, model });
  animatedActors.add(actor);
}

function buildGear(actor, team) {
  const gear = new THREE.Group();
  const patch = new THREE.MeshStandardMaterial({ color: TEAM_PATCH[team], roughness: .8, emissive: TEAM_PATCH[team], emissiveIntensity: .25 });
  const vestMat = new THREE.MeshStandardMaterial({ color: 0x3b4034, roughness: .98, map: camoTex[team] });
  const webbing = new THREE.MeshStandardMaterial({ color: 0x2a2d26, roughness: 1 });
  // Plate carrier with mag pouches, helmet with NVG mount, knee pads, team armband + helmet band.
  box(gear, [.4, .4, .14], [0, 1.24, -.12], vestMat);
  box(gear, [.38, .36, .1], [0, 1.22, .14], vestMat);
  for (const x of [-.11, 0, .11]) box(gear, [.085, .14, .06], [x, 1.1, -.2], webbing);
  for (const side of [-1, 1]) { box(gear, [.06, .4, .18], [side * .22, 1.24, 0], webbing); box(gear, [.1, .06, .1], [side * .16, 1.42, -.02], webbing); }
  box(gear, [.2, .05, .11], [.27, 1.33, -.04], patch); // armband
  const helmet = new THREE.Mesh(new THREE.SphereGeometry(.185, 20, 14, 0, Math.PI * 2, 0, Math.PI * .58), vestMat); helmet.position.set(0, 1.63, 0); helmet.castShadow = true; gear.add(helmet);
  const band = new THREE.Mesh(new THREE.TorusGeometry(.186, .012, 6, 24), patch); band.rotation.x = Math.PI / 2; band.position.set(0, 1.69, 0); gear.add(band);
  box(gear, [.05, .05, .06], [0, 1.77, -.16], webbing); // NVG mount
  for (const side of [-1, 1]) box(gear, [.13, .12, .08], [side * .11, .5, -.1], webbing); // knee pads
  // Backpack
  const bag = new THREE.Mesh(new THREE.CapsuleGeometry(.17, .22, 5, 10), vestMat); bag.scale.set(1.1, 1, .66); bag.position.set(0, 1.18, .24); bag.castShadow = true; gear.add(bag);
  box(gear, [.26, .18, .07], [0, 1.08, .37], webbing);
  for (const side of [-1, 1]) box(gear, [.04, .44, .025], [side * .11, 1.21, .33], webbing);
  actor.add(gear);
  actor.userData.gear = gear;
  actor.userData.patchMaterial = patch;
}

export function makeOperative(team = 0) {
  const actor = new THREE.Group();
  actor.userData.team = team;
  const fallback = new THREE.Group();
  const cloth = new THREE.MeshStandardMaterial({ color: 0x6d7360, roughness: .95, map: camoTex[team] });
  const vest = new THREE.MeshStandardMaterial({ color: 0x424a36, roughness: .98 });
  const skin = new THREE.MeshStandardMaterial({ color: 0xb39778, roughness: .95 });
  box(fallback, [.44, .53, .25], [0, 1.2, 0], cloth);
  for (const side of [-1, 1]) {
    box(fallback, [.18, .42, .19], [side * .13, .64, 0], cloth);
    box(fallback, [.15, .4, .16], [side * .13, .24, .01], cloth);
    box(fallback, [.18, .13, .29], [side * .13, .065, -.055], black);
    const arm = box(fallback, [.14, .4, .14], [side * .3, 1.16, -.055], cloth); arm.rotation.x = -.55;
    box(fallback, [.13, .12, .14], [side * .3, .98, -.17], black);
  }
  const head = new THREE.Mesh(new THREE.SphereGeometry(.15, 16, 14), skin); head.position.y = 1.62; fallback.add(head);
  box(fallback, [.26, .11, .07], [0, 1.6, -.12], black);
  actor.add(fallback);
  buildGear(actor, team);
  actor.userData.fallback = fallback;
  actor.userData.pack = actor.userData.gear;
  actor.userData.walking = false;
  setOperativeWeapon(actor, 'M416', 'rifle', 'Red Dot');
  if (soldierAsset) installModel(actor); else waitingActors.add(actor);
  return actor;
}

export function retintOperative(actor, team) {
  actor.userData.team = team;
  if (actor.userData.gear) { actor.remove(actor.userData.gear); }
  buildGear(actor, team);
  actor.userData.model?.traverse(object => { if (object.isMesh && object.userData.baseColor) object.material.color.copy(object.userData.baseColor); });
}

export function setOperativeWeapon(actor, id, kind, scope) {
  const previous = actor.userData.weapon;
  if (previous) { actor.remove(previous); previous.traverse(object => object.geometry?.dispose()); }
  if (!id) { actor.userData.weapon = null; return; }
  const weapon = makeWeapon(kind || 'rifle', scope, id);
  weapon.position.set(.26, 1.08, -.16);
  weapon.rotation.set(-.38, 0, -.06);
  actor.add(weapon);
  actor.userData.weapon = weapon;
}

export function animateOperatives(dt) {
  for (const actor of animatedActors) {
    if (!actor.parent || !actor.visible) continue;
    const data = actor.userData;
    const wanted = data.walking ? (data.sprinting ? data.actions.run : data.actions.walk) : data.actions.idle;
    if (wanted && wanted !== data.current) { data.current?.fadeOut(.2); wanted.reset().fadeIn(.2).play(); data.current = wanted; }
    data.mixer.update(dt);
    actor.scale.y = data.crouching ? .73 : 1;
  }
}
