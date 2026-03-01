# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This project creates a web-based user interface for AI image generation, built with React and Vite. It currently uses ComfyUI as its inference backend (`http://127.0.0.1:8188`), with planned support for Draw Things as an alternate backend for optimized Apple Silicon inference.

> **Architecture decisions and platform strategy** are documented in [`ARCHITECTURE.md`](./ARCHITECTURE.md). Key decision (Feb 2026): stay web + ComfyUI, exploit ComfyUI's API for dynamic model lists and filesystem browsing, consider Tauri wrapper if/when native capabilities are needed.

### Active Workflow: Medium Format Studio

The application now uses the **Medium Format Studio** (MFS) workflow — a multi-stage darkroom-metaphor pipeline for Flux.2 Klein 9B image generation. This replaces the original single-pass `TextToImage` workflow (which remains in the codebase but is no longer imported by `App.jsx`).

## Backend Architecture (Current & Planned)

### Current: ComfyUI Backend
- REST API at `http://127.0.0.1:8188` (POST /prompt, GET /history, GET /view)
- WebSocket at `ws://127.0.0.1:8188/ws` for real-time progress
- Workflow-based: loads a JSON workflow template, injects parameters, queues for execution
- Runs on any platform; uses CUDA on NVIDIA GPUs, MPS fallback on Apple Silicon

### Planned: Draw Things Backend
- REST API at `http://localhost:7860` (SD WebUI-compatible: POST /sdapi/v1/txt2img, GET /)
- Draw Things is a macOS/iOS app with Metal FlashAttention, providing significantly faster diffusion inference on Apple Silicon compared to PyTorch MPS (which ComfyUI uses)
- Apple Silicon Macs lack support for key CUDA-only optimizations (FlashAttention, SageAttention, Triton) -- Draw Things' native Metal implementation fills this gap
- Synchronous request-response (no WebSocket progress) -- images returned as base64 in JSON
- Model/sampler selection done through Draw Things GUI; API uses current app settings
- The goal is a backend abstraction layer so the same web UI can target either ComfyUI (on CUDA machines or remote servers) or Draw Things (for optimized local Apple Silicon inference)

### Performance Context: Apple Silicon Inference
- PyTorch MPS (used by ComfyUI on Mac) lacks FlashAttention, SageAttention, and Triton -- all CUDA-only
- Draw Things uses Metal FlashAttention (community implementation by Philip Turner / Draw Things team), providing substantial speedups over PyTorch MPS for attention-heavy diffusion models
- Metal FlashAttention v2.5 (Nov 2025) also leverages Apple Neural Engine on M5 chips
- MLX is another Apple-native option but requires leaving the PyTorch ecosystem entirely
- For this project, Draw Things is the pragmatic choice: it runs as a local app with an HTTP API, uses optimized Metal kernels, and supports Flux 2 Klein models

## Medium Format Studio Workflow Architecture

The MFS workflow is a 5-stage pipeline using the Flux.2 Klein 9B model. It uses a darkroom metaphor where images progress through increasingly refined stages, with ComfyUI's execution caching ensuring that earlier stages are not re-computed when promoting to later stages.

### Workflow File
- **Template**: `public/medium_format_studio_api.json` (API format)
- **Source**: Exported from ComfyUI's "Medium Format Film Studio" workflow

### Models Used
- **Diffusion Model**: `flux-2-klein-9b.safetensors` (9B parameter model)
- **Text Encoder**: `qwen_3_8b_fp8mixed.safetensors`
- **VAE**: `flux2-vae.safetensors`
- **AI Upscaler**: `seedvr2_ema_7b_sharp_fp16.safetensors` (SeedVR2 7B)
- **LoRA 1 (Detail)**: `FluxKlein/detail_slider_klein_9b_20260123_065513.safetensors`
- **LoRA 2 (Chiaroscuro)**: `FluxKlein/klein_slider_chiaroscuro.safetensors`

### Pipeline Stages

| # | Stage Name | What It Does | Key Nodes | SaveImage Node |
|---|-----------|-------------|-----------|---------------|
| 1 | Negative & Filtration | Load 9B model, apply LoRA stack, encode negative prompt | 30, 18, 11, 12, 7 | — |
| 2 | Subject, Style & Format | Encode positive prompt, set film format/aspect ratio | 13, 19, 55 | — |
| 3 | Develop & Contact Print | Initial 6-step diffusion → decoded "contact print" | 16, 10, 2, 3, 1, 6, 4, 5, 17 | **17** |
| 4 | Work Print | Latent upscale (1.5x) + 4-step 2nd pass + sharpen | 46, 52, 36, 50, 53, 39, 43, 38, 37, 47, 74, 48 | **48** |
| 5 | Scan / Digital C-Print | SeedVR2 AI upscale + sharpen | 80, 77, 76, 78, 79, 60, 61, 62, 75, 63 | **63** |

