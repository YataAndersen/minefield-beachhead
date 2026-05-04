import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import gsap from 'gsap';

// Escudo de Erros
window.addEventListener('error', function(e) {
    console.warn('Erro interceptado:', e.message);
    e.preventDefault();
});

// Configurações do Jogo
const GRID_SIZE = 10;
let MINES_COUNT = 15;
let gameMode = 'classic'; // 'classic' ou 'roguelite'
let focus = 100;

let gameOver = false;
let firstClick = true;
let timer = 0;
let timerInterval = null;
let pressedInstanceId = null;
let longPressTimer = null;
let isLongPress = false;
let flagsPlaced = 0;
let cellsRevealed = 0;
const flagsMap = new Map();

const uiTimer = document.getElementById('timer-display');
const uiSmiley = document.getElementById('smiley-btn');
const uiSmileyImg = document.getElementById('smiley-img');
const uiFocus = document.getElementById('focus-display');
const mapScreen = document.getElementById('map-screen');
const minesDisplay = document.getElementById('mines-display');

uiSmiley.addEventListener('pointerdown', () => {
    if(gameOver) { mapScreen.classList.remove('hidden'); }
    else { resetRoom(); }
});

document.getElementById('btn-node-normal').addEventListener('click', () => startRoom(15, 'classic'));
document.getElementById('btn-node-desafio').addEventListener('click', () => startRoom(22, 'roguelite'));

// 🎭 EMOJIS & EXPRESSÕES (STATE MACHINE)
const IMG_IDLE = './assets/icons/emoji_olhando_jogador.png';
const IMG_IDLE_BLINK = './assets/icons/emoji_piscada_olhando_jogador.png';
const IMG_ACTIVE = './assets/icons/emoji_olhando_canva.png';
const IMG_ACTIVE_BLINK = './assets/icons/emoji_piscada_olhando_canva.png';
const IMG_DAMAGE = './assets/icons/emoji_assutado_olhando_player.png'; 
const IMG_DEATH = './assets/icons/emoji_death_game_over.png'; 

let lastInteractionTime = performance.now();
let isBlinking = false;
let isDamaged = false;
let isDead = false;
let currentSmileySrc = IMG_IDLE;

function updateSmileyFace() {
    if (isDead || isDamaged) return;
    
    const timeSinceInteraction = performance.now() - lastInteractionTime;
    const isIdle = timeSinceInteraction > 4000; // 4 Segundos sem jogar
    let targetSrc = isIdle ? (isBlinking ? IMG_IDLE_BLINK : IMG_IDLE) : (isBlinking ? IMG_ACTIVE_BLINK : IMG_ACTIVE);
    
    if (currentSmileySrc !== targetSrc) {
        uiSmileyImg.src = targetSrc;
        currentSmileySrc = targetSrc;
    }
}

function scheduleBlink() {
    const delay = 3000 + Math.random() * 4000;
    setTimeout(() => {
        if (!gameOver && !isDamaged && !isDead) {
            isBlinking = true; updateSmileyFace();
            setTimeout(() => { isBlinking = false; updateSmileyFace(); scheduleBlink(); }, 150); // Pisca por 150ms
        } else { scheduleBlink(); }
    }, delay);
}
scheduleBlink();

// Engine Lógica (Grid Data)
const gridData = Array.from({ length: GRID_SIZE }, () => 
    Array.from({ length: GRID_SIZE }, () => ({ isMine: false, revealed: false, flagged: false, adjacent: 0 }))
);

function placeMines(safeX, safeY) {
    let planted = 0;
    while(planted < MINES_COUNT) {
        let x = Math.floor(Math.random() * GRID_SIZE);
        let y = Math.floor(Math.random() * GRID_SIZE);
        // Impede minas no primeiro clique ou ao redor dele
        if(!gridData[x][y].isMine && (Math.abs(x - safeX) > 1 || Math.abs(y - safeY) > 1)) {
            gridData[x][y].isMine = true;
            planted++;
        }
    }
    
    // Calcula números adjacentes
    for(let i = 0; i < GRID_SIZE; i++) {
        for(let j = 0; j < GRID_SIZE; j++) {
            if(!gridData[i][j].isMine) {
                let count = 0;
                for(let dx = -1; dx <= 1; dx++) {
                    for(let dy = -1; dy <= 1; dy++) {
                        let nx = i + dx, ny = j + dy;
                        if(nx >= 0 && nx < GRID_SIZE && ny >= 0 && ny < GRID_SIZE && gridData[nx][ny].isMine) count++;
                    }
                }
                gridData[i][j].adjacent = count;
            }
        }
    }
}

