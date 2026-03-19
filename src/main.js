import {
  Animation,
  Color3,
  Color4,
  CubeTexture,
  DirectionalLight,
  DynamicTexture,
  Engine,
  HemisphericLight,
  MeshBuilder,
  ParticleSystem,
  PointLight,
  Scene,
  SceneLoader,
  StandardMaterial,
  Texture,
  TransformNode,
  UniversalCamera,
  Vector3,
} from "https://cdn.jsdelivr.net/npm/@babylonjs/core@7.48.0/index.js";
import "https://cdn.jsdelivr.net/npm/@babylonjs/loaders@7.48.0/glTF/index.js";

const ROOM = {
  width: 12,
  depth: 10,
  height: 4.2,
  wallThickness: 0.24,
  doorWidth: 2,
  doorHeight: 3,
};

const ASSETS = {
  environment:
    "https://assets.babylonjs.com/environments/environmentSpecular.env",
  floorTexture:
    "https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/herringbone_parquet/herringbone_parquet_diff_1k.jpg",
  wallTexture:
    "https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/beige_wall_001/beige_wall_001_diff_1k.jpg",
  wallArt:
    "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/GlamVelvetSofa/screenshot/screenshot.jpg",
};

const MODEL_BASE =
  "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models";

const MODEL_LAYOUT = [
  // Sofa against north wall, facing room
  {
    name: "GlamVelvetSofa",
    position: new Vector3(-3.8, 0, 3.8),
    rotationY: Math.PI,
    targetHeight: 1.2,
  },
  // Purple chair — NE corner
  {
    name: "ChairDamaskPurplegold",
    position: new Vector3(4.3, 0, 4.3),
    rotationY: -Math.PI * 0.75,
    targetHeight: 1.15,
  },
  // Refrigerator — east wall, south area
  {
    name: "CommercialRefrigerator",
    position: new Vector3(5.0, 0, -3.2),
    rotationY: -Math.PI / 2,
    targetHeight: 2.2,
  },
  // 2 dining chairs — one on each long side of the table (north and south)
  {
    name: "SheenChairN",
    url: "https://assets.babylonjs.com/meshes/SheenChair.glb",
    position: new Vector3(0, 0, 0.3),
    rotationY: Math.PI,        // faces south (-Z) toward table
    targetHeight: 1.0,
  },
  {
    name: "SheenChairS",
    url: "https://assets.babylonjs.com/meshes/SheenChair.glb",
    position: new Vector3(0, 0, -1.3),
    rotationY: 0,              // faces north (+Z) toward table
    targetHeight: 1.0,
  },
];

function randomUniqueNumbers(count, min, max) {
  const pool = [];
  for (let i = min; i <= max; i++) pool.push(i);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, count);
}

const [cn1, cn2, cn3, cn4] = randomUniqueNumbers(4, 1, 9);

const CLUE_DEFINITIONS = [
  {
    id: "clock",
    number: cn1,
    message: `A stopped desk clock is frozen at ${cn1}. That number looks deliberate.`,
    position: new Vector3(0, 0.82, -0.5),
    color: new Color3(0.88, 0.76, 0.26),
  },
  {
    id: "receipt",
    number: cn2,
    message: `A winner's ticket is taped to the joystick: "SNAKE 10 — TOP SCORER — CODE ${cn2}". The number ${cn2} is stamped in green ink.`,
    position: new Vector3(-5.16, 1.12, -1.9),
    color: new Color3(0.3, 0.82, 0.86),
  },
  {
    id: "metalTag",
    number: cn3,
    message: `A postcard hidden behind the King Kong poster reads "Cabin No. ${cn3}". The number is circled in red ink.`,
    position: new Vector3(2.2, 2.15, 4.3),
    color: new Color3(0.85, 0.46, 0.3),
  },
  {
    id: "sinkPaper",
    number: cn4,
    message: `A soggy note at the bottom of the sink reads: "Lucky number: ${cn4}" — scrawled in blue ink.`,
    position: new Vector3(5.44, 1.05, 0.0),
    color: new Color3(0.3, 0.65, 0.95),
  },
];

function requiredElement(id) {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`Missing required DOM element: #${id}`);
  }
  return element;
}

const canvas = requiredElement("renderCanvas");
const ui = {
  clueLedger: requiredElement("clueLedger"),
  prompt: requiredElement("interactionPrompt"),
  cluePanel: requiredElement("cluePanel"),
  clueText: requiredElement("clueText"),
  clueCloseBtn: requiredElement("clueCloseBtn"),
  doorPanel: requiredElement("doorPanel"),
  doorForm: requiredElement("doorForm"),
  codeInputs: [
    requiredElement("code1"),
    requiredElement("code2"),
    requiredElement("code3"),
    requiredElement("code4"),
  ],
  doorCancelBtn: requiredElement("doorCancelBtn"),
  doorFeedback: requiredElement("doorFeedback"),
  winBanner: requiredElement("winBanner"),
};

const engine = new Engine(canvas, true, {
  preserveDrawingBuffer: true,
  stencil: true,
});

const gameState = {
  combination: CLUE_DEFINITIONS.map((clue) => clue.number),
  discoveredNumbers: new Map(),
  doorInRange: false,
  doorUnlocked: false,
  escaped: false,
  overlayOpen: false,
  transientPrompt: { text: "", until: 0 },
  arcadeInRange: false,
  snakeCompleted: false,
  // Inventory
  inventory: [],       // array of { id, label, emoji }
  activeItem: null,    // id of selected inventory item
  pliersPicked: false,
  sinkDrained: false,
  sinkInRange: false,
  pliersInRange: false,
};

function showPrompt(text) {
  ui.prompt.textContent = text;
  ui.prompt.classList.remove("hidden");
}

function hidePrompt() {
  ui.prompt.classList.add("hidden");
}

function setTransientPrompt(text, durationMs = 1800) {
  gameState.transientPrompt.text = text;
  gameState.transientPrompt.until = performance.now() + durationMs;
}

function updateClueLedger() {
  const slots = CLUE_DEFINITIONS.map((clue) => {
    const value = gameState.discoveredNumbers.get(clue.id);
    return `[ ${typeof value === "number" ? value : "?"} ]`;
  });
  ui.clueLedger.textContent = `Clues found: ${slots.join(" ")}`;
}

function renderInventoryBar() {
  const bar = document.getElementById("inventory-bar");
  if (!bar) return;
  const slotsEl = bar.querySelector("#inv-slots");
  if (!slotsEl) return;
  slotsEl.innerHTML = "";
  gameState.inventory.forEach(({ id, label, emoji }) => {
    const slot = document.createElement("div");
    slot.className = "inv-slot" + (gameState.activeItem === id ? " inv-slot--active" : "");
    slot.innerHTML = `<span class="inv-emoji">${emoji}</span><span class="inv-label">${label}</span>`;
    slot.addEventListener("click", () => selectInventoryItem(id));
    slotsEl.appendChild(slot);
  });
  const activeEl = bar.querySelector("#inv-active");
  if (activeEl) {
    activeEl.textContent = gameState.activeItem
      ? `Using: ${gameState.inventory.find(i => i.id === gameState.activeItem)?.label ?? ""}`
      : "";
  }
}

function addToInventory(id, label, emoji) {
  if (gameState.inventory.find(i => i.id === id)) return;
  gameState.inventory.push({ id, label, emoji });
  renderInventoryBar();
}

function selectInventoryItem(id) {
  gameState.activeItem = gameState.activeItem === id ? null : id;
  renderInventoryBar();
}

function openOverlay(element) {
  element.classList.remove("hidden");
  gameState.overlayOpen = true;
  if (document.pointerLockElement === canvas) {
    document.exitPointerLock();
  }
}

function closeOverlay(element) {
  element.classList.add("hidden");
  const anyOpen =
    !ui.cluePanel.classList.contains("hidden") ||
    !ui.doorPanel.classList.contains("hidden") ||
    !ui.winBanner.classList.contains("hidden");
  gameState.overlayOpen = anyOpen;
}

function sortedSignature(numbers) {
  return [...numbers]
    .map((value) => Number(value))
    .sort((a, b) => a - b)
    .join("|");
}

function createMaterial(scene, name, textureUrl, uScale, vScale) {
  const material = new StandardMaterial(name, scene);
  const texture = new Texture(textureUrl, scene, true, false);
  texture.uScale = uScale;
  texture.vScale = vScale;
  material.diffuseTexture = texture;
  material.specularColor = new Color3(0.08, 0.08, 0.08);
  return material;
}

function setCollisionFlags(meshes, enabled) {
  for (const mesh of meshes) {
    mesh.checkCollisions = enabled;
    mesh.isPickable = false;
  }
}