**Excluded nodes**: 71 (Image Comparer — UI-only), 54 (disconnected ImageFromBatch)

### Progressive Execution & Caching

The key design principle is progressive execution leveraging ComfyUI's node caching:

1. **Contact Print** (stages 1-3): Quick 6-step generation for evaluation
2. **Promote to Work Print** (stages 1-4): ComfyUI caches stages 1-3, only runs stage 4
3. **Promote to Final Print** (stages 1-5): ComfyUI caches everything already computed

**Skip Work Print**: When promoting directly from contact to final, stage 4 nodes are omitted and stage 5 inputs (nodes 80, 62) are rewired from node 74 (sharpened work print) to node 5 (contact print VAE decode).

### MFS Parameter Injection

| Parameter | Node ID | Field | Description |
|-----------|---------|-------|-------------|
| Positive Prompt | 13 | `inputs.text` | CLIPTextEncode "We see..." |
| Negative Prompt | 7 | `inputs.text` | CLIPTextEncode "We don't see..." |
| Film Format | 19 | `inputs.dimensions` | EmptyLatentImageCustomPresets preset string |
| Seed | 16 | `inputs.seed` | Seed (rgthree) |
| LoRA 1 on/strength | 18 | `inputs.lora_1.on/.strength` | Power Lora Loader (rgthree) |
| LoRA 2 on/strength | 18 | `inputs.lora_2.on/.strength` | Power Lora Loader (rgthree) |
| Upscale Factor | 52 | `inputs.value` | PrimitiveFloat (shared between stages 4 & 5) |

### Film Format Presets

The presets match the `EmptyLatentImageCustomPresets` node and must use the exact string format `"Label - WxH"`:

| Label | Dimensions |
|-------|-----------|
| 6x7 | 1120x928 |
| 6x6 | 1024x1024 |
| 645 | 1184x864 |
| 6x9 | 1216x832 |
| 6x17 | 1600x576 |
| Cinemascope | 1536x640 |
| Cinemascope2K | 2048x864 |

Source file: `/Users/gsmith/Documents/comfy/ComfyUI/custom_nodes/comfyui-kjnodes/custom_dimensions.json`

### State Machine

```
idle → generating_contact → contact_ready
                              ↓                ↓
                   generating_work    generating_final
                              ↓                ↓
                        work_ready       final_ready
                              ↓
                   generating_final
                              ↓
                        final_ready
```

Parameters are locked (form controls disabled) whenever `pipelineState !== 'idle'` to preserve ComfyUI cache validity. "New Exposure" resets to idle with a fresh seed.

## Legacy: TextToImage Workflow

The original single-pass TextToImage workflow is preserved in the codebase (`src/workflows/TextToImage.jsx`) but is no longer imported by `App.jsx`. It used the simpler `image_flux2_klein_text_to_image_api.json` workflow with the 4B model.

### Legacy Workflow File Formats
ComfyUI has two different workflow formats:

1. **Frontend/UI Format** (`image_flux2_klein_text_to_image.json`): Contains UI elements like node positions, links, groups. Used by the ComfyUI web interface.

2. **API Format** (`image_flux2_klein_text_to_image_api.json`): Simplified format for API execution. Contains only node IDs, class types, and inputs.

The web UI requires the API format. To export:
- In ComfyUI, enable "Dev mode" in settings → Click "Save (API Format)"
- Or use browser console: `copy(JSON.stringify(await app.graphToPrompt(), null, 2))`

## ComfyUI API Integration

When building the web UI, you'll need to interact with the ComfyUI API at `http://127.0.0.1:8188`:

### Core API Endpoints
- **POST /prompt**: Queue a workflow for execution
- **GET /history**: Retrieve completed workflow results
- **GET /view**: Retrieve generated images
- **WebSocket /ws**: Real-time progress updates during generation

### Workflow Execution Flow
1. Load the workflow JSON structure
2. Update input parameters (prompt, dimensions, seed, model selection)
3. Submit via POST to `/prompt` endpoint
4. Monitor progress via WebSocket
5. Retrieve results from `/history` and `/view` endpoints

## Development Notes

### Reference UI
The `comfy_webui_text-to-image.png` screenshot shows the target UI design. The interface provides:
- Text input field for prompts
- Optional negative prompt (checkbox-enabled)
- Image dimension controls
- Model selection (base vs distilled)
- Generation trigger button
- Image display area
- Progress indicators

