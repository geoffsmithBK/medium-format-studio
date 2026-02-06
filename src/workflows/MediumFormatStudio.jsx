import React, { useState, useEffect, useRef } from 'react';
import PromptInput from '../components/PromptInput';
import ImageDisplay from '../components/ImageDisplay';
import ProgressBar from '../components/ProgressBar';
import SidebarSection from '../components/SidebarSection';
import FilmFormatSelect from '../components/FilmFormatSelect';
import LoRAControls from '../components/LoRAControls';
import StageTabs from '../components/StageTabs';
import {
  loadMFSWorkflow,
  buildWorkflowForTarget,
  generateRandomSeed,
} from '../services/mfs-workflow-builder';
import {
  queuePrompt,
  connectWebSocket,
  getHistory,
  getImageUrl,
  generateClientId,
  checkServerStatus,
} from '../services/comfyui-api';
import {
  MFS_FILM_FORMATS,
  MFS_DEFAULT_FILM_FORMAT,
  MFS_LORA_DEFAULTS,
  MFS_OUTPUT_NODES,
  MFS_NODE_STAGE_NAMES,
} from '../utils/constants';
import './MediumFormatStudio.css';

// Pipeline state machine
// idle → generating_contact → contact_ready
//        → generating_work → work_ready
//        → generating_final → final_ready
const GENERATING_STATES = ['generating_contact', 'generating_work', 'generating_final'];

