import {
  MFS_STAGES,
  MFS_EXCLUDED_NODES,
  MFS_NODE_IDS,
} from '../utils/constants';

let cachedWorkflow = null;

/**
 * Load the Medium Format Studio workflow template from public/
 * Caches after first fetch.
 */
export async function loadMFSWorkflow() {
  if (cachedWorkflow) return cachedWorkflow;
  const response = await fetch('/medium_format_studio_api.json');
  if (!response.ok) {
    throw new Error(`Failed to load MFS workflow: ${response.status}`);
  }
  cachedWorkflow = await response.json();
  return cachedWorkflow;
}

/**
 * Determine which stages to include for a given target.
 *   contact → stages 1-3
 *   work    → stages 1-4
 *   final   → stages 1-5
 */
function stagesForTarget(target) {
  switch (target) {
    case 'contact': return [1, 2, 3];
    case 'work':    return [1, 2, 3, 4];
    case 'final':   return [1, 2, 3, 4, 5];
    default: throw new Error(`Unknown target: ${target}`);
  }
}

/**
 * Build a filtered workflow for the given target stage.
 *
 * @param {Object} fullWorkflow - The complete MFS workflow template
 * @param {'contact'|'work'|'final'} target - Which stage to build up to
 * @param {boolean} skipWorkPrint - If true and target==='final', omit stage 4
 *   and rewire stage 5 inputs from node 74 (sharpened work print) to node 5
 *   (contact print VAE decode)
 * @param {Object} params - User parameters to inject
 * @param {string} params.prompt
 * @param {string} params.negativePrompt
 * @param {string} params.filmFormat - Exact preset string e.g. "6x7 - 1120x928"
 * @param {number} params.seed
 * @param {boolean} params.lora1Enabled
 * @param {number} params.lora1Strength
 * @param {boolean} params.lora2Enabled
 * @param {number} params.lora2Strength
 * @param {string} [params.lora1Filename] - Resolved LoRA 1 filename
 * @param {string} [params.lora2Filename] - Resolved LoRA 2 filename
 * @param {number} params.upscaleFactor
 * @param {string} params.model - Model filename (e.g. 'flux-2-klein-9b-Q8_0.gguf')
 * @returns {Object} Filtered and parameterized workflow ready for /prompt
 */
export function buildWorkflowForTarget(fullWorkflow, target, skipWorkPrint, params) {
  // 1. Determine included stages
  let stages = stagesForTarget(target);
  if (target === 'final' && skipWorkPrint) {
    stages = stages.filter((s) => s !== 4);
  }

  // 2. Collect included node IDs
  const includedNodes = new Set();
  stages.forEach((s) => {
    MFS_STAGES[s].forEach((id) => includedNodes.add(id));
  });

  // 3. Remove excluded nodes
  MFS_EXCLUDED_NODES.forEach((id) => includedNodes.delete(id));

  // 4. Deep clone only included nodes
  const workflow = {};
  for (const nodeId of includedNodes) {
    if (fullWorkflow[nodeId]) {
      workflow[nodeId] = JSON.parse(JSON.stringify(fullWorkflow[nodeId]));
    }
  }

  // 5. Rewire if skipping work print: nodes 80 and 62 read from node 5
  //    instead of node 74 (which won't exist)
  if (target === 'final' && skipWorkPrint) {
    // Node 52 (upscale factor) lives in stage 4 but stage 5 nodes 76/77
    // reference it for resolution math — include it even when skipping stage 4
    if (fullWorkflow['52']) {
      workflow['52'] = JSON.parse(JSON.stringify(fullWorkflow['52']));
    }
    // Node 80 (GetImageSize+): image input → node 5 output 0
    if (workflow['80']) {
      workflow['80'].inputs.image = ['5', 0];
    }
    // Node 62 (SeedVR2VideoUpscaler): image input → node 5 output 0
    if (workflow['62']) {
      workflow['62'].inputs.image = ['5', 0];
    }
    // Keep node 75 (ImageSharpen) — contact print wasn't sharpened,
    // so Stage 5 needs its own sharpening pass.
  }

  // 5b. Conditional sharpening: when Stage 4 was executed (not skipped),
  //     the image is already sharpened by node 74. Bypass node 75 in Stage 5
  //     to avoid double-sharpening.
  if (target === 'final' && !skipWorkPrint) {
    if (workflow['63']) {
      workflow['63'].inputs.images = ['62', 0];
    }
    delete workflow['75'];
  }

  // 6. Apply user parameters
  applyParams(workflow, params);

  return workflow;
}

/**
 * Inject user parameters into the workflow nodes.
 */