function resetRoom() {
    firstClick = true;
    gameOver = false;
    timer = 0;
    clearInterval(timerInterval);
    uiTimer.innerText = '000';
    
    // Reseta os estados da imagem do novo Emoji
    isDead = false;
    isDamaged = false;
    lastInteractionTime = performance.now();
    gsap.killTweensOf(uiSmileyImg);
    uiSmileyImg.style.transform = 'scale(1)';
    uiSmiley.style.backgroundImage = ''; // Limpa resíduo de textura do fundo se houver
    gsap.killTweensOf('#death-overlay');
    document.getElementById('death-overlay').style.opacity = '0';
    uiFocus.classList.remove('text-emerald-400');
    uiFocus.classList.remove('text-red-700');
    focus = 100;
    uiFocus.innerText = `F:${focus}%`;
    
    flagsPlaced = 0;
    cellsRevealed = 0;
    flagsMap.clear();
    minesDisplay.innerText = (MINES_COUNT - flagsPlaced).toString().padStart(3, '0');

    while(spritesGroup.children.length > 0){ 
        spritesGroup.remove(spritesGroup.children[0]); 
    }

    for(let i = 0; i < GRID_SIZE; i++) {
        for(let j = 0; j < GRID_SIZE; j++) {
            gridData[i][j] = { isMine: false, revealed: false, flagged: false, adjacent: 0 };
            const index = i * GRID_SIZE + j;
            const state = cellStates[index];
            gsap.killTweensOf(state); // Cancela as animações de delay do jogo anterior
            state.y = 0;
            state.scaleY = 1;
            state.color.set(COLORS.hiddenTop);
            applyInstanceTransform(index, i - offset, j - offset);
        }
    }

    // Reseta a câmera para a posição original
    gsap.killTweensOf(camera);
    gsap.killTweensOf(camera.position);
    gsap.to(camera, { zoom: 1, duration: 0.8, ease: "power2.out", onUpdate: () => camera.updateProjectionMatrix() });
    gsap.to(camera.position, { x: 0, y: 10, z: 3.5, duration: 0.8, ease: "power2.out" });
}

function startRoom(mines, mode) {
    MINES_COUNT = mines;
    gameMode = mode;
    mapScreen.classList.add('hidden');
    resetRoom();
}

// 🎨 CLASSIC COLOR PALETTE
const COLORS = {
    hiddenTop: '#94a3b8', // Cinza Frio (Slate - Sensação de metal/pedra bruta)
    revealed: '#e7e5e4',  // Cinza Quente (Stone - Sensação de areia/terreno escavado)
    mine: '#222222',
    numbers: ['#000000','#2563eb','#16a34a','#dc2626','#9333ea','#ca8a04','#0d9488','#ea580c','#475569']
};

// 🔢 IMPROVED NUMBER RENDER (crisp + glow)
function createSprite(text, color='#000', size=128) {
    const can = document.createElement('canvas');
    can.width = can.height = size;
    const ctx = can.getContext('2d');
    
    ctx.clearRect(0,0,size,size);
    ctx.font = `400 ${Math.floor(size*.65)}px 'Black Ops One'`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    // Preenchimento com a nova cor sólida (sem borda/stroke)
    ctx.fillStyle = color;
    ctx.fillText(text, size/2, size/2+4);
    
    const tex = new THREE.CanvasTexture(can);
    tex.minFilter = THREE.LinearFilter;
    
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false });
    const s = new THREE.Sprite(mat);
    s.scale.set(0.6, 0.6, 0.6);
    return s;
}

// 🛠️ GAME FEEL 2026: TEXTURA PROCEDURAL (NOISE)
const canvasNoise = document.createElement('canvas');
canvasNoise.width = 256; canvasNoise.height = 256;
const ctxNoise = canvasNoise.getContext('2d');
ctxNoise.fillStyle = '#ffffff'; ctxNoise.fillRect(0,0,256,256);
for(let i=0; i<12000; i++) { // Quantidade de grãos de textura triplicada
    ctxNoise.fillStyle = Math.random() > 0.5 ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.18)'; // Opacidade e contraste aumentados
    ctxNoise.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
}
const texNoise = new THREE.CanvasTexture(canvasNoise);
texNoise.wrapS = texNoise.wrapT = THREE.RepeatWrapping;

// 🎨 GAME FEEL 2026: TEXTURA PROCEDURAL NO HUD
const uiNoiseCan = document.createElement('canvas');
uiNoiseCan.width = 256; uiNoiseCan.height = 256;
const uiCtx = uiNoiseCan.getContext('2d');
for(let i=0; i<15000; i++) {
    uiCtx.fillStyle = Math.random() > 0.5 ? 'rgba(0,0,0,0.15)' : 'rgba(255,255,255,0.4)';
    uiCtx.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
}
document.documentElement.style.setProperty('--ui-noise', `url(${uiNoiseCan.toDataURL()})`);

// 🚩 GAME FEEL 2026: BANDEIRA 3D TÁTICA E ANIMADA
function createFlagMesh() {
    const group = new THREE.Group();

    // Base arredondada em dois níveis (Estilo Ícone Clássico)
    const baseMat = new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.6, roughness: 0.7 });
    const baseBottom = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 0.04, 16), baseMat);
    baseBottom.position.y = 0.02;
    baseBottom.castShadow = true;
    const baseTop = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.11, 0.04, 16), baseMat);
    baseTop.position.y = 0.06;
    baseTop.castShadow = true;
    
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.021, 0.021, 0.4), new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.8 }));
    pole.position.y = 0.2;
    pole.castShadow = true; // Sombra do mastro
    
    // Trocado de PlaneGeometry para BoxGeometry para dar espessura (Estilo Toy 3D)
    const flagGeo = new THREE.BoxGeometry(0.2, 0.15, 0.04, 6, 2, 1);
    flagGeo.translate(0.1, 0, 0); // Desloca o eixo para fixar a base no mastro

    // Transforma o retângulo em um triângulo clássico (flâmula)
    const pos = flagGeo.attributes.position;
    const baseZ = new Float32Array(pos.count); // Array para guardar a profundidade (espessura) original
    for(let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        pos.setY(i, pos.getY(i) * (1 - (x / 0.2))); // Afunila o Y conforme afasta do mastro
        baseZ[i] = pos.getZ(i); // Salva o estado físico da espessura
    }
    flagGeo.setAttribute('baseZ', new THREE.BufferAttribute(baseZ, 1));
    flagGeo.computeVertexNormals();
    
    // Removido DoubleSide (agora é um volume fechado e reage melhor à luz)
    const flag = new THREE.Mesh(flagGeo, new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.4 }));
    flag.position.set(0, 0.3, 0);
    flag.castShadow = true; // Sombra do tecido espesso
    group.add(baseBottom, baseTop, pole, flag);
    return group;
}

