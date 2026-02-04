# Image Gallery Module - Implementation Plan

## Overview

Add a new **Gallery** tab to the existing web UI that enables browsing, viewing, and inspecting generation metadata for AI-generated images. The gallery will work independently from the image generation workflow.

## Scope & Constraints

| Aspect | Decision |
|--------|----------|
| **Directory Access** | ComfyUI output folder via existing APIs |
| **Use Case** | Both quick review AND archive browsing |
| **Navigation** | Tab within the existing app (not a separate route) |
| **Image Discovery** | Hybrid: `/history` API for recent + drag-drop for manual additions |

---

## Architecture

### New Files to Create

```
src/
├── views/                        # NEW: Top-level view components
│   ├── GenerateView.jsx          # Wraps existing TextToImage workflow
│   └── GalleryView.jsx           # New gallery view
├── components/
│   ├── TabNavigation.jsx         # NEW: Tab switcher component
│   ├── TabNavigation.css
│   ├── gallery/                   # NEW: Gallery-specific components
│   │   ├── GalleryGrid.jsx       # Thumbnail grid layout
│   │   ├── GalleryGrid.css
│   │   ├── ImageCard.jsx         # Single image thumbnail with preview
│   │   ├── ImageCard.css
│   │   ├── ImageViewer.jsx       # Full-size image modal/panel
│   │   ├── ImageViewer.css
│   │   ├── MetadataPanel.jsx     # Metadata display with copy buttons
│   │   └── MetadataPanel.css
├── services/
│   └── gallery-service.js        # NEW: Gallery data fetching logic
└── utils/
    └── png-parser.js             # EXISTING: Reuse for metadata extraction
```

### Modified Files

| File | Changes |
|------|---------|
| `App.jsx` | Add tab navigation, conditionally render GenerateView or GalleryView |
| `App.css` | Add layout styles for tab navigation |

---

## Component Design

### 1. TabNavigation
Simple horizontal tab bar with two tabs:
- **Generate** - Shows the existing TextToImage workflow
- **Gallery** - Shows the new gallery view

```jsx
// Props
activeTab: 'generate' | 'gallery'
onTabChange: (tab) => void
```

### 2. GalleryView
Main container for gallery functionality:
- Toolbar with refresh button, view options
- Source selector (ComfyUI History / Dropped Images)
- GalleryGrid of images
- ImageViewer modal when an image is selected

**State:**
- `images[]` - Array of image objects
- `selectedImage` - Currently selected image for detail view
- `viewMode` - 'grid' | 'list' (future)
- `isLoading` - Loading state

### 3. GalleryGrid
Responsive grid of ImageCard components:
- CSS Grid with auto-fill columns
- Virtualization for large collections (future optimization)
- Supports keyboard navigation (arrow keys)

### 4. ImageCard
Individual image thumbnail:
- Lazy-loaded thumbnail image
- Hover state shows quick info (dimensions, date)
- Click opens ImageViewer
- Visual indicator if metadata is present

### 5. ImageViewer
Full-size image display with metadata:
- Modal or side-panel layout
- Large image preview (zoomable in future)
- MetadataPanel on the side
- Navigation arrows (prev/next)
- Close button

### 6. MetadataPanel
Structured display of generation parameters:
- Collapsible sections: Prompt, Negative Prompt, Settings, Model, Raw JSON
- Copy buttons for each field and for "Copy All"
- Formatted display (not raw JSON)
- Graceful handling of missing fields

---

## Data Flow

### Image Discovery Sources

**Source 1: ComfyUI History API**
```
GET /history → Returns recent prompt executions
  ↓
Parse outputs to find SaveImage nodes
  ↓
Extract filename, subfolder, type for each image
  ↓
Build image URL via /view endpoint
```

**Source 2: Drag-and-Drop**
```
User drops PNG files onto gallery
  ↓
Create object URLs for display
  ↓
Extract metadata via png-parser.js
  ↓
Add to images array (session-only, not persisted)
```

### Image Object Schema
```javascript
{
  id: string,              // Unique identifier
  url: string,             // Display URL (/view?... or blob:...)
  filename: string,        // Original filename
  source: 'comfyui' | 'dropped',
  timestamp: number,       // When generated/added
  dimensions: { width, height },
  metadata: {              // Extracted generation params
    prompt: string,
    negativePrompt: string,
    seed: number,
    steps: number,
    cfg: number,
    model: string,
    // ... etc
  },
  rawMetadata: object,     // Full workflow JSON or A1111 params
  metadataType: 'comfyui' | 'a1111' | 'unknown'
}
```