export default function MediumFormatStudio() {
  // ── Form state ──────────────────────────────────────────────────────
  const [prompt, setPrompt] = useState('');
  const [negativePrompt, setNegativePrompt] = useState('');
  const [filmFormat, setFilmFormat] = useState(MFS_DEFAULT_FILM_FORMAT);
  const [seed, setSeed] = useState(generateRandomSeed());
  const [lora1Enabled, setLora1Enabled] = useState(MFS_LORA_DEFAULTS.lora1.defaultEnabled);
  const [lora1Strength, setLora1Strength] = useState(MFS_LORA_DEFAULTS.lora1.defaultStrength);
  const [lora2Enabled, setLora2Enabled] = useState(MFS_LORA_DEFAULTS.lora2.defaultEnabled);
  const [lora2Strength, setLora2Strength] = useState(MFS_LORA_DEFAULTS.lora2.defaultStrength);
  const [upscaleFactor, setUpscaleFactor] = useState(1.5);

  // ── Pipeline state ──────────────────────────────────────────────────
  const [pipelineState, setPipelineState] = useState('idle');

  // ── Image state ─────────────────────────────────────────────────────
  const [contactPrintUrl, setContactPrintUrl] = useState('');
  const [workPrintUrl, setWorkPrintUrl] = useState('');
  const [finalPrintUrl, setFinalPrintUrl] = useState('');
  const [activeTab, setActiveTab] = useState('contact');

  // ── Generation state ────────────────────────────────────────────────
  const [progress, setProgress] = useState(0);
  const [progressMax, setProgressMax] = useState(0);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  // ── Refs ────────────────────────────────────────────────────────────
  const wsRef = useRef(null);
  const clientIdRef = useRef(generateClientId());
  const promptIdRef = useRef(null);
  const fetchingImageRef = useRef(false);

  // Cleanup WebSocket on unmount
  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  // ── Derived state ───────────────────────────────────────────────────
  const isGenerating = GENERATING_STATES.includes(pipelineState);
  const paramsLocked = pipelineState !== 'idle';

  const enabledTabs = ['contact'];
  if (workPrintUrl) enabledTabs.push('work');
  if (finalPrintUrl) enabledTabs.push('final');

  const currentImageUrl = {
    contact: contactPrintUrl,
    work: workPrintUrl,
    final: finalPrintUrl,
  }[activeTab] || '';

  // ── Helpers ─────────────────────────────────────────────────────────

  function getParams() {
    return {
      prompt,
      negativePrompt,
      filmFormat,
      seed,
      lora1Enabled,
      lora1Strength,
      lora2Enabled,
      lora2Strength,
      upscaleFactor,
    };
  }

  function closeWebSocket() {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  }

  /**
   * Fetch the image for a specific output node from /history.
   */
  async function fetchStageImage(promptId, outputNodeId) {
    if (fetchingImageRef.current) return null;
    fetchingImageRef.current = true;

    try {
      const history = await getHistory(promptId);
      if (history[promptId] && history[promptId].outputs) {
        const nodeOutput = history[promptId].outputs[outputNodeId];
        if (nodeOutput && nodeOutput.images && nodeOutput.images.length > 0) {
          const img = nodeOutput.images[0];
          return getImageUrl(img.filename, img.subfolder, img.type);
        }
      }
      throw new Error(`No image found for node ${outputNodeId}`);
    } finally {
      fetchingImageRef.current = false;
    }
  }

  /**
   * Generic generation runner — builds workflow, queues, listens via WS.
   */
  async function runGeneration(target, skipWorkPrint, generatingState, readyState, outputNodeId, setImageUrl, switchToTab) {
    setError('');
    setPipelineState(generatingState);
    setProgress(0);
    setProgressMax(0);
    fetchingImageRef.current = false;

    try {
      // Check server
      setStatus('Checking server...');
      const isUp = await checkServerStatus();
      if (!isUp) {
        throw new Error('ComfyUI server is not running. Please start the server at http://127.0.0.1:8188');
      }

      // Build workflow
      setStatus('Building workflow...');
      const fullWorkflow = await loadMFSWorkflow();
      const workflow = buildWorkflowForTarget(fullWorkflow, target, skipWorkPrint, getParams());

      // Queue
      setStatus('Queueing workflow...');
      const result = await queuePrompt(workflow, clientIdRef.current);

      if (result.node_errors && Object.keys(result.node_errors).length > 0) {
        throw new Error(`Workflow error: ${JSON.stringify(result.node_errors)}`);
      }

      promptIdRef.current = result.prompt_id;

      // Connect WebSocket
      setStatus('Connecting...');
      wsRef.current = connectWebSocket(clientIdRef.current, {
        onProgress: (value, max) => {
          setProgress(value);
          setProgressMax(max);
          setStatus('Generating...');

          // Fallback: fetch on 100%
          if (value === max && max > 0 && promptIdRef.current) {
            setTimeout(async () => {
              if (promptIdRef.current && fetchingImageRef.current === false) {
                try {
                  const url = await fetchStageImage(promptIdRef.current, outputNodeId);
                  if (url) {
                    setImageUrl(url);
                    setActiveTab(switchToTab);
                    setPipelineState(readyState);
                    setStatus('Done!');
                    setTimeout(() => setStatus(''), 3000);
                    closeWebSocket();
                  }
                } catch (err) {
                  console.error('Fallback fetch error:', err);
                }
              }
            }, 1000);
          }
        },
        onExecuting: (node, wsPromptId) => {
          if (node === null && promptIdRef.current) {
            // Execution complete
            handleExecutionComplete(promptIdRef.current, outputNodeId, setImageUrl, switchToTab, readyState);
          } else if (node && MFS_NODE_STAGE_NAMES[node]) {
            setStatus(MFS_NODE_STAGE_NAMES[node]);
          }
        },
        onExecuted: () => {},
        onCached: (data) => {
          if (data.nodes && data.nodes.length > 0) {
            setStatus(`Cached ${data.nodes.length} nodes`);
          }
        },
        onError: (err) => {
          console.error('WebSocket error:', err);
          setError('Connection error. Please check if ComfyUI is running.');
          setPipelineState(readyState === 'contact_ready' ? 'idle' : pipelineState);
          closeWebSocket();
        },
      });

      setStatus('Waiting for execution...');
    } catch (err) {
      console.error('Generation error:', err);
      setError(err.message || 'Failed to generate');
      // Revert to previous ready state or idle
      setPipelineState(
        generatingState === 'generating_contact' ? 'idle' :
        generatingState === 'generating_work' ? 'contact_ready' :
        workPrintUrl ? 'work_ready' : 'contact_ready'
      );
      setStatus('');
      closeWebSocket();
    }
  }

  async function handleExecutionComplete(promptId, outputNodeId, setImageUrl, switchToTab, readyState) {
    try {
      setStatus('Processing results...');
      const url = await fetchStageImage(promptId, outputNodeId);
      if (url) {
        setImageUrl(url);
        setActiveTab(switchToTab);
        setPipelineState(readyState);
        setStatus('Done!');
        setTimeout(() => setStatus(''), 3000);
      } else {
        throw new Error('No image found');
      }
    } catch (err) {
      console.error('Error fetching image:', err);
      setError('Failed to retrieve generated image');
      setPipelineState(readyState);
    } finally {
      closeWebSocket();
    }
  }

  // ── Stage Handlers ──────────────────────────────────────────────────

  function handleExposeContactPrint() {
    runGeneration(
      'contact', false,
      'generating_contact', 'contact_ready',
      MFS_OUTPUT_NODES.contact,
      setContactPrintUrl, 'contact'
    );
  }

  function handlePromoteToWorkPrint() {
    runGeneration(
      'work', false,
      'generating_work', 'work_ready',
      MFS_OUTPUT_NODES.work,
      setWorkPrintUrl, 'work'
    );
  }

  function handlePromoteToFinalPrint() {
    // If promoting from contact (no work print), skip stage 4
    const skipWorkPrint = !workPrintUrl;
    runGeneration(
      'final', skipWorkPrint,
      'generating_final', 'final_ready',
      MFS_OUTPUT_NODES.final,
      setFinalPrintUrl, 'final'
    );
  }

  function handleNewExposure() {
    closeWebSocket();
    setPipelineState('idle');
    setSeed(generateRandomSeed());
    setContactPrintUrl('');
    setWorkPrintUrl('');
    setFinalPrintUrl('');
    setActiveTab('contact');
    setProgress(0);
    setProgressMax(0);
    setStatus('');
    setError('');
    fetchingImageRef.current = false;
    promptIdRef.current = null;
  }

  // ── Render ──────────────────────────────────────────────────────────

  const canPromote = ['contact_ready', 'work_ready', 'final_ready'].includes(pipelineState);

  return (
    <div className="mfs">
      {/* ── Sidebar ─────────────────────────────────────────────── */}
      <div className="mfs-sidebar">
        <h1 className="app-title">Medium Format Studio</h1>

        <div className="mfs-stages">
          {/* Stage 1: Negative & Filtration */}
          <SidebarSection stageNumber={1} title="Negative & Filtration" disabled={false} defaultOpen={false}>
            <div className="mfs-field">
              <label htmlFor="neg-prompt" className="mfs-label">Negative Prompt</label>
              <textarea
                id="neg-prompt"
                className="mfs-textarea"
                value={negativePrompt}
                onChange={(e) => setNegativePrompt(e.target.value)}
                placeholder="Things to avoid..."
                disabled={paramsLocked}
                rows={2}
              />
            </div>
            <LoRAControls
              lora1Enabled={lora1Enabled}
              lora1Strength={lora1Strength}
              lora1Name={MFS_LORA_DEFAULTS.lora1.name}
              lora2Enabled={lora2Enabled}
              lora2Strength={lora2Strength}
              lora2Name={MFS_LORA_DEFAULTS.lora2.name}
              onLora1EnabledChange={setLora1Enabled}
              onLora1StrengthChange={setLora1Strength}
              onLora2EnabledChange={setLora2Enabled}
              onLora2StrengthChange={setLora2Strength}
              disabled={paramsLocked}
            />
          </SidebarSection>

          {/* Stage 2: Subject, Style & Format */}
          <SidebarSection stageNumber={2} title="Subject, Style & Format" defaultOpen={true}>
            <PromptInput
              value={prompt}
              onChange={setPrompt}
              placeholder="Describe what we see..."
              disabled={paramsLocked}
            />
            <FilmFormatSelect
              value={filmFormat}
              onChange={setFilmFormat}
              formats={MFS_FILM_FORMATS}
              disabled={paramsLocked}
            />
          </SidebarSection>

          {/* Stage 3: Develop & Contact Print */}
          <SidebarSection stageNumber={3} title="Develop & Contact Print" defaultOpen={true}>
            <div className="mfs-seed-row">
              <div className="mfs-field mfs-seed-field">
                <label htmlFor="seed" className="mfs-label">Seed</label>
                <input
                  id="seed"
                  type="number"
                  className="mfs-input"
                  value={seed}
                  onChange={(e) => setSeed(parseInt(e.target.value, 10) || 0)}
                  disabled={paramsLocked}
                />
              </div>
              <button
                type="button"
                className="mfs-random-btn"
                onClick={() => setSeed(generateRandomSeed())}
                disabled={paramsLocked}
                title="Random seed"
              >
                Random
              </button>
            </div>
            <button
              type="button"
              className="mfs-action-btn mfs-action-primary"
              onClick={handleExposeContactPrint}
              disabled={isGenerating || !prompt.trim() || paramsLocked}
            >
              {pipelineState === 'generating_contact' ? 'Exposing...' : 'Expose Contact Print'}
            </button>
          </SidebarSection>

          {/* Stage 4: Work Print */}
          <SidebarSection
            stageNumber={4}
            title="Work Print"
            disabled={!canPromote || pipelineState === 'generating_work'}
            defaultOpen={false}
          >
            <div className="mfs-field">
              <label htmlFor="upscale" className="mfs-label">Upscale Factor</label>
              <input
                id="upscale"
                type="number"
                className="mfs-input"
                value={upscaleFactor}
                onChange={(e) => setUpscaleFactor(parseFloat(e.target.value) || 1.5)}
                step={0.1}
                min={1}
                max={3}
                disabled={paramsLocked}
              />
            </div>
            <button
              type="button"
              className="mfs-action-btn"
              onClick={handlePromoteToWorkPrint}
              disabled={isGenerating || !contactPrintUrl}
            >
              {pipelineState === 'generating_work' ? 'Promoting...' : 'Promote to Work Print'}
            </button>
          </SidebarSection>

          {/* Stage 5: Scan / Digital C-Print */}
          <SidebarSection
            stageNumber={5}
            title="Scan / Digital C-Print"
            disabled={!canPromote || pipelineState === 'generating_final'}
            defaultOpen={false}
          >
            <button
              type="button"
              className="mfs-action-btn"
              onClick={handlePromoteToFinalPrint}
              disabled={isGenerating || !contactPrintUrl}
            >
              {pipelineState === 'generating_final' ? 'Promoting...' : 'Promote to Final Print'}
            </button>
            {!workPrintUrl && contactPrintUrl && (
              <p className="mfs-note">Skips Work Print stage</p>
            )}
          </SidebarSection>
        </div>

        {/* New Exposure button — visible after any stage completes */}
        {paramsLocked && !isGenerating && (
          <button
            type="button"
            className="mfs-new-exposure-btn"
            onClick={handleNewExposure}
          >
            New Exposure
          </button>
        )}

        {error && <div className="error-message">{error}</div>}
      </div>

      {/* ── Content Area ────────────────────────────────────────── */}
      <div className="mfs-content">
        <ProgressBar
          progress={progress}
          max={progressMax}
          status={status}
          isGenerating={isGenerating}
        />

        <StageTabs
          activeTab={activeTab}
          onTabChange={setActiveTab}
          enabledTabs={enabledTabs}
        />

        <ImageDisplay imageUrl={currentImageUrl} prompt={prompt} />
      </div>
    </div>
  );
}
