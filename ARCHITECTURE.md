# Architecture Decisions

## ADR-001: Web + ComfyUI — Platform Strategy (Feb 2026)

### Context

As the MFS UI matures, we're encountering friction points characteristic of browser-sandboxed applications: the model dropdown is hardcoded rather than reflecting what's actually installed, the gallery is limited to ComfyUI's `/history` API rather than being a general file browser, and there's no way to browse the ComfyUI output folder directly.

This prompted a broader evaluation: should we stay as a web app, wrap in something like Tauri/Electron, or go fully native (Swift + MLX on macOS)?

### Decision

**Stay web + ComfyUI.** The friction points we're hitting are largely solvable within the current architecture. The browser sandbox is not the fundamental constraint it appears to be — ComfyUI is already a local process with full disk access, and its API (plus a small Python extension) can bridge the gap.

### Product Vision

The MFS UI is a metaphor-based creative tool for photographers confronting camera-less image generation. The darkroom metaphor (negative/development/contact print/work print/final print) gives film-literate creatives an accessible mental model for diffusion workflows — much as the film-to-digital transition used familiar terms (RAW = negative, RAW processing = development, Lightroom export = print) to ease adoption. The UI layer and interaction design are the novel contribution; inference is a commodity backend concern.

### Options Evaluated

#### Lane 1: Pure web, lean harder into ComfyUI API (CHOSEN)

The specific pain points have concrete solutions that don't require leaving the web:

**Dynamic model list** — ComfyUI's `GET /object_info` endpoint returns every registered node type and its valid input options, including all available model files on disk. We can populate the model dropdown dynamically instead of hardcoding it. This is straightforward, no filesystem access needed.

**Output folder browsing** — A thin ComfyUI server extension (~50 lines of Python) can serve directory listings and file metadata for the output folder over the existing `:8188` API. ComfyUI's extension/custom-node system is designed for this. The gallery tab could then offer both "recent generations" (from `/history`) and "browse output folder" (from the extension) views.

**Other filesystem needs** — The File System Access API (Chromium) handles ad-hoc "open a folder" use cases with a user gesture. Not Safari-compatible, but adequate for a power-user tool.

- **Cost**: Near zero. No new dependencies, no architecture change.
- **Limitation**: Tethered to a running ComfyUI instance. Can only see what it exposes.
- **Timeline**: These are days-of-work improvements, not architectural changes.

#### Lane 2: Tauri wrapper

Tauri 2.x gives a Rust backend with the existing React frontend — same web UI in a native window with full filesystem access, system tray, native menus. ~10-15MB binary overhead (vs. Electron's ~200MB+). Cross-platform preserved.

- **When to reconsider**: If we want Finder drag-and-drop, system keyboard shortcuts, menu bar integration, offline mode, or a polished `.dmg` distribution story.
- **Key advantage**: Preserves the entire React/CSS investment. Native capabilities are bolted on incrementally.
- **This is the right "next lane" if/when we outgrow pure web.**

#### Lane 3: Electron

Same idea as Tauri but heavier (full Chromium + Node.js). Running Chromium alongside a Python ML backend alongside a loaded model in VRAM is expensive on unified-memory Macs. Tauri wins on every dimension unless a specific Node.js library is required.

**Verdict**: Skip. Tauri is strictly better for this use case.

#### Lane 4: Native Swift + MLX

Full native macOS app. Direct filesystem, Metal, MLX for inference. Maximum platform integration and performance.

**Performance reality check**: For Flux Klein 9B on M-series, ComfyUI/MPS might take ~12-15s for a 6-step contact print. MLX/Metal FlashAttention might get to ~6-8s. Meaningful but not transformative — and the creative bottleneck is usually the human evaluating and adjusting, not the GPU.

**The real cost**: Abandoning ComfyUI's node ecosystem. The 5-stage MFS pipeline, LoRA stacking, SeedVR2 upscale chain, and hundreds of community custom nodes (ControlNet, IP-Adapter, InstantID, etc.) would all need reimplementation. This is months of work.

**Verdict**: This is a different *product* — "building an inference engine" vs. "building a creative UI for an inference engine." Not justified unless we're willing to go Mac-only and rewrite the backend from scratch.

### Actionable Next Steps (Low-Hanging Fruit)

These can be implemented incrementally within the current architecture:

1. **Dynamic model dropdown** — Fetch available models from ComfyUI's `GET /object_info` endpoint (or more specific model-listing endpoints) instead of hardcoding `MFS_MODELS` in `constants.js`. Fall back to hardcoded list if the server is unreachable.

2. **Output folder browser** — Write a small ComfyUI custom node / server extension (Python) that exposes directory listings of the output folder via a new REST endpoint. Update the gallery tab to support both "recent history" and "browse folder" views.

3. **Gallery refresh** — The gallery currently refetches on every tab switch. Could add a manual refresh button and/or poll for new items during generation.

4. **LoRA discovery** — We already resolve LoRA filenames from `getAvailableLoRAs()` on mount. The same pattern can be extended to populate a LoRA browser/picker rather than hardcoding the two LoRA slots.

### Revisit Triggers

Reconsider the Tauri lane if any of these become requirements:
- Native file drag-and-drop (into/out of the app)
- System-level global keyboard shortcuts
- Menu bar / dock integration
- Offline operation (no ComfyUI dependency for browsing/organizing)
- Distributable `.dmg` / `.app` packaging for non-technical users