function toggleFlag(instanceId, x, y) {
    const cell = gridData[x][y];
    if (cell.revealed) return;

    if (cell.flagged) {
        cell.flagged = false;
        const flag = flagsMap.get(instanceId);
        if (flag) {
            gsap.to(flag.scale, { x: 0, y: 0, z: 0, duration: 0.2, onComplete: () => {
                spritesGroup.remove(flag);
                flagsMap.delete(instanceId);
            }});
        }
        flagsPlaced--;
    } else {
        cell.flagged = true;
        const flag = createFlagMesh();
        const px = x - offset;
        const pz = y - offset;
        flag.position.set(px, 0.18, pz); // Fica fincada no topo do bloco
        flag.scale.set(0, 0, 0);
        spritesGroup.add(flag);
        flagsMap.set(instanceId, flag);
        gsap.to(flag.scale, { x: 1.6, y: 1.6, z: 1.6, duration: 0.4, ease: "back.out(2)" }); // Aumento de 60%
        flagsPlaced++;
    }
    minesDisplay.innerText = (MINES_COUNT - flagsPlaced).toString().padStart(3, '0');
}

// 💣 GAME FEEL 2026: BOMBA 3D
function createBombMesh(isFatal = true) {
    const group = new THREE.Group();
    group.scale.setScalar(1.2); // Aumenta todo o conjunto (corpo e espinhos) em 20%
    
    const bodyMat = new THREE.MeshStandardMaterial({ 
        color: isFatal ? 0x111111 : 0x666666, 
        emissive: isFatal ? 0x330000 : 0x222222, 
        emissiveIntensity: 0.6,
        roughness: 0.4, 
        metalness: 0.8 
    });
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 16), bodyMat);
    group.add(body);

    // Espinhos Prateados
    const spikeGeo = new THREE.ConeGeometry(0.04, 0.12, 8);
    spikeGeo.translate(0, 0.06, 0); // Desloca a base para a origem (pivô na ponta inferior)
    const spikeMat = new THREE.MeshStandardMaterial({ 
        color: 0xcccccc,
        metalness: 1.0, 
        roughness: 0.2 
    });

    // Direções dos espinhos (6 eixos cardeais + 8 cantos diagonais)
    const dirs = [
        new THREE.Vector3(1,0,0), new THREE.Vector3(-1,0,0), new THREE.Vector3(0,1,0), new THREE.Vector3(0,-1,0), new THREE.Vector3(0,0,1), new THREE.Vector3(0,0,-1),
        new THREE.Vector3(1,1,1).normalize(), new THREE.Vector3(-1,1,1).normalize(), new THREE.Vector3(1,-1,1).normalize(), new THREE.Vector3(-1,-1,1).normalize(),
        new THREE.Vector3(1,1,-1).normalize(), new THREE.Vector3(-1,1,-1).normalize(), new THREE.Vector3(1,-1,-1).normalize(), new THREE.Vector3(-1,-1,-1).normalize()
    ];

    dirs.forEach(dir => {
        const spike = new THREE.Mesh(spikeGeo, spikeMat);
        spike.position.copy(dir).multiplyScalar(0.19); // Fixa levemente afundado na superfície da esfera
        spike.lookAt(dir.clone().multiplyScalar(2)); // Aponta o eixo Z do objeto para fora
        spike.rotateX(Math.PI / 2); // Rotaciona o cone 90 graus para o bico (eixo Y) apontar na direção certa
        group.add(spike);
    });

    const light = new THREE.PointLight(isFatal ? 0xff0000 : 0xffffff, isFatal ? 15 : 2, 3); 
    light.position.y = 0.1; 
    group.add(light);

    return group;
}