### Model Configuration
Always reference `flux-2-klein-4b.safetensors` (distilled version) as the default model, not the base version. The distilled model is faster (4 steps vs 20 steps) and produces comparable quality.

### Workflow Node Types
Understanding these ComfyUI node types is essential:
- **UNETLoader**: Loads diffusion models
- **CLIPLoader**: Loads text encoders for prompt processing
- **VAELoader**: Loads VAE for latent decoding
- **CLIPTextEncode**: Converts text prompts to embeddings
- **KSamplerSelect**: Selects sampling algorithm
- **Flux2Scheduler**: Configures sampling schedule
- **CFGGuider**: Controls classifier-free guidance
- **RandomNoise**: Generates noise for diffusion process
- **EmptyFlux2LatentImage**: Creates empty latent space
- **SamplerCustomAdvanced**: Executes the sampling process
- **VAEDecode**: Converts latents to images
- **SaveImage**: Saves generated images

## Implementation Details

### Technology Stack
The web UI is built with:
- **React 18** - Component-based UI framework
- **Vite** - Fast build tool and dev server
- **CSS Modules** - Component-scoped styling with dark theme

### Project Structure
```
src/
├── components/                # Reusable UI components
│   ├── PromptInput.jsx        # Multiline prompt text input
│   ├── ImageDisplay.jsx       # Image display with inline zoom + fullscreen
│   ├── FullscreenViewer.jsx   # Shared fullscreen overlay with zoom/pan
│   ├── ProgressBar.jsx        # Real-time progress indicator
│   ├── CacheWarningDot.jsx    # Orange dot for changed cache-breaking params
│   ├── ContactSheet.jsx       # Thumbnail grid for gallery tab
│   ├── MetadataPanel.jsx      # Sidebar metadata display for gallery
│   ├── SidebarSection.jsx     # Collapsible sidebar section with stage badge (MFS)
│   ├── FilmFormatSelect.jsx   # Film format preset dropdown (MFS)
│   ├── LoRAControls.jsx       # LoRA toggle + strength controls (MFS)
│   ├── StageTabs.jsx          # Data-driven tab strip (MFS)
│   ├── NegativePromptInput.jsx # Optional negative prompt with checkbox (legacy)
│   ├── ParameterControls.jsx  # Dimension, seed, and model controls (legacy)
│   └── ImageDropZone.jsx      # Drag-drop PNG metadata loader (legacy)
├── workflows/                 # Workflow-specific components
│   ├── MediumFormatStudio.jsx # Active: 5-stage darkroom workflow + gallery
│   └── TextToImage.jsx        # Legacy: single-pass text-to-image
├── services/
│   ├── comfyui-api.js         # ComfyUI API client with WebSocket
│   ├── mfs-workflow-builder.js # MFS stage-aware workflow assembly
│   ├── gallery-service.js     # Gallery: ComfyUI /history + local folder loading
│   └── workflow-loader.js     # Legacy workflow JSON manipulation
├── utils/
│   ├── constants.js           # API URLs, node IDs, MFS stage mappings
│   └── png-parser.js          # PNG metadata extraction (+ exported extractor)
├── App.jsx                    # Root component (renders MediumFormatStudio)
├── App.css                    # Global dark theme styles
└── main.jsx                   # React entry point
```

### MFS Workflow Builder Service (`services/mfs-workflow-builder.js`)

The MFS workflow builder handles stage-aware workflow assembly:

- `loadMFSWorkflow()` - Load and cache the MFS template from `public/`
- `buildWorkflowForTarget(fullWorkflow, target, skipWorkPrint, params)` - Build a filtered workflow
  - `target`: `'contact'` | `'work'` | `'final'` — determines which stages to include
  - `skipWorkPrint`: if true and target=final, omits stage 4 and rewires stage 5 inputs
  - `params`: user parameters to inject (prompt, seed, film format, LoRA settings, etc.)
- `generateRandomSeed()` - Generate random seed (large integer range)

The builder deep-clones only the included nodes from the template, handles rewiring for skip-work-print mode, and injects user parameters into the appropriate nodes.

### Legacy Workflow Parameter Updates (TextToImage)

The legacy TextToImage workflow modifies nodes with `75:` subgraph prefix. See `services/workflow-loader.js` for details.

### API Service (`services/comfyui-api.js`)
The ComfyUI API service provides:
- `generateClientId()` - Create unique WebSocket client ID
- `queuePrompt(workflow, clientId)` - Queue workflow for execution
- `getHistory(promptId)` - Fetch execution results
- `getImageUrl(filename, subfolder, type)` - Construct image URL
- `connectWebSocket(clientId, callbacks)` - WebSocket connection for progress
- `checkServerStatus()` - Verify ComfyUI server is running