function createRoom(scene) {
  const floor = MeshBuilder.CreateGround(
    "floor",
    { width: ROOM.width, height: ROOM.depth },
    scene,
  );
  floor.position.y = 0;
  floor.material = createMaterial(scene, "floorMaterial", ASSETS.floorTexture, 4, 4);
  floor.checkCollisions = true;
  floor.receiveShadows = true;

  const ceiling = MeshBuilder.CreateGround(
    "ceiling",
    { width: ROOM.width, height: ROOM.depth },
    scene,
  );
  ceiling.position.y = ROOM.height;
  ceiling.rotation.x = Math.PI;
  const ceilingMaterial = new StandardMaterial("ceilingMaterial", scene);
  const ceilingTex = new Texture("./textures/concrete_tile_facade_diff_2k.jpg", scene, true, false);
  ceilingTex.uScale = 4;
  ceilingTex.vScale = 3;
  ceilingMaterial.diffuseTexture = ceilingTex;
  ceilingMaterial.diffuseColor = new Color3(0.7, 0.7, 0.7);
  ceilingMaterial.emissiveColor = new Color3(0.28, 0.27, 0.25);
  ceilingMaterial.specularColor = new Color3(0.02, 0.02, 0.02);
  ceiling.material = ceilingMaterial;
  ceiling.checkCollisions = true;
  ceiling.isPickable = false;

  const wallMaterial = createMaterial(scene, "wallMaterial", ASSETS.wallTexture, 4, 2);

  const northWall = MeshBuilder.CreateBox(
    "northWall",
    { width: ROOM.width, height: ROOM.height, depth: ROOM.wallThickness },
    scene,
  );
  northWall.position = new Vector3(0, ROOM.height / 2, ROOM.depth / 2);
  northWall.material = wallMaterial;

  const eastWall = MeshBuilder.CreateBox(
    "eastWall",
    { width: ROOM.depth, height: ROOM.height, depth: ROOM.wallThickness },
    scene,
  );
  eastWall.position = new Vector3(ROOM.width / 2, ROOM.height / 2, 0);
  eastWall.rotation.y = Math.PI / 2;
  eastWall.material = wallMaterial;

  const westWall = MeshBuilder.CreateBox(
    "westWall",
    { width: ROOM.depth, height: ROOM.height, depth: ROOM.wallThickness },
    scene,
  );
  westWall.position = new Vector3(-ROOM.width / 2, ROOM.height / 2, 0);
  westWall.rotation.y = Math.PI / 2;
  westWall.material = wallMaterial;

  const sideWidth = (ROOM.width - ROOM.doorWidth) / 2;

  const southLeftWall = MeshBuilder.CreateBox(
    "southLeftWall",
    { width: sideWidth, height: ROOM.height, depth: ROOM.wallThickness },
    scene,
  );
  southLeftWall.position = new Vector3(
    -ROOM.doorWidth / 2 - sideWidth / 2,
    ROOM.height / 2,
    -ROOM.depth / 2,
  );
  southLeftWall.material = wallMaterial;

  const southRightWall = MeshBuilder.CreateBox(
    "southRightWall",
    { width: sideWidth, height: ROOM.height, depth: ROOM.wallThickness },
    scene,
  );
  southRightWall.position = new Vector3(
    ROOM.doorWidth / 2 + sideWidth / 2,
    ROOM.height / 2,
    -ROOM.depth / 2,
  );
  southRightWall.material = wallMaterial;

  const topHeight = ROOM.height - ROOM.doorHeight;
  const southTopWall = MeshBuilder.CreateBox(
    "southTopWall",
    { width: ROOM.doorWidth, height: topHeight, depth: ROOM.wallThickness },
    scene,
  );
  southTopWall.position = new Vector3(
    0,
    ROOM.doorHeight + topHeight / 2,
    -ROOM.depth / 2,
  );
  southTopWall.material = wallMaterial;

  setCollisionFlags(
    [
      northWall,
      eastWall,
      westWall,
      southLeftWall,
      southRightWall,
      southTopWall,
      floor,
      ceiling,
    ],
    true,
  );

  const doorHinge = new TransformNode("doorHinge", scene);
  doorHinge.position = new Vector3(
    -ROOM.doorWidth / 2,
    ROOM.doorHeight / 2,
    -ROOM.depth / 2 + ROOM.wallThickness / 2,
  );

  const door = MeshBuilder.CreateBox(
    "door",
    { width: ROOM.doorWidth, height: ROOM.doorHeight, depth: 0.1 },
    scene,
  );
  door.parent = doorHinge;
  door.position = new Vector3(ROOM.doorWidth / 2, 0, 0);
  const doorMaterial = new StandardMaterial("doorMaterial", scene);
  const doorTexture = new Texture(
    "https://playground.babylonjs.com/textures/wood.jpg",
    scene,
    true,
    false,
  );
  doorTexture.uScale = 1;
  doorTexture.vScale = 1.5;
  doorMaterial.diffuseTexture = doorTexture;
  doorMaterial.specularColor = new Color3(0.22, 0.18, 0.12);
  doorMaterial.specularPower = 36;
  door.material = doorMaterial;
  door.checkCollisions = true;
  door.isPickable = false;

  // Door-panel moulding strips
  const mouldingMat = new StandardMaterial("mouldingMat", scene);
  mouldingMat.diffuseColor = new Color3(0.28, 0.17, 0.08);
  mouldingMat.specularColor = new Color3(0.12, 0.1, 0.06);
  const mouldingData = [
    { w: ROOM.doorWidth - 0.3, h: 0.04, y:  0.7 },
    { w: ROOM.doorWidth - 0.3, h: 0.04, y: -0.7 },
    { w: 0.04, h: 1.48, y:  0 },
  ];
  for (const [idx, md] of mouldingData.entries()) {
    const strip = MeshBuilder.CreateBox(`doorMoulding${idx}`, { width: md.w, height: md.h, depth: 0.02 }, scene);
    strip.parent = doorHinge;
    strip.position = new Vector3(ROOM.doorWidth / 2, md.y, -0.06);
    strip.material = mouldingMat;
    strip.isPickable = false;
    strip.checkCollisions = false;
  }

  // Brass doorknob (inside face, room side)
  const knobMat = new StandardMaterial("doorKnobMat", scene);
  knobMat.diffuseColor = new Color3(0.72, 0.58, 0.18);
  knobMat.specularColor = new Color3(0.85, 0.72, 0.3);
  knobMat.specularPower = 80;
  const knobBall = MeshBuilder.CreateSphere("doorKnob", { diameter: 0.115, segments: 14 }, scene);
  knobBall.parent = doorHinge;
  // knob height: 0.5 below door centre == 1.0 m above floor (ROOM.doorHeight/2 - 0.5)
  knobBall.position = new Vector3(ROOM.doorWidth - 0.2, -0.5, 0.09);
  knobBall.material = knobMat;
  knobBall.isPickable = false;
  knobBall.checkCollisions = false;
  const knobStem = MeshBuilder.CreateCylinder("doorKnobStem", { height: 0.07, diameter: 0.035, tessellation: 10 }, scene);
  knobStem.parent = doorHinge;
  knobStem.position = new Vector3(ROOM.doorWidth - 0.2, -0.5, 0.04);
  knobStem.rotation.x = Math.PI / 2;
  knobStem.material = knobMat;
  knobStem.isPickable = false;
  knobStem.checkCollisions = false;

  return {
    door,
    doorHinge,
    doorInteractionPoint: new Vector3(
      0,
      ROOM.doorHeight * 0.5,
      -ROOM.depth / 2 + 1.1,
    ),
    exitThresholdZ: -ROOM.depth / 2 - 1.2,
  };
}

function createOutdoorScene(scene) {
  // Sky dome — large sphere surrounding the outdoor area, seen through the open door
  const skyMat = new StandardMaterial("skyMat", scene);
  skyMat.diffuseColor = new Color3(0.38, 0.68, 0.96);
  skyMat.emissiveColor = new Color3(0.32, 0.6, 0.9);
  skyMat.backFaceCulling = false;
  skyMat.disableLighting = true;
  const skydome = MeshBuilder.CreateSphere("skydome", { diameter: 100, segments: 16 }, scene);
  skydome.position = new Vector3(0, 8, -15);
  skydome.material = skyMat;
  skydome.isPickable = false;

  // Outdoor ground — lush green
  const grassMat = new StandardMaterial("grassMat", scene);
  const grassTex = new Texture(
    "https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/brown_planks_07/brown_planks_07_diff_1k.jpg",
    scene,
    true,
    false,
  );
  grassTex.uScale = 12;
  grassTex.vScale = 12;
  // tint the floor texture green to simulate grass
  grassMat.diffuseColor = new Color3(0.22, 0.55, 0.18);
  grassMat.specularColor = new Color3(0.04, 0.06, 0.04);
  const outdoorGround = MeshBuilder.CreateGround(
    "outdoorGround",
    { width: 90, height: 44, subdivisions: 2 },
    scene,
  );
  // Centered at -27 → spans Z: -49 to -5 (stops right at south wall, no room overlap)
  outdoorGround.position = new Vector3(0, 0.005, -27);
  outdoorGround.material = grassMat;
  outdoorGround.checkCollisions = true;
  outdoorGround.isPickable = false;

  // Pathway — narrow concrete strip from door to outside
  const pathMat = new StandardMaterial("pathMat", scene);
  pathMat.diffuseColor = new Color3(0.62, 0.6, 0.55);
  pathMat.specularColor = new Color3(0.08, 0.08, 0.08);
  const path = MeshBuilder.CreateBox("outdoorPath", { width: 1.1, height: 0.01, depth: 12 }, scene);
  path.position = new Vector3(0, 0.006, -11);
  path.material = pathMat;
  path.isPickable = false;

  // Procedural trees
  const trunkMat = new StandardMaterial("trunkMat", scene);
  trunkMat.diffuseColor = new Color3(0.35, 0.22, 0.1);
  trunkMat.specularColor = new Color3(0.05, 0.05, 0.05);

  const leavesMat = new StandardMaterial("leavesMat", scene);
  leavesMat.diffuseColor = new Color3(0.14, 0.48, 0.16);
  leavesMat.specularColor = new Color3(0.03, 0.06, 0.03);

  const treeConfigs = [
    { x: -4.8, z: -8,  trunkH: 2.2, canopyD: 2.6 },
    { x:  5.2, z: -10, trunkH: 2.6, canopyD: 3.1 },
    { x: -6.5, z: -14, trunkH: 1.9, canopyD: 2.2 },
    { x:  3.8, z: -17, trunkH: 3.0, canopyD: 3.6 },
  ];

  for (const cfg of treeConfigs) {
    const trunk = MeshBuilder.CreateCylinder(
      `trunk-${cfg.x}`,
      { height: cfg.trunkH, diameterTop: 0.22, diameterBottom: 0.34, tessellation: 10 },
      scene,
    );
    trunk.position = new Vector3(cfg.x, cfg.trunkH / 2, cfg.z);
    trunk.material = trunkMat;
    trunk.isPickable = false;

    // Two stacked cones for fuller canopy
    const canopy1 = MeshBuilder.CreateCylinder(
      `canopy1-${cfg.x}`,
      { height: cfg.canopyD * 1.1, diameterTop: 0, diameterBottom: cfg.canopyD, tessellation: 10 },
      scene,
    );
    canopy1.position = new Vector3(cfg.x, cfg.trunkH + cfg.canopyD * 0.38, cfg.z);
    canopy1.material = leavesMat;
    canopy1.isPickable = false;

    const canopy2 = MeshBuilder.CreateCylinder(
      `canopy2-${cfg.x}`,
      { height: cfg.canopyD * 0.9, diameterTop: 0, diameterBottom: cfg.canopyD * 0.7, tessellation: 10 },
      scene,
    );
    canopy2.position = new Vector3(cfg.x, cfg.trunkH + cfg.canopyD * 0.85, cfg.z);
    canopy2.material = leavesMat;
    canopy2.isPickable = false;
  }

  // Outdoor sun light
  const sunLight = new DirectionalLight("sunLight", new Vector3(0.3, -1, 0.5), scene);
  sunLight.position = new Vector3(0, 20, -5);
  sunLight.diffuse = new Color3(1, 0.97, 0.88);
  sunLight.intensity = 0.9;
}