function triggerExplosion(x, y, z) {
    const particleMat = new THREE.MeshStandardMaterial({ color: 0xff5500, emissive: 0xff1100, emissiveIntensity: 2 });
    const particleGeo = new THREE.TetrahedronGeometry(0.08, 0);
    
    // 🔥 Fogo e Brasas (Embers) subindo do chão
    for(let i=0; i<30; i++) {
        const mesh = new THREE.Mesh(particleGeo, particleMat);
        mesh.scale.set(0, 0, 0); // Começa invisível até o delay agir
        spritesGroup.add(mesh); // Grupo limpa automaticamente no resetRoom
        
        const floatEmber = () => {
            if (!spritesGroup.children.includes(mesh)) return; // Para a animação se o jogador reiniciar o jogo

            // Nasce em um raio espalhado perto do chão
            const startX = x + (Math.random() - 0.5) * 2.8;
            const startZ = z + (Math.random() - 0.5) * 2.8;
            mesh.position.set(startX, y - 0.1, startZ);
            mesh.scale.setScalar(Math.random() * 0.4 + 0.2); // Tamanhos irregulares

            const duration = 2 + Math.random() * 3; // Flutua lentamente (de 2s a 5s)

            // Movimento lento para cima e levemente para os lados
            gsap.to(mesh.position, {
                x: startX + (Math.random() - 0.5) * 1.5,
                y: y + 0.2 + Math.random() * 1.5, // Fica baixo para dar a impressão de chão queimando
                z: startZ + (Math.random() - 0.5) * 1.5,
                duration: duration,
                ease: "sine.inOut"
            });

            // Rotação orgânica e apagar devagar para renascer (Loop)
            gsap.to(mesh.rotation, { x: Math.random() * 10, y: Math.random() * 10, duration: duration, ease: "none" });
            gsap.to(mesh.scale, { x: 0, y: 0, z: 0, duration: duration * 0.5, delay: duration * 0.5, ease: "power2.inOut", onComplete: floatEmber });
        };
        
        // Dispara cada brasa em um momento diferente (dentro de 2s) para criar fluxo contínuo
        gsap.delayedCall(Math.random() * 2, floatEmber);
    }

    // Fumaça subindo
    const smokeGeo = new THREE.SphereGeometry(0.15, 8, 8);
    for(let i=0; i<12; i++) {
        const smokeMat = new THREE.MeshStandardMaterial({ color: 0x333333, transparent: true, opacity: 0.9, roughness: 1.0 });
        const smoke = new THREE.Mesh(smokeGeo, smokeMat);
        smoke.position.set(x + (Math.random()-0.5)*0.4, y, z + (Math.random()-0.5)*0.4);
        spritesGroup.add(smoke);
        
        const duration = 1.5 + Math.random() * 1.5;
        gsap.to(smoke.position, { 
            y: y + 1.5 + Math.random() * 2, 
            x: x + (Math.random() - 0.5) * 1.5, 
            duration: duration, 
            ease: "power1.out", 
            delay: 0.1 
        });
        gsap.to(smoke.scale, { x: 3, y: 3, z: 3, duration: duration, ease: "power2.out", delay: 0.1 });
        gsap.to(smokeMat, { opacity: 0, duration: duration * 0.7, delay: duration * 0.3 });
    }

    // 🧱 Pedaços do bloco (Debris) voando
    const debrisCount = 12 + Math.floor(Math.random() * 6);
    const debrisGeo = new THREE.BoxGeometry(0.2, 0.2, 0.2);
    
    for(let i = 0; i < debrisCount; i++) {
        const debrisMat = new THREE.MeshStandardMaterial({ 
            color: COLORS.hiddenTop, // Cor original do bloco
            roughness: 0.9, 
            transparent: true 
        });
        const debris = new THREE.Mesh(debrisGeo, debrisMat);
        debris.castShadow = true; // Destroços projetam sombra
        
        // Variação de tamanho para ficar orgânico
        debris.scale.setScalar(0.5 + Math.random());
        debris.position.set(x + (Math.random()-0.5)*0.5, y + 0.2, z + (Math.random()-0.5)*0.5);
        spritesGroup.add(debris);

        const angle = Math.random() * Math.PI * 2;
        const radius = 1.5 + Math.random() * 3;
        const flightDuration = 0.5 + Math.random() * 0.4;

        // Espalhamento no chão (X e Z)
        gsap.to(debris.position, { x: x + Math.cos(angle) * radius, z: z + Math.sin(angle) * radius, duration: flightDuration, ease: "power2.out" });
        
        // Pulo parabólico simulando gravidade (Y) usando yoyo
        gsap.to(debris.position, { y: y + 1.5 + Math.random() * 2, duration: flightDuration / 2, ease: "power1.out", yoyo: true, repeat: 1 });
        
        // Rotação caótica no ar
        gsap.to(debris.rotation, { x: Math.random() * 15, y: Math.random() * 15, z: Math.random() * 15, duration: flightDuration, ease: "none" });

        // Piscar e sumir após alguns segundos na física "stepped/classic"
        const delayBlink = flightDuration + 2 + Math.random() * 1.5;
        gsap.to(debrisMat, { 
            opacity: 0, 
            duration: 0.1, 
            yoyo: true, 
            repeat: 9, // 9 transições (0-1-0-1...) termina invisível
            delay: delayBlink, 
            ease: "power1.inOut",
            onComplete: () => {
                spritesGroup.remove(debris);
                debrisMat.dispose(); // Libera a memória da placa de vídeo
            }
        });
    }
}

// Three.js Setup
const canvas = document.getElementById('game-canvas');
const scene = new THREE.Scene();
scene.background = new THREE.Color('#475569'); 
scene.fog = new THREE.FogExp2('#475569', 0.04); // Atmosfera densa e opressiva