WebSocket callbacks handle:
- `onProgress(value, max)` - Progress updates during generation
- `onExecuting(node, promptId)` - Current executing node
- `onExecuted(data)` - Node execution complete
- `onCached(data)` - Nodes served from ComfyUI cache (used by MFS for stage-aware status)
- `onError(error)` - Connection errors
- `onClose()` - Connection closed

### Workflow Loader (`services/workflow-loader.js`)
Utilities for manipulating workflow JSON:
- `loadWorkflow()` - Load workflow from public folder
- `updatePrompt(workflow, promptText)` - Update prompt in node 76
- `updateNegativePrompt(workflow, negativePromptText)` - Update negative prompt in node 75:67
- `updateDimensions(workflow, width, height)` - Update nodes 75:68, 75:69
- `updateSeed(workflow, seed)` - Update node 75:73
- `updateModel(workflow, modelName)` - Update node 75:70
- `updateSteps(workflow, steps)` - Update node 75:62 (scheduler steps)
- `updateCFG(workflow, cfg)` - Update node 75:63 (CFG scale)
- `updateWorkflow(workflow, params)` - Update all parameters at once
- `generateRandomSeed()` - Generate random seed value

### Component Architecture

**Shared components** (used by MFS and potentially other workflows):
- **PromptInput** - Multiline text input for prompts
- **ImageDisplay** - Image viewer with inline zoom (small/large detection), download button, opens FullscreenViewer
- **FullscreenViewer** - Standalone fullscreen overlay with 3-level zoom (fit/native/200%) and pan
- **ProgressBar** - Real-time progress indicator

**Gallery components** (used by the Contact Sheet tab):
- **ContactSheet** - CSS Grid thumbnail layout; click to select, double-click to open fullscreen
- **MetadataPanel** - Sidebar showing preview, prompt (with copy), parameter grid (seed, model, dims, steps, CFG), filename, and "Send to Contact Print" button

**MFS-specific components**:
- **SidebarSection** - Collapsible section with stage number badge and disabled state
- **FilmFormatSelect** - Dropdown for medium-format film format presets
- **LoRAControls** - Two LoRA rows with checkbox toggle + strength input
- **StageTabs** - Data-driven tab strip; accepts `tabs` prop (default: 3 generation tabs); tab objects support optional `className` for separator styling
- **MediumFormatStudio** - Main workflow component with pipeline state machine + gallery integration

**Legacy components** (kept in repo, not currently imported):
- **TextToImage** - Original single-pass workflow
- **NegativePromptInput** - Checkbox-toggled negative prompt
- **ParameterControls** - Dimensions, seed, model, steps, CFG controls
- **ImageDropZone** - Drag-and-drop PNG metadata loader

### Development Commands
```bash
npm install        # Install dependencies
npm run dev        # Start development server (http://127.0.0.1:5173)
npm run build      # Build for production
npm run preview    # Preview production build
```

### Server Management

**Starting the Servers**

You need **two separate terminal windows/tabs**:

**Terminal 1 - ComfyUI Backend:**
```bash
cd /Users/gsmith/work/ComfyUI
python main.py --enable-cors-header
```

**Terminal 2 - Web UI Frontend:**
```bash
cd /Users/gsmith/work/comfy-webui
npm run dev
```

Then access the web UI at: `http://127.0.0.1:5173/`

**Restarting the Vite Dev Server**

Proper method (graceful):
1. In the terminal running Vite, press `Ctrl+C` to stop
2. Wait for clean shutdown (usually instant)
3. Run `npm run dev` again

Why this is better than background restarts:
- Clean shutdown prevents resource leaks
- No risk of port conflicts
- No exit code 137 errors from forced kills
- You can see startup logs and errors immediately

**Shutting Down**

Graceful shutdown (recommended):
- Press `Ctrl+C` in each terminal running the servers
- This sends SIGINT, allowing clean shutdown

Force shutdown (if frozen):
- `Ctrl+C` then `Ctrl+\` (SIGQUIT)
- Or manually: `kill <pid>` (not `kill -9` unless necessary)

**Finding and Killing Processes (if needed)**

If you need to find and kill a stuck process:
```bash
# Find Vite process
lsof -i :5173

# Kill gracefully (preferred)
kill <pid>

