/**
 * Face tracker using MediaPipe Face Landmarker.
 * Detects face and mouth: when the user opens their mouth (lips separate),
 * the cursor is placed at the center of the mouth. While mouth is open,
 * head movement draws; when mouth is closed, drawing stops.
 */

import { FilesetResolver, FaceLandmarker } from '@mediapipe/tasks-vision';

// Mouth openness: vertical distance between upper and lower inner lip (normalized 0–1).
// Strict: only clearly open mouth triggers; closed = no tracking, no sound, no draw.
const MOUTH_OPEN_THRESHOLD = 0.041;  // Must exceed this to start (mouth clearly open) — ~30% lower
const MOUTH_CLOSE_THRESHOLD = 0.027; // Below this = closed, stop immediately

const WASM_BASE = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm';
const MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';

// Inner mouth: upper lip / lower lip (used for openness so closed = small distance).
const UPPER_LIP_INDEX = 13;
const LOWER_LIP_INDEX = 14;
// Full lip contour for mouth center (no nose/chin).
const LIP_INDICES = new Set([61, 291, 78, 308, 312, 317, 82, 87, 314, 84, 91, 181, 146, 13, 14]);
function ensureLipIndices() {
  if (LIP_INDICES.size > 10) return;
  try {
    const lipConnections = FaceLandmarker.FACE_LANDMARKS_LIPS || [];
    for (const conn of lipConnections) {
      LIP_INDICES.add(conn.start);
      LIP_INDICES.add(conn.end);
    }
  } catch (_) {}
}

let faceLandmarker = null;
let videoElement = null;
let lastVideoTime = -1;
let wasMouthOpen = false; // For hysteresis
let state = {
  mouthOpen: false,
  mouthCenterX: 0.5,
  mouthCenterY: 0.5,
  mouthOpenness: 0, // 0–1, lip separation (for bubble size)
  ready: false,
  error: null
};

/**
 * Compute mouth center and openness from face landmarks.
 * @param {Array} landmarks - NormalizedLandmark[] for one face
 * @returns {{ centerX: number, centerY: number, open: boolean }}
 */
function getMouthFromLandmarks(landmarks) {
  ensureLipIndices();
  if (!landmarks || landmarks.length < 20) {
    return { centerX: 0.5, centerY: 0.5, open: false };
  }
  const lipPoints = [];
  for (const i of LIP_INDICES) {
    if (i < landmarks.length && landmarks[i]) {
      lipPoints.push({ x: landmarks[i].x, y: landmarks[i].y });
    }
  }
  if (lipPoints.length === 0) {
    return { centerX: 0.5, centerY: 0.5, open: false };
  }
  let sumX = 0, sumY = 0, minY = 1, maxY = 0;
  for (const p of lipPoints) {
    sumX += p.x;
    sumY += p.y;
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
  }
  const centerX = sumX / lipPoints.length;
  const centerY = sumY / lipPoints.length;
  // Use inner-lip vertical distance (13 vs 14) so closed mouth is unambiguous.
  let verticalExtent = maxY - minY;
  if (landmarks.length > Math.max(UPPER_LIP_INDEX, LOWER_LIP_INDEX) &&
      landmarks[UPPER_LIP_INDEX] && landmarks[LOWER_LIP_INDEX]) {
    const upper = landmarks[UPPER_LIP_INDEX];
    const lower = landmarks[LOWER_LIP_INDEX];
    verticalExtent = Math.abs(lower.y - upper.y);
  }
  // Strict: only above OPEN = open; below CLOSE = closed; in-between = keep previous.
  let open;
  if (verticalExtent >= MOUTH_OPEN_THRESHOLD) {
    open = true;
  } else if (verticalExtent < MOUTH_CLOSE_THRESHOLD) {
    open = false;
  } else {
    open = wasMouthOpen;
  }
  wasMouthOpen = open;
  return { centerX, centerY, open, openness: verticalExtent };
}

/**
 * Initialize camera and FaceLandmarker. Call once after user gesture if needed.
 * @returns {Promise<{video: HTMLVideoElement, error?: string}>}
 */
