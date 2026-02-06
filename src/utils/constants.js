// ComfyUI API configuration
export const API_BASE = 'http://127.0.0.1:8188';
export const WS_BASE = 'ws://127.0.0.1:8188';

// Default workflow parameters
export const DEFAULT_WIDTH = 1024;
export const DEFAULT_HEIGHT = 1024;

// Model-specific parameters (automatically applied based on model selection)
export const MODEL_SETTINGS = {
  DISTILLED: {
    steps: 4,
    cfg: 1.0
  },
  BASE: {
    steps: 20,
    cfg: 5
  }
};

// Model options
export const MODELS = {
  DISTILLED: 'flux-2-klein-4b.safetensors',
  BASE: 'flux-2-klein-base-4b.safetensors'
};

// Workflow node IDs (API format uses subgraph prefixes)
export const NODE_IDS = {
  PROMPT: '76',
  NEGATIVE_PROMPT: '75:67',  // CLIPTextEncode (Negative Prompt)
  WIDTH: '75:68',
  HEIGHT: '75:69',
  SEED: '75:73',
  UNET_LOADER: '75:70',
  SCHEDULER: '75:62',  // Flux2Scheduler (steps)
  CFG_GUIDER: '75:63'  // CFGGuider (cfg)
};

// ── Medium Format Studio ──────────────────────────────────────────────

// Pipeline stage → node ID mapping
// Stage 1: Negative & Filtration — load model, apply LoRA stack, encode negative prompt
// Stage 2: Subject, Style & Format — encode positive prompt, set film format
// Stage 3: Develop & Contact Print — initial 6-step diffusion → decoded contact print
// Stage 4: Work Print — latent upscale (1.5x) + 4-step 2nd pass + sharpen
// Stage 5: Scan / Digital C-Print — SeedVR2 AI upscale + sharpen
export const MFS_STAGES = {
  1: ['30', '18', '11', '12', '7'],
  2: ['13', '19', '55'],
  3: ['16', '10', '2', '3', '1', '6', '4', '5', '17'],
  4: ['46', '52', '36', '50', '53', '39', '43', '38', '37', '47', '74', '48'],
  5: ['80', '77', '76', '78', '79', '60', '61', '62', '75', '63'],
};

// Nodes always excluded from API submission (UI-only or disconnected)
export const MFS_EXCLUDED_NODES = ['71', '54'];

// SaveImage node IDs for each output stage
export const MFS_OUTPUT_NODES = {
  contact: '17',
  work: '48',
  final: '63',
};

// Node ID → human-readable stage name (for progress display)
export const MFS_NODE_STAGE_NAMES = {};
Object.entries(MFS_STAGES).forEach(([stage, nodes]) => {
  const names = {
    1: 'Negative & Filtration',
    2: 'Subject, Style & Format',
    3: 'Develop & Contact Print',
    4: 'Work Print',
    5: 'Scan / Digital C-Print',
  };
  nodes.forEach((id) => {
    MFS_NODE_STAGE_NAMES[id] = `Stage ${stage}: ${names[stage]}`;
  });
});

// MFS workflow node IDs for parameter injection
export const MFS_NODE_IDS = {
  POSITIVE_PROMPT: '13',      // CLIPTextEncode "We see..."
  NEGATIVE_PROMPT: '7',       // CLIPTextEncode "We don't see..."
  FILM_FORMAT: '19',          // EmptyLatentImageCustomPresets
  SEED: '16',                 // Seed (rgthree)
  LORA_STACK: '18',           // Power Lora Loader (rgthree)
  UPSCALE_FACTOR: '52',       // PrimitiveFloat
  BATCH_SIZE: '55',           // PrimitiveInt
};

// Film format presets — must match the exact string format "Label - WxH"
// used by EmptyLatentImageCustomPresets node.
// Source: /Users/gsmith/Documents/comfy/ComfyUI/custom_nodes/comfyui-kjnodes/custom_dimensions.json
export const MFS_FILM_FORMATS = [
  { label: '6x7', value: '6x7 - 1120x928' },
  { label: '6x6', value: '6x6 - 1024x1024' },
  { label: '645', value: '645 - 1184x864' },
  { label: '6x9', value: '6x9 - 1216x832' },
  { label: '6x17', value: '6x17 - 1600x576' },
  { label: 'Cinemascope', value: 'Cinemascope - 1536x640' },
  { label: 'Cinemascope2K', value: 'Cinemascope2K - 2048x864' },
];

export const MFS_DEFAULT_FILM_FORMAT = 'Cinemascope - 1536x640';

// LoRA defaults (from the workflow template)
export const MFS_LORA_DEFAULTS = {
  lora1: {
    name: 'Detail',
    filename: 'FluxKlein/detail_slider_klein_9b_20260123_065513.safetensors',
    defaultStrength: 7,
    defaultEnabled: true,
  },
  lora2: {
    name: 'Chiaroscuro',
    filename: 'FluxKlein/klein_slider_chiaroscuro.safetensors',
    defaultStrength: 0.8,
    defaultEnabled: true,
  },
};