function createWallPosters(scene) {
  // Verified-200 public-domain images from Wikimedia Commons
  const northZ = ROOM.depth / 2 - ROOM.wallThickness / 2;  // 4.88 — inner north face
  const eastX  =  ROOM.width  / 2 - ROOM.wallThickness / 2; // 5.88
  const westX  = -(ROOM.width  / 2 - ROOM.wallThickness / 2); // -5.88

  const posters = [
    {
      // Nosferatu (1922) — classic horror movie poster
      url: "https://upload.wikimedia.org/wikipedia/commons/2/23/Nosferatu.jpg",
      pos: new Vector3(-2.8, 2.15, northZ - 0.03),
      rotY: 0, pw: 1.1, ph: 1.55,
    },
    {
      // King Kong (1933) — iconic monster movie poster
      url: "https://upload.wikimedia.org/wikipedia/commons/f/f3/Kingkongposter.jpg",
      pos: new Vector3(2.6, 2.15, northZ - 0.03),
      rotY: 0, pw: 1.0, ph: 1.55,
    },
    {
      // Pac-Man pixel-perfect gameplay art
      url: "https://upload.wikimedia.org/wikipedia/commons/c/c0/Pac-Man_gameplay_%281x_pixel-perfect_recreation%29.png",
      pos: new Vector3(westX + 0.03, 2.2, -1.2),
      rotY: -Math.PI / 2, pw: 1.1, ph: 1.1,
    },
    {
      // Classic Tetris game art
      url: "https://upload.wikimedia.org/wikipedia/commons/thumb/9/9c/Typical_Tetris_Game.svg/250px-Typical_Tetris_Game.svg.png",
      pos: new Vector3(eastX - 0.03, 2.2, 0.8),
      rotY: Math.PI / 2, pw: 1.0, ph: 1.4,
    },
  ];

  const frameMat = new StandardMaterial("posterFrameMat", scene);
  frameMat.diffuseColor = new Color3(0.08, 0.06, 0.04);
  frameMat.specularColor = new Color3(0.1, 0.1, 0.1);

  for (const [idx, cfg] of posters.entries()) {
    if (idx === 1) continue; // King Kong handled separately as hinged poster with hidden clue
    const mat = new StandardMaterial(`posterMat${idx}`, scene);
    mat.diffuseTexture = new Texture(cfg.url, scene, true, true);
    mat.specularColor = new Color3(0.05, 0.05, 0.05);
    mat.emissiveColor = new Color3(0.04, 0.04, 0.04);
    mat.backFaceCulling = false;

    const frame = MeshBuilder.CreateBox(
      `posterFrame${idx}`,
      { width: cfg.pw + 0.08, height: cfg.ph + 0.08, depth: 0.04 },
      scene,
    );
    frame.position = cfg.pos.clone();
    frame.rotation.y = cfg.rotY;
    frame.material = frameMat;
    frame.isPickable = false;

    const plane = MeshBuilder.CreatePlane(
      `posterPlane${idx}`,
      { width: cfg.pw, height: cfg.ph },
      scene,
    );
    plane.position = cfg.pos.clone();
    // Offset plane toward room (away from wall face)
    plane.position.x -= Math.sin(cfg.rotY) * 0.03;
    plane.position.z -= Math.cos(cfg.rotY) * 0.03;
    plane.rotation.y = cfg.rotY;
    plane.material = mat;
    plane.isPickable = false;
  }
}
function createProceduralFurniture(scene) {
  const woodMaterial = new StandardMaterial("furnitureWoodMaterial", scene);
  woodMaterial.diffuseColor = new Color3(0.45, 0.3, 0.18);
  woodMaterial.specularColor = new Color3(0.08, 0.08, 0.08);

  const cabinetBaseMat = new StandardMaterial("cabinetBaseMat", scene);
  cabinetBaseMat.diffuseColor = new Color3(0.10, 0.20, 0.14);  // forest green
  cabinetBaseMat.specularColor = new Color3(0.10, 0.13, 0.11);

  const sinkMaterial = new StandardMaterial("sinkMaterial", scene);
  sinkMaterial.diffuseColor = new Color3(0.78, 0.8, 0.82);
  sinkMaterial.specularColor = new Color3(0.35, 0.35, 0.35);

  const lampMetalMaterial = new StandardMaterial("wallLampMetalMaterial", scene);
  lampMetalMaterial.diffuseColor = new Color3(0.2, 0.19, 0.17);
  lampMetalMaterial.specularColor = new Color3(0.28, 0.28, 0.28);

  const lampShadeMaterial = new StandardMaterial("wallLampShadeMaterial", scene);
  lampShadeMaterial.diffuseColor = new Color3(0.27, 0.24, 0.18);
  lampShadeMaterial.specularColor = new Color3(0.24, 0.24, 0.24);

  const lampBulbMaterial = new StandardMaterial("wallLampBulbMaterial", scene);
  lampBulbMaterial.diffuseColor = new Color3(1, 0.92, 0.78);
  lampBulbMaterial.emissiveColor = new Color3(0.5, 0.44, 0.3);
  lampBulbMaterial.specularColor = new Color3(0.2, 0.2, 0.2);

  // ── Kitchen counter against east wall ─────────────────────────────────────
  // width (X) = depth from wall, depth (Z) = length along wall
  // Base cabinet (0.92 tall) + separate marble slab (0.04) keep total surface at y=0.96
  const counter = MeshBuilder.CreateBox(
    "counter",
    { width: 0.72, depth: 2.6, height: 0.92 },
    scene,
  );
  counter.position = new Vector3(5.52, 0.46, 0);
  counter.material = cabinetBaseMat;

  // Marble countertop slab (sits on top of base cabinet, slight overhang)
  const marbleTex = new DynamicTexture("marbleCounterTex", { width: 512, height: 512 }, scene, false);
  const mtCtx = marbleTex.getContext();
  mtCtx.fillStyle = "#c4c0b8";
  mtCtx.fillRect(0, 0, 512, 512);
  const drawVein = (x1, y1, cx1, cy1, cx2, cy2, x2, y2, color, w) => {
    mtCtx.strokeStyle = color; mtCtx.lineWidth = w;
    mtCtx.lineCap = "round"; mtCtx.beginPath();
    mtCtx.moveTo(x1, y1); mtCtx.bezierCurveTo(cx1, cy1, cx2, cy2, x2, y2);
    mtCtx.stroke();
  };
  drawVein(  0,  80, 160, 120, 300,  90, 512, 150, "rgba(80,74,66,0.55)", 2.5);
  drawVein(  0, 220, 120, 260, 280, 210, 512, 280, "rgba(80,74,66,0.50)", 2.0);
  drawVein( 80,   0, 180, 140, 250, 280, 380, 512, "rgba(80,74,66,0.60)", 3.0);
  drawVein(320,   0, 370, 120, 360, 280, 420, 512, "rgba(80,74,66,0.45)", 1.8);
  drawVein(  0, 340, 180, 380, 320, 350, 512, 400, "rgba(140,128,114,0.40)", 1.5);
  drawVein(150,   0, 200, 180, 170, 330, 260, 512, "rgba(140,128,114,0.35)", 1.2);
  drawVein(  0, 460, 160, 430, 340, 470, 512, 460, "rgba(160,148,134,0.30)", 1.0);
  drawVein(420,   0, 440, 200, 390, 350, 460, 512, "rgba(120,110,98,0.25)",  0.8);
  drawVein(  0, 140, 100, 170, 200, 155, 512, 195, "rgba(165,158,148,0.22)", 0.8);
  marbleTex.update();

  const marbleMat = new StandardMaterial("marbleCounterMat", scene);
  marbleMat.diffuseTexture = marbleTex;
  marbleMat.specularColor = new Color3(0.38, 0.34, 0.30);
  marbleMat.specularPower = 72;

  const marbleSlab = MeshBuilder.CreateBox(
    "counterMarbleSlab",
    { width: 0.76, depth: 2.64, height: 0.04 },
    scene,
  );
  marbleSlab.position = new Vector3(5.50, 0.94, 0);  // bottom=0.92, top=0.96 — same surface as before
  marbleSlab.material = marbleMat;

  // ── Ceramic sink basin ────────────────────────────────────────────────────
  const ceramicMat = new StandardMaterial("ceramicMat", scene);
  ceramicMat.diffuseColor = new Color3(0.18, 0.18, 0.18);
  ceramicMat.emissiveColor = new Color3(0.08, 0.08, 0.08);
  ceramicMat.specularColor = new Color3(0.5, 0.5, 0.5);
  ceramicMat.specularPower = 80;

  const chromeMat = new StandardMaterial("chromeMat", scene);
  chromeMat.diffuseColor = new Color3(0.58, 0.58, 0.62);
  chromeMat.specularColor = new Color3(0.70, 0.70, 0.70);
  chromeMat.specularPower = 120;

  const basinDrainMat = new StandardMaterial("basinDrainMat", scene);
  basinDrainMat.diffuseColor = new Color3(0.2, 0.2, 0.2);

  // Sink anchor — centered on the counter surface, scooted toward the east wall
  const SX = 5.44, SY = 0.96, SZ = 0.0;

  // Outer rim / ledge
  const sinkRim = MeshBuilder.CreateBox("sinkRim",
    { width: 0.52, depth: 0.62, height: 0.03 }, scene);
  sinkRim.position = new Vector3(SX, SY + 0.015, SZ);
  sinkRim.material = ceramicMat;

  // Basin walls (5-piece hollow box: bottom + 4 sides)
  const basinParts = [];
  // bottom
  const basinBot = MeshBuilder.CreateBox("basinBot",
    { width: 0.36, depth: 0.46, height: 0.018 }, scene);
  basinBot.position = new Vector3(SX, SY + 0.028, SZ);
  basinBot.material = ceramicMat;
  basinParts.push(basinBot);
  // left wall
  const basinL = MeshBuilder.CreateBox("basinL",
    { width: 0.028, depth: 0.46, height: 0.13 }, scene);
  basinL.position = new Vector3(SX - 0.166, SY + 0.093, SZ);
  basinL.material = ceramicMat;
  basinParts.push(basinL);
  // right wall
  const basinR = MeshBuilder.CreateBox("basinR",
    { width: 0.028, depth: 0.46, height: 0.13 }, scene);
  basinR.position = new Vector3(SX + 0.166, SY + 0.093, SZ);
  basinR.material = ceramicMat;
  basinParts.push(basinR);
  // back wall
  const basinBk = MeshBuilder.CreateBox("basinBk",
    { width: 0.36, depth: 0.028, height: 0.13 }, scene);
  basinBk.position = new Vector3(SX, SY + 0.093, SZ - 0.216);
  basinBk.material = ceramicMat;
  basinParts.push(basinBk);
  // front wall
  const basinFt = MeshBuilder.CreateBox("basinFt",
    { width: 0.36, depth: 0.028, height: 0.13 }, scene);
  basinFt.position = new Vector3(SX, SY + 0.093, SZ + 0.216);
  basinFt.material = ceramicMat;
  basinParts.push(basinFt);

  // Basin floor top surface: SY + 0.028 + 0.009 = SY + 0.037
  const DRAIN_Y = SY + 0.037;
  // Chrome outer ring
  const drainRing = MeshBuilder.CreateCylinder("sinkDrainRing",
    { diameter: 0.078, height: 0.007, tessellation: 24 }, scene);
  drainRing.position = new Vector3(SX, DRAIN_Y + 0.0035, SZ);
  drainRing.material = chromeMat;
  // Dark recessed hole
  const drainHole = MeshBuilder.CreateCylinder("sinkDrainHole",
    { diameter: 0.054, height: 0.006, tessellation: 20 }, scene);
  drainHole.position = new Vector3(SX, DRAIN_Y + 0.001, SZ);
  drainHole.material = basinDrainMat;
  // Grate — two chrome bars crossing over the hole
  [0, Math.PI / 2].forEach((rot, i) => {
    const bar = MeshBuilder.CreateBox(`sinkDrainBar${i}`,
      { width: 0.056, depth: 0.008, height: 0.007 }, scene);
    bar.position = new Vector3(SX, DRAIN_Y + 0.007, SZ);
    bar.rotation.y = rot;
    bar.material = chromeMat;
  });

  // ── Animated water pool ────────────────────────────────────────────────────
  const waterPoolTex = new DynamicTexture("waterPoolTex", { width: 128, height: 128 }, scene, false);
  const waterPoolMat = new StandardMaterial("waterPoolMat", scene);
  waterPoolMat.diffuseTexture = waterPoolTex;
  waterPoolMat.emissiveColor = new Color3(0.10, 0.28, 0.52);
  waterPoolMat.alpha = 0.82;
  waterPoolMat.backFaceCulling = false;

  const waterPool = MeshBuilder.CreatePlane("waterPool", { width: 0.30, height: 0.40 }, scene);
  waterPool.position = new Vector3(SX, SY + 0.145, SZ);
  waterPool.rotation.x = Math.PI / 2;
  waterPool.material = waterPoolMat;
  waterPool.isPickable = false;  // clicks must pass through to drain stopper below

  // Ripple state
  const ripples = [];
  let rippleFrame = 0;
  scene.registerBeforeRender(() => {
    rippleFrame++;
    // Spawn a new ripple every ~40 frames (where faucet drip would land)
    if (rippleFrame % 40 === 0) {
      ripples.push({
        x: 0.38 + (Math.random() - 0.5) * 0.18,
        y: 0.45 + (Math.random() - 0.5) * 0.12,
        r: 0.01,
      });
    }
    const ctx = waterPoolTex.getContext();
    // Water base
    ctx.fillStyle = "rgba(25, 75, 145, 0.95)";
    ctx.fillRect(0, 0, 128, 128);
    // Subtle surface shimmer lines
    ctx.strokeStyle = "rgba(80, 150, 230, 0.18)";
    ctx.lineWidth = 1;
    for (let i = 0; i < 5; i++) {
      const y = ((rippleFrame * 0.4 + i * 25) % 128);
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(128, y + 6); ctx.stroke();
    }
    // Draw and advance ripples
    for (let i = ripples.length - 1; i >= 0; i--) {
      const rp = ripples[i];
      rp.r += 0.022;
      const alpha = Math.max(0, 1 - rp.r / 0.55);
      if (alpha <= 0) { ripples.splice(i, 1); continue; }
      const cx = rp.x * 128, cy = rp.y * 128, rad = rp.r * 128;
      ctx.beginPath();
      ctx.arc(cx, cy, rad, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(160, 215, 255, ${alpha * 0.85})`;
      ctx.lineWidth = 1.2;
      ctx.stroke();
      // Inner secondary ring
      if (rad > 6) {
        ctx.beginPath();
        ctx.arc(cx, cy, rad * 0.55, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(200, 235, 255, ${alpha * 0.4})`;
        ctx.lineWidth = 0.8;
        ctx.stroke();
      }
    }
    waterPoolTex.update();
  });
  const faucetStem = MeshBuilder.CreateCylinder("faucetStem",
    { diameter: 0.038, height: 0.22, tessellation: 14 }, scene);
  faucetStem.position = new Vector3(SX + 0.14, SY + 0.25, SZ);
  faucetStem.material = chromeMat;

  const faucetNeck = MeshBuilder.CreateTorus("faucetNeck",
    { diameter: 0.18, thickness: 0.028, tessellation: 20 }, scene);
  faucetNeck.position = new Vector3(SX + 0.06, SY + 0.37, SZ);
  faucetNeck.rotation.x = Math.PI / 2;
  faucetNeck.material = chromeMat;

  const faucetSpout = MeshBuilder.CreateCylinder("faucetSpout",
    { diameter: 0.028, height: 0.1, tessellation: 12 }, scene);
  faucetSpout.position = new Vector3(SX - 0.03, SY + 0.34, SZ);
  faucetSpout.rotation.z = Math.PI / 2;
  faucetSpout.material = chromeMat;

  // Handles — flanking the stem along Z (parallel to wall)
  [-0.14, 0.14].forEach((dz, i) => {
    const handle = MeshBuilder.CreateCylinder(`faucetHandle${i}`,
      { diameter: 0.018, height: 0.09, tessellation: 10 }, scene);
    handle.position = new Vector3(SX + 0.14, SY + 0.22, SZ + dz);
    handle.rotation.x = Math.PI / 2;
    handle.material = chromeMat;
  });

  // ── Water particle stream from faucet ─────────────────────────────────────
  // Soft circle gradient texture for droplets
  const waterParticleTex = new DynamicTexture("waterParticleTex", { width: 32, height: 32 }, scene, false);
  const wpCtx = waterParticleTex.getContext();
  const wpGrad = wpCtx.createRadialGradient(16, 16, 0, 16, 16, 16);
  wpGrad.addColorStop(0, "rgba(255,255,255,1)");
  wpGrad.addColorStop(0.45, "rgba(180,220,255,0.85)");
  wpGrad.addColorStop(1, "rgba(80,160,255,0)");
  wpCtx.fillStyle = wpGrad;
  wpCtx.beginPath(); wpCtx.arc(16, 16, 16, 0, Math.PI * 2); wpCtx.fill();
  waterParticleTex.update();

  const waterSystem = new ParticleSystem("waterFlow", 180, scene);
  waterSystem.particleTexture = waterParticleTex;
  // Emit from just below the faucet spout tip
  waterSystem.emitter = new Vector3(SX - 0.08, SY + 0.33, SZ);
  waterSystem.minEmitBox = new Vector3(-0.005, 0, -0.005);
  waterSystem.maxEmitBox = new Vector3(0.005, 0, 0.005);
  // Blue water gradient
  waterSystem.color1    = new Color4(0.55, 0.80, 1.00, 0.90);
  waterSystem.color2    = new Color4(0.30, 0.60, 0.95, 0.75);
  waterSystem.colorDead = new Color4(0.70, 0.88, 1.00, 0.00);
  // Small droplets
  waterSystem.minSize = 0.010;
  waterSystem.maxSize = 0.020;
  // Short lifetime — particles fall ~34 cm to the basin
  waterSystem.minLifeTime = 0.28;
  waterSystem.maxLifeTime = 0.42;
  waterSystem.emitRate = 110;
  // Emit straight down with tiny lateral spread
  waterSystem.direction1 = new Vector3(-0.008, -1.0, -0.008);
  waterSystem.direction2 = new Vector3(0.008, -1.0, 0.008);
  waterSystem.minEmitPower = 0.55;
  waterSystem.maxEmitPower = 0.80;
  waterSystem.gravity = new Vector3(0, -4.5, 0);
  waterSystem.updateSpeed = 0.016;
  waterSystem.blendMode = ParticleSystem.BLENDMODE_ADD;
  waterSystem.start();
  const coffeeTableMat = new StandardMaterial("coffeeTableMat", scene);
  coffeeTableMat.diffuseColor = new Color3(0.32, 0.2, 0.1);
  coffeeTableMat.specularColor = new Color3(0.35, 0.35, 0.35);
  coffeeTableMat.specularPower = 48;

  const coffeeTableTop = MeshBuilder.CreateBox(
    "coffeeTableTop",
    { width: 1.15, height: 0.055, depth: 0.62 },
    scene,
  );
  coffeeTableTop.position = new Vector3(-3.8, 0.42, 2.5);
  coffeeTableTop.rotation.y = Math.PI / 2;
  coffeeTableTop.material = coffeeTableMat;

  const ctLegPositions = [
    [-0.25, 0.21, -0.49],
    [ 0.25, 0.21, -0.49],
    [-0.25, 0.21,  0.49],
    [ 0.25, 0.21,  0.49],
  ];
  const coffeeTableLegs = ctLegPositions.map((offset, i) => {
    const leg = MeshBuilder.CreateBox(
      `coffeeTableLeg${i}`,
      { width: 0.07, height: 0.42, depth: 0.07 },
      scene,
    );
    leg.position = new Vector3(-3.8 + offset[0], offset[1], 2.5 + offset[2]);
    leg.material = coffeeTableMat;
    return leg;
  });

  setCollisionFlags([coffeeTableTop, ...coffeeTableLegs], true);

  const wallLampBackplate = MeshBuilder.CreateBox(
    "wallLampBackplate",
    { width: 0.26, height: 0.34, depth: 0.04 },
    scene,
  );
  wallLampBackplate.position = new Vector3(-1.1, 2.55, ROOM.depth / 2 - 0.06);
  wallLampBackplate.material = lampMetalMaterial;

  const wallLampArm = MeshBuilder.CreateBox(
    "wallLampArm",
    { width: 0.08, height: 0.08, depth: 0.32 },
    scene,
  );
  wallLampArm.position = new Vector3(-1.1, 2.55, ROOM.depth / 2 - 0.24);
  wallLampArm.material = lampMetalMaterial;

  const wallLampShade = MeshBuilder.CreateCylinder(
    "wallLampShade",
    { height: 0.3, diameterTop: 0.16, diameterBottom: 0.38, tessellation: 28 },
    scene,
  );
  wallLampShade.position = new Vector3(-1.1, 2.45, ROOM.depth / 2 - 0.4);
  wallLampShade.material = lampShadeMaterial;

  const wallLampBulb = MeshBuilder.CreateSphere(
    "wallLampBulb",
    { diameter: 0.12, segments: 16 },
    scene,
  );
  wallLampBulb.position = new Vector3(-1.1, 2.42, ROOM.depth / 2 - 0.39);
  wallLampBulb.material = lampBulbMaterial;

  const wallLampLight = new PointLight("wallLampLight", wallLampBulb.position.clone(), scene);
  wallLampLight.diffuse = new Color3(1, 0.9, 0.72);
  wallLampLight.intensity = 0.7;
  wallLampLight.range = 7;

  setCollisionFlags(
    [counter, marbleSlab, sinkRim, ...basinParts, drainRing, drainHole, faucetStem, faucetNeck, faucetSpout],
    true,
  );
  setCollisionFlags(
    [wallLampBackplate, wallLampArm, wallLampShade, wallLampBulb],
    false,
  );

  // ── Drain stopper (rubber plug sitting on drain grate) ────────────────────
  const stopperMat = new StandardMaterial("drainStopperMat", scene);
  stopperMat.diffuseColor = new Color3(0.12, 0.10, 0.10);
  stopperMat.emissiveColor = new Color3(0.06, 0.05, 0.05);
  const drainStopper = MeshBuilder.CreateCylinder("drainStopper",
    { diameter: 0.058, height: 0.022, tessellation: 18 }, scene);
  drainStopper.position = new Vector3(SX, DRAIN_Y + 0.018, SZ);
  drainStopper.material = stopperMat;
  drainStopper.isPickable = true;
  drainStopper.metadata = { type: "drainStopper" };

  // ── Sink clue paper (lying flat in basin) ─────────────────────────────────
  const paperTex = new DynamicTexture("sinkPaperTex", { width: 256, height: 160 }, scene, false);
  const pCtx = paperTex.getContext();
  pCtx.fillStyle = "#fffde8";
  pCtx.fillRect(0, 0, 256, 160);
  pCtx.strokeStyle = "#c8c8a0";
  pCtx.lineWidth = 3;
  pCtx.strokeRect(4, 4, 248, 152);
  // Ruled lines
  pCtx.strokeStyle = "#d0d8e0";
  pCtx.lineWidth = 1;
  [40, 60, 80, 100, 120, 140].forEach(y => {
    pCtx.beginPath(); pCtx.moveTo(12, y); pCtx.lineTo(244, y); pCtx.stroke();
  });
  pCtx.fillStyle = "#1a3a7a";
  pCtx.font = "bold 18px serif";
  pCtx.fillText("Lucky number:", 20, 35);
  pCtx.font = "bold 52px serif";
  pCtx.fillStyle = "#0d2a5e";
  const clueNum = CLUE_DEFINITIONS.find(c => c.id === "sinkPaper").number;
  pCtx.fillText(String(clueNum), 100, 115);
  paperTex.update();

  // Number face (faces down when card is face-down → hidden from above)
  const paperFrontMat = new StandardMaterial("sinkPaperFrontMat", scene);
  paperFrontMat.diffuseTexture = paperTex;
  paperFrontMat.emissiveColor = new Color3(0.12, 0.12, 0.10);
  paperFrontMat.backFaceCulling = true;

  // Cream back face (faces up when card is face-down → visible from above)
  const paperBackMat = new StandardMaterial("sinkPaperBackMat", scene);
  paperBackMat.diffuseColor = new Color3(0.94, 0.92, 0.84);
  paperBackMat.emissiveColor = new Color3(0.14, 0.13, 0.10);
  paperBackMat.backFaceCulling = true;

  // Root node controls the flip; start face-down
  const sinkPaperMesh = new TransformNode("sinkPaperRoot", scene);
  sinkPaperMesh.position = new Vector3(SX - 0.04, DRAIN_Y + 0.052, SZ + 0.05);
  sinkPaperMesh.rotation.x = -Math.PI / 2;

  // Front plane (number) — local rotation=0 → normal faces DOWN in world when root face-down
  const paperFront = MeshBuilder.CreatePlane("sinkPaperFront", { width: 0.14, height: 0.09 }, scene);
  paperFront.parent = sinkPaperMesh;
  paperFront.material = paperFrontMat;
  paperFront.isPickable = false;

  // Back plane (cream) — local rotation.y=PI → normal faces UP in world when root face-down
  const paperBack = MeshBuilder.CreatePlane("sinkPaperBack", { width: 0.14, height: 0.09 }, scene);
  paperBack.parent = sinkPaperMesh;
  paperBack.rotation.y = Math.PI;
  paperBack.material = paperBackMat;
  paperBack.isPickable = true;
  paperBack.metadata = { clueId: "sinkPaper" };

  // pliersMeshes populated after GLTF load in createScene
  const pliersMeshes = [];

  return { waterPool, waterSystem, drainStopper, sinkPaperMesh, pliersMeshes };
}

