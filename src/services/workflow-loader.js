import { NODE_IDS } from '../utils/constants';

/**
 * Load workflow JSON from public folder
 * @returns {Promise<Object>} Workflow JSON object
 */
export async function loadWorkflow() {
  try {
    // Use API format workflow (not frontend format)
    const response = await fetch('/image_flux2_klein_text_to_image_api.json');
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const workflow = await response.json();
    return workflow;
  } catch (error) {
    console.error('Error loading workflow:', error);
    throw new Error(`Failed to load workflow: ${error.message}`);
  }
}

/**
 * Deep clone a workflow object to avoid mutating the original
 * @param {Object} workflow - Workflow to clone
 * @returns {Object} Cloned workflow
 */
function cloneWorkflow(workflow) {
  return JSON.parse(JSON.stringify(workflow));
}

/**
 * Update the prompt text in the workflow
 * @param {Object} workflow - Workflow object
 * @param {string} promptText - New prompt text
 * @returns {Object} Updated workflow (new instance)
 */
export function updatePrompt(workflow, promptText) {
  const updated = cloneWorkflow(workflow);
  const node = updated[NODE_IDS.PROMPT];

  if (node && node.inputs) {
    node.inputs.value = promptText;
  }

  return updated;
}

/**
 * Update the negative prompt text in the workflow
 * @param {Object} workflow - Workflow object
 * @param {string} negativePromptText - New negative prompt text
 * @returns {Object} Updated workflow (new instance)
 */
export function updateNegativePrompt(workflow, negativePromptText) {
  const updated = cloneWorkflow(workflow);
  const node = updated[NODE_IDS.NEGATIVE_PROMPT];

  if (node && node.inputs) {
    node.inputs.text = negativePromptText;
  }

  return updated;
}

/**
 * Update image dimensions in the workflow
 * @param {Object} workflow - Workflow object
 * @param {number} width - Image width
 * @param {number} height - Image height
 * @returns {Object} Updated workflow (new instance)
 */
export function updateDimensions(workflow, width, height) {
  const updated = cloneWorkflow(workflow);

  // Update width node
  const widthNode = updated[NODE_IDS.WIDTH];
  if (widthNode && widthNode.inputs) {
    widthNode.inputs.value = width;
  }

  // Update height node
  const heightNode = updated[NODE_IDS.HEIGHT];
  if (heightNode && heightNode.inputs) {
    heightNode.inputs.value = height;
  }

  return updated;
}

/**
 * Update the random seed in the workflow
 * @param {Object} workflow - Workflow object
 * @param {number} seed - New seed value
 * @returns {Object} Updated workflow (new instance)
 */
export function updateSeed(workflow, seed) {
  const updated = cloneWorkflow(workflow);
  const node = updated[NODE_IDS.SEED];

  if (node && node.inputs) {
    node.inputs.noise_seed = seed;
  }

  return updated;
}

/**
 * Update the model name in the workflow
 * @param {Object} workflow - Workflow object
 * @param {string} modelName - New model filename
 * @returns {Object} Updated workflow (new instance)
 */
export function updateModel(workflow, modelName) {
  const updated = cloneWorkflow(workflow);
  const node = updated[NODE_IDS.UNET_LOADER];

  if (node && node.inputs) {
    node.inputs.unet_name = modelName;
  }

  return updated;
}

/**
 * Update the scheduler steps in the workflow
 * @param {Object} workflow - Workflow object
 * @param {number} steps - Number of steps
 * @returns {Object} Updated workflow (new instance)
 */
export function updateSteps(workflow, steps) {
  const updated = cloneWorkflow(workflow);
  const node = updated[NODE_IDS.SCHEDULER];

  if (node && node.inputs) {
    node.inputs.steps = steps;
  }

  return updated;
}

/**
 * Update the CFG scale in the workflow
 * @param {Object} workflow - Workflow object
 * @param {number} cfg - CFG scale value
 * @returns {Object} Updated workflow (new instance)
 */
export function updateCFG(workflow, cfg) {
  const updated = cloneWorkflow(workflow);
  const node = updated[NODE_IDS.CFG_GUIDER];

  if (node && node.inputs) {
    node.inputs.cfg = cfg;
  }

  return updated;
}

/**
 * Generate a random seed value
 * @returns {number} Random seed (positive integer)
 */
export function generateRandomSeed() {
  return Math.floor(Math.random() * 1000000000);
}

/**
 * Update all workflow parameters at once
 * @param {Object} workflow - Base workflow object
 * @param {Object} params - Parameters to update
 * @param {string} params.prompt - Prompt text
 * @param {string} params.negativePrompt - Negative prompt text
 * @param {number} params.width - Image width
 * @param {number} params.height - Image height
 * @param {number} params.seed - Random seed
 * @param {string} params.model - Model filename
 * @param {number} params.steps - Scheduler steps
 * @param {number} params.cfg - CFG scale
 * @returns {Object} Updated workflow (new instance)
 */
export function updateWorkflow(workflow, params) {
  let updated = workflow;

  if (params.prompt !== undefined) {
    updated = updatePrompt(updated, params.prompt);
  }

  if (params.negativePrompt !== undefined) {
    updated = updateNegativePrompt(updated, params.negativePrompt);
  }

  if (params.width !== undefined || params.height !== undefined) {
    updated = updateDimensions(
      updated,
      params.width ?? 1024,
      params.height ?? 1024
    );
  }

  if (params.seed !== undefined) {
    updated = updateSeed(updated, params.seed);
  }

  if (params.model !== undefined) {
    updated = updateModel(updated, params.model);
  }

  if (params.steps !== undefined) {
    updated = updateSteps(updated, params.steps);
  }

  if (params.cfg !== undefined) {
    updated = updateCFG(updated, params.cfg);
  }

  return updated;
}
