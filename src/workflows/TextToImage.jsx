import React, { useState, useEffect, useRef } from 'react';
import PromptInput from '../components/PromptInput';
import NegativePromptInput from '../components/NegativePromptInput';
import ParameterControls from '../components/ParameterControls';
import ImageDisplay from '../components/ImageDisplay';
import ProgressBar from '../components/ProgressBar';
import {
  loadWorkflow,
  updateWorkflow,
  generateRandomSeed,
} from '../services/workflow-loader';
import {
  queuePrompt,
  connectWebSocket,
  getHistory,
  getImageUrl,
  generateClientId,
  checkServerStatus,
} from '../services/comfyui-api';
import { MODELS, MODEL_SETTINGS, DEFAULT_WIDTH, DEFAULT_HEIGHT } from '../utils/constants';
import './TextToImage.css';

export default function TextToImage() {
  // Form state
  const [prompt, setPrompt] = useState('');
  const [negativePromptEnabled, setNegativePromptEnabled] = useState(false);
  const [negativePrompt, setNegativePrompt] = useState('blurry, ugly, bad, text');
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const [height, setHeight] = useState(DEFAULT_HEIGHT);
  const [seed, setSeed] = useState(generateRandomSeed());
  const [model, setModel] = useState(MODELS.DISTILLED);
  const [steps, setSteps] = useState(MODEL_SETTINGS.DISTILLED.steps);
  const [cfg, setCfg] = useState(MODEL_SETTINGS.DISTILLED.cfg);

  // Generation state
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressMax, setProgressMax] = useState(0);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  // Result state
  const [generatedImageUrl, setGeneratedImageUrl] = useState('');

  // Refs
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

  // Update steps and cfg when model changes
  useEffect(() => {
    const isDistilled = model === MODELS.DISTILLED;
    const modelSettings = isDistilled ? MODEL_SETTINGS.DISTILLED : MODEL_SETTINGS.BASE;
    setSteps(modelSettings.steps);
    setCfg(modelSettings.cfg);
  }, [model]);

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      setError('Please enter a prompt');
      return;
    }

    setError('');
    setIsGenerating(true);
    setProgress(0);
    setProgressMax(0);
    setStatus('Checking server connection...');
    fetchingImageRef.current = false; // Reset flag for new generation

    try {
      // Check if server is running
      const isServerRunning = await checkServerStatus();
      if (!isServerRunning) {
        throw new Error(
          'ComfyUI server is not running. Please start the server at http://127.0.0.1:8188'
        );
      }

      // Load and update workflow
      setStatus('Loading workflow...');
      const baseWorkflow = await loadWorkflow();

      const updatedWorkflow = updateWorkflow(baseWorkflow, {
        prompt,
        negativePrompt: negativePromptEnabled ? negativePrompt : '',
        width,
        height,
        seed,
        model,
        steps,
        cfg,
      });

      // Queue the workflow first to get the prompt_id
      setStatus('Queueing workflow...');
      const result = await queuePrompt(updatedWorkflow, clientIdRef.current);

      if (result.node_errors && Object.keys(result.node_errors).length > 0) {
        throw new Error(
          `Workflow error: ${JSON.stringify(result.node_errors)}`
        );
      }

      // Store the prompt_id for later use
      promptIdRef.current = result.prompt_id;
      console.log('Queued prompt with ID:', result.prompt_id);

      // Connect WebSocket for progress updates
      setStatus('Connecting to server...');
      wsRef.current = connectWebSocket(clientIdRef.current, {
        onProgress: (value, max) => {
          setProgress(value);
          setProgressMax(max);
          setStatus('Generating image...');

          // Fallback: if we reach 100% progress, fetch the image after a short delay
          if (value === max && max > 0 && promptIdRef.current) {
            console.log('Progress reached 100%, scheduling image fetch...');
            setTimeout(() => {
              if (promptIdRef.current && isGenerating) {
                console.log('Fetching image via progress fallback');
                fetchGeneratedImage(promptIdRef.current);
              }
            }, 1000);
          }
        },
        onExecuting: (node, promptId) => {
          console.log('Executing node:', node, 'Prompt ID:', promptId);
          if (node === null && promptIdRef.current) {
            // Generation complete
            console.log('Generation complete, fetching image for prompt:', promptIdRef.current);
            setStatus('Processing results...');
            fetchGeneratedImage(promptIdRef.current);
          }
        },
        onExecuted: (data) => {
          console.log('Node executed:', data);
        },
        onError: (error) => {
          console.error('WebSocket error:', error);
          setError('Connection error. Please check if ComfyUI is running.');
          setIsGenerating(false);
        },
      });

      setStatus('Waiting for generation to start...');
    } catch (err) {
      console.error('Generation error:', err);
      setError(err.message || 'Failed to generate image');
      setIsGenerating(false);
      setStatus('');

      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    }
  };

  const fetchGeneratedImage = async (promptId) => {
    // Prevent duplicate fetches
    if (fetchingImageRef.current) {
      console.log('Already fetching image, skipping duplicate request');
      return;
    }

    fetchingImageRef.current = true;
    console.log('Fetching generated image for prompt:', promptId);

    try {
      const history = await getHistory(promptId);
      console.log('History response:', history);

      if (history[promptId] && history[promptId].outputs) {
        // Find the SaveImage node output
        const outputs = history[promptId].outputs;
        let imageInfo = null;

        for (const nodeId in outputs) {
          if (outputs[nodeId].images && outputs[nodeId].images.length > 0) {
            imageInfo = outputs[nodeId].images[0];
            break;
          }
        }

        if (imageInfo) {
          const imageUrl = getImageUrl(
            imageInfo.filename,
            imageInfo.subfolder,
            imageInfo.type
          );
          console.log('Image URL:', imageUrl);
          setGeneratedImageUrl(imageUrl);
          setStatus('Image generated successfully!');
        } else {
          throw new Error('No image found in outputs');
        }
      } else {
        throw new Error('No outputs found in history');
      }
    } catch (err) {
      console.error('Error fetching image:', err);
      setError('Failed to retrieve generated image');
    } finally {
      setIsGenerating(false);
      fetchingImageRef.current = false;
      setTimeout(() => setStatus(''), 3000);

      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    }
  };

  return (
    <div className="text-to-image">
      <div className="text-to-image-sidebar">
        <h1 className="app-title">Text to Image</h1>

        <form
          className="generation-form"
          onSubmit={(e) => {
            e.preventDefault();
            handleGenerate();
          }}
        >
          <PromptInput
            value={prompt}
            onChange={setPrompt}
            disabled={isGenerating}
          />

          <NegativePromptInput
            enabled={negativePromptEnabled}
            value={negativePrompt}
            onEnabledChange={setNegativePromptEnabled}
            onChange={setNegativePrompt}
            disabled={isGenerating}
          />

          <ParameterControls
            width={width}
            height={height}
            seed={seed}
            model={model}
            steps={steps}
            cfg={cfg}
            onWidthChange={setWidth}
            onHeightChange={setHeight}
            onSeedChange={setSeed}
            onModelChange={setModel}
            onStepsChange={setSteps}
            onCfgChange={setCfg}
            disabled={isGenerating}
          />

          <button
            type="submit"
            className="generate-button"
            disabled={isGenerating || !prompt.trim()}
          >
            {isGenerating ? 'Generating...' : 'Generate Image'}
          </button>

          {error && <div className="error-message">{error}</div>}
        </form>
      </div>

      <div className="text-to-image-content">
        <ProgressBar
          progress={progress}
          max={progressMax}
          status={status}
          isGenerating={isGenerating}
        />

        <ImageDisplay imageUrl={generatedImageUrl} prompt={prompt} />
      </div>
    </div>
  );
}
