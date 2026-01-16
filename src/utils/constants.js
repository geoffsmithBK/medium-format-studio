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