function drawPostcard(ctx, w, h, number) {
  // Cream card stock background
  ctx.fillStyle = "#fffef0";
  ctx.fillRect(0, 0, w, h);

  // ── Left half: tropical scene illustration ──────────────────────────────
  const lw = w * 0.48;
  // Sky
  const skyGrad = ctx.createLinearGradient(0, 0, 0, h * 0.6);
  skyGrad.addColorStop(0, "#5ba8e5");
  skyGrad.addColorStop(1, "#a0d0f0");
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, lw, h * 0.62);
  // Sea
  ctx.fillStyle = "#2a80c0";
  ctx.fillRect(0, h * 0.58, lw, h * 0.1);
  // Sand
  ctx.fillStyle = "#e8c97a";
  ctx.fillRect(0, h * 0.65, lw, h * 0.35);
  // Sun
  ctx.fillStyle = "#ffe060";
  ctx.beginPath();
  ctx.arc(lw * 0.72, h * 0.16, h * 0.1, 0, Math.PI * 2);
  ctx.fill();
  // Palm trunk
  ctx.strokeStyle = "#7a4b18";
  ctx.lineWidth = Math.round(w * 0.018);
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(lw * 0.28, h * 0.65);
  ctx.bezierCurveTo(lw * 0.22, h * 0.5, lw * 0.3, h * 0.35, lw * 0.25, h * 0.22);
  ctx.stroke();
  // Palm fronds
  ctx.strokeStyle = "#2e7a1e";
  ctx.lineWidth = Math.round(w * 0.013);
  const fronds = [[-0.18, -0.15], [0.18, -0.08], [0, -0.22], [-0.08, -0.25], [0.1, -0.24]];
  fronds.forEach(([dx, dy]) => {
    ctx.beginPath();
    ctx.moveTo(lw * 0.25, h * 0.22);
    ctx.lineTo(lw * 0.25 + lw * dx, h * 0.22 + h * dy);
    ctx.stroke();
  });
  // "WISH YOU WERE HERE" caption
  ctx.shadowColor = "rgba(0,0,0,0.4)";
  ctx.shadowBlur = 3;
  ctx.fillStyle = "#fff";
  ctx.font = `bold italic ${Math.round(h * 0.1)}px serif`;
  ctx.textAlign = "center";
  ctx.fillText("WISH YOU", lw * 0.5, h * 0.82);
  ctx.fillText("WERE HERE", lw * 0.5, h * 0.93);
  ctx.shadowBlur = 0;

  // ── Dividing line ────────────────────────────────────────────────────────
  ctx.strokeStyle = "#ccc";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(lw + 2, h * 0.05);
  ctx.lineTo(lw + 2, h * 0.95);
  ctx.stroke();

  // ── Right half: address side ─────────────────────────────────────────────
  const rx = lw + w * 0.04;

  // Stamp (top-right)
  ctx.fillStyle = "#e8901a";
  ctx.fillRect(w * 0.85, h * 0.04, w * 0.11, h * 0.17);
  ctx.strokeStyle = "#b07010";
  ctx.lineWidth = 2;
  ctx.strokeRect(w * 0.85, h * 0.04, w * 0.11, h * 0.17);
  ctx.fillStyle = "#d0600a";
  ctx.font = `bold ${Math.round(h * 0.07)}px serif`;
  ctx.textAlign = "center";
  ctx.fillText("★", w * 0.905, h * 0.14);

  // Red postmark circle
  ctx.strokeStyle = "#b02020";
  ctx.lineWidth = Math.round(w * 0.012);
  ctx.beginPath();
  ctx.arc(w * 0.88, h * 0.13, h * 0.09, 0, Math.PI * 2);
  ctx.stroke();
  for (let i = -1; i <= 1; i++) {
    ctx.beginPath();
    ctx.moveTo(w * 0.88 - h * 0.09, h * 0.13 + i * h * 0.04);
    ctx.lineTo(w * 0.88 + h * 0.09, h * 0.13 + i * h * 0.04);
    ctx.stroke();
  }

  // ── Large circled number — the clue ──────────────────────────────────────
  ctx.strokeStyle = "#b02020";
  ctx.lineWidth = Math.round(w * 0.016);
  const cx2 = rx + (w - rx) * 0.38, cy2 = h * 0.42;
  ctx.beginPath();
  ctx.arc(cx2, cy2, h * 0.19, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = "#b02020";
  ctx.font = `bold ${Math.round(h * 0.3)}px serif`;
  ctx.textAlign = "center";
  ctx.fillText(String(number), cx2, cy2 + h * 0.1);
  ctx.fillStyle = "#777";
  ctx.font = `${Math.round(h * 0.075)}px serif`;
  ctx.fillText("CABIN No.", cx2, cy2 - h * 0.22);

  // Address lines
  ctx.fillStyle = "#bbb";
  [0.66, 0.76, 0.86].forEach((yf) => {
    ctx.fillRect(rx, h * yf, w * 0.44, h * 0.018);
  });

  // Outer border
  ctx.strokeStyle = "#c8a060";
  ctx.lineWidth = 3;
  ctx.strokeRect(4, 4, w - 8, h - 8);
}