// Orthographic Camera para leitura "Classic Plus" isométrico leve
const aspect = window.innerWidth / window.innerHeight;
const frustumSize = GRID_SIZE + 3;
const camera = new THREE.OrthographicCamera(
    frustumSize * aspect / -2, frustumSize * aspect / 2, 
    frustumSize / 2, frustumSize / -2, 
    -20, 20
);
camera.position.set(0, 10, 3.5);
camera.lookAt(0, -1, 0);
camera.layers.enable(1); // Permite que a câmera enxergue a Layer 1 (Minas Inativas)

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;

// 🌟 PÓS-PROCESSAMENTO: BLOOM (BRILHO CINEMATOGRÁFICO)
const composer = new EffectComposer(renderer);
const renderPass = new RenderPass(scene, camera);
composer.addPass(renderPass);
const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.5, 0.4, 0.85);
bloomPass.threshold = 0.2; // Apenas elementos claros vão brilhar
bloomPass.strength = 0.12; // Intensidade reduzida (brilho sutil)
bloomPass.radius = 0.5;    // Espalhamento da luz
composer.addPass(bloomPass);
const outputPass = new OutputPass();
composer.addPass(outputPass);

// 💡 LIGHTING (Setup Cinematográfico Tático)
const ambient = new THREE.AmbientLight(0xffffff, 0.4); // Reduzido para as cores brilharem mais
ambient.layers.enable(1); // A luz ambiente também afeta a Layer 1
scene.add(ambient);

const topLight = new THREE.DirectionalLight(0xffffff, 1.0);
topLight.position.set(2, 10, 3);
topLight.castShadow = true;
topLight.shadow.mapSize.width = 1024;
topLight.shadow.camera.right = 12;
topLight.shadow.camera.top = 12;
topLight.shadow.camera.bottom = -12;
topLight.shadow.camera.near = 0.1;
topLight.shadow.camera.far = 30;
topLight.layers.enable(1); // A luz do Sol também afeta a Layer 1
scene.add(topLight);

// 🔴 Rim Light Vermelha (Luz de Recorte vindo de trás/direita)
const rimLight = new THREE.DirectionalLight(0xff1133, 2.0); 
rimLight.position.set(6, 2, -6);
scene.add(rimLight);
const fillLight = new THREE.DirectionalLight(0x60a5fa, 0.8); 
fillLight.position.set(-6, 4, 4);
scene.add(fillLight);

// ☁️ Sky Fill Light (Luz refletida do céu, EXCLUSIVA para minas inativas)
const skyFillLight = new THREE.DirectionalLight(0x7dd3fc, 1.5); // Azul céu sereno
skyFillLight.position.set(0, 6, 2); // Luz suave vindo de cima/frente
skyFillLight.layers.set(1); // APLICA APENAS NA LAYER 1 (Ignora os blocos normais)
scene.add(skyFillLight);

// 🌌 GAME FEEL 2026: POEIRA ATMOSFÉRICA
const dustGeo = new THREE.BufferGeometry();
const dustCount = 3500; // Quantidade de poeira dobrada para mais "sujeira"
const dustPos = new Float32Array(dustCount * 3);
for(let i = 0; i < dustCount * 3; i++) {
    dustPos[i] = (Math.random() - 0.5) * 20; // Espalha as partículas em X, Y e Z
}
dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
const dustMat = new THREE.PointsMaterial({
    size: 0.35, // Flocos levemente maiores para aumentar a percepção
    color: 0x94a3b8, // Tailwind slate-400
    transparent: true,
    opacity: 0.85, // Mais brilhantes e densas
    blending: THREE.AdditiveBlending // Faz a poeira brilhar sutilmente sobre o fundo
});
const dustParticles = new THREE.Points(dustGeo, dustMat);
scene.add(dustParticles);

// 🧱 INSTANCED MESH COM CHANFRO E TEXTURA FÍSICA
const geometry = new RoundedBoxGeometry(0.96, 0.35, 0.96, 4, 0.06);
const materialPadrão = new THREE.MeshStandardMaterial({ 
    color: COLORS.hiddenTop, 
    roughness: 0.6, 
    metalness: 0.1,
    map: texNoise
});
const instancedMesh = new THREE.InstancedMesh(geometry, materialPadrão, GRID_SIZE * GRID_SIZE);
instancedMesh.castShadow = true;    // Blocos geram sombras uns nos outros
instancedMesh.receiveShadow = true; // Blocos recebem as sombras dos destroços

const dummy = new THREE.Object3D();
const offset = (GRID_SIZE - 1) / 2;
const cellStates = [];

const spritesGroup = new THREE.Group();
scene.add(spritesGroup);

for(let i = 0; i < GRID_SIZE; i++) {
    for(let j = 0; j < GRID_SIZE; j++) {
        const index = i * GRID_SIZE + j;
        dummy.position.set(i - offset, 0, j - offset);
        dummy.updateMatrix();
        
        instancedMesh.setMatrixAt(index, dummy.matrix);
        instancedMesh.setColorAt(index, new THREE.Color(COLORS.hiddenTop));
        cellStates.push({ y: 0, scaleY: 1, color: new THREE.Color(COLORS.hiddenTop) });
    }
}
scene.add(instancedMesh);