# Force kill only if necessary (exit code 137)
kill -9 <pid>
```

**Important Notes:**
- **Don't use background processes** for dev servers - keep them in foreground terminals
- Exit code 137 means a process was killed with SIGKILL (kill -9 or OOM killer)
- Always prefer graceful shutdown with `Ctrl+C` over forced termination
- Keep servers in separate, visible terminals to monitor logs and errors

### Quick Start
To run the application:

1. **Start ComfyUI** with CORS enabled:
   ```bash
   cd /Users/gsmith/work/ComfyUI
   python main.py --enable-cors-header
   ```

2. **Start the web UI** (in a new terminal):
   ```bash
   cd /Users/gsmith/work/comfy-webui
   npm run dev
   ```

3. **Open browser** to http://127.0.0.1:5173/

4. **Generate images** (Medium Format Studio):
   - Enter a prompt in Stage 2 (Subject, Style & Format)
   - Optionally adjust LoRAs in Stage 1, select film format
   - Click "Expose Contact Print" to generate a quick preview
   - Evaluate the contact print, then promote to Work Print or Final Print
   - Use "New Exposure" to reset and start fresh with a new seed

### Configuration
- **Vite proxy** - Configured to proxy `/prompt`, `/history`, and `/view` requests to ComfyUI server
- **WebSocket** - Direct connection to `ws://127.0.0.1:8188/ws` with client ID
- **MFS workflow** - Stored in `public/medium_format_studio_api.json` (API format)
- **Legacy workflow** - Stored in `public/image_flux2_klein_text_to_image_api.json` (API format)

### Error Handling
The application handles common error scenarios:
- **Server not running** - Checks server status before queueing
- **Workflow errors** - Displays node_errors from API response
- **WebSocket failures** - Shows connection error messages
- **Missing outputs** - Handles cases where image generation fails

## Troubleshooting

### Invalid Prompt Error - Missing class_type
If you see: `invalid prompt: {'type': 'invalid_prompt', 'message': 'Cannot execute because a node is missing the class_type property.'}`

**Cause**: The workflow file is in Frontend/UI format instead of API format.

**Solution**: Export the workflow in API format from ComfyUI:
1. Open ComfyUI web interface
2. Load your workflow
3. Enable "Dev mode" in Settings (gear icon)
4. Click "Save (API Format)" button
5. Save to `public/image_flux2_klein_text_to_image_api.json`

Alternative method using browser console:
```javascript
copy(JSON.stringify(await app.graphToPrompt(), null, 2))
```
Then paste into `public/image_flux2_klein_text_to_image_api.json`

### CORS / Origin Mismatch Error
If you see: `WARNING: request with non matching host and origin 127.0.0.1:8188 != localhost:5173, returning 403`

**Solution 1 (Recommended)**: Start ComfyUI with CORS enabled:
```bash
python main.py --enable-cors-header
```

**Solution 2**: Access the web UI using `http://127.0.0.1:5173/` instead of `http://localhost:5173/` (the Vite config is already set to bind to 127.0.0.1)

**Solution 3**: Start ComfyUI with:
```bash
python main.py --listen 0.0.0.0 --enable-cors-header
```

The Vite dev server is configured to bind to `127.0.0.1` to match ComfyUI's default host, preventing origin mismatch issues.

### Image Not Displaying After Generation
If the image generates successfully (visible in ComfyUI output folder) but doesn't appear in the web UI:

**Cause**: WebSocket completion message may not fire properly, or image fetch is failing.

**Solution**: The web UI has a fallback mechanism that automatically fetches the image when progress reaches 100%. Check browser console (F12) for detailed logs:
- Look for "Progress reached 100%, scheduling image fetch..."
- Check for "Image URL: ..." message
- Verify no errors in history fetch or image URL construction

**Debugging Steps**:
1. Open browser DevTools console (F12)
2. Look for WebSocket messages: `WebSocket message: executing {node: null, prompt_id: "..."}`
3. Check for "Fetching generated image for prompt: ..." messages
4. Verify the image URL is correct and accessible

The application logs all WebSocket messages and image fetch attempts to the console for debugging.

## MFS Generation Flow

### Contact Print (stages 1-3)
1. User enters prompt, configures LoRAs, selects film format, clicks "Expose Contact Print"
2. `buildWorkflowForTarget(template, 'contact', false, params)` — includes only stage 1-3 nodes
3. POST to `/prompt`, connect WebSocket, monitor progress
4. On completion: fetch `/history/{promptId}`, extract image from `outputs['17']`
5. Set `pipelineState = 'contact_ready'`, display in Contact Print tab, lock parameters

### Promote to Work Print (stages 1-4)
1. User clicks "Promote to Work Print"
2. `buildWorkflowForTarget(template, 'work', false, params)` — includes stages 1-4
3. ComfyUI **caches stages 1-3** (same parameters), only executes stage 4
4. On completion: extract image from `outputs['48']`, switch to Work Print tab

### Promote to Final Print (stages 1-5 or 1-3+5)
1. If promoting from contact (no work print yet): `skipWorkPrint = true`
   - Stage 4 nodes omitted; nodes 80 and 62 rewired from node 74 → node 5