export async function initFaceTracker() {
  if (state.ready && videoElement) {
    return { video: videoElement };
  }
  try {
    const vision = await FilesetResolver.forVisionTasks(WASM_BASE);
    faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
      baseOptions: { modelAssetPath: MODEL_URL },
      numFaces: 1,
      runningMode: 'VIDEO',
      minFaceDetectionConfidence: 0.5,
      minFacePresenceConfidence: 0.5
    });

    videoElement = document.createElement('video');
    videoElement.setAttribute('playsinline', '');
    videoElement.setAttribute('muted', '');
    videoElement.setAttribute('autoplay', '');
    videoElement.style.cssText = 'position:fixed;top:0;left:-9999px;width:640px;height:480px;opacity:0;pointer-events:none;';

    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: 640, height: 480 } });
    videoElement.srcObject = stream;
    await videoElement.play();
    document.body.appendChild(videoElement);

    state.ready = true;
    state.error = null;
    return { video: videoElement };
  } catch (err) {
    state.error = err.message || 'Face tracker failed';
    console.warn('Face tracker init failed:', err);
    return { video: null, error: state.error };
  }
}

/**
 * Update face state from the current video frame. Call every frame from p5 draw().
 * @param {HTMLVideoElement} video
 * @param {number} canvasWidth
 * @param {number} canvasHeight
 * @param {boolean} mirror - mirror X for front camera
 */
export function updateFaceTracker(video, canvasWidth, canvasHeight, mirror = true) {
  if (!faceLandmarker || !video || video.readyState < 2 || !canvasWidth || !canvasHeight) {
    state.mouthOpen = false;
    return;
  }

  const timeMs = performance.now();
  if (timeMs <= lastVideoTime) return;
  lastVideoTime = timeMs;

  try {
    const result = faceLandmarker.detectForVideo(video, timeMs);
    state.mouthOpen = false;
    state.mouthCenterX = 0.5;
    state.mouthCenterY = 0.5;

    if (result.faceLandmarks && result.faceLandmarks.length > 0) {
      const landmarks = result.faceLandmarks[0];
      const mouth = getMouthFromLandmarks(landmarks);
      state.mouthOpen = mouth.open;
      state.mouthCenterX = mouth.centerX;
      state.mouthCenterY = mouth.centerY;
      state.mouthOpenness = mouth.openness;
    } else {
      state.mouthOpenness = 0;
      wasMouthOpen = false; // No face: reset so next time we need to open again
    }
  } catch (e) {
    state.mouthOpen = false;
  }
}

/**
 * Get current face state for drawing.
 * Coordinates are normalized 0–1 (same space as video). Convert to canvas in sketch.
 */
export function getFaceState() {
  return {
    mouthOpen: state.mouthOpen,
    mouthCenterX: state.mouthCenterX,
    mouthCenterY: state.mouthCenterY,
    mouthOpenness: state.mouthOpenness,
    ready: state.ready,
    error: state.error
  };
}

/**
 * Map normalized mouth center (0–1) to canvas coordinates.
 */
export function mouthCenterToCanvas(mouthX, mouthY, width, height, mirror = true) {
  const x = mirror ? 1 - mouthX : mouthX;
  return {
    x: x * width,
    y: mouthY * height
  };
}

/**
 * Stop camera and cleanup.
 */
export function closeFaceTracker() {
  if (videoElement && videoElement.srcObject) {
    videoElement.srcObject.getTracks().forEach(t => t.stop());
    videoElement.srcObject = null;
  }
  if (videoElement && videoElement.parentNode) {
    videoElement.parentNode.removeChild(videoElement);
  }
  if (faceLandmarker) {
    faceLandmarker.close();
    faceLandmarker = null;
  }
  videoElement = null;
  wasMouthOpen = false;
  state = { mouthOpen: false, mouthCenterX: 0.5, mouthCenterY: 0.5, mouthOpenness: 0, ready: false, error: null };
}
