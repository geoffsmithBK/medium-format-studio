# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This project creates a web-based user interface for ComfyUI workflows. The goal is to build a custom web UI that interacts with a ComfyUI instance running at `http://127.0.0.1:8188`.

## ComfyUI Workflow Architecture

The project is built around a Flux 2 Klein text-to-image workflow. This workflow uses:

### Workflow File Formats
ComfyUI has two different workflow formats:

1. **Frontend/UI Format** (`image_flux2_klein_text_to_image.json`): Contains UI elements like node positions, links, groups. Used by the ComfyUI web interface.

2. **API Format** (`image_flux2_klein_text_to_image_api.json`): Simplified format for API execution. Contains only node IDs, class types, and inputs. **This is what the web UI uses.**

The web UI requires the API format. To export:
- In ComfyUI, enable "Dev mode" in settings → Click "Save (API Format)"
- Or use browser console: `copy(JSON.stringify(await app.graphToPrompt(), null, 2))`

**API Format Structure:**
```json
{
  "node_id": {
    "class_type": "NodeClassName",
    "inputs": {
      "parameter": "value"
    }
  }
}
```

### Models Used
- **Diffusion Model**: `flux-2-klein-4b.safetensors` (distilled version)
  - Alternative: `flux-2-klein-base-4b.safetensors`
- **Text Encoder**: `qwen_3_4b.safetensors`
- **VAE**: `flux2-vae.safetensors`

### Workflow Structure
The ComfyUI workflow is organized into subgraphs (reusable node groups):
- **Subgraph ID `7b34ab90-36f9-45ba-a665-71d418f0df18`**: Text to Image (Flux.2 Klein 4B base)
- **Subgraph ID `a67caa28-5f85-4917-8396-36004960dd30`**: Text to Image (Flux.2 Klein 4B Distilled)

Each subgraph contains these functional groups:
1. **Models Group**: Loads UNET (diffusion model), CLIP (text encoder), and VAE
2. **Prompt Group**: Text encoding for positive and negative prompts
3. **Sampler Group**: Controls the diffusion sampling process (KSampler, scheduler, noise generation)
4. **Image Size Group**: Defines output dimensions (default: 1024x1024)

### Key Workflow Parameters
- **Prompt**: User text input for image generation
- **Negative Prompt**: Optional text to steer generation away from unwanted elements (default: "blurry, ugly, bad, text")
- **Image Dimensions**: Width and height (default 1024x1024)
- **Noise Seed**: Random seed for reproducibility
- **Scheduler Steps**: 20 for base model, 4 for distilled model
- **CFG Scale**: 5 for base model, 1 for distilled model
- **Sampler**: Euler method

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
├── components/          # Reusable UI components
│   ├── PromptInput.jsx  # Multiline prompt text input
│   ├── NegativePromptInput.jsx  # Optional negative prompt with checkbox
│   ├── ParameterControls.jsx  # Dimension, seed, and model controls
│   ├── ImageDisplay.jsx # Image display with download button
│   └── ProgressBar.jsx  # Real-time progress indicator
├── workflows/           # Workflow-specific components (extensible)
│   └── TextToImage.jsx  # Main text-to-image workflow UI
├── services/            # API and utilities
│   ├── comfyui-api.js   # ComfyUI API client with WebSocket
│   └── workflow-loader.js # Workflow JSON manipulation utilities
├── utils/               # Constants and helpers
│   └── constants.js     # API URLs, default values, node IDs
├── App.jsx              # Main application component
├── App.css              # Global dark theme styles
└── main.jsx             # React entry point
```

### Workflow Parameter Updates
The application modifies specific nodes in the workflow JSON to update parameters:

| Parameter | Node ID | Field | Description |
|-----------|---------|-------|-------------|
| Prompt | 76 | `inputs.value` | PrimitiveStringMultiline for prompt text |
| Negative Prompt | 75:67 | `inputs.text` | CLIPTextEncode negative prompt (optional) |
| Width | 75:68 | `inputs.value` | PrimitiveInt for image width |
| Height | 75:69 | `inputs.value` | PrimitiveInt for image height |
| Seed | 75:73 | `inputs.noise_seed` | RandomNoise seed value |
| Model | 75:70 | `inputs.unet_name` | UNETLoader model filename |
| Steps | 75:62 | `inputs.steps` | Flux2Scheduler step count |
| CFG | 75:63 | `inputs.cfg` | CFGGuider classifier-free guidance scale |

Note: Node IDs with `75:` prefix are from subgraph nodes. API format uses `inputs` object instead of `widgets_values` array.

### Automatic Model-Based Settings
The web UI automatically adjusts generation parameters based on the selected model:

| Model | Steps | CFG | Speed | Quality |
|-------|-------|-----|-------|---------|
| Flux 2 Klein 4B Distilled | 4 | 1.0 | Fast (~4x faster) | Good |
| Flux 2 Klein 4B Base | 20 | 5.0 | Slower | Best |

These settings are applied automatically when a model is selected - no manual adjustment needed.

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
Components are designed for reusability across different workflow types:

- **PromptInput** - Reusable for any text-based input workflow
- **NegativePromptInput** - Optional negative prompt with checkbox toggle (default: "blurry, ugly, bad, text")
- **ParameterControls** - Handles common parameters (dimensions, seed, model)
- **ImageDisplay** - Generic image viewer with download
- **ProgressBar** - Universal progress tracking component
- **TextToImage** - Workflow-specific component that combines reusable components

This architecture allows easy addition of new workflow types (img2img, video, etc.) by:
1. Creating a new component in `src/workflows/`
2. Reusing existing UI components
3. Using the same API service
4. Adding workflow-specific parameter handling

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

4. **Generate images**:
   - Enter a prompt
   - Select model (Distilled for speed, Base for quality)
   - Adjust dimensions if needed
   - Click "Generate Image"
   - Watch real-time progress
   - Download generated images

### Configuration
- **Vite proxy** - Configured to proxy `/prompt`, `/history`, and `/view` requests to ComfyUI server
- **WebSocket** - Direct connection to `ws://127.0.0.1:8188/ws` with client ID
- **Workflow location** - Stored in `public/image_flux2_klein_text_to_image_api.json` (API format, not UI format)

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