function createKingKongSwingPoster(scene) {
  const northZ = ROOM.depth / 2 - ROOM.wallThickness / 2;
  const pw = 1.0, ph = 1.55;
  // Hinge at the left edge of where the King Kong poster sits
  const hinge = new TransformNode("kkHinge", scene);
  hinge.position = new Vector3(2.6 - pw / 2, 2.15, northZ - 0.03);

  const frameMat = new StandardMaterial("kkFrameMat", scene);
  frameMat.diffuseColor = new Color3(0.08, 0.06, 0.04);
  frameMat.specularColor = new Color3(0.12, 0.12, 0.12);

  // Frame box
  const frame = MeshBuilder.CreateBox("kkFrame",
    { width: pw + 0.08, height: ph + 0.08, depth: 0.04 }, scene);
  frame.parent = hinge;
  frame.position = new Vector3(pw / 2, 0, 0);
  frame.material = frameMat;
  frame.isPickable = true;
  frame.metadata = { posterId: "kingkong" };

  // Front image plane (King Kong poster facing room)
  const frontMat = new StandardMaterial("kkFrontMat", scene);
  frontMat.diffuseTexture = new Texture(
    "https://upload.wikimedia.org/wikipedia/commons/f/f3/Kingkongposter.jpg",
    scene, true, true);
  frontMat.backFaceCulling = false;
  const front = MeshBuilder.CreatePlane("kkFront", { width: pw, height: ph }, scene);
  front.parent = hinge;
  front.position = new Vector3(pw / 2, 0, -0.03);
  front.material = frontMat;
  front.isPickable = true;
  front.metadata = { posterId: "kingkong" };

  // Postcard on the back — the hidden clue
  const clueNumber = CLUE_DEFINITIONS.find(c => c.id === "metalTag").number;
  const pcTex = new DynamicTexture("postcardTex", { width: 480, height: 320 }, scene, false);
  drawPostcard(pcTex.getContext(), 480, 320, clueNumber);
  pcTex.update();

  const pcMat = new StandardMaterial("postcardMat", scene);
  pcMat.diffuseTexture = pcTex;
  pcMat.emissiveColor = new Color3(0.06, 0.06, 0.06);
  pcMat.backFaceCulling = false;

  const postcard = MeshBuilder.CreatePlane("postcardPlane",
    { width: 0.62, height: 0.41 }, scene);
  postcard.parent = hinge;
  postcard.position = new Vector3(pw / 2, 0.1, 0.03);
  // face +Z (into wall) when closed; visible from back when poster swings open
  postcard.rotation.y = Math.PI;
  postcard.material = pcMat;
  postcard.isPickable = true;
  postcard.metadata = { clueId: "metalTag" };

  // Small tack/pin props at the postcard corners
  const tackMat = new StandardMaterial("tackMat", scene);
  tackMat.diffuseColor = new Color3(0.8, 0.15, 0.1);
  [[-0.27, 0.31], [0.27, 0.31], [-0.27, -0.11], [0.27, -0.11]].forEach(([tx, ty], i) => {
    const tack = MeshBuilder.CreateSphere(`tack${i}`, { diameter: 0.028, segments: 8 }, scene);
    tack.parent = hinge;
    tack.position = new Vector3(pw / 2 + tx, ty, 0.045);
    tack.material = tackMat;
    tack.isPickable = false;
  });

  const posterState = { isOpen: false, animating: false };
  return { posterState, hinge };
}

function createClueObjects(scene) {
  const markInteractive = (mesh, clueId) => {
    mesh.metadata = { clueId };
    mesh.isPickable = true;
    mesh.checkCollisions = false;
  };

  const clueMap = new Map();

  for (const clue of CLUE_DEFINITIONS) {
    const anchor = new TransformNode(`clue-${clue.id}-anchor`, scene);
    anchor.position.copyFrom(clue.position);

    if (clue.id === "clock") {
      // Mesh loaded from GLTF in createScene and parented to this anchor
    } else if (clue.id === "receipt") {
      // Winner's ticket is revealed by winning the arcade Snake game (revealArcadeClue)
    } else if (clue.id === "metalTag") {
      // Visual (postcard) is created by createKingKongSwingPoster — only anchor needed here.
    } else if (clue.id === "sinkPaper") {
      // Mesh is created inside createProceduralFurniture; anchor is added to clueMeshes from there.
    }

    clueMap.set(clue.id, anchor);
  }

  return clueMap;
}

function extractBounds(meshes) {
  const min = new Vector3(Infinity, Infinity, Infinity);
  const max = new Vector3(-Infinity, -Infinity, -Infinity);
  let hasBoundedMesh = false;

  for (const mesh of meshes) {
    if (typeof mesh.getTotalVertices !== "function") {
      continue;
    }
    if (mesh.getTotalVertices() === 0) {
      continue;
    }
    mesh.computeWorldMatrix(true);
    const bounds = mesh.getBoundingInfo().boundingBox;
    min.minimizeInPlace(bounds.minimumWorld);
    max.maximizeInPlace(bounds.maximumWorld);
    hasBoundedMesh = true;
  }

  if (!hasBoundedMesh) {
    return { min: new Vector3(0, 0, 0), max: new Vector3(1, 1, 1) };
  }
  return { min, max };
}

async function loadFurnitureModel(scene, definition) {
  const modelUrl = definition.url || `${MODEL_BASE}/${definition.name}/glTF-Binary/${definition.name}.glb`;
  const imported = await SceneLoader.ImportMeshAsync("", "", modelUrl, scene);

  const root = new TransformNode(`${definition.name}-root`, scene);
  const topLevel = imported.meshes.filter((mesh) => mesh.parent === null);
  for (const mesh of topLevel) {
    mesh.parent = root;
  }

  const childMeshes = root.getChildMeshes(false);
  const bounds = extractBounds(childMeshes);
  const modelHeight = Math.max(bounds.max.y - bounds.min.y, 0.001);
  const scaleFactor = definition.targetHeight / modelHeight;

  root.scaling.setAll(scaleFactor);
  root.position = new Vector3(
    definition.position.x,
    definition.position.y - bounds.min.y * scaleFactor,
    definition.position.z,
  );
  root.rotation.y = definition.rotationY;

  for (const mesh of childMeshes) {
    mesh.isPickable = false;
    mesh.checkCollisions = true;
  }
}

function createFallbackModel(scene, definition) {
  const placeholder = MeshBuilder.CreateBox(
    `${definition.name}-fallback`,
    {
      width: definition.targetHeight * 0.65,
      depth: definition.targetHeight * 0.65,
      height: definition.targetHeight,
    },
    scene,
  );
  placeholder.position = new Vector3(
    definition.position.x,
    definition.targetHeight / 2,
    definition.position.z,
  );
  placeholder.rotation.y = definition.rotationY;
  const material = new StandardMaterial(`${definition.name}-fallback-material`, scene);
  material.diffuseColor = new Color3(0.45, 0.36, 0.28);
  placeholder.material = material;
  placeholder.isPickable = false;
  placeholder.checkCollisions = true;
}