2. If promoting from work print: `skipWorkPrint = false` (all 5 stages)
3. On completion: extract image from `outputs['63']`, switch to Final Print tab

### Image Retrieval
Unlike the legacy TextToImage (which grabs the first image from any output node), MFS looks up the **specific SaveImage node** for each stage:
- Contact Print: `outputs['17']`
- Work Print: `outputs['48']`
- Final Print: `outputs['63']`

### New Exposure
Resets `pipelineState` to idle, generates a new seed, clears all images, unlocks parameters.

## Debugging Tips

### Enable Verbose Logging
All WebSocket messages and image fetch operations are logged to the browser console. To debug issues:

```javascript
// In browser console, all messages are logged:
// - "WebSocket message: progress {value: 20, max: 20}"
// - "Progress reached 100%, scheduling image fetch..."
// - "Fetching generated image for prompt: abc123"
// - "Image URL: http://127.0.0.1:8188/view?filename=..."
```

### Common Issues and Logs

**Image not displaying**:
- Check: "Fetching generated image for prompt: ..." appears in console
- Check: "Image URL: ..." shows correct URL
- Check: Network tab shows successful `/history` and `/view` requests

**Generation stuck**:
- Check: WebSocket messages are being received
- Check: Progress updates are appearing
- Check: ComfyUI console shows execution progress

**Wrong parameters**:
- Check: Console logs show correct steps/CFG for selected model
- Distilled: 4 steps, CFG 1.0
- Base: 20 steps, CFG 5.0

## Development Session Notes

### Initial Setup (Session 1)
- Created React + Vite project structure
- Implemented component-based architecture for extensibility
- Built reusable UI components (PromptInput, ParameterControls, ImageDisplay, ProgressBar)
- Created ComfyUI API service with WebSocket support
- Implemented workflow loader utilities

### Key Fixes Applied

#### 1. CORS/Origin Mismatch (127.0.0.1 vs localhost)
**Problem**: ComfyUI rejected requests due to host mismatch
**Solution**: Configure Vite to bind to `127.0.0.1` and start ComfyUI with `--enable-cors-header`

#### 2. Workflow Format (Frontend vs API)
**Problem**: Missing `class_type` error - workflow was in UI format
**Solution**: Export workflow in API format from ComfyUI (Dev mode → Save API Format)
- UI format: Has `nodes` array with positions, links, UI elements
- API format: Simple object with node IDs as keys, `class_type` and `inputs` fields

#### 3. Node ID Mapping (Subgraph Prefixes)
**Problem**: Workflow uses subgraph nodes with `75:` prefix
**Solution**: Updated all node IDs to include prefix:
- `75:68` (width), `75:69` (height), `75:73` (seed), `75:70` (model)
- `75:62` (scheduler/steps), `75:63` (CFG guider)

#### 4. Field Names (widgets_values vs inputs)
**Problem**: API format uses different field structure
**Solution**: Changed from `widgets_values[0]` to `inputs.value` / `inputs.noise_seed` / `inputs.unet_name`

#### 5. Automatic Model Settings
**Problem**: Users need correct steps/CFG for each model variant
**Solution**: Automatically set parameters based on model selection:
- Distilled: 4 steps, CFG 1.0 (fast)
- Base: 20 steps, CFG 5.0 (quality)

#### 6. Image Display Completion
**Problem**: Image generated but didn't appear in UI
**Solutions Applied**:
- Store `prompt_id` from queue response
- Queue workflow before connecting WebSocket (have ID ready)
- Dual completion detection:
  - Primary: WebSocket `executing` with `node: null`
  - Fallback: Progress reaches 100% → auto-fetch after 1s
- Prevent duplicate fetches with `fetchingImageRef` flag
- Comprehensive console logging for debugging

### Production-Ready Features
- ✅ Real-time progress tracking via WebSocket
- ✅ Automatic parameter optimization per model
- ✅ Error handling with clear user messages
- ✅ Fallback mechanisms for robustness
- ✅ Comprehensive debugging logs
- ✅ Dark theme UI matching reference design
- ✅ Image download functionality
- ✅ Responsive layout
- ✅ Server status checking
- ✅ CORS configuration

### Current Status: Medium Format Studio + Contact Sheet Gallery + Folder Browsing
The application features the multi-stage Medium Format Studio pipeline with progressive generation (contact → work → final prints), ComfyUI execution caching, LoRA controls, film format presets, and stage-aware progress display. A fourth "Contact Sheet" tab provides a gallery of recent generations with metadata inspection and fullscreen viewing, plus the ability to load and browse any local folder of images.

## Contact Sheet (Gallery)