function applyParams(workflow, params) {
  if (!params) return;

  // Positive prompt (node 13) — append film borders text if enabled
  if (params.prompt !== undefined && workflow[MFS_NODE_IDS.POSITIVE_PROMPT]) {
    let promptText = params.prompt;
    if (params.filmBorders) {
      promptText += ' Slightly rough, un-even black border as from an unfiled negative carrier with film edge-markings.';
    }
    if (params.bw) {
	promptText += ' The image is monochrome, black and white, as if shot with Kodak Tri-X, Ilford HP5, or another panchromatic film from the 20th century. Ignore earlier mentions of color, the image is devoid of color, however with enhanced and deepened contrast.';
    }
    workflow[MFS_NODE_IDS.POSITIVE_PROMPT].inputs.text = promptText;
  }

  // Negative prompt (node 7)
  if (params.negativePrompt !== undefined && workflow[MFS_NODE_IDS.NEGATIVE_PROMPT]) {
    workflow[MFS_NODE_IDS.NEGATIVE_PROMPT].inputs.text = params.negativePrompt;
  }

  // Film format (node 19) + portrait mode (invert dimensions)
  if (params.filmFormat !== undefined && workflow[MFS_NODE_IDS.FILM_FORMAT]) {
    workflow[MFS_NODE_IDS.FILM_FORMAT].inputs.dimensions = params.filmFormat;
    workflow[MFS_NODE_IDS.FILM_FORMAT].inputs.invert = !!params.portrait;
  }

  // Seed (node 16)
  if (params.seed !== undefined && workflow[MFS_NODE_IDS.SEED]) {
    workflow[MFS_NODE_IDS.SEED].inputs.seed = params.seed;
  }

  // LoRA stack (node 18)
  if (workflow[MFS_NODE_IDS.LORA_STACK]) {
    const lora = workflow[MFS_NODE_IDS.LORA_STACK].inputs;
    if (params.lora1Enabled !== undefined) {
      lora.lora_1 = { ...lora.lora_1, on: params.lora1Enabled };
    }
    if (params.lora1Strength !== undefined) {
      lora.lora_1 = { ...lora.lora_1, strength: params.lora1Strength };
    }
    if (params.lora2Enabled !== undefined) {
      lora.lora_2 = { ...lora.lora_2, on: params.lora2Enabled };
    }
    if (params.lora2Strength !== undefined) {
      lora.lora_2 = { ...lora.lora_2, strength: params.lora2Strength };
    }
    if (params.lora1Filename) {
      lora.lora_1 = { ...lora.lora_1, lora: params.lora1Filename };
    }
    if (params.lora2Filename) {
      lora.lora_2 = { ...lora.lora_2, lora: params.lora2Filename };
    }
  }

  // Upscale factor (node 52)
  if (params.upscaleFactor !== undefined && workflow[MFS_NODE_IDS.UPSCALE_FACTOR]) {
    workflow[MFS_NODE_IDS.UPSCALE_FACTOR].inputs.value = params.upscaleFactor;
  }

  // SeedVR2 device injection (nodes 60, 61, 62)
  // Template has "mps" baked in from Mac export; override for CUDA servers
  if (params.computeDevice && params.computeDevice.startsWith('cuda')) {
    const dev = params.computeDevice;
    if (workflow[MFS_NODE_IDS.SEEDVR2_DIT]) {
      workflow[MFS_NODE_IDS.SEEDVR2_DIT].inputs.device = dev;
      workflow[MFS_NODE_IDS.SEEDVR2_DIT].inputs.offload_device = 'cpu';
      // Swap 20 of ~36 transformer blocks to CPU during inference.
      // Keeps ~7GB of DiT in VRAM, leaving room for ComfyUI's cached models.
      workflow[MFS_NODE_IDS.SEEDVR2_DIT].inputs.blocks_to_swap = 30;
    }
    if (workflow[MFS_NODE_IDS.SEEDVR2_VAE]) {
      workflow[MFS_NODE_IDS.SEEDVR2_VAE].inputs.device = dev;
    }
    if (workflow[MFS_NODE_IDS.SEEDVR2_UPSCALER]) {
      workflow[MFS_NODE_IDS.SEEDVR2_UPSCALER].inputs.offload_device = 'cpu';
    }
  }

  // Model selection (node 30) — swap loader class_type for GGUF models
  if (params.model && workflow[MFS_NODE_IDS.UNET_LOADER]) {
    const node = workflow[MFS_NODE_IDS.UNET_LOADER];
    const isGGUF = params.model.toLowerCase().endsWith('.gguf');
    if (isGGUF) {
      node.class_type = 'UnetLoaderGGUF';
      node.inputs.unet_name = params.model;
      delete node.inputs.weight_dtype;
    } else {
      node.class_type = 'UNETLoader';
      node.inputs.unet_name = params.model;
    }
  }
}

/**
 * Generate a random seed for MFS (large integer range).
 */
export function generateRandomSeed() {
  return Math.floor(Math.random() * 1_000_000_000_000_000);
}