## Complete Generation Flow

Understanding the complete flow from button click to image display:

1. **User Action**: Click "Generate Image" button
   - Validates prompt is not empty
   - Resets progress state and error messages

2. **Server Check**: Verify ComfyUI is running
   - Calls `/system_stats` endpoint
   - Fails fast with clear error if server is down

3. **Workflow Preparation**:
   - Load base workflow from `public/image_flux2_klein_text_to_image_api.json`
   - Determine model settings (steps/CFG based on model selection)
   - Update workflow parameters: prompt, width, height, seed, model, steps, CFG
   - Clone workflow to avoid mutations

4. **Queue Workflow**:
   - POST to `/prompt` endpoint with workflow JSON
   - Receive `prompt_id` and store it
   - Check for `node_errors` in response

5. **WebSocket Connection**:
   - Connect to `ws://127.0.0.1:8188/ws?clientId=xxx`
   - Listen for messages: `progress`, `executing`, `executed`, `status`
   - Update UI progress bar in real-time

6. **Progress Tracking**:
   - Receive `progress` messages with `{value, max}` (e.g., 20/20)
   - Update progress bar display
   - When `value === max`, trigger fallback image fetch after 1 second

7. **Completion Detection** (dual mechanism):
   - **Primary**: WebSocket `executing` message with `node: null`
   - **Fallback**: Progress reaches 100% → wait 1 second → fetch image
   - Prevents duplicate fetches with `fetchingImageRef` flag

8. **Image Retrieval**:
   - GET from `/history/{prompt_id}`
   - Parse `outputs` to find `SaveImage` node
   - Extract image info: `{filename, subfolder, type}`
   - Construct URL: `/view?filename=X&subfolder=Y&type=output`

9. **Display**:
   - Set image URL in React state
   - ImageDisplay component renders the image
   - Show success status message
   - Close WebSocket connection

10. **Cleanup**:
    - Set `isGenerating = false`
    - Clear status message after 3 seconds
    - Close WebSocket
    - Reset fetch flag for next generation

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

### Current Status: MVP Complete
The application successfully generates images with both Flux 2 Klein model variants, displays them in the UI, and provides a polished user experience with real-time progress tracking and automatic parameter optimization.

## Image Gallery Module (Planned)

A new **Gallery** tab feature is planned to enable browsing, viewing, and inspecting generation metadata for AI-generated images. Full implementation details are in `GALLERY.md`.

### Key Features (Planned)
- **Tab Navigation**: Switch between Generate and Gallery views
- **Image Grid**: Browse thumbnails of generated images
- **Metadata Viewer**: Inspect generation parameters with copy-to-clipboard
- **Dual Source Support**: 
  - ComfyUI `/history` API for recent generations
  - Drag-and-drop for external PNG files
- **Standalone Operation**: Gallery works independently from generation UI

### New Architecture Components
```
src/
├── views/                    # Top-level view components
│   ├── GenerateView.jsx      # Wraps existing TextToImage
│   └── GalleryView.jsx       # New gallery view
├── components/
│   ├── TabNavigation.jsx     # Tab switcher
│   └── gallery/              # Gallery-specific components
│       ├── GalleryGrid.jsx   # Thumbnail grid
│       ├── ImageCard.jsx     # Single thumbnail
│       ├── ImageViewer.jsx   # Full-size modal
│       └── MetadataPanel.jsx # Metadata display
└── services/
    └── gallery-service.js    # Gallery data fetching
```

### Implementation Status
- **Phase 1**: Foundation (Not Started)
- **Phase 2**: Grid & Thumbnails (Not Started)
- **Phase 3**: Image Viewer & Metadata (Not Started)
- **Phase 4**: Drag-and-Drop Support (Not Started)
- **Phase 5**: Polish & Enhancements (Not Started)

See `GALLERY.md` for detailed implementation plan.

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

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
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