The Contact Sheet tab is the 4th tab in MFS, providing a browsable gallery with two sources: ComfyUI generation history and local filesystem folders.

### Gallery Features
- **Thumbnail grid**: CSS Grid layout (`repeat(auto-fill, minmax(160px, 1fr))`) showing images
- **Auto-select**: Newest image highlighted for ComfyUI history; oldest (top-left) for loaded folders
- **Selection**: Click a thumbnail to view its metadata in the sidebar
- **Fullscreen**: Double-click a thumbnail, or press Space/Enter on highlighted thumbnail, to open FullscreenViewer
- **Keyboard navigation**: Arrow keys move selection (Left/Right by 1, Up/Down by grid row with wrapping); Space or Enter opens fullscreen
- **Metadata panel**: Shows preview, prompt (with copy-to-clipboard), parameter grid (seed with inline copy, model, dimensions, steps, CFG), and filename
- **Send to Contact Print**: Loads the selected image's prompt and seed into the generation form, resets pipeline, and switches to the Contact Print tab
- **Load Folder**: Browse any local folder of images (PNG, JPG, WebP) via `<input webkitdirectory>`. Displays folder name with close button; closing returns to ComfyUI history view
- **Always enabled**: The gallery tab is always clickable regardless of pipeline state
- **State preservation**: Switching between gallery and generation tabs preserves state in both directions

### Gallery Sources

**ComfyUI History** (default): Fetches recent generations from `GET /history`. Auto-selects newest (last) image.

**Local Folder**: User clicks "Load Folder" button → system folder picker → images loaded as blob URLs with optional PNG metadata extraction. Auto-selects oldest (first) image. Cap of 200 images; truncation indicated in folder label. Blob URLs are tracked in a ref and revoked on folder close or unmount.

### Gallery Service (`services/gallery-service.js`)
- `fetchGalleryItems(limit=50)` — fetches `GET /history`, extracts images from output nodes (picks highest-numbered node for multi-output MFS workflows), returns array sorted oldest-first
- `extractGalleryItemMetadata(item)` — passes `item.workflow` through `extractParametersFromComfyUIWorkflow()` to get prompt, seed, model, dimensions, steps, CFG
- `loadFolderItems(fileList)` — filters image files from a `webkitdirectory` FileList, sorts by `lastModified`, creates blob URLs, extracts PNG metadata where available, returns `{ items, totalCount, truncated }`
- Actual image dimensions are resolved via browser `Image()` constructor (ground truth from the cached image, not workflow metadata)

### Gallery Data Flow
1. User switches to Contact Sheet tab → `useEffect` fetches fresh gallery items, auto-selects based on source
2. Click or arrow-key to thumbnail → `handleGallerySelect` extracts metadata, creates `Image()` to get real pixel dimensions
3. Sidebar shows MetadataPanel with extracted params
4. Double-click, Space, or Enter → opens FullscreenViewer for that image
5. "Send to Contact Print" → resets pipeline (like New Exposure), loads prompt + seed, switches tab
6. "Load Folder" → system folder picker → switches `gallerySource` to `'folder'`, displays folder images with close button to return

## Image Viewer

The image viewer has two contexts: **inline** (within ImageDisplay) and **fullscreen** (FullscreenViewer overlay). Behavior adapts based on whether the image is small (fits within its container/viewport) or large.

### Inline Viewer (ImageDisplay)

**Small images** (naturalWidth < container width):
```
1:1 (natural size) ──click──→ fitted (fill column width) ──click──→ fullscreen
```

**Large images** (naturalWidth >= container width):
```
fitted (scaled to column width) ──click──→ fullscreen
```

ImageDisplay detects small vs. large via `onLoad` comparing `naturalWidth` to `containerRef.clientWidth`. Small images render at natural size with `max-width: 100%`; clicking toggles `inlineFitted` state before opening fullscreen.

### Fullscreen Viewer (FullscreenViewer)

Three zoom levels with a state machine:

```
fit ──click──→ native ──click──→ fit
fit ──shift-click──→ 200
native ──shift-click──→ 200
200 ──any click──→ native
```

| Zoom Level | Behavior |
|-----------|----------|
| **fit** | Image scaled to fill viewport (preserving aspect ratio); computed explicit pixel dimensions that scale both up and down |
| **native** | Image at 1:1 pixel resolution; pan enabled when image exceeds viewport |
| **200** | Image at 2× native resolution (shift-click only); pan enabled when exceeds viewport |

**Small image handling**: Images that fit within the viewport open at native/1:1 instead of fit (detected via `onLoad` → `naturalWidth`/`naturalHeight` vs `window.innerWidth`/`innerHeight`).