function registerDoorUI(scene, camera, doorNode) {
  const targetSignature = sortedSignature(gameState.combination);

  const closeDoorPanel = () => {
    closeOverlay(ui.doorPanel);
    ui.doorFeedback.textContent = "";
    ui.doorForm.reset();
    camera.attachControl(canvas, true);
  };

  const openDoorPanel = () => {
    openOverlay(ui.doorPanel);
    ui.doorFeedback.textContent = "";
    ui.doorForm.reset();
    camera.detachControl();
    ui.codeInputs[0].focus();
  };

  const unlockDoor = () => {
    if (gameState.doorUnlocked) {
      return;
    }
    gameState.doorUnlocked = true;
    closeDoorPanel();
    setTransientPrompt("Door unlocked. Walk through the doorway to escape.", 4000);
    doorNode.getChildMeshes(false).forEach((mesh) => {
      mesh.checkCollisions = false;
    });

    const animation = new Animation(
      "doorOpenAnimation",
      "rotation.y",
      60,
      Animation.ANIMATIONTYPE_FLOAT,
      Animation.ANIMATIONLOOPMODE_CONSTANT,
    );
    animation.setKeys([
      { frame: 0, value: doorNode.rotation.y },
      { frame: 45, value: -Math.PI / 2 },
    ]);

    scene.beginDirectAnimation(doorNode, [animation], 0, 45, false, 1.0);
  };

  ui.doorForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const values = ui.codeInputs.map((input) => Number(input.value));
    if (values.some((value) => Number.isNaN(value))) {
      ui.doorFeedback.textContent = "Please enter all four numbers.";
      return;
    }

    if (sortedSignature(values) === targetSignature) {
      ui.doorFeedback.textContent = "Correct combination.";
      unlockDoor();
      return;
    }

    ui.doorFeedback.textContent = "Incorrect combination. Keep exploring.";
  });

  ui.doorCancelBtn.addEventListener("click", () => {
    closeDoorPanel();
  });

  window.addEventListener("keydown", (event) => {
    const key = event.key.toLowerCase();
    if (key === "escape" && !ui.doorPanel.classList.contains("hidden")) {
      closeDoorPanel();
      return;
    }

    if (
      key === "i" &&
      gameState.doorInRange &&
      !gameState.overlayOpen &&
      !gameState.doorUnlocked
    ) {
      openDoorPanel();
    }
  });
}

function registerClueUI(scene, camera, clueMeshes, posterState) {
  let activeClueId = null;

  const closeCluePanel = () => {
    closeOverlay(ui.cluePanel);
    activeClueId = null;
    camera.attachControl(canvas, true);
  };

  const showClue = (clueId) => {
    const clue = CLUE_DEFINITIONS.find((entry) => entry.id === clueId);
    if (!clue) {
      return;
    }

    gameState.discoveredNumbers.set(clue.id, clue.number);
    updateClueLedger();
    activeClueId = clue.id;
    ui.clueText.textContent = `${clue.message} (Number: ${clue.number})`;
    openOverlay(ui.cluePanel);
    camera.detachControl();
  };

  ui.clueCloseBtn.addEventListener("click", closeCluePanel);

  window.addEventListener("keydown", (event) => {
    if (event.key.toLowerCase() === "escape" && activeClueId) {
      closeCluePanel();
    }
  });

  // Pointer lock suppresses absolute mouse coords, so pick from screen center on click.
  window.addEventListener("click", () => {
    if (gameState.overlayOpen || gameState.escaped) return;
    if (document.pointerLockElement !== canvas) return;

    const cx = engine.getRenderWidth() / 2;
    const cy = engine.getRenderHeight() / 2;
    const pickResult = scene.pick(cx, cy);
    const pickedMesh = pickResult?.pickedMesh;
    const clueId = pickedMesh?.metadata?.clueId;
    if (!clueId) return;

    // Postcard hidden behind King Kong — poster must be open first
    if (clueId === "metalTag" && posterState && !posterState.isOpen) {
      setTransientPrompt("There's something pinned behind the King Kong poster...", 2200);
      return;
    }

    // Sink paper — water must be drained first
    if (clueId === "sinkPaper" && !gameState.sinkDrained) {
      setTransientPrompt("The water is too hot to pick up the clue.", 2200);
      return;
    }

    // Sink paper — flip animation before revealing the clue
    if (clueId === "sinkPaper" && gameState.sinkDrained && !gameState.discoveredNumbers.has("sinkPaper")) {
      const anchor = clueMeshes.get("sinkPaper");
      if (!anchor) return;
      if (Vector3.Distance(camera.position, anchor.position) > 3.15) {
        setTransientPrompt("Move closer to inspect that clue.", 1600);
        return;
      }
      const flipAnim = new Animation(
        "sinkPaperFlip", "rotation.x", 60,
        Animation.ANIMATIONTYPE_FLOAT, Animation.ANIMATIONLOOPMODE_CONSTANT,
      );
      flipAnim.setKeys([
        { frame: 0,  value: -Math.PI / 2 },
        { frame: 20, value: 0 },           // edge-on (halfway)
        { frame: 40, value: Math.PI / 2 }, // face-up
      ]);
      const flipTarget = pickedMesh.parent || pickedMesh;
      scene.beginDirectAnimation(flipTarget, [flipAnim], 0, 40, false, 1.0, () => {
        showClue("sinkPaper");
      });
      return;
    }

    const anchor = clueMeshes.get(clueId);
    if (!anchor) return;

    const distance = Vector3.Distance(camera.position, anchor.position);
    if (distance > 3.15) {
      setTransientPrompt("Move closer to inspect that clue.", 1600);
      return;
    }
    showClue(clueId);
  });
}

// ── Arcade machine ────────────────────────────────────────────────────────
function createArcadeMachine(scene) {
  const CX = -5.5, CZ = -1.8;
  const FRONT_X = -5.18;

  const cabinetMat = new StandardMaterial("arcadeCabinetMat", scene);
  cabinetMat.diffuseColor = new Color3(0.08, 0.08, 0.10);
  cabinetMat.specularColor = new Color3(0.14, 0.14, 0.14);

  const cabinet = MeshBuilder.CreateBox("arcadeCabinet",
    { width: 0.65, height: 1.8, depth: 0.68 }, scene);
  cabinet.position = new Vector3(CX, 0.9, CZ);
  cabinet.material = cabinetMat;
  cabinet.checkCollisions = true;
  cabinet.isPickable = false;

  const topCap = MeshBuilder.CreateBox("arcadeTopCap",
    { width: 0.68, height: 0.1, depth: 0.72 }, scene);
  topCap.position = new Vector3(CX, 1.85, CZ);
  topCap.material = cabinetMat;
  topCap.isPickable = false;

  const trimMat = new StandardMaterial("arcadeTrimMat", scene);
  trimMat.diffuseColor = new Color3(0.68, 0.08, 0.05);
  trimMat.emissiveColor = new Color3(0.08, 0.0, 0.0);
  [-0.34, 0.34].forEach((zOff, i) => {
    const strip = MeshBuilder.CreateBox(`arcadeTrim${i}`,
      { width: 0.03, height: 1.8, depth: 0.04 }, scene);
    strip.position = new Vector3(CX + 0.28, 0.9, CZ + zOff);
    strip.material = trimMat;
    strip.isPickable = false;
  });

  const bezelMat = new StandardMaterial("arcadeBezelMat", scene);
  bezelMat.diffuseColor = new Color3(0.04, 0.04, 0.04);
  const bezel = MeshBuilder.CreateBox("arcadeBezel",
    { width: 0.035, height: 0.52, depth: 0.57 }, scene);
  bezel.position = new Vector3(FRONT_X - 0.01, 1.35, CZ);
  bezel.material = bezelMat;
  bezel.isPickable = false;

  // Marquee with DynamicTexture
  const marqueeTex = new DynamicTexture("arcadeMarqueeTex",
    { width: 512, height: 128 }, scene, false);
  const mCtx = marqueeTex.getContext();
  const grd = mCtx.createLinearGradient(0, 0, 512, 0);
  grd.addColorStop(0, "#1a0030"); grd.addColorStop(0.5, "#3a0070"); grd.addColorStop(1, "#1a0030");
  mCtx.fillStyle = grd; mCtx.fillRect(0, 0, 512, 128);
  mCtx.fillStyle = "#ffdd00"; mCtx.shadowColor = "#ffaa00"; mCtx.shadowBlur = 20;
  mCtx.font = "bold 62px monospace"; mCtx.textAlign = "center";
  mCtx.fillText("SNAKE 10", 256, 88);
  mCtx.strokeStyle = "#ffdd00"; mCtx.lineWidth = 3; mCtx.shadowBlur = 0;
  mCtx.strokeRect(4, 4, 504, 120);
  marqueeTex.update();

  const marqueeMat = new StandardMaterial("arcadeMarqueeMat", scene);
  marqueeMat.diffuseTexture = marqueeTex;
  marqueeMat.emissiveColor = new Color3(0.18, 0.14, 0.04);
  const marqueePlane = MeshBuilder.CreatePlane("arcadeMarqueePlane",
    { width: 0.54, height: 0.22 }, scene);
  marqueePlane.position = new Vector3(FRONT_X + 0.01, 1.72, CZ);
  marqueePlane.rotation.y = -Math.PI / 2;
  marqueePlane.material = marqueeMat;
  marqueePlane.isPickable = false;

  // Screen with DynamicTexture
  const screenTex = new DynamicTexture("arcadeScreenTex",
    { width: 256, height: 224 }, scene, false);
  const sCtx = screenTex.getContext();
  sCtx.fillStyle = "#001100"; sCtx.fillRect(0, 0, 256, 224);
  sCtx.fillStyle = "rgba(0,0,0,0.18)";
  for (let y = 0; y < 224; y += 4) sCtx.fillRect(0, y, 256, 2);
  sCtx.fillStyle = "#00dd44"; sCtx.shadowColor = "#00ff44"; sCtx.shadowBlur = 8;
  sCtx.font = "bold 22px monospace"; sCtx.textAlign = "center";
  sCtx.fillText("INSERT COIN", 128, 80);
  sCtx.font = "14px monospace"; sCtx.fillStyle = "#00aa33"; sCtx.shadowBlur = 4;
  sCtx.fillText("HIGH SCORE: 10", 128, 118);
  sCtx.fillText("PRESS [I] TO PLAY", 128, 148);
  sCtx.shadowBlur = 0;
  screenTex.update();

  const screenMat = new StandardMaterial("arcadeScreenMat", scene);
  screenMat.diffuseTexture = screenTex;
  screenMat.emissiveColor = new Color3(0.05, 0.12, 0.05);
  const screenPlane = MeshBuilder.CreatePlane("arcadeScreenPlane",
    { width: 0.46, height: 0.42 }, scene);
  screenPlane.position = new Vector3(FRONT_X + 0.02, 1.35, CZ);
  screenPlane.rotation.y = -Math.PI / 2;
  screenPlane.material = screenMat;
  screenPlane.isPickable = false;

  // Control panel
  const cpMat = new StandardMaterial("arcadeCpMat", scene);
  cpMat.diffuseColor = new Color3(0.10, 0.10, 0.12);
  const controlPanel = MeshBuilder.CreateBox("arcadeControlPanel",
    { width: 0.12, height: 0.32, depth: 0.65 }, scene);
  controlPanel.position = new Vector3(FRONT_X + 0.03, 0.88, CZ);
  controlPanel.material = cpMat;
  controlPanel.isPickable = false;

  // Joystick
  const jsMat = new StandardMaterial("jsBaseMat", scene);
  jsMat.diffuseColor = new Color3(0.18, 0.18, 0.20);
  jsMat.specularColor = new Color3(0.3, 0.3, 0.3);

  const jsBase = MeshBuilder.CreateCylinder("jsBase",
    { diameter: 0.1, height: 0.04, tessellation: 16 }, scene);
  jsBase.position = new Vector3(FRONT_X + 0.02, 0.96, CZ - 0.1);
  jsBase.material = jsMat; jsBase.isPickable = false;

  const jsStickMat = new StandardMaterial("jsStickMat", scene);
  jsStickMat.diffuseColor = new Color3(0.12, 0.12, 0.14);
  const jsStick = MeshBuilder.CreateCylinder("jsStick",
    { diameter: 0.025, height: 0.13, tessellation: 12 }, scene);
  jsStick.position = new Vector3(FRONT_X + 0.02, 1.035, CZ - 0.1);
  jsStick.material = jsStickMat; jsStick.isPickable = false;

  const jsBallMat = new StandardMaterial("jsBallMat", scene);
  jsBallMat.diffuseColor = new Color3(0.10, 0.10, 0.12);
  jsBallMat.specularColor = new Color3(0.65, 0.65, 0.65);
  const jsBall = MeshBuilder.CreateSphere("jsBall",
    { diameter: 0.055, segments: 12 }, scene);
  jsBall.position = new Vector3(FRONT_X + 0.02, 1.1, CZ - 0.1);
  jsBall.material = jsBallMat; jsBall.isPickable = false;

  // Buttons
  const btnDefs = [
    { color: new Color3(0.80, 0.08, 0.06), zOff: 0.08 },
    { color: new Color3(0.82, 0.68, 0.0),  zOff: 0.00 },
    { color: new Color3(0.08, 0.16, 0.78), zOff: -0.08 },
  ];
  btnDefs.forEach(({ color, zOff }, i) => {
    const bm = new StandardMaterial(`btnMat${i}`, scene);
    bm.diffuseColor = color;
    bm.emissiveColor = color.scale(0.12);
    bm.specularColor = new Color3(0.25, 0.25, 0.25);
    const btn = MeshBuilder.CreateCylinder(`arcadeBtn${i}`,
      { diameter: 0.048, height: 0.04, tessellation: 16 }, scene);
    btn.position = new Vector3(FRONT_X + 0.02, 0.97, CZ + zOff);
    btn.material = bm; btn.isPickable = false;
  });

  // Coin slot
  const slotMat = new StandardMaterial("coinSlotMat", scene);
  slotMat.diffuseColor = new Color3(0.03, 0.03, 0.04);
  slotMat.specularColor = new Color3(0.45, 0.45, 0.45);
  const coinSlot = MeshBuilder.CreateBox("coinSlot",
    { width: 0.025, height: 0.015, depth: 0.1 }, scene);
  coinSlot.position = new Vector3(FRONT_X + 0.01, 0.62, CZ);
  coinSlot.material = slotMat; coinSlot.isPickable = false;

  return {
    interactionPoint: new Vector3(FRONT_X, 1.2, CZ),
    joystickPos: new Vector3(FRONT_X + 0.02, 1.12, CZ - 0.1),
  };
}