function applyInstanceTransform(index, px, pz) {
    const state = cellStates[index];
    dummy.position.set(px, state.y, pz);
    dummy.scale.set(1, state.scaleY, 1);
    dummy.updateMatrix();
    instancedMesh.setMatrixAt(index, dummy.matrix);
    instancedMesh.setColorAt(index, state.color);
    instancedMesh.instanceMatrix.needsUpdate = true;
    instancedMesh.instanceColor.needsUpdate = true;
}

function revealAllMines(fatalX, fatalY) {
    const safeColor = new THREE.Color(COLORS.revealed); 
    for(let i = 0; i < GRID_SIZE; i++) {
        for(let j = 0; j < GRID_SIZE; j++) {
            // Revela apenas se for mina, se NÃO for a mina que explodiu e se não estiver com bandeira
            if(gridData[i][j].isMine && !(i === fatalX && j === fatalY) && !gridData[i][j].flagged) {
                const idx = i * GRID_SIZE + j;
                const v2 = cellStates[idx];
                const px2 = i - offset;
                const pz2 = j - offset;
                const popDelay = Math.random() * 0.5;

                // 1. Cria a bomba imediatamente
                const otherBomb = createBombMesh(false);
                otherBomb.position.set(px2, -0.5, pz2);
                spritesGroup.add(otherBomb);
                
                // 2. Anima a bomba subindo
                gsap.to(otherBomb.position, { y: 0.1, duration: 0.5, delay: popDelay, ease: "back.out(1.7)" });

                // 3. Anima o bloco afundando
                gsap.to(v2, {
                    y: -0.15, scaleY: 0.5, delay: popDelay, duration: 0.4, ease: "power2.out",
                    onStart: () => { v2.color.copy(safeColor); },
                    onUpdate: () => { applyInstanceTransform(idx, px2, pz2); }
                });
            }
        }
    }
}