**Pan**: Enabled in native/200 modes when the image exceeds the viewport. Uses mousedown/mousemove/mouseup tracking with a 4px movement threshold to distinguish drags from clicks.

**Mouse event coordination**: Two event paths can trigger zoom transitions — `onMouseUp` (pan-enabled modes) and `onClick` (non-pan modes). A `dragRef.handled` flag ensures they never both fire for the same gesture: when drag tracking is active, `onMouseUp` always sets `handled=true`, suppressing the subsequent `onClick`.

**Keyboard controls** (fullscreen):

| Key | Action |
|-----|--------|
| **Space** | Return to grid view |
| **Enter** | Cycle zoom levels (fit → native → fit; Shift+Enter → 200%) |
| **Left/Right** | Navigate to adjacent image (preserves zoom level) |
| **Up/Down** | Navigate by grid row (columnar, preserves zoom level) |
| **Escape** | Return to grid view |

**Zoom preservation on navigate**: When arrowing between images, the current zoom level is preserved (loupe metaphor) — only pan offset resets. The `navigatingRef` flag in FullscreenViewer skips the small-image auto-zoom-detect on `onLoad` during navigation.

**Close**: Escape key, Space key, X button, or backdrop click from any zoom state.

## Version Control and Repository

### GitHub Repository
**Repository URL**: https://github.com/geoffsmithBK/comfy-webui

The project is version-controlled with Git and hosted on GitHub. All source code, documentation, and configuration files are tracked.

### GitHub CLI (`gh`) Available
The GitHub CLI tool is installed via Homebrew and should be used for GitHub operations:
- Creating pull requests: `gh pr create`
- Viewing issues: `gh issue list`
- Managing releases: `gh release create`
- Repository operations: `gh repo view`

### Git Workflow

**Checking Status**:
```bash
git status                    # Check working directory status
git log --oneline -5          # View recent commits
git diff                      # See uncommitted changes
```

**Making Changes**:
```bash
git add <file>                # Stage specific files
git add .                     # Stage all changes
git commit -m "message"       # Commit with message
git push                      # Push to GitHub
```

**Pulling Updates** (on another machine):
```bash
git pull                      # Fetch and merge latest changes
```

**Cloning** (setting up on a new machine):
```bash
git clone https://github.com/geoffsmithBK/comfy-webui.git
cd comfy-webui
npm install                   # Install dependencies
```

### Branch Structure
- **main**: Primary development branch
- Feature branches can be created as needed for larger changes

### What's Tracked in Git
✅ **Included**:
- Source code (`src/`)
- Public assets (`public/`)
- Configuration files (`package.json`, `vite.config.js`, etc.)
- Documentation (`.md` files)
- Workflow JSON files

❌ **Excluded** (via `.gitignore`):
- `node_modules/` - Dependencies (regenerated with `npm install`)
- `dist/` - Build output
- `.DS_Store` - macOS metadata
- `*.local` - Local config files
- `.claude/` - Claude Code session files

### Commit Message Convention
Use descriptive commit messages with co-author attribution:
```bash
git commit -m "Add feature description

Detailed explanation of changes.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

### Syncing Between Machines
**From work to home**:
```bash
# On work machine
git add .
git commit -m "Description of changes"
git push

# On home machine
git pull
npm install  # If dependencies changed
```

**From home to work** (same process in reverse)

### Creating Pull Requests
Use GitHub CLI for creating PRs:
```bash
gh pr create --title "Feature name" --body "Description"
```

Or use the web interface at https://github.com/geoffsmithBK/comfy-webui/pulls

### Release Management
When ready to tag releases:
```bash
git tag -a v0.1.0 -m "Release version 0.1.0"
git push --tags

# Or use GitHub CLI
gh release create v0.1.0 --title "v0.1.0" --notes "Release notes"
```

### Portability Notes
The project is fully portable across machines:
- No hardcoded absolute paths in source code
- All connections use localhost (127.0.0.1)
- Dependencies are specified in `package.json`
- ComfyUI path examples in documentation can be adjusted per machine
- Workflow JSON files are included in the repository

Just ensure the target machine has:
- Node.js 18+
- ComfyUI installation with required models
- Python (for running ComfyUI)

### Troubleshooting Git Issues

**Merge Conflicts**:
```bash
git status              # See conflicted files
# Edit files to resolve conflicts
git add <resolved-file>
git commit
```

**Undoing Changes**:
```bash
git restore <file>      # Discard changes to a file
git reset HEAD~1        # Undo last commit (keep changes)
git reset --hard HEAD~1 # Undo last commit (discard changes)
```

**Checking Remote**:
```bash
git remote -v           # Show remote URLs
git branch -vv          # Show branch tracking info
```