function revealArcadeClue(scene, joystickPos) {
  const ticketMat = new StandardMaterial("arcadeTicketMat", scene);
  ticketMat.diffuseColor = new Color3(0.97, 0.97, 0.90);
  ticketMat.emissiveColor = new Color3(0.06, 0.10, 0.04);
  ticketMat.specularColor = new Color3(0.06, 0.06, 0.06);

  const ticket = MeshBuilder.CreateBox("arcadeTicket",
    { width: 0.055, height: 0.003, depth: 0.12 }, scene);
  ticket.position = joystickPos.clone();
  ticket.rotation.y = 0.35;
  ticket.material = ticketMat;
  ticket.isPickable = true;
  ticket.metadata = { clueId: "receipt" };

  const stripeMat = new StandardMaterial("ticketStripeMat", scene);
  stripeMat.diffuseColor = new Color3(0.1, 0.65, 0.15);
  stripeMat.emissiveColor = new Color3(0.02, 0.14, 0.03);

  const stripe = MeshBuilder.CreateBox("arcadeTicketStripe",
    { width: 0.055, height: 0.004, depth: 0.022 }, scene);
  stripe.position = new Vector3(joystickPos.x, joystickPos.y, joystickPos.z + 0.042);
  stripe.rotation.y = 0.35;
  stripe.material = stripeMat;
  stripe.isPickable = true;
  stripe.metadata = { clueId: "receipt" };
}

function startSnakeGame(camera, onWin) {
  const overlay = document.getElementById("snakeOverlay");
  const snkCanvas = document.getElementById("snakeCanvas");
  const scoreEl  = document.getElementById("snakeScore");
  const ctx = snkCanvas.getContext("2d");

  const COLS = 20, ROWS = 20, CELL = 22;
  snkCanvas.width  = COLS * CELL;
  snkCanvas.height = ROWS * CELL;

  let snake   = [{ x: 10, y: 10 }];
  let dir     = { x: 1, y: 0 };
  let nextDir = { x: 1, y: 0 };
  let food    = placeFood();
  let score   = 0;
  let speed   = 145;
  let loopId  = null;
  let clueFlashUntil = 0;
  let isOver  = false;

  function placeFood() {
    let pos;
    do {
      pos = { x: Math.floor(Math.random() * COLS), y: Math.floor(Math.random() * ROWS) };
    } while (snake.some(s => s.x === pos.x && s.y === pos.y));
    return pos;
  }

  function draw() {
    ctx.fillStyle = "#0a1a0a";
    ctx.fillRect(0, 0, snkCanvas.width, snkCanvas.height);

    // Subtle grid
    ctx.strokeStyle = "#0f220f";
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= COLS; i++) {
      ctx.beginPath(); ctx.moveTo(i * CELL, 0); ctx.lineTo(i * CELL, snkCanvas.height); ctx.stroke();
    }
    for (let j = 0; j <= ROWS; j++) {
      ctx.beginPath(); ctx.moveTo(0, j * CELL); ctx.lineTo(snkCanvas.width, j * CELL); ctx.stroke();
    }

    // Food (pulsing red circle)
    ctx.fillStyle = "#ff4444";
    ctx.shadowColor = "#ff0000"; ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc((food.x + 0.5) * CELL, (food.y + 0.5) * CELL, CELL * 0.38, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Snake body
    snake.forEach((seg, i) => {
      if (i === 0) {
        ctx.fillStyle = "#00ff44";
        ctx.shadowColor = "#00cc33"; ctx.shadowBlur = 6;
      } else {
        ctx.fillStyle = i % 2 === 0 ? "#00aa33" : "#009929";
        ctx.shadowBlur = 0;
      }
      const r = i === 0 ? 4 : 3;
      ctx.beginPath();
      ctx.roundRect(seg.x * CELL + 1, seg.y * CELL + 1, CELL - 2, CELL - 2, r);
      ctx.fill();
    });
    ctx.shadowBlur = 0;

    // Clue-unlocked flash overlay
    const flashRemaining = clueFlashUntil - performance.now();
    if (flashRemaining > 0) {
      const alpha = Math.min(1, flashRemaining / 400);
      ctx.fillStyle = `rgba(0,18,0,${alpha * 0.72})`;
      ctx.fillRect(0, 0, snkCanvas.width, snkCanvas.height);
      ctx.fillStyle = `rgba(0,255,68,${alpha})`;
      ctx.shadowColor = "#00ff44"; ctx.shadowBlur = 14;
      ctx.font = "bold 22px monospace"; ctx.textAlign = "center";
      ctx.fillText("🎉 CLUE UNLOCKED!", snkCanvas.width / 2, snkCanvas.height / 2 - 12);
      ctx.shadowBlur = 0; ctx.fillStyle = `rgba(170,255,170,${alpha})`;
      ctx.font = "15px monospace";
      ctx.fillText("Keep playing!", snkCanvas.width / 2, snkCanvas.height / 2 + 18);
      ctx.textAlign = "left";
    }
  }

  function update() {
    dir = { ...nextDir };
    const head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };

    if (head.x < 0 || head.x >= COLS || head.y < 0 || head.y >= ROWS ||
        snake.some(s => s.x === head.x && s.y === head.y)) {
      gameOver(); return;
    }

    snake.unshift(head);

    if (head.x === food.x && head.y === food.y) {
      score++;
      scoreEl.textContent = `Score: ${score}`;
      if (score === 10 && !gameState.snakeCompleted) {
        onWin();               // reveal winner's ticket, sets snakeCompleted
        clueFlashUntil = performance.now() + 2200;
      }
      food = placeFood();
      if (score % 3 === 0) { speed = Math.max(75, speed - 12); restartLoop(); }
    } else {
      snake.pop();
    }
  }

  function gameOver() {
    clearInterval(loopId);
    isOver = true;
    ctx.fillStyle = "rgba(0,0,0,0.72)";
    ctx.fillRect(0, 0, snkCanvas.width, snkCanvas.height);
    ctx.fillStyle = "#ff4444"; ctx.shadowColor = "#ff0000"; ctx.shadowBlur = 12;
    ctx.font = "bold 38px monospace"; ctx.textAlign = "center";
    ctx.fillText("GAME OVER", snkCanvas.width / 2, snkCanvas.height / 2 - 24);
    ctx.shadowBlur = 0; ctx.fillStyle = "#aaa";
    ctx.font = "18px monospace";
    ctx.fillText(`Score: ${score}`, snkCanvas.width / 2, snkCanvas.height / 2 + 14);
    ctx.fillStyle = "#88cc88";
    ctx.fillText("Press [Enter] to try again", snkCanvas.width / 2, snkCanvas.height / 2 + 48);
    ctx.textAlign = "left";

    document.addEventListener("keydown", (e) => {
      if (e.key !== "Enter") return;
      snake = [{ x: 10, y: 10 }]; dir = { x: 1, y: 0 }; nextDir = { x: 1, y: 0 };
      food = placeFood(); score = 0; speed = 145; clueFlashUntil = 0; isOver = false;
      scoreEl.textContent = "Score: 0";
      restartLoop();
    }, { once: true });
  }

  function restartLoop() {
    clearInterval(loopId);
    loopId = setInterval(() => { update(); if (!isOver) draw(); }, speed);
  }

  function closeGame() {
    clearInterval(loopId);
    document.removeEventListener("keydown", snakeKeyHandler);
    overlay.classList.add("hidden");
    gameState.overlayOpen = false;
    camera.attachControl(canvas, true);
  }

  function snakeKeyHandler(e) {
    switch (e.key) {
      case "ArrowUp":    case "w": case "W": if (dir.y === 0) nextDir = { x: 0, y: -1 }; break;
      case "ArrowDown":  case "s": case "S": if (dir.y === 0) nextDir = { x: 0, y:  1 }; break;
      case "ArrowLeft":  case "a": case "A": if (dir.x === 0) nextDir = { x: -1, y: 0 }; break;
      case "ArrowRight": case "d": case "D": if (dir.x === 0) nextDir = { x:  1, y: 0 }; break;
      case "Escape": closeGame(); break;
    }
    if (["ArrowUp","ArrowDown","ArrowLeft","ArrowRight"].includes(e.key)) e.preventDefault();
  }

  overlay.classList.remove("hidden");
  gameState.overlayOpen = true;
  camera.detachControl();
  document.addEventListener("keydown", snakeKeyHandler);
  scoreEl.textContent = "Score: 0";
  draw();
  restartLoop();
}

function registerArcadeUI(camera, scene, interactionPoint, joystickPos) {
  window.addEventListener("keydown", (event) => {
    if (event.key.toLowerCase() !== "i") return;
    if (gameState.overlayOpen || gameState.escaped) return;
    if (!gameState.arcadeInRange || gameState.snakeCompleted) return;

    startSnakeGame(camera, () => {
      gameState.snakeCompleted = true;
      revealArcadeClue(scene, joystickPos);
      setTransientPrompt("A winner's ticket appeared on the joystick! Check the arcade machine.", 3800);
    });
  });
}