// 🌊 LÓGICA DE REVELAÇÃO E CASCATA (FLOOD FILL)
function revealCell(x, y, delay = 0) {
    if(x < 0 || x >= GRID_SIZE || y < 0 || y >= GRID_SIZE) return;
    const cell = gridData[x][y];
    if(cell.revealed || cell.flagged) return;
    cell.revealed = true;
    cellsRevealed++;
    
    const index = x * GRID_SIZE + y;
    const px = x - offset;
    const pz = y - offset;
    const v = cellStates[index];
    
    const targetColor = new THREE.Color(cell.isMine ? COLORS.mine : COLORS.revealed);

    gsap.to(v, {
        y: -0.12, scaleY: 0.6, delay: delay, duration: 0.35, ease: "power2.out",
        onUpdate: () => {
            v.color.lerp(targetColor, 0.15);
            applyInstanceTransform(index, px, pz);
        },
        onComplete: () => {
            v.color.copy(targetColor);
            applyInstanceTransform(index, px, pz);
            
            if(!cell.isMine && cell.adjacent > 0) {
                const sprite = createSprite(cell.adjacent.toString(), COLORS.numbers[cell.adjacent]);
                sprite.position.set(px, 0.12, pz);
                spritesGroup.add(sprite);
                gsap.from(sprite.scale, { x: 0, y: 0, z: 0, duration: 0.4, ease: "back.out(1.5)" });
            }
        }
    });

    if(cell.isMine) {
        // 💣 BOMB SPAWN & PARTICLES
        triggerExplosion(px, 0, pz);
        const bomb = createBombMesh();
        bomb.position.set(px, -0.5, pz);
        spritesGroup.add(bomb);
        gsap.to(bomb.position, { y: 0.1, duration: 0.5, ease: "back.out(1.5)" });

        // LÓGICA DE DANO SEPARADA POR MODO
        if (gameMode === 'classic') {
            gameOver = true;
            focus = 0;
            uiFocus.innerText = `F:0%`;
            uiFocus.classList.add('text-red-700');
            clearInterval(timerInterval);
            
            isDead = true;
            uiSmileyImg.src = IMG_DEATH;
        } else {
            // Modo Roguelite (Operador)
            focus -= 25;
            uiFocus.innerText = `F:${focus}%`;
            uiFocus.classList.add('text-red-700');
            setTimeout(() => uiFocus.classList.remove('text-red-700'), 400);
            
            if(focus <= 0) {
                gameOver = true;
                clearInterval(timerInterval);
                isDead = true;
                uiSmileyImg.src = IMG_DEATH;
            } else {
                // Expressão de Dano (Coração pulsando) - Só acontece se sobreviveu
                isDamaged = true;
                uiSmileyImg.src = IMG_DAMAGE;
                currentSmileySrc = IMG_DAMAGE;
                gsap.to(uiSmileyImg, { scale: 1.25, duration: 0.15, yoyo: true, repeat: -1, ease: "sine.inOut" });

                setTimeout(() => { 
                    if(!gameOver) { isDamaged = false; gsap.killTweensOf(uiSmileyImg); gsap.to(uiSmileyImg, { scale: 1, duration: 0.2 }); }
                }, 1200);
            }
        }

        // 💥 SCREEN SHAKE PROFISSIONAL E SUTIL
        const startX = camera.position.x;
        const startZ = camera.position.z;
        gsap.fromTo(camera.position, 
            { x: startX, z: startZ }, 
            { x: startX + 0.12, z: startZ + 0.05, yoyo: true, repeat: 9, duration: 0.05, ease: "sine.inOut", onComplete: () => {
                if (gameOver) {
                    if (gameMode === 'roguelite') {
                        // 🎥 ZOOM CINEMATOGRÁFICO DE GAME OVER (Apenas Operador/Roguelite)
                        gsap.to(camera, { zoom: 3, duration: 1.5, ease: "power2.inOut", onUpdate: () => camera.updateProjectionMatrix() });
                        gsap.to(camera.position, { x: px, y: 10, z: pz + 3.18, duration: 1.5, ease: "power2.inOut", onComplete: () => {
                            uiSmileyImg.src = IMG_DEATH;
                            gsap.to('#death-overlay', { opacity: 1, duration: 0.2 }); // Traz o degradê vermelho para a frente do emoji
                            gsap.killTweensOf(uiSmileyImg);
                            gsap.to(uiSmileyImg, { scale: 1, duration: 0.2 }); // Retorna escala se estava pulsando
                        }});
                    } else {
                        // 🗺️ CÂMERA ABERTA (Modo Clássico): Reseta trepidação para ver as outras minas
                        gsap.to(camera.position, { x: startX, z: startZ, duration: 0.2, ease: "power2.out" });
                        uiSmileyImg.src = IMG_DEATH;
                        gsap.to('#death-overlay', { opacity: 1, duration: 0.2 }); 
                        gsap.killTweensOf(uiSmileyImg);
                        gsap.to(uiSmileyImg, { scale: 1, duration: 0.2 }); 
                    }
                } else {
                    gsap.to(camera.position, { x: startX, z: startZ, duration: 0.2, ease: "power2.out" });
                }
            }}
        );

        // 💣 REVELA AS OUTRAS MINAS (SOMENTE SE MORREU)
        if (gameOver) {
            const safeColor = new THREE.Color(COLORS.revealed); // Otimização de performance
            for(let i = 0; i < GRID_SIZE; i++) {
                for(let j = 0; j < GRID_SIZE; j++) {
                    if(gridData[i][j].isMine && !(i === x && j === y) && !gridData[i][j].flagged) {
                        const idx = i * GRID_SIZE + j;
                        const v2 = cellStates[idx];
                        const px2 = i - offset;
                        const pz2 = j - offset;
                        
                        gsap.to(v2, {
                            y: -0.12, scaleY: 0.6, delay: 0.4 + Math.random() * 0.8, duration: 0.35, ease: "power2.out",
                            onUpdate: () => {
                                v2.color.lerp(safeColor, 0.15); // Usa a cor otimizada
                                applyInstanceTransform(idx, px2, pz2);
                            },
                            onComplete: () => {
                                v2.color.copy(safeColor); // Usa a cor otimizada
                                applyInstanceTransform(idx, px2, pz2);
                                const otherBomb = createBombMesh(false); // false = Mina sem a luz/brasa vermelha
                                otherBomb.position.set(px2, -0.5, pz2);
                                spritesGroup.add(otherBomb);
                                gsap.to(otherBomb.position, { y: 0.1, duration: 0.5, ease: "back.out(1.5)" });
                            }
                        });
                    }
                }
            }
        }
    } else if(cell.adjacent === 0) {
        // Chama as vizinhas em cascata (Flood Fill)
        const nextDelay = delay + 0.04;
        for(let dx = -1; dx <= 1; dx++) {
            for(let dy = -1; dy <= 1; dy++) {
                revealCell(x + dx, y + dy, nextDelay);
            }
        }
    }
    
    // 🏆 VERIFICAÇÃO DE VITÓRIA (WIN STATE)
    if(!cell.isMine && cellsRevealed === (GRID_SIZE * GRID_SIZE) - MINES_COUNT) {
        gameOver = true;
        clearInterval(timerInterval);
        uiFocus.innerText = `CLEAR!`;
        uiFocus.classList.add('text-emerald-400');
        gsap.to(camera.position, { y: 16, duration: 3, ease: "power2.out" }); // Câmera sobe para admirar o tabuleiro limpo
        
        // 🚩 AUTO-BANDEIRA (Regra Clássica de Vitória)
        for(let i = 0; i < GRID_SIZE; i++) {
            for(let j = 0; j < GRID_SIZE; j++) {
                if(gridData[i][j].isMine && !gridData[i][j].flagged) {
                    const idx = i * GRID_SIZE + j;
                    toggleFlag(idx, i, j);
                }
            }
        }
    }
}

// Interação e Raycaster
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