---

## API Integration

### Existing ComfyUI Endpoints Used
| Endpoint | Purpose |
|----------|---------|
| `GET /history` | List recent generations |
| `GET /history/{prompt_id}` | Get specific generation details |
| `GET /view?filename=X&subfolder=Y&type=Z` | Fetch image file |

### New Service Functions (`gallery-service.js`)

```javascript
// Fetch recent images from ComfyUI history
async function fetchRecentImages(limit = 50) → Image[]

// Fetch metadata for a specific image (if not already loaded)
async function fetchImageMetadata(promptId) → Metadata

// Process dropped file and extract metadata
async function processDroppedImage(file) → Image
```

---

## UI/UX Details

### Gallery Grid Layout
- **Default**: 4 columns on desktop, responsive down to 1 column on mobile
- **Thumbnail size**: ~200px squares with aspect-ratio preserved
- **Infinite scroll** or pagination for large sets (future)

### Metadata Panel Layout
```
┌─────────────────────────────────────┐
│ PROMPT                        [Copy]│
│ ─────────────────────────────────── │
│ A beautiful landscape with...       │
│                                     │
├─────────────────────────────────────┤
│ NEGATIVE PROMPT               [Copy]│
│ ─────────────────────────────────── │
│ blurry, ugly, bad                   │
│                                     │
├─────────────────────────────────────┤
│ SETTINGS                      [Copy]│
│ ─────────────────────────────────── │
│ Dimensions: 1024 × 1024             │
│ Seed: 123456789                     │
│ Steps: 4                            │
│ CFG: 1.0                            │
│ Model: flux-2-klein-4b.safetensors  │
│                                     │
├─────────────────────────────────────┤
│ ▶ RAW METADATA (collapsed)    [Copy]│
└─────────────────────────────────────┘

              [Copy All to Clipboard]
```

### Copy Functionality
- **Copy Prompt**: Plain text, just the prompt
- **Copy Settings**: Formatted key-value pairs
- **Copy All**: JSON object with all extracted parameters
- **Visual feedback**: "Copied!" toast or button state change

---

## Implementation Phases

### Phase 1: Foundation (MVP)
1. Create `TabNavigation` component
2. Refactor `App.jsx` to support tab switching
3. Create `GenerateView` wrapper (move TextToImage into it)
4. Create basic `GalleryView` skeleton
5. Implement `gallery-service.js` with `/history` integration

**Deliverable**: Can switch between Generate and Gallery tabs; Gallery shows list of recent images from ComfyUI

### Phase 2: Grid & Thumbnails
1. Create `GalleryGrid` component
2. Create `ImageCard` component with lazy loading
3. Style the grid layout (responsive)
4. Add loading states and empty states

**Deliverable**: Gallery displays a responsive grid of thumbnails from recent generations

### Phase 3: Image Viewer & Metadata
1. Create `ImageViewer` modal component
2. Create `MetadataPanel` component
3. Integrate `png-parser.js` for metadata extraction
4. Implement copy-to-clipboard functionality
5. Add prev/next navigation in viewer

**Deliverable**: Click any thumbnail to see full image + formatted metadata with copy buttons

### Phase 4: Drag-and-Drop Support
1. Add drop zone to GalleryView
2. Process dropped PNG files
3. Extract metadata and add to gallery
4. Handle images without metadata gracefully

**Deliverable**: Can drag external PNG files into gallery for viewing/metadata inspection

### Phase 5: Polish & Enhancements
1. Keyboard navigation (arrow keys, Escape to close)
2. Loading skeletons instead of spinners
3. Error handling and retry UI
4. Empty state messaging
5. Performance optimization if needed

---

## Future Enhancements (Post-MVP)

These features are out of scope for initial implementation but documented for future consideration:

- **Filtering/Search**: Filter by prompt text, date range, model
- **Sorting options**: By date, name, dimensions
- **List view**: Alternative to grid view
- **Image comparison**: Side-by-side view of two images
- **Favorites/Tags**: Mark and organize images
- **Batch operations**: Select multiple, copy all metadata, delete
- **localStorage persistence**: Remember dropped images across sessions
- **Virtualized scrolling**: For very large galleries (1000+ images)
- **External directory support**: Via standalone Node.js server or Electron wrapper

---

## Status

**Current Phase**: Planning Complete  
**Next Step**: Begin Phase 1 implementation