async function createScene() {
  const scene = new Scene(engine);
  scene.clearColor = new Color4(0.47, 0.72, 0.94, 1);
  scene.collisionsEnabled = true;
  scene.gravity = new Vector3(0, -0.34, 0);
  scene.environmentTexture = CubeTexture.CreateFromPrefilteredData(
    ASSETS.environment,
    scene,
  );
  scene.environmentIntensity = 0.55;

  const camera = new UniversalCamera("playerCamera", new Vector3(0, 1.7, 3.2), scene);
  camera.setTarget(new Vector3(0, 1.7, 0));
  camera.attachControl(canvas, true);
  camera.minZ = 0.1;
  camera.speed = 0.45;
  camera.angularSensibility = 3500;
  camera.inertia = 0.62;
  camera.keysUp = [87, 38];
  camera.keysDown = [83, 40];
  camera.keysLeft = [65, 37];
  camera.keysRight = [68, 39];
  camera.checkCollisions = true;
  camera.applyGravity = true;
  camera.ellipsoid = new Vector3(0.35, 0.92, 0.35);

  const ambientLight = new HemisphericLight(
    "ambientLight",
    new Vector3(0, 1, 0),
    scene,
  );
  ambientLight.intensity = 0.68;

  const fillLight = new DirectionalLight(
    "fillLight",
    new Vector3(-0.15, -1, 0.28),
    scene,
  );
  fillLight.position = new Vector3(0, ROOM.height + 1.5, 0);
  fillLight.intensity = 0.58;

  const room = createRoom(scene);
  createOutdoorScene(scene);
  createWallPosters(scene);
  const furnitureRefs = createProceduralFurniture(scene);
  const { interactionPoint: arcadeInteractionPoint, joystickPos } = createArcadeMachine(scene);
  const clueMeshes = createClueObjects(scene);
  // Wire the sink paper mesh into the clue map so registerClueUI distance check works
  clueMeshes.set("sinkPaper", furnitureRefs.sinkPaperMesh);
  const { posterState, hinge: kkHinge } = createKingKongSwingPoster(scene);

  // Poster-swing click listener (separate from clue interaction)
  const posterPos = new Vector3(2.6, 2.15, ROOM.depth / 2 - ROOM.wallThickness / 2);
  window.addEventListener("click", () => {
    if (gameState.overlayOpen || gameState.escaped) return;
    if (document.pointerLockElement !== canvas) return;
    if (posterState.animating || posterState.isOpen) return;

    const cx = engine.getRenderWidth() / 2;
    const cy = engine.getRenderHeight() / 2;
    const pickResult = scene.pick(cx, cy);
    if (pickResult?.pickedMesh?.metadata?.posterId !== "kingkong") return;

    if (Vector3.Distance(camera.position, posterPos) > 3.2) {
      setTransientPrompt("Move closer to the poster.", 1600);
      return;
    }
    posterState.animating = true;
    const swingAnim = new Animation("posterSwing", "rotation.y", 60,
      Animation.ANIMATIONTYPE_FLOAT, Animation.ANIMATIONLOOPMODE_CONSTANT);
    swingAnim.setKeys([
      { frame: 0, value: 0 },
      { frame: 50, value: Math.PI / 2 },
    ]);
    scene.beginDirectAnimation(kkHinge, [swingAnim], 0, 50, false, 1.0, () => {
      posterState.isOpen = true;
      posterState.animating = false;
      setTransientPrompt("A postcard was hidden behind the poster!", 2800);
    });
  });

  await Promise.all(
    MODEL_LAYOUT.map(async (definition) => {
      try {
        await loadFurnitureModel(scene, definition);
      } catch (error) {
        console.error(
          `Failed to load model ${definition.name}. Using fallback geometry.`,
          error,
        );
        createFallbackModel(scene, definition);
      }
    }),
  );

  // Load mantel clock GLTF and attach to the clock clue anchor
  try {
    const clockImport = await SceneLoader.ImportMeshAsync("", "./models/", "mantel_clock_01_4k.gltf", scene);
    const clockAnchor = clueMeshes.get("clock");
    // Re-parent all top-level meshes to the anchor
    clockImport.meshes
      .filter(m => m.parent === null)
      .forEach(m => { m.parent = clockAnchor; });
    // Scale and orient: model is roughly 0.22 m tall, sits on table at anchor position
    clockAnchor.scaling = new Vector3(1.4, 1.4, 1.4);
    // Mark every mesh as interactive for the clock clue
    clockImport.meshes.forEach(m => {
      m.isPickable = true;
      m.metadata = { clueId: "clock" };
      m.checkCollisions = false;
    });
  } catch (err) {
    console.error("Failed to load mantel clock GLTF:", err);
  }

  // Load wooden_table_02 GLTF — replaces the procedural dining table
  try {
    const tableImport = await SceneLoader.ImportMeshAsync("", "./models/", "wooden_table_02_2k.gltf", scene);
    tableImport.meshes.forEach(m => {
      m.checkCollisions = true;
      m.isPickable = false;
    });
    // Centre of room, floor-level; table top is at y ≈ 0.80 m (real-world scale)
    const tableRoot = tableImport.meshes.find(m => m.parent === null) || tableImport.meshes[0];
    tableRoot.position = new Vector3(0, 0, -0.5);
    tableRoot.rotationQuaternion = null;
    tableRoot.rotation.y = 0;
  } catch (err) {
    console.error("Failed to load wooden_table_02 GLTF:", err);
  }

  // Load bolt_cutters_01 GLTF — lying flat in the SW corner of the room
  try {
    const bcImport = await SceneLoader.ImportMeshAsync("", "./models/", "bolt_cutters_01_2k.gltf", scene);
    // SW corner: (-4.8, floor, -4.4); rotate so they lie flat (long axis along X) angled into corner
    const bcRoot = bcImport.meshes.find(m => m.parent === null) || bcImport.meshes[0];
    bcRoot.rotationQuaternion = null;
    bcRoot.rotation.x = Math.PI / 2;   // tip long axis from Y → -Z (lay flat)
    bcRoot.rotation.y = Math.PI * 1.25; // angle diagonally into SW corner
    bcRoot.position = new Vector3(-4.8, 0.01, -4.4);
    bcImport.meshes.forEach(m => {
      m.checkCollisions = false;
      m.isPickable = true;
      m.metadata = { type: "pickup", itemId: "pliers" };
    });
    // Store refs so the pickup handler can hide them
    furnitureRefs.pliersMeshes.push(...bcImport.meshes);
  } catch (err) {
    console.error("Failed to load bolt_cutters_01 GLTF:", err);
  }

  registerDoorUI(scene, camera, room.doorHinge);
  registerClueUI(scene, camera, clueMeshes, posterState);
  registerArcadeUI(camera, scene, arcadeInteractionPoint, joystickPos);
  updateClueLedger();

  // ── Drain sink animation ───────────────────────────────────────────────────
  const drainSink = () => {
    if (gameState.sinkDrained) return;
    furnitureRefs.waterSystem.stop();
    furnitureRefs.drainStopper.isVisible = false;
    const startAlpha = furnitureRefs.waterPool.material.alpha;
    const totalFrames = 180;
    let frame = 0;
    const drainObs = scene.onBeforeRenderObservable.add(() => {
      frame++;
      furnitureRefs.waterPool.material.alpha = startAlpha * Math.max(0, 1 - frame / totalFrames);
      if (frame >= totalFrames) {
        furnitureRefs.waterPool.isVisible = false;
        gameState.sinkDrained = true;
        scene.onBeforeRenderObservable.remove(drainObs);
        setTransientPrompt("The sink is drained. Something is on the bottom!", 2800);
      }
    });
  };

  // ── Pliers pickup + drain stopper click handler ───────────────────────────
  window.addEventListener("click", () => {
    if (gameState.overlayOpen || gameState.escaped) return;
    if (document.pointerLockElement !== canvas) return;
    const cx = engine.getRenderWidth() / 2;
    const cy = engine.getRenderHeight() / 2;
    const pickResult = scene.pick(cx, cy);
    const pickedMesh = pickResult?.pickedMesh;
    if (!pickedMesh) return;

    // Pliers pickup
    if (pickedMesh.metadata?.type === "pickup" && pickedMesh.metadata?.itemId === "pliers") {
      if (!gameState.pliersPicked) {
        gameState.pliersPicked = true;
        addToInventory("pliers", "Bolt Cutters", "✂️");
        furnitureRefs.pliersMeshes.forEach(m => { m.isPickable = false; m.isVisible = false; });
        setTransientPrompt("You picked up the bolt cutters!", 1800);
      }
      return;
    }

    // Drain stopper
    if (pickedMesh.metadata?.type === "drainStopper") {
      if (Vector3.Distance(camera.position, furnitureRefs.drainStopper.position) > 2.8) {
        setTransientPrompt("Move closer to the sink.", 1600);
        return;
      }
      if (!gameState.pliersPicked) {
        setTransientPrompt("You need something to remove the drain plug.", 1800);
      } else {
        drainSink();
        setTransientPrompt("You remove the drain plug with the bolt cutters.", 2200);
      }
      return;
    }
  });

  // Proximity points
  const sinkPoint = new Vector3(5.44, 0.96, 0.0);
  const pliersPoint = new Vector3(-4.8, 0.5, -4.4);

  scene.onBeforeRenderObservable.add(() => {
    const frameTime = performance.now();
    const doorDistance = Vector3.Distance(camera.position, room.doorInteractionPoint);
    gameState.doorInRange = doorDistance <= 2.1;
    const arcadeDistance = Vector3.Distance(camera.position, arcadeInteractionPoint);
    gameState.arcadeInRange = arcadeDistance <= 2.5;
    gameState.sinkInRange = Vector3.Distance(camera.position, sinkPoint) <= 2.5;
    gameState.pliersInRange = Vector3.Distance(camera.position, pliersPoint) <= 2.0;

    if (!gameState.escaped && gameState.doorUnlocked && camera.position.z < room.exitThresholdZ) {
      gameState.escaped = true;
      openOverlay(ui.winBanner);
      camera.detachControl();
      setTransientPrompt("", 0);
      hidePrompt();
      canvas.style.cursor = "default";
      return;
    }

    if (!gameState.escaped) {
      const isTransientActive = gameState.transientPrompt.until > frameTime;
      if (isTransientActive) {
        showPrompt(gameState.transientPrompt.text);
      } else if (gameState.arcadeInRange && !gameState.overlayOpen && !gameState.snakeCompleted) {
        showPrompt('Press [I] to begin playing Snake!');
      } else if (gameState.arcadeInRange && gameState.snakeCompleted && !gameState.discoveredNumbers.has("receipt")) {
        showPrompt('Check the arcade joystick for your prize!');
      } else if (gameState.pliersInRange && !gameState.pliersPicked) {
        showPrompt('Click the bolt cutters to pick them up.');
      } else if (gameState.sinkInRange && !gameState.sinkDrained && gameState.pliersPicked) {
        showPrompt('Aim at the drain plug and click to remove it.');
      } else if (gameState.sinkInRange && !gameState.sinkDrained && !gameState.pliersPicked) {
        showPrompt('Something is in the sink — but the water looks scalding hot.');
      } else if (
        gameState.doorInRange &&
        !gameState.overlayOpen &&
        !gameState.doorUnlocked
      ) {
        showPrompt('Press "I" to interact with the door');
      } else {
        hidePrompt();
      }
    }
  });

  return scene;
}

canvas.addEventListener("click", () => {
  if (!gameState.overlayOpen && document.pointerLockElement !== canvas) {
    canvas.requestPointerLock();
  }
});

let activeScene = null;

createScene()
  .then((scene) => {
    activeScene = scene;
    engine.runRenderLoop(() => {
      activeScene.render();
    });
  })
  .catch((error) => {
    console.error("Failed to initialize scene.", error);
    showPrompt("Failed to initialize game scene. Check console for details.");
  });

window.addEventListener("resize", () => {
  engine.resize();
});