// Efeito Tátil (Press)
window.addEventListener('pointerdown', (event) => {
    if(gameOver) return;
    
    isLongPress = false;
    if(event.button === 2) return; // Ignora o clique direito (é tratado no contextmenu)

    lastInteractionTime = performance.now();
    const clientX = event.changedTouches ? event.changedTouches[0].clientX : event.clientX;
    const clientY = event.changedTouches ? event.changedTouches[0].clientY : event.clientY;

    pointer.x = (clientX / window.innerWidth) * 2 - 1;
    pointer.y = -(clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(pointer, camera);
    const intersects = raycaster.intersectObject(instancedMesh);

    if (intersects.length > 0) {
        const instanceId = intersects[0].instanceId;
        const x = Math.floor(instanceId / GRID_SIZE);
        const y = instanceId % GRID_SIZE;
        const cell = gridData[x][y];

        // Permite clicar em blocos revelados para o Chording, mas só afunda blocos escondidos
        if(!cell.flagged) {
            pressedInstanceId = instanceId;
            if(!cell.revealed) {
                const v = cellStates[instanceId];
                gsap.to(v, { 
                    y: -0.06, duration: 0.08, 
                    onUpdate: () => applyInstanceTransform(instanceId, x - offset, y - offset) 
                });

                // Inicia timer para Long Press (Dispara Bandeira no Mobile se não soltar)
                longPressTimer = setTimeout(() => {
                    isLongPress = true;
                    toggleFlag(instanceId, x, y);
                    // Devolve o bloco para a altura original
                    gsap.to(v, { y: 0, duration: 0.1, onUpdate: () => applyInstanceTransform(instanceId, x - offset, y - offset) });
                }, 400);
            }
        }
    }
});

// Confirma Ação (Reveal)
window.addEventListener('pointerup', (event) => {
    clearTimeout(longPressTimer); // Cancela o timer se soltar o dedo rápido
    if(gameOver || event.button === 2 || isLongPress) return;
    lastInteractionTime = performance.now();

    if(pressedInstanceId !== null) {
        const x = Math.floor(pressedInstanceId / GRID_SIZE);
        const y = pressedInstanceId % GRID_SIZE;
        
        if(firstClick) {
            firstClick = false;
            placeMines(x, y);
            timerInterval = setInterval(() => {
                timer++;
                uiTimer.innerText = timer.toString().padStart(3, '0');
            }, 1000);
        }

        const cell = gridData[x][y];

        if(cell.revealed && cell.adjacent > 0) {
            // ⚡ CHORDING: Conta as bandeiras ao redor
            let flagCount = 0;
            for(let dx = -1; dx <= 1; dx++) {
                for(let dy = -1; dy <= 1; dy++) {
                    let nx = x + dx, ny = y + dy;
                    if(nx >= 0 && nx < GRID_SIZE && ny >= 0 && ny < GRID_SIZE && gridData[nx][ny].flagged) flagCount++;
                }
            }
            // Se o número de bandeiras bater com o número do bloco, revela todos os vizinhos escondidos
            if(flagCount === cell.adjacent) {
                for(let dx = -1; dx <= 1; dx++) {
                    for(let dy = -1; dy <= 1; dy++) {
                        let nx = x + dx, ny = y + dy;
                        if(nx >= 0 && nx < GRID_SIZE && ny >= 0 && ny < GRID_SIZE && !gridData[nx][ny].revealed && !gridData[nx][ny].flagged) {
                            revealCell(nx, ny);
                        }
                    }
                }
            }
        } else if(!cell.revealed) {
            revealCell(x, y);
        }
        pressedInstanceId = null;
    }
});

// Clique Direito (Bandeira no PC)
window.addEventListener('contextmenu', (event) => {
    event.preventDefault(); // Impede o menu do navegador de abrir
    if(gameOver) return;
    lastInteractionTime = performance.now();

    pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
    pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(pointer, camera);
    const intersects = raycaster.intersectObject(instancedMesh);

    if (intersects.length > 0) {
        const instanceId = intersects[0].instanceId;
        const x = Math.floor(instanceId / GRID_SIZE);
        const y = instanceId % GRID_SIZE;
        toggleFlag(instanceId, x, y);
    }
});

window.addEventListener('resize', () => {
    const aspect = window.innerWidth / window.innerHeight;
    camera.left = -frustumSize * aspect / 2;
    camera.right = frustumSize * aspect / 2;
    camera.top = frustumSize / 2;
    camera.bottom = -frustumSize / 2;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);
});

function animate() {
    requestAnimationFrame(animate);
    updateSmileyFace(); // Analisa e processa as emoções/imagens
    
    // Rotação contínua e suave para simular a poeira flutuando ao vento
    dustParticles.rotation.y += 0.0012; // Movimento mais perceptível
    dustParticles.rotation.x += 0.0006;
    
    // 🚩 Animação do vento batendo nas bandeiras
    const time = performance.now() * 0.005; // Tempo um pouco mais lento para vento brando
    flagsMap.forEach((flagGroup) => {
        const flagMesh = flagGroup.children[3]; // Atualizado para apontar para o tecido (4º elemento do grupo)
        const positions = flagMesh.geometry.attributes.position;
        const baseZ = flagMesh.geometry.attributes.baseZ.array;
        
        for(let i = 0; i < positions.count; i++) {
            const x = positions.getX(i);
            // Vento realista e discreto: duas ondas sobrepostas com amplitudes bem baixinhas
            const windZ = Math.sin(time + flagGroup.position.x + x * 15) * (x * 0.06) 
                    + Math.cos(time * 1.5 + flagGroup.position.z + x * 10) * (x * 0.03);
            positions.setZ(i, baseZ[i] + windZ); // Soma o movimento do vento à espessura da geometria
        }
        positions.needsUpdate = true;
        flagMesh.geometry.computeVertexNormals(); // Atualiza as sombras nas dobras do pano
    });

    composer.render();
}
animate();