(() => {
  const WORLD_WIDTH = 64;
  const WORLD_HEIGHT = 28;
  const WORLD_DEPTH = 64;
  const REACH = 7;
  const STORAGE_KEY = "minebits-voxel-world-v1";
  const BLOCKS = {
    air: 0,
    grass: 1,
    data: 2,
    bitstone: 3,
    ore: 4,
    log: 5,
    leaves: 6,
    core: 7,
    bedrock: 8,
    sand: 9,
    clay: 10,
    coal: 11,
    planks: 12,
    craftingTable: 13,
    glass: 14,
    bricks: 15,
    gravel: 16,
    lava: 17,
  };
  const BLOCK_INFO = {
    1: { name: "Grass Data", color: [0.36, 0.68, 0.22], drop: 2, hardness: 1, tool: "shovel", tier: 0 },
    2: { name: "Data", color: [0.45, 0.29, 0.16], drop: 2, hardness: 1, tool: "shovel", tier: 0 },
    3: { name: "Bitstone", color: [0.39, 0.43, 0.46], drop: 3, hardness: 3, tool: "pickaxe", tier: 1 },
    4: { name: "Copper Bit Ore", color: [0.18, 0.68, 0.72], drop: 4, hardness: 4, tool: "pickaxe", tier: 2 },
    5: { name: "Log File", color: [0.42, 0.27, 0.12], drop: 5, hardness: 3, tool: "axe", tier: 0 },
    6: { name: "Leaf Cache", color: [0.22, 0.52, 0.18], drop: 6, hardness: 1, tool: "axe", tier: 0 },
    7: { name: "Core Bit", color: [0.96, 0.78, 0.18], drop: 7, hardness: 6, tool: "pickaxe", tier: 3 },
    8: { name: "Bedrock Firewall", color: [0.12, 0.13, 0.15], unbreakable: true },
    9: { name: "Packet Sand", color: [0.78, 0.68, 0.4], drop: 9, hardness: 1, tool: "shovel", tier: 0 },
    10: { name: "Raw Clay", color: [0.46, 0.53, 0.58], drop: 10, hardness: 2, tool: "shovel", tier: 0 },
    11: { name: "Coal Bit Ore", color: [0.19, 0.2, 0.22], drop: 11, hardness: 3, tool: "pickaxe", tier: 1 },
    12: { name: "Data Planks", color: [0.66, 0.44, 0.2], drop: 12, hardness: 2, tool: "axe", tier: 0 },
    13: { name: "Crafting Terminal", color: [0.52, 0.31, 0.12], drop: 13, hardness: 3, tool: "axe", tier: 0 },
    14: { name: "Glass Pane Block", color: [0.48, 0.78, 0.84], drop: 14, hardness: 1, tool: "hand", tier: 0 },
    15: { name: "Compiled Brick", color: [0.57, 0.25, 0.18], drop: 15, hardness: 3, tool: "pickaxe", tier: 1 },
    16: { name: "Loose Gravel", color: [0.43, 0.41, 0.39], drop: 16, hardness: 1, tool: "shovel", tier: 0 },
    17: { name: "Memory Lava", color: [1, 0.18, 0.04], unbreakable: true, hazard: true },
  };
  const HOTBAR_BLOCKS = [2, 3, 5, 6, 9, 12, 13, 14, 15];
  const INVENTORY_BLOCKS = [2, 3, 4, 5, 6, 9, 10, 11, 12, 13, 14, 15, 16];
  const TOOL_KINDS = ["hand", "pickaxe", "axe", "shovel"];
  const TOOL_MATERIALS = {
    wood: { label: "WOOD", tier: 1, durability: 48 },
    bitstone: { label: "BITSTONE", tier: 2, durability: 112 },
    copper: { label: "COPPER", tier: 3, durability: 220 },
  };
  const RECIPES = {
    planks: { label: "DATA PLANKS ×4", inputs: { 5: 1 }, outputs: { 12: 4 } },
    sticks: { label: "BIT STICKS ×4", inputs: { 12: 2 }, itemInputs: {}, itemOutputs: { sticks: 4 } },
    table: { label: "CRAFTING TERMINAL", inputs: { 12: 4 }, outputs: { 13: 1 } },
    glass: { label: "GLASS BLOCKS ×4", inputs: { 9: 4, 11: 1 }, outputs: { 14: 4 }, table: true },
    bricks: { label: "COMPILED BRICKS ×4", inputs: { 10: 4, 11: 1 }, outputs: { 15: 4 }, table: true },
    "wood-pickaxe": { label: "WOOD PICKAXE", inputs: { 12: 3 }, itemInputs: { sticks: 2 }, tool: ["pickaxe", "wood"], table: true },
    "wood-axe": { label: "WOOD AXE", inputs: { 12: 3 }, itemInputs: { sticks: 2 }, tool: ["axe", "wood"], table: true },
    "wood-shovel": { label: "WOOD SHOVEL", inputs: { 12: 1 }, itemInputs: { sticks: 2 }, tool: ["shovel", "wood"], table: true },
    "bitstone-pickaxe": { label: "BITSTONE PICKAXE", inputs: { 3: 3 }, itemInputs: { sticks: 2 }, tool: ["pickaxe", "bitstone"], table: true },
    "bitstone-axe": { label: "BITSTONE AXE", inputs: { 3: 3 }, itemInputs: { sticks: 2 }, tool: ["axe", "bitstone"], table: true },
    "bitstone-shovel": { label: "BITSTONE SHOVEL", inputs: { 3: 1 }, itemInputs: { sticks: 2 }, tool: ["shovel", "bitstone"], table: true },
    "copper-pickaxe": { label: "COPPER PICKAXE", inputs: { 4: 3, 11: 1 }, itemInputs: { sticks: 2 }, tool: ["pickaxe", "copper"], table: true },
    "copper-axe": { label: "COPPER AXE", inputs: { 4: 3, 11: 1 }, itemInputs: { sticks: 2 }, tool: ["axe", "copper"], table: true },
    "copper-shovel": { label: "COPPER SHOVEL", inputs: { 4: 1, 11: 1 }, itemInputs: { sticks: 2 }, tool: ["shovel", "copper"], table: true },
  };
  const FACE_DATA = [
    { direction: [1, 0, 0], shade: 0.82, vertices: [[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 0], [1, 1, 1], [1, 0, 1]] },
    { direction: [-1, 0, 0], shade: 0.68, vertices: [[0, 0, 1], [0, 1, 1], [0, 1, 0], [0, 0, 1], [0, 1, 0], [0, 0, 0]] },
    { direction: [0, 1, 0], shade: 1, vertices: [[0, 1, 0], [0, 1, 1], [1, 1, 1], [0, 1, 0], [1, 1, 1], [1, 1, 0]] },
    { direction: [0, -1, 0], shade: 0.5, vertices: [[0, 0, 1], [0, 0, 0], [1, 0, 0], [0, 0, 1], [1, 0, 0], [1, 0, 1]] },
    { direction: [0, 0, 1], shade: 0.76, vertices: [[1, 0, 1], [1, 1, 1], [0, 1, 1], [1, 0, 1], [0, 1, 1], [0, 0, 1]] },
    { direction: [0, 0, -1], shade: 0.62, vertices: [[0, 0, 0], [0, 1, 0], [1, 1, 0], [0, 0, 0], [1, 1, 0], [1, 0, 0]] },
  ];

  function clamp(value, minimum, maximum) {
    return Math.min(maximum, Math.max(minimum, value));
  }

  function randomSeed() {
    if (window.crypto?.getRandomValues) {
      return window.crypto.getRandomValues(new Uint32Array(1))[0] >>> 0;
    }
    return Math.floor(Math.random() * 0xffffffff) >>> 0;
  }

  function hash(seed, x, y = 0, z = 0) {
    let value = (seed ^ Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(z, 2147483647)) >>> 0;
    value = Math.imul(value ^ (value >>> 13), 1274126177) >>> 0;
    return ((value ^ (value >>> 16)) >>> 0) / 4294967295;
  }

  function smoothstep(value) {
    return value * value * (3 - 2 * value);
  }

  function valueNoise(seed, x, z, scale) {
    const scaledX = x / scale;
    const scaledZ = z / scale;
    const x0 = Math.floor(scaledX);
    const z0 = Math.floor(scaledZ);
    const tx = smoothstep(scaledX - x0);
    const tz = smoothstep(scaledZ - z0);
    const a = hash(seed, x0, 0, z0);
    const b = hash(seed, x0 + 1, 0, z0);
    const c = hash(seed, x0, 0, z0 + 1);
    const d = hash(seed, x0 + 1, 0, z0 + 1);
    const top = a + ((b - a) * tx);
    const bottom = c + ((d - c) * tx);
    return top + ((bottom - top) * tz);
  }

  function multiplyMatrices(a, b) {
    const output = new Float32Array(16);
    for (let column = 0; column < 4; column += 1) {
      for (let row = 0; row < 4; row += 1) {
        output[(column * 4) + row] =
          (a[row] * b[column * 4])
          + (a[4 + row] * b[(column * 4) + 1])
          + (a[8 + row] * b[(column * 4) + 2])
          + (a[12 + row] * b[(column * 4) + 3]);
      }
    }
    return output;
  }

  function perspectiveMatrix(fieldOfView, aspect, near, far) {
    const f = 1 / Math.tan(fieldOfView / 2);
    const range = 1 / (near - far);
    return new Float32Array([
      f / aspect, 0, 0, 0,
      0, f, 0, 0,
      0, 0, (near + far) * range, -1,
      0, 0, near * far * range * 2, 0,
    ]);
  }

  function lookAtMatrix(eye, target) {
    const zx = eye[0] - target[0];
    const zy = eye[1] - target[1];
    const zz = eye[2] - target[2];
    const zLength = Math.hypot(zx, zy, zz) || 1;
    const z = [zx / zLength, zy / zLength, zz / zLength];
    const xx = z[2];
    const xy = 0;
    const xz = -z[0];
    const xLength = Math.hypot(xx, xy, xz) || 1;
    const x = [xx / xLength, xy, xz / xLength];
    const y = [
      (z[1] * x[2]) - (z[2] * x[1]),
      (z[2] * x[0]) - (z[0] * x[2]),
      (z[0] * x[1]) - (z[1] * x[0]),
    ];
    return new Float32Array([
      x[0], y[0], z[0], 0,
      x[1], y[1], z[1], 0,
      x[2], y[2], z[2], 0,
      -((x[0] * eye[0]) + (x[1] * eye[1]) + (x[2] * eye[2])),
      -((y[0] * eye[0]) + (y[1] * eye[1]) + (y[2] * eye[2])),
      -((z[0] * eye[0]) + (z[1] * eye[1]) + (z[2] * eye[2])),
      1,
    ]);
  }

  function compileShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const message = gl.getShaderInfoLog(shader);
      gl.deleteShader(shader);
      throw new Error(`MineBits shader failed: ${message}`);
    }
    return shader;
  }

  function createProgram(gl) {
    const vertexShader = compileShader(gl, gl.VERTEX_SHADER, `
      attribute vec3 a_position;
      attribute vec3 a_color;
      uniform mat4 u_viewProjection;
      uniform vec3 u_camera;
      varying vec3 v_color;
      varying float v_distance;
      void main() {
        gl_Position = u_viewProjection * vec4(a_position, 1.0);
        v_color = a_color;
        v_distance = distance(a_position, u_camera);
      }
    `);
    const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, `
      precision mediump float;
      uniform vec3 u_sky;
      varying vec3 v_color;
      varying float v_distance;
      void main() {
        float fog = smoothstep(28.0, 52.0, v_distance);
        gl_FragColor = vec4(mix(v_color, u_sky, fog), 1.0);
      }
    `);
    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(`MineBits renderer failed: ${gl.getProgramInfoLog(program)}`);
    }
    return program;
  }

  window.createMineBitsGame = ({
    root,
    onScore = () => {},
    onAchievement = () => {},
    onArcadeStatus = () => {},
  }) => {
    const canvas = root.querySelector("#minebits-canvas");
    const status = root.querySelector("#minebits-status");
    const scoreOutput = root.querySelector("#minebits-score");
    const toolOutput = root.querySelector("#minebits-tool-label");
    const blockOutput = root.querySelector("#minebits-block-label");
    const positionOutput = root.querySelector("#minebits-position");
    const seedInput = root.querySelector("#minebits-seed");
    const saveButton = root.querySelector("#minebits-save");
    const newButton = root.querySelector("#minebits-start");
    const publishButton = root.querySelector("#minebits-publish");
    const fullscreenButton = root.querySelector("#minebits-fullscreen");
    const viewport = root.querySelector(".minebits-viewport");
    const hotbar = root.querySelector("#minebits-hotbar");
    const toolbelt = root.querySelector("#minebits-toolbelt");
    const recipeList = root.querySelector("#minebits-recipes");
    const tableOutput = root.querySelector("#minebits-table-state");
    const sticksOutput = root.querySelector("#minebits-sticks-count");
    const craftedOutput = root.querySelector("#minebits-crafted");
    const minedOutput = root.querySelector("#minebits-mined");
    const placedOutput = root.querySelector("#minebits-placed");
    const coresOutput = root.querySelector("#minebits-cores");
    const saveOutput = root.querySelector("#minebits-save-state");
    const prompt = root.querySelector("#minebits-prompt");
    const healthOutput = root.querySelector("#minebits-health");
    const timeOutput = root.querySelector("#minebits-time");
    const hostilesOutput = root.querySelector("#minebits-hostiles");
    const dangerAlert = root.querySelector("#minebits-danger-alert");
    const hand = root.querySelector("#minebits-hand");
    const handTool = root.querySelector("#minebits-hand-tool");
    const gameInventory = root.querySelector("#minebits-game-inventory");
    const gameInventoryOptions = root.querySelector("#minebits-game-inventory-options");
    const gl = canvas.getContext("webgl", {
      alpha: false,
      antialias: false,
      powerPreference: "high-performance",
    });
    let program;
    let buffer;
    let positionLocation;
    let colorLocation;
    let matrixLocation;
    let cameraLocation;
    let skyLocation;
    let vertexCount = 0;
    let mobBuffer;
    let mobVertexCount = 0;
    let world = new Uint8Array(WORLD_WIDTH * WORLD_HEIGHT * WORLD_DEPTH);
    let seed = randomSeed();
    let edits = {};
    let inventory = Object.fromEntries(INVENTORY_BLOCKS.map((block) => [block, 0]));
    let items = { sticks: 0 };
    let tools = { pickaxe: null, axe: null, shovel: null };
    let stats = { mined: 0, placed: 0, cores: 0, crafted: 0 };
    let selectedBlock = 2;
    let selectedTool = "hand";
    let miningTarget = { key: "", progress: 0 };
    let player = { x: 32.5, y: 16, z: 32.5, yaw: 0, pitch: 0, velocityY: 0, grounded: false };
    let keys = new Set();
    let frameRequest = 0;
    let previousTime = 0;
    let running = false;
    let initialized = false;
    let saveTimer = 0;
    let achievementAwarded = false;
    let survival = { health: 10, day: 1, time: 0.32, deaths: 0, kills: 0 };
    let mobs = [];
    let mobSpawnTimer = 0;
    let hazardCooldown = 0;
    let highestFallSpeed = 0;
    let swingTimer = 0;
    let inventoryOpen = false;

    function indexFor(x, y, z) {
      return x + (z * WORLD_WIDTH) + (y * WORLD_WIDTH * WORLD_DEPTH);
    }

    function inBounds(x, y, z) {
      return x >= 0 && x < WORLD_WIDTH
        && y >= 0 && y < WORLD_HEIGHT
        && z >= 0 && z < WORLD_DEPTH;
    }

    function getBlock(x, y, z) {
      if (!inBounds(x, y, z)) {
        return BLOCKS.air;
      }
      return world[indexFor(x, y, z)];
    }

    function setBlock(x, y, z, block, trackEdit = true) {
      if (!inBounds(x, y, z)) {
        return;
      }
      world[indexFor(x, y, z)] = block;
      if (trackEdit) {
        edits[`${x},${y},${z}`] = block;
      }
    }

    function terrainHeight(x, z) {
      const broad = valueNoise(seed, x, z, 22);
      const detail = valueNoise(seed ^ 0x9e3779b9, x, z, 7);
      return clamp(Math.round(7 + (broad * 7) + (detail * 3)), 6, 18);
    }

    function generateWorld() {
      world = new Uint8Array(WORLD_WIDTH * WORLD_HEIGHT * WORLD_DEPTH);
      for (let z = 0; z < WORLD_DEPTH; z += 1) {
        for (let x = 0; x < WORLD_WIDTH; x += 1) {
          const height = terrainHeight(x, z);
          const dryBiome = valueNoise(seed ^ 0x5a17, x, z, 17) > 0.7;
          const clayPatch = valueNoise(seed ^ 0xc1a7, x, z, 8) > 0.76;
          for (let y = 0; y <= height; y += 1) {
            let block = BLOCKS.bitstone;
            if (y === 0) {
              block = BLOCKS.bedrock;
            } else if (y === height) {
              block = dryBiome ? BLOCKS.sand : BLOCKS.grass;
            } else if (y >= height - 3) {
              if (dryBiome) {
                block = BLOCKS.sand;
              } else {
                block = clayPatch && y < height - 1 ? BLOCKS.clay : BLOCKS.data;
              }
            } else {
              const cave = y > 2
                && y < height - 2
                && hash(seed ^ 0x51f15e, x, y, z) > 0.91;
              const resourceRoll = hash(seed ^ 0xa11ce, x, y, z);
              if (cave) {
                block = y <= 3 && hash(seed ^ 0x1a7a, x, y, z) > 0.62
                  ? BLOCKS.lava
                  : BLOCKS.air;
              } else if (resourceRoll > 0.972) {
                block = BLOCKS.ore;
              } else if (resourceRoll > 0.925) {
                block = BLOCKS.coal;
              } else if (
                y < height - 3
                && valueNoise(seed ^ 0x6a4e1, x + y, z - y, 6) > 0.82
              ) {
                block = BLOCKS.gravel;
              } else if (y < 8 && hash(seed ^ 0xc0feb17, x, y, z) > 0.993) {
                block = BLOCKS.core;
              }
            }
            setBlock(x, y, z, block, false);
          }
        }
      }
      for (let z = 3; z < WORLD_DEPTH - 3; z += 1) {
        for (let x = 3; x < WORLD_WIDTH - 3; x += 1) {
          if (
            hash(seed ^ 0x7ee, x, 0, z) < 0.018
            && getBlock(x, terrainHeight(x, z), z) === BLOCKS.grass
          ) {
            const ground = terrainHeight(x, z);
            for (let y = 1; y <= 3; y += 1) {
              setBlock(x, ground + y, z, BLOCKS.log, false);
            }
            for (let dz = -2; dz <= 2; dz += 1) {
              for (let dx = -2; dx <= 2; dx += 1) {
                for (let dy = 2; dy <= 4; dy += 1) {
                  if (Math.abs(dx) + Math.abs(dz) + Math.abs(dy - 3) <= 4) {
                    if (dx !== 0 || dz !== 0 || dy > 3) {
                      setBlock(x + dx, ground + dy, z + dz, BLOCKS.leaves, false);
                    }
                  }
                }
              }
            }
            setBlock(x, ground + 4, z, BLOCKS.leaves, false);
          }
        }
      }
      const spawnX = Math.floor(WORLD_WIDTH / 2);
      const spawnZ = Math.floor(WORLD_DEPTH / 2);
      const spawnY = terrainHeight(spawnX, spawnZ);
      for (let z = spawnZ - 1; z <= spawnZ + 1; z += 1) {
        for (let x = spawnX - 1; x <= spawnX + 1; x += 1) {
          for (let y = spawnY + 1; y <= spawnY + 3; y += 1) {
            setBlock(x, y, z, BLOCKS.air, false);
          }
        }
      }
      Object.entries(edits).forEach(([key, block]) => {
        const [x, y, z] = key.split(",").map(Number);
        setBlock(x, y, z, block, false);
      });
    }

    function getSurfaceY(x, z) {
      for (let y = WORLD_HEIGHT - 1; y >= 0; y -= 1) {
        const block = getBlock(x, y, z);
        if (block && block !== BLOCKS.leaves && block !== BLOCKS.log) {
          return y;
        }
      }
      return 0;
    }

    function resetPlayer() {
      const x = Math.floor(WORLD_WIDTH / 2);
      const z = Math.floor(WORLD_DEPTH / 2);
      player = {
        x: x + 0.5,
        y: getSurfaceY(x, z) + 1.01,
        z: z + 0.5,
        yaw: Math.PI,
        pitch: -0.08,
        velocityY: 0,
        grounded: false,
      };
    }

    function buildMesh() {
      const vertices = [];
      for (let y = 0; y < WORLD_HEIGHT; y += 1) {
        for (let z = 0; z < WORLD_DEPTH; z += 1) {
          for (let x = 0; x < WORLD_WIDTH; x += 1) {
            const block = getBlock(x, y, z);
            if (!block) {
              continue;
            }
            const info = BLOCK_INFO[block];
            FACE_DATA.forEach((face) => {
              const neighbor = getBlock(
                x + face.direction[0],
                y + face.direction[1],
                z + face.direction[2],
              );
              if (neighbor) {
                return;
              }
              const topTint = block === BLOCKS.grass && face.direction[1] === 1
                ? [0.42, 0.78, 0.24]
                : info.color;
              const glow = block === BLOCKS.core ? 1.12 : 1;
              face.vertices.forEach((vertex) => {
                vertices.push(
                  x + vertex[0],
                  y + vertex[1],
                  z + vertex[2],
                  clamp(topTint[0] * face.shade * glow, 0, 1),
                  clamp(topTint[1] * face.shade * glow, 0, 1),
                  clamp(topTint[2] * face.shade * glow, 0, 1),
                );
              });
            });
          }
        }
      }
      const data = new Float32Array(vertices);
      vertexCount = data.length / 6;
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    }

    function appendCube(vertices, x, y, z, color, size = 1) {
      const offset = (1 - size) / 2;
      FACE_DATA.forEach((face) => {
        face.vertices.forEach((vertex) => {
          vertices.push(
            x + offset + (vertex[0] * size),
            y + (vertex[1] * size),
            z + offset + (vertex[2] * size),
            clamp(color[0] * face.shade, 0, 1),
            clamp(color[1] * face.shade, 0, 1),
            clamp(color[2] * face.shade, 0, 1),
          );
        });
      });
    }

    function buildMobMesh() {
      const vertices = [];
      mobs.forEach((mob) => {
        appendCube(vertices, mob.x - 0.5, mob.y, mob.z - 0.5, [0.94, 0.08, 0.5], 0.9);
        appendCube(vertices, mob.x - 0.5, mob.y + 0.82, mob.z - 0.5, [0.42, 0.05, 0.65], 0.78);
      });
      const data = new Float32Array(vertices);
      mobVertexCount = data.length / 6;
      gl.bindBuffer(gl.ARRAY_BUFFER, mobBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);
    }

    function calculateScore() {
      return (stats.mined * 10)
        + (stats.placed * 5)
        + (stats.cores * 150)
        + (stats.crafted * 25);
    }

    function hasNearbyTable() {
      const centerX = Math.floor(player.x);
      const centerY = Math.floor(player.y);
      const centerZ = Math.floor(player.z);
      for (let y = centerY - 3; y <= centerY + 3; y += 1) {
        for (let z = centerZ - 4; z <= centerZ + 4; z += 1) {
          for (let x = centerX - 4; x <= centerX + 4; x += 1) {
            if (getBlock(x, y, z) === BLOCKS.craftingTable) {
              return true;
            }
          }
        }
      }
      return false;
    }

    function hasRecipeMaterials(recipe, tableNearby = hasNearbyTable()) {
      const hasBlocks = Object.entries(recipe.inputs || {}).every(
        ([block, count]) => (inventory[block] || 0) >= count,
      );
      const hasItems = Object.entries(recipe.itemInputs || {}).every(
        ([item, count]) => (items[item] || 0) >= count,
      );
      if (!hasBlocks || !hasItems || (recipe.table && !tableNearby)) {
        return false;
      }
      if (recipe.tool) {
        const [kind, material] = recipe.tool;
        const existingTier = tools[kind]?.tier || 0;
        return existingTier <= TOOL_MATERIALS[material].tier;
      }
      return true;
    }

    function toolLabel(kind) {
      const tool = tools[kind];
      return tool
        ? `${TOOL_MATERIALS[tool.material].label} ${kind.toUpperCase()} ${tool.durability}/${tool.maxDurability}`
        : `${kind.toUpperCase()} NONE`;
    }

    function craftRecipe(recipeId) {
      const recipe = RECIPES[recipeId];
      if (!recipe || !hasRecipeMaterials(recipe)) {
        setStatus(
          recipe?.table && !hasNearbyTable()
            ? "Place a Crafting Terminal nearby before compiling that recipe."
            : "The inventory does not contain the Bits required for that recipe.",
          "error",
        );
        return;
      }
      Object.entries(recipe.inputs || {}).forEach(([block, count]) => {
        inventory[block] -= count;
      });
      Object.entries(recipe.itemInputs || {}).forEach(([item, count]) => {
        items[item] -= count;
      });
      Object.entries(recipe.outputs || {}).forEach(([block, count]) => {
        inventory[block] = (inventory[block] || 0) + count;
      });
      Object.entries(recipe.itemOutputs || {}).forEach(([item, count]) => {
        items[item] = (items[item] || 0) + count;
      });
      if (recipe.tool) {
        const [kind, material] = recipe.tool;
        const materialInfo = TOOL_MATERIALS[material];
        tools[kind] = {
          material,
          tier: materialInfo.tier,
          durability: materialInfo.durability,
          maxDurability: materialInfo.durability,
        };
        selectedTool = kind;
      }
      stats.crafted += 1;
      setStatus(`${recipe.label} compiled successfully.`, "success");
      updateHud();
      scheduleSave();
    }

    function updateHud() {
      scoreOutput.textContent = calculateScore().toLocaleString();
      minedOutput.textContent = stats.mined.toLocaleString();
      placedOutput.textContent = stats.placed.toLocaleString();
      coresOutput.textContent = stats.cores.toLocaleString();
      craftedOutput.textContent = stats.crafted.toLocaleString();
      sticksOutput.textContent = String(items.sticks || 0);
      seedInput.value = String(seed);
      toolOutput.textContent = selectedTool === "hand"
        ? "HAND"
        : toolLabel(selectedTool);
      blockOutput.textContent = BLOCK_INFO[selectedBlock].name.toUpperCase();
      positionOutput.textContent = `${Math.floor(player.x)} ${Math.floor(player.y)} ${Math.floor(player.z)}`;
      healthOutput.textContent = `${survival.health} / 10`;
      healthOutput.closest(".minebits-survival-hud").classList.toggle(
        "is-critical",
        survival.health <= 3,
      );
      const totalMinutes = Math.floor(survival.time * 24 * 60);
      const hour = Math.floor(totalMinutes / 60) % 24;
      const minute = totalMinutes % 60;
      timeOutput.textContent = `DAY ${survival.day} // ${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
      hostilesOutput.textContent = String(mobs.length);
      hand.dataset.tool = selectedTool;
      handTool.textContent = selectedTool === "hand"
        ? "HAND"
        : TOOL_MATERIALS[tools[selectedTool]?.material]?.label || selectedTool.toUpperCase();
      const tableNearby = hasNearbyTable();
      tableOutput.textContent = tableNearby ? "ONLINE" : "NOT NEARBY";
      tableOutput.dataset.state = tableNearby ? "success" : "";
      hotbar.querySelectorAll("[data-minebits-block]").forEach((button) => {
        const block = Number(button.dataset.minebitsBlock);
        button.classList.toggle("is-selected", block === selectedBlock);
        button.setAttribute("aria-pressed", String(block === selectedBlock));
        button.querySelector("strong").textContent = String(inventory[block] || 0);
      });
      toolbelt.querySelectorAll("[data-minebits-tool]").forEach((button) => {
        const kind = button.dataset.minebitsTool;
        const available = kind === "hand" || Boolean(tools[kind]);
        button.classList.toggle("is-selected", kind === selectedTool);
        button.setAttribute("aria-pressed", String(kind === selectedTool));
        button.disabled = !available;
        button.querySelector("strong").textContent = kind === "hand"
          ? "∞"
          : toolLabel(kind).replace(`${kind.toUpperCase()} `, "");
      });
      root.querySelectorAll("[data-minebits-inventory]").forEach((output) => {
        output.textContent = String(inventory[output.dataset.minebitsInventory] || 0);
      });
      recipeList.querySelectorAll("[data-minebits-recipe]").forEach((button) => {
        button.disabled = !hasRecipeMaterials(
          RECIPES[button.dataset.minebitsRecipe],
          tableNearby,
        );
      });
      if (!achievementAwarded && stats.mined >= 20 && stats.placed >= 10 && stats.cores >= 1) {
        achievementAwarded = true;
        onAchievement({
          id: "minebits-architect",
          label: "BLOCKY GOOD FAITH",
          message: "MINEBITS SANDBOX MASTERED",
        });
      }
      if (inventoryOpen) {
        renderGameInventory();
      }
    }

    function renderGameInventory() {
      const options = [];
      TOOL_KINDS.forEach((kind) => {
        const available = kind === "hand" || Boolean(tools[kind]);
        const button = document.createElement("button");
        button.type = "button";
        button.dataset.inventoryAction = "tool";
        button.dataset.value = kind;
        button.disabled = !available;
        button.innerHTML = `<span>EQUIP ${kind.toUpperCase()}</span><small>${kind === "hand" ? "ALWAYS AVAILABLE" : toolLabel(kind)}</small>`;
        options.push(button);
      });
      HOTBAR_BLOCKS.forEach((block) => {
        const button = document.createElement("button");
        button.type = "button";
        button.dataset.inventoryAction = "block";
        button.dataset.value = String(block);
        button.disabled = !inventory[block];
        button.innerHTML = `<span>SELECT ${BLOCK_INFO[block].name.toUpperCase()}</span><small>${inventory[block] || 0} BLOCKS</small>`;
        options.push(button);
      });
      Object.entries(RECIPES).forEach(([recipeId, recipe]) => {
        const button = document.createElement("button");
        button.type = "button";
        button.dataset.inventoryAction = "recipe";
        button.dataset.value = recipeId;
        button.disabled = !hasRecipeMaterials(recipe);
        button.innerHTML = `<span>CRAFT ${recipe.label}</span><small>${recipe.table ? "CRAFTING TERMINAL REQUIRED" : "HAND RECIPE"}</small>`;
        options.push(button);
      });
      const focusedAction = document.activeElement?.dataset.inventoryAction;
      const focusedValue = document.activeElement?.dataset.value;
      gameInventoryOptions.replaceChildren(...options);
      const preferred = options.find((button) => (
        button.dataset.inventoryAction === focusedAction
        && button.dataset.value === focusedValue
      ));
      (preferred || options.find((button) => !button.disabled))?.focus();
    }

    function toggleGameInventory(forceOpen) {
      inventoryOpen = typeof forceOpen === "boolean" ? forceOpen : !inventoryOpen;
      gameInventory.hidden = !inventoryOpen;
      viewport.classList.toggle("is-inventory-open", inventoryOpen);
      keys.clear();
      if (inventoryOpen) {
        renderGameInventory();
        setStatus("Inventory opened without releasing pointer lock. Use arrows and Enter.");
      } else {
        canvas.focus();
        setStatus("Inventory closed. Survival process resumed.");
      }
    }

    function setStatus(message, state = "") {
      status.textContent = message;
      status.dataset.state = state;
    }

    function saveWorld(showMessage = true) {
      window.clearTimeout(saveTimer);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
          version: 3,
          seed,
          edits,
          inventory,
          items,
          tools,
          stats,
          selectedBlock,
          selectedTool,
          survival,
          player: {
            x: player.x,
            y: player.y,
            z: player.z,
            yaw: player.yaw,
            pitch: player.pitch,
          },
          achievementAwarded,
        }));
        saveOutput.textContent = "SAVED";
        if (showMessage) {
          setStatus("World saved locally. The chunks will remember your architectural decisions.", "success");
        }
      } catch (error) {
        console.error("Unable to save MineBits world:", error);
        saveOutput.textContent = "SAVE FAILED";
        setStatus("World save failed. Local storage rejected the chunks.", "error");
      }
    }

    function scheduleSave() {
      saveOutput.textContent = "UNSAVED";
      window.clearTimeout(saveTimer);
      saveTimer = window.setTimeout(() => saveWorld(false), 700);
    }

    function loadWorld() {
      try {
        const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
        if (
          !saved
          || ![1, 2, 3].includes(saved.version)
          || !Number.isInteger(saved.seed)
        ) {
          return false;
        }
        const savedEdits = saved.edits && typeof saved.edits === "object"
          ? Object.entries(saved.edits)
          : [];
        const validEdits = savedEdits.filter(([key, block]) => {
          const coordinates = key.split(",").map(Number);
          return coordinates.length === 3
            && coordinates.every(Number.isInteger)
            && inBounds(...coordinates)
            && Number.isInteger(block)
            && block >= BLOCKS.air
            && block !== BLOCKS.bedrock
            && (block === BLOCKS.air || Boolean(BLOCK_INFO[block]));
        });
        const savedCount = (value) => (
          Number.isInteger(value) && value >= 0 ? value : 0
        );
        seed = saved.seed >>> 0;
        edits = Object.fromEntries(validEdits);
        inventory = Object.fromEntries(INVENTORY_BLOCKS.map((block) => [
          block,
          savedCount(saved.inventory?.[block]),
        ]));
        items = {
          sticks: savedCount(saved.items?.sticks),
        };
        tools = Object.fromEntries(["pickaxe", "axe", "shovel"].map((kind) => {
          const savedTool = saved.tools?.[kind];
          const materialInfo = TOOL_MATERIALS[savedTool?.material];
          const durability = savedCount(savedTool?.durability);
          if (!materialInfo || durability === 0) {
            return [kind, null];
          }
          return [kind, {
            material: savedTool.material,
            tier: materialInfo.tier,
            durability: clamp(
              durability,
              0,
              materialInfo.durability,
            ),
            maxDurability: materialInfo.durability,
          }];
        }));
        stats = {
          mined: savedCount(saved.stats?.mined),
          placed: savedCount(saved.stats?.placed),
          cores: savedCount(saved.stats?.cores),
          crafted: savedCount(saved.stats?.crafted),
        };
        selectedBlock = HOTBAR_BLOCKS.includes(saved.selectedBlock) ? saved.selectedBlock : 2;
        selectedTool = TOOL_KINDS.includes(saved.selectedTool)
          && (saved.selectedTool === "hand" || tools[saved.selectedTool])
          ? saved.selectedTool
          : "hand";
        survival = {
          health: clamp(savedCount(saved.survival?.health) || 10, 1, 10),
          day: Math.max(1, savedCount(saved.survival?.day) || 1),
          time: clamp(Number(saved.survival?.time) || 0.32, 0, 0.9999),
          deaths: savedCount(saved.survival?.deaths),
          kills: savedCount(saved.survival?.kills),
        };
        achievementAwarded = saved.achievementAwarded === true;
        generateWorld();
        resetPlayer();
        if (saved.player) {
          player.x = clamp(Number(saved.player.x) || player.x, 1, WORLD_WIDTH - 1);
          player.y = clamp(Number(saved.player.y) || player.y, 1, WORLD_HEIGHT - 2);
          player.z = clamp(Number(saved.player.z) || player.z, 1, WORLD_DEPTH - 1);
          player.yaw = Number(saved.player.yaw) || 0;
          player.pitch = clamp(Number(saved.player.pitch) || 0, -1.5, 1.5);
        }
        return true;
      } catch (error) {
        console.error("Unable to load MineBits world:", error);
        localStorage.removeItem(STORAGE_KEY);
        return false;
      }
    }

    function newWorld() {
      const requestedSeed = seedInput.value.trim();
      const parsedSeed = Number.parseInt(requestedSeed, 10);
      seed = Number.isFinite(parsedSeed) ? parsedSeed >>> 0 : randomSeed();
      edits = {};
      inventory = Object.fromEntries(INVENTORY_BLOCKS.map((block) => [block, 0]));
      items = { sticks: 0 };
      tools = { pickaxe: null, axe: null, shovel: null };
      stats = { mined: 0, placed: 0, cores: 0, crafted: 0 };
      selectedBlock = 2;
      selectedTool = "hand";
      miningTarget = { key: "", progress: 0 };
      survival = { health: 10, day: 1, time: 0.32, deaths: 0, kills: 0 };
      mobs = [];
      achievementAwarded = false;
      generateWorld();
      resetPlayer();
      buildMesh();
      updateHud();
      saveWorld(false);
      setStatus(`World ${seed} generated. Click the view to capture the mouse and explore.`, "success");
      onArcadeStatus("MINEBITS first-person voxel world generated from original code and colors.");
      resume();
    }

    function isSolidAt(x, y, z) {
      const radius = 0.28;
      const samplesX = [x - radius, x + radius];
      const samplesY = [y + 0.05, y + 0.9, y + 1.72];
      const samplesZ = [z - radius, z + radius];
      return samplesX.some((sampleX) => samplesY.some((sampleY) => samplesZ.some((sampleZ) => (
        sampleX < 0
        || sampleX >= WORLD_WIDTH
        || sampleY < 0
        || sampleZ < 0
        || sampleZ >= WORLD_DEPTH
        || ![BLOCKS.air, BLOCKS.lava].includes(
          getBlock(Math.floor(sampleX), Math.floor(sampleY), Math.floor(sampleZ)),
        )
      ))));
    }

    function isNight() {
      return survival.time >= 0.72 || survival.time < 0.2;
    }

    function takeDamage(amount, reason) {
      if (hazardCooldown > 0 || amount <= 0) {
        return;
      }
      survival.health = Math.max(0, survival.health - amount);
      hazardCooldown = 0.7;
      viewport.classList.remove("is-damaged");
      window.requestAnimationFrame(() => viewport.classList.add("is-damaged"));
      dangerAlert.textContent = `${reason} // -${amount} HEALTH`;
      window.setTimeout(() => {
        dangerAlert.textContent = "";
        viewport.classList.remove("is-damaged");
      }, 900);
      if (survival.health === 0) {
        survival.deaths += 1;
        survival.health = 10;
        mobs = [];
        resetPlayer();
        setStatus(`RESPAWNED: ${reason}. Inventory survived due to narrative convenience.`, "error");
      }
      updateHud();
      scheduleSave();
    }

    function spawnGlitchMob() {
      for (let attempt = 0; attempt < 12; attempt += 1) {
        const angle = Math.random() * Math.PI * 2;
        const distance = 9 + (Math.random() * 8);
        const x = Math.floor(player.x + (Math.cos(angle) * distance));
        const z = Math.floor(player.z + (Math.sin(angle) * distance));
        if (x < 2 || x >= WORLD_WIDTH - 2 || z < 2 || z >= WORLD_DEPTH - 2) {
          continue;
        }
        const y = getSurfaceY(x, z) + 1;
        if (getBlock(x, y, z) === BLOCKS.air && getBlock(x, y + 1, z) === BLOCKS.air) {
          mobs.push({
            id: `${Date.now()}-${attempt}`,
            x: x + 0.5,
            y,
            z: z + 0.5,
            health: 6,
            attackCooldown: 0,
          });
          return;
        }
      }
    }

    function updateSurvival(deltaTime) {
      if (inventoryOpen) {
        return;
      }

      function swingHand() {
        window.clearTimeout(swingTimer);
        viewport.classList.remove("is-swinging");
        void viewport.offsetWidth;
        viewport.classList.add("is-swinging");
        swingTimer = window.setTimeout(() => {
          viewport.classList.remove("is-swinging");
        }, 240);
      }
      hazardCooldown = Math.max(0, hazardCooldown - deltaTime);
      survival.time += deltaTime / 180;
      if (survival.time >= 1) {
        survival.time -= 1;
        survival.day += 1;
      }
      const footBlock = getBlock(
        Math.floor(player.x),
        Math.floor(player.y + 0.1),
        Math.floor(player.z),
      );
      if (footBlock === BLOCKS.lava) {
        takeDamage(2, "MEMORY LAVA");
      }
      if (isNight()) {
        mobSpawnTimer -= deltaTime;
        if (mobSpawnTimer <= 0 && mobs.length < 6) {
          spawnGlitchMob();
          mobSpawnTimer = 3 + (Math.random() * 4);
        }
      } else if (mobs.length) {
        mobs = mobs.filter((mob) => Math.hypot(mob.x - player.x, mob.z - player.z) < 7);
      }
      mobs.forEach((mob) => {
        mob.attackCooldown = Math.max(0, mob.attackCooldown - deltaTime);
        const dx = player.x - mob.x;
        const dz = player.z - mob.z;
        const distance = Math.hypot(dx, dz) || 1;
        if (distance > 1.15) {
          const speed = 0.9 * deltaTime;
          const nextX = mob.x + ((dx / distance) * speed);
          const nextZ = mob.z + ((dz / distance) * speed);
          if (!isSolidAt(nextX, mob.y, mob.z)) {
            mob.x = nextX;
          }
          if (!isSolidAt(mob.x, mob.y, nextZ)) {
            mob.z = nextZ;
          }
          mob.y = getSurfaceY(Math.floor(mob.x), Math.floor(mob.z)) + 1;
        } else if (mob.attackCooldown === 0) {
          mob.attackCooldown = 1.35;
          takeDamage(1, "GLITCH MOB COLLISION");
        }
      });
    }

    function attackMob() {
      const direction = viewDirection();
      const eye = [player.x, player.y + 1.3, player.z];
      let target = null;
      let targetDistance = Infinity;
      mobs.forEach((mob) => {
        const vector = [mob.x - eye[0], (mob.y + 0.8) - eye[1], mob.z - eye[2]];
        const distance = Math.hypot(...vector);
        const dot = (
          (vector[0] * direction[0])
          + (vector[1] * direction[1])
          + (vector[2] * direction[2])
        ) / (distance || 1);
        if (distance <= 4.5 && dot > 0.92 && distance < targetDistance) {
          target = mob;
          targetDistance = distance;
        }
      });
      if (!target) {
        return false;
      }
      const damage = selectedTool === "hand" ? 2 : 3 + (tools[selectedTool]?.tier || 0);
      target.health -= damage;
      if (selectedTool !== "hand") {
        damageSelectedTool();
      }
      if (target.health <= 0) {
        mobs = mobs.filter((mob) => mob !== target);
        survival.kills += 1;
        setStatus("Glitch mob dereferenced. Hostile process terminated.", "success");
      } else {
        setStatus(`Glitch mob damaged. ${target.health} integrity remains.`);
      }
      updateHud();
      scheduleSave();
      return true;
    }

    function movePlayer(deltaTime) {
      if (inventoryOpen) {
        return;
      }
      const forward = (keys.has("KeyW") || keys.has("ArrowUp") ? 1 : 0)
        - (keys.has("KeyS") || keys.has("ArrowDown") ? 1 : 0);
      const strafe = (keys.has("KeyD") || keys.has("ArrowRight") ? 1 : 0)
        - (keys.has("KeyA") || keys.has("ArrowLeft") ? 1 : 0);
      const length = Math.hypot(forward, strafe) || 1;
      const speed = keys.has("ShiftLeft") || keys.has("ShiftRight") ? 7.2 : 4.6;
      const sin = Math.sin(player.yaw);
      const cos = Math.cos(player.yaw);
      const moveX = (((sin * forward) + (cos * strafe)) / length) * speed * deltaTime;
      const moveZ = (((-cos * forward) + (sin * strafe)) / length) * speed * deltaTime;
      const nextX = player.x + moveX;
      if (!isSolidAt(nextX, player.y, player.z)) {
        player.x = nextX;
      }
      const nextZ = player.z + moveZ;
      if (!isSolidAt(player.x, player.y, nextZ)) {
        player.z = nextZ;
      }
      player.velocityY -= 22 * deltaTime;
      highestFallSpeed = Math.min(highestFallSpeed, player.velocityY);
      if ((keys.has("Space") || keys.has("KeyE")) && player.grounded) {
        player.velocityY = 8.2;
        player.grounded = false;
      }
      const nextY = player.y + (player.velocityY * deltaTime);
      if (!isSolidAt(player.x, nextY, player.z)) {
        player.y = nextY;
        player.grounded = false;
      } else {
        if (player.velocityY < 0) {
          player.grounded = true;
          if (highestFallSpeed < -12) {
            takeDamage(Math.min(6, Math.floor((Math.abs(highestFallSpeed) - 9) / 3)), "FALL DAMAGE");
          }
        }
        player.velocityY = 0;
        highestFallSpeed = 0;
      }
      if (player.y < 1) {
        resetPlayer();
        setStatus("Respawned after an unscheduled meeting with the void.", "error");
      }
    }

    function viewDirection() {
      const pitchCosine = Math.cos(player.pitch);
      return [
        Math.sin(player.yaw) * pitchCosine,
        Math.sin(player.pitch),
        -Math.cos(player.yaw) * pitchCosine,
      ];
    }

    function raycast() {
      const origin = [player.x, player.y + 1.62, player.z];
      const direction = viewDirection();
      let x = Math.floor(origin[0]);
      let y = Math.floor(origin[1]);
      let z = Math.floor(origin[2]);
      const stepX = direction[0] >= 0 ? 1 : -1;
      const stepY = direction[1] >= 0 ? 1 : -1;
      const stepZ = direction[2] >= 0 ? 1 : -1;
      const deltaX = direction[0] === 0 ? Infinity : Math.abs(1 / direction[0]);
      const deltaY = direction[1] === 0 ? Infinity : Math.abs(1 / direction[1]);
      const deltaZ = direction[2] === 0 ? Infinity : Math.abs(1 / direction[2]);
      let maxX = direction[0] === 0
        ? Infinity
        : Math.abs(((stepX > 0 ? x + 1 : x) - origin[0]) / direction[0]);
      let maxY = direction[1] === 0
        ? Infinity
        : Math.abs(((stepY > 0 ? y + 1 : y) - origin[1]) / direction[1]);
      let maxZ = direction[2] === 0
        ? Infinity
        : Math.abs(((stepZ > 0 ? z + 1 : z) - origin[2]) / direction[2]);
      let distance = 0;
      let previous = { x, y, z };
      while (distance <= REACH) {
        const block = getBlock(x, y, z);
        if (block) {
          return { x, y, z, block, previous };
        }
        previous = { x, y, z };
        if (maxX < maxY && maxX < maxZ) {
          x += stepX;
          distance = maxX;
          maxX += deltaX;
        } else if (maxY < maxZ) {
          y += stepY;
          distance = maxY;
          maxY += deltaY;
        } else {
          z += stepZ;
          distance = maxZ;
          maxZ += deltaZ;
        }
      }
      return null;
    }

    function playerIntersectsBlock(x, y, z) {
      return player.x + 0.28 > x
        && player.x - 0.28 < x + 1
        && player.y + 1.78 > y
        && player.y < y + 1
        && player.z + 0.28 > z
        && player.z - 0.28 < z + 1;
    }

    function requiredToolLabel(info) {
      const material = Object.values(TOOL_MATERIALS).find(
        (candidate) => candidate.tier === info.tier,
      );
      return `${material?.label || "SPECIAL"} ${info.tool.toUpperCase()}`;
    }

    function damageSelectedTool() {
      if (selectedTool === "hand") {
        return "";
      }
      const tool = tools[selectedTool];
      if (!tool) {
        return "";
      }
      tool.durability -= 1;
      if (tool.durability > 0) {
        return ` ${tool.durability}/${tool.maxDurability} durability remains.`;
      }
      const brokenLabel = `${TOOL_MATERIALS[tool.material].label} ${selectedTool.toUpperCase()}`;
      tools[selectedTool] = null;
      selectedTool = "hand";
      return ` ${brokenLabel} exhausted its warranty and broke.`;
    }

    function editTarget(place) {
      const target = raycast();
      if (!target) {
        setStatus("No block in range. The Bits cannot reach that far.", "error");
        return;
      }
      if (!place) {
        const info = BLOCK_INFO[target.block];
        if (info.unbreakable) {
          setStatus("The Bedrock Firewall declined your deletion request.", "error");
          return;
        }
        const equippedTool = selectedTool === "hand" ? null : tools[selectedTool];
        if (
          info.tier > 0
          && (
            selectedTool !== info.tool
            || !equippedTool
            || equippedTool.tier < info.tier
          )
        ) {
          miningTarget = { key: "", progress: 0 };
          setStatus(
            `${info.name} requires a ${requiredToolLabel(info)} or better.`,
            "error",
          );
          return;
        }
        const targetKey = `${target.x},${target.y},${target.z}`;
        if (miningTarget.key !== targetKey) {
          miningTarget = { key: targetKey, progress: 0 };
        }
        const properTool = selectedTool === info.tool && equippedTool;
        miningTarget.progress += properTool ? 1 + (equippedTool.tier * 1.5) : 1;
        if (miningTarget.progress < info.hardness) {
          const remainingHits = Math.ceil(
            (info.hardness - miningTarget.progress)
            / (properTool ? 1 + (equippedTool.tier * 1.5) : 1),
          );
          setStatus(
            `${info.name} cracking... ${remainingHits} more hit${remainingHits === 1 ? "" : "s"}.`,
          );
          return;
        }
        setBlock(target.x, target.y, target.z, BLOCKS.air);
        if (info.drop && info.drop !== BLOCKS.core) {
          inventory[info.drop] = (inventory[info.drop] || 0) + 1;
        }
        stats.mined += 1;
        if (target.block === BLOCKS.core) {
          stats.cores += 1;
        }
        const durabilityMessage = damageSelectedTool();
        miningTarget = { key: "", progress: 0 };
        setStatus(`${info.name} mined.${durabilityMessage}`, "success");
      } else {
        miningTarget = { key: "", progress: 0 };
        const destination = target.previous;
        if (!inBounds(destination.x, destination.y, destination.z)) {
          setStatus("Blocks must remain inside the allocated world process.", "error");
          return;
        }
        if (!inventory[selectedBlock]) {
          setStatus(`No ${BLOCK_INFO[selectedBlock].name} blocks available. Mine some first.`, "error");
          return;
        }
        if (playerIntersectsBlock(destination.x, destination.y, destination.z)) {
          setStatus("Cannot place a block inside the operator.", "error");
          return;
        }
        setBlock(destination.x, destination.y, destination.z, selectedBlock);
        inventory[selectedBlock] -= 1;
        stats.placed += 1;
        setStatus(`${BLOCK_INFO[selectedBlock].name} placed.`, "success");
      }
      buildMesh();
      updateHud();
      scheduleSave();
    }

    function resizeCanvas() {
      const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
      const width = Math.max(1, Math.floor(canvas.clientWidth * ratio));
      const height = Math.max(1, Math.floor(canvas.clientHeight * ratio));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
      gl.viewport(0, 0, canvas.width, canvas.height);
    }

    function render() {
      resizeCanvas();
      const daylight = clamp(
        Math.sin(((survival.time - 0.25) * Math.PI * 2)) * 0.55 + 0.55,
        0.08,
        1,
      );
      const sky = [
        0.04 + (0.35 * daylight),
        0.04 + (0.58 * daylight),
        0.1 + (0.66 * daylight),
      ];
      const eye = [player.x, player.y + 1.62, player.z];
      const direction = viewDirection();
      const target = [eye[0] + direction[0], eye[1] + direction[1], eye[2] + direction[2]];
      const projection = perspectiveMatrix(Math.PI / 3, canvas.width / canvas.height, 0.08, 80);
      const view = lookAtMatrix(eye, target);
      const viewProjection = multiplyMatrices(projection, view);
      gl.clearColor(sky[0], sky[1], sky[2], 1);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.useProgram(program);
      gl.uniformMatrix4fv(matrixLocation, false, viewProjection);
      gl.uniform3fv(cameraLocation, eye);
      gl.uniform3fv(skyLocation, sky);
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.enableVertexAttribArray(positionLocation);
      gl.vertexAttribPointer(positionLocation, 3, gl.FLOAT, false, 24, 0);
      gl.enableVertexAttribArray(colorLocation);
      gl.vertexAttribPointer(colorLocation, 3, gl.FLOAT, false, 24, 12);
      gl.drawArrays(gl.TRIANGLES, 0, vertexCount);
      buildMobMesh();
      gl.bindBuffer(gl.ARRAY_BUFFER, mobBuffer);
      gl.vertexAttribPointer(positionLocation, 3, gl.FLOAT, false, 24, 0);
      gl.vertexAttribPointer(colorLocation, 3, gl.FLOAT, false, 24, 12);
      gl.drawArrays(gl.TRIANGLES, 0, mobVertexCount);
    }

    function frame(time) {
      if (!running) {
        return;
      }
      const deltaTime = Math.min((time - previousTime) / 1000 || 0, 0.05);
      previousTime = time;
      movePlayer(deltaTime);
      updateSurvival(deltaTime);
      const walking = !inventoryOpen && (
        keys.has("KeyW")
        || keys.has("KeyA")
        || keys.has("KeyS")
        || keys.has("KeyD")
        || keys.has("ArrowUp")
        || keys.has("ArrowDown")
        || keys.has("ArrowLeft")
        || keys.has("ArrowRight")
      );
      viewport.classList.toggle("is-walking", walking);
      updateHud();
      render();
      frameRequest = window.requestAnimationFrame(frame);
    }

    function selectBlock(block) {
      if (!HOTBAR_BLOCKS.includes(block)) {
        return;
      }
      selectedBlock = block;
      updateHud();
      setStatus(`${BLOCK_INFO[block].name} selected. Right-click a nearby face to place it.`);
    }

    function selectTool(kind) {
      if (!TOOL_KINDS.includes(kind) || (kind !== "hand" && !tools[kind])) {
        return;
      }
      selectedTool = kind;
      miningTarget = { key: "", progress: 0 };
      updateHud();
      setStatus(
        kind === "hand"
          ? "Hand selected. Natural materials may require several hits."
          : `${toolLabel(kind)} equipped.`,
      );
    }

    function cycleTool() {
      const availableTools = TOOL_KINDS.filter(
        (kind) => kind === "hand" || Boolean(tools[kind]),
      );
      const currentIndex = availableTools.indexOf(selectedTool);
      selectTool(availableTools[(currentIndex + 1) % availableTools.length]);
    }

    function initialize() {
      if (initialized) {
        return;
      }
      initialized = true;
      if (!gl) {
        canvas.hidden = true;
        prompt.textContent = "WEBGL UNAVAILABLE";
        setStatus("MineBits needs WebGL to render its voxel world.", "error");
        return;
      }
      try {
        program = createProgram(gl);
        buffer = gl.createBuffer();
        mobBuffer = gl.createBuffer();
        positionLocation = gl.getAttribLocation(program, "a_position");
        colorLocation = gl.getAttribLocation(program, "a_color");
        matrixLocation = gl.getUniformLocation(program, "u_viewProjection");
        cameraLocation = gl.getUniformLocation(program, "u_camera");
        skyLocation = gl.getUniformLocation(program, "u_sky");
        gl.enable(gl.DEPTH_TEST);
        gl.enable(gl.CULL_FACE);
        gl.cullFace(gl.BACK);
      } catch (error) {
        console.error(error);
        canvas.hidden = true;
        prompt.textContent = "RENDERER FAILED";
        setStatus(error.message, "error");
        return;
      }
      const restored = loadWorld();
      if (!restored) {
        generateWorld();
        resetPlayer();
      }
      buildMesh();
      updateHud();
      render();
      saveOutput.textContent = restored ? "RESTORED" : "NEW WORLD";
      setStatus(
        restored
          ? `World ${seed} restored. Click the view to continue exploring.`
          : `World ${seed} generated. Click the view to capture the mouse.`,
      );
    }

    function resume() {
      initialize();
      if (!gl || running) {
        return;
      }
      running = true;
      previousTime = performance.now();
      frameRequest = window.requestAnimationFrame(frame);
    }

    function pause() {
      running = false;
      keys.clear();
      if (inventoryOpen) {
        toggleGameInventory(false);
      }
      window.clearTimeout(swingTimer);
      viewport.classList.remove("is-swinging", "is-walking");
      window.cancelAnimationFrame(frameRequest);
      if (document.pointerLockElement === canvas) {
        document.exitPointerLock();
      }
      if (initialized && gl) {
        saveWorld(false);
      }
    }

    canvas.addEventListener("click", () => {
      if (document.pointerLockElement !== canvas) {
        canvas.requestPointerLock();
      }
    });
    canvas.addEventListener("mousedown", (event) => {
      if (document.pointerLockElement !== canvas || inventoryOpen) {
        return;
      }
      event.preventDefault();
      swingHand();
      if (event.button === 0) {
        if (!attackMob()) {
          editTarget(false);
        }
      } else if (event.button === 2) {
        editTarget(true);
      }
    });
    canvas.addEventListener("contextmenu", (event) => event.preventDefault());
    document.addEventListener("pointerlockchange", () => {
      const locked = document.pointerLockElement === canvas;
      root.classList.toggle("is-pointer-locked", locked);
      prompt.textContent = locked ? "ESC TO RELEASE MOUSE" : "CLICK TO ENTER WORLD";
      if (locked) {
        setStatus("Mouse captured. Left-click mines; right-click builds.");
      }
    });
    document.addEventListener("mousemove", (event) => {
      if (document.pointerLockElement !== canvas || inventoryOpen) {
        return;
      }
      player.yaw += event.movementX * 0.0024;
      player.pitch = clamp(player.pitch - (event.movementY * 0.0024), -1.5, 1.5);
    });
    document.addEventListener("keydown", (event) => {
      if (!running || root.hidden || root.closest("[hidden]")) {
        return;
      }
      if (event.code === "KeyI") {
        toggleGameInventory();
        event.preventDefault();
        return;
      }
      if (event.code === "KeyF") {
        if (document.fullscreenElement === viewport) {
          document.exitFullscreen();
        } else {
          viewport.requestFullscreen().catch((error) => {
            console.error("Unable to enter MineBits fullscreen:", error);
            setStatus("Fullscreen request was declined by the browser.", "error");
          });
        }
        event.preventDefault();
        return;
      }
      if (inventoryOpen) {
        const options = [...gameInventoryOptions.querySelectorAll("button:not(:disabled)")];
        const currentIndex = options.indexOf(document.activeElement);
        if (["ArrowDown", "ArrowRight", "ArrowUp", "ArrowLeft"].includes(event.code)) {
          const direction = ["ArrowDown", "ArrowRight"].includes(event.code) ? 1 : -1;
          options[(currentIndex + direction + options.length) % options.length]?.focus();
          event.preventDefault();
        } else if (event.code === "Enter" || event.code === "Space") {
          document.activeElement?.click();
          event.preventDefault();
        }
        return;
      }
      if (event.code.startsWith("Digit")) {
        const index = Number.parseInt(event.code.slice(5), 10) - 1;
        if (HOTBAR_BLOCKS[index]) {
          selectBlock(HOTBAR_BLOCKS[index]);
          event.preventDefault();
        }
        if (event.code === "KeyQ") {
          cycleTool();
          event.preventDefault();
        }
      }
      if (["KeyW", "KeyA", "KeyS", "KeyD", "Space", "KeyE", "ShiftLeft", "ShiftRight", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.code)) {
        keys.add(event.code);
        event.preventDefault();
      }
    });
    document.addEventListener("keyup", (event) => keys.delete(event.code));
    hotbar.addEventListener("click", (event) => {
      const button = event.target.closest("[data-minebits-block]");
      if (button) {
        selectBlock(Number(button.dataset.minebitsBlock));
      }
    });
    toolbelt.addEventListener("click", (event) => {
      const button = event.target.closest("[data-minebits-tool]");
      if (button) {
        selectTool(button.dataset.minebitsTool);
      }
    });
    recipeList.addEventListener("click", (event) => {
      const button = event.target.closest("[data-minebits-recipe]");
      if (button) {
        craftRecipe(button.dataset.minebitsRecipe);
      }
    });
    gameInventoryOptions.addEventListener("click", (event) => {
      const button = event.target.closest("[data-inventory-action]");
      if (!button || button.disabled) {
        return;
      }
      if (button.dataset.inventoryAction === "tool") {
        selectTool(button.dataset.value);
      } else if (button.dataset.inventoryAction === "block") {
        selectBlock(Number(button.dataset.value));
      } else if (button.dataset.inventoryAction === "recipe") {
        craftRecipe(button.dataset.value);
      }
      renderGameInventory();
    });
    fullscreenButton.addEventListener("click", () => {
      if (document.fullscreenElement === viewport) {
        document.exitFullscreen();
      } else {
        viewport.requestFullscreen().catch((error) => {
          console.error("Unable to enter MineBits fullscreen:", error);
          setStatus("Fullscreen request was declined by the browser.", "error");
        });
      }
    });
    document.addEventListener("fullscreenchange", () => {
      const fullscreen = document.fullscreenElement === viewport;
      fullscreenButton.textContent = fullscreen ? "EXIT_FULLSCREEN" : "FULLSCREEN";
      viewport.classList.toggle("is-fullscreen", fullscreen);
      render();
    });
    saveButton.addEventListener("click", () => saveWorld(true));
    newButton.addEventListener("click", newWorld);
    publishButton.addEventListener("click", () => {
      const score = calculateScore();
      if (score <= 0) {
        setStatus("Mine or place at least one block before publishing a run.", "error");
        return;
      }
      saveWorld(false);
      onScore({
        score,
        detail: `${stats.mined} MINED // ${stats.placed} BUILT // ${stats.crafted} CRAFTED`,
      });
      setStatus("Run score prepared for the Arcade leaderboard.", "success");
    });
    window.addEventListener("beforeunload", () => {
      if (initialized && gl) {
        saveWorld(false);
      }
    });

    initialize();
    return { newWorld, pause, resume, save: saveWorld };
  };
})();
