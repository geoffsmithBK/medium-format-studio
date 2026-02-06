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
 * @param {number} params.upscaleFactor
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
    // Node 80 (GetImageSize+): image input → node 5 output 0
    if (workflow['80']) {
      workflow['80'].inputs.image = ['5', 0];
    }
    // Node 62 (SeedVR2VideoUpscaler): image input → node 5 output 0
    if (workflow['62']) {
      workflow['62'].inputs.image = ['5', 0];
    }
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

  // Positive prompt (node 13)
  if (params.prompt !== undefined && workflow[MFS_NODE_IDS.POSITIVE_PROMPT]) {
    workflow[MFS_NODE_IDS.POSITIVE_PROMPT].inputs.text = params.prompt;
  }

  // Negative prompt (node 7)
  if (params.negativePrompt !== undefined && workflow[MFS_NODE_IDS.NEGATIVE_PROMPT]) {
    workflow[MFS_NODE_IDS.NEGATIVE_PROMPT].inputs.text = params.negativePrompt;
  }

  // Film format (node 19)
  if (params.filmFormat !== undefined && workflow[MFS_NODE_IDS.FILM_FORMAT]) {
    workflow[MFS_NODE_IDS.FILM_FORMAT].inputs.dimensions = params.filmFormat;
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
  }

  // Upscale factor (node 52)
  if (params.upscaleFactor !== undefined && workflow[MFS_NODE_IDS.UPSCALE_FACTOR]) {
    workflow[MFS_NODE_IDS.UPSCALE_FACTOR].inputs.value = params.upscaleFactor;
  }
}

/**
 * Generate a random seed for MFS (large integer range).
 */
export function generateRandomSeed() {
  return Math.floor(Math.random() * 1_000_000_000_000_000);
}
