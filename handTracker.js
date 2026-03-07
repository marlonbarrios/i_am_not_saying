/**
 * Hand tracker using MediaPipe Hands.
 * Tracks both hands and detects pinch gesture (thumb + index tip close).
 * Pinch position is used for drawing in place of mouse.
 */

import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';

// MediaPipe hand landmark indices
const THUMB_TIP = 4;
const INDEX_TIP = 8;

// Pinch threshold (normalized distance 0–1). Smaller = tighter pinch.
const PINCH_THRESHOLD = 0.08;

const WASM_BASE = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm';
const MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';

let handLandmarker = null;
let videoElement = null;
let lastVideoTime = -1;
let state = {
  isPinching: false,
  pinchX: 0.5,
  pinchY: 0.5,
  ready: false,
  error: null
};

/**
 * Initialize camera and HandLandmarker. Call once after user gesture if needed.
 * @returns {Promise<{video: HTMLVideoElement, error?: string}>}
 */
export async function initHandTracker() {
  if (state.ready && videoElement) {
    return { video: videoElement };
  }
  try {
    const vision = await FilesetResolver.forVisionTasks(WASM_BASE);
    handLandmarker = await HandLandmarker.createFromOptions(vision, {
      baseOptions: { modelAssetPath: MODEL_URL },
      numHands: 2,
      runningMode: 'VIDEO'
    });

    videoElement = document.createElement('video');
    videoElement.setAttribute('playsinline', '');
    videoElement.setAttribute('muted', '');
    videoElement.setAttribute('autoplay', '');
    // Keep off-screen but give real size so the stream decodes and can be drawn to canvas
    videoElement.style.cssText = 'position:fixed;top:0;left:-9999px;width:640px;height:480px;opacity:0;pointer-events:none;';

    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: 640, height: 480 } });
    videoElement.srcObject = stream;
    await videoElement.play();
    document.body.appendChild(videoElement);

    state.ready = true;
    state.error = null;
    return { video: videoElement };
  } catch (err) {
    state.error = err.message || 'Hand tracker failed';
    console.warn('Hand tracker init failed:', err);
    return { video: null, error: state.error };
  }
}

/**
 * Update hand state from the current video frame. Call every frame from p5 draw().
 * @param {HTMLVideoElement} video
 * @param {number} canvasWidth
 * @param {number} canvasHeight
 * @param {boolean} mirror - mirror X for front camera
 */
export function updateHandTracker(video, canvasWidth, canvasHeight, mirror = true) {
  if (!handLandmarker || !video || video.readyState < 2 || !canvasWidth || !canvasHeight) {
    state.isPinching = false;
    return;
  }

  const timeMs = performance.now();
  if (timeMs <= lastVideoTime) return;
  lastVideoTime = timeMs;

  try {
    const result = handLandmarker.detectForVideo(video, timeMs);
    state.isPinching = false;
    state.pinchX = 0.5;
    state.pinchY = 0.5;

    if (result.landmarks && result.landmarks.length > 0) {
      for (const landmarks of result.landmarks) {
        if (landmarks.length <= Math.max(THUMB_TIP, INDEX_TIP)) continue;
        const thumb = landmarks[THUMB_TIP];
        const index = landmarks[INDEX_TIP];
        const dx = thumb.x - index.x;
        const dy = thumb.y - index.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < PINCH_THRESHOLD) {
          state.isPinching = true;
          state.pinchX = (thumb.x + index.x) / 2;
          state.pinchY = (thumb.y + index.y) / 2;
          break;
        }
      }
    }
  } catch (e) {
    state.isPinching = false;
  }
}

/**
 * Get current hand state for drawing.
 * Coordinates are normalized 0–1 (same space as video). Convert to canvas in sketch.
 */
export function getHandState() {
  return {
    isPinching: state.isPinching,
    pinchX: state.pinchX,
    pinchY: state.pinchY,
    ready: state.ready,
    error: state.error
  };
}

/**
 * Map normalized pinch (0–1) to canvas coordinates.
 */
export function pinchToCanvas(pinchX, pinchY, width, height, mirror = true) {
  const x = mirror ? 1 - pinchX : pinchX;
  return {
    x: x * width,
    y: pinchY * height
  };
}

/**
 * Stop camera and cleanup.
 */
export function closeHandTracker() {
  if (videoElement && videoElement.srcObject) {
    videoElement.srcObject.getTracks().forEach(t => t.stop());
    videoElement.srcObject = null;
  }
  if (videoElement && videoElement.parentNode) {
    videoElement.parentNode.removeChild(videoElement);
  }
  if (handLandmarker) {
    handLandmarker.close();
    handLandmarker = null;
  }
  videoElement = null;
  state = { isPinching: false, pinchX: 0.5, pinchY: 0.5, ready: false, error: null };
}
