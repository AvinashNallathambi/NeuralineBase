"""
Neuraline EMR — Whisper Speech-to-Text Microservice

Lightweight FastAPI service wrapping faster-whisper for medical
encounter transcription.  Runs the 'base' model on CPU by default
(good accuracy/speed trade-off for development).

Environment variables
---------------------
WHISPER_MODEL   Model size: tiny | base | small | medium | large-v3
                Default: base
WHISPER_DEVICE  Compute device: cpu | cuda
                Default: cpu
"""

from __future__ import annotations

import io
import os
import tempfile
import time
from pathlib import Path

from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.responses import JSONResponse

app = FastAPI(title="Neuraline Whisper Service", version="1.0.0")

# ---------------------------------------------------------------------------
# Lazy-load the model on first request so the container starts fast
# ---------------------------------------------------------------------------
_model = None

MODEL_SIZE = os.getenv("WHISPER_MODEL", "base")
DEVICE = os.getenv("WHISPER_DEVICE", "cpu")
COMPUTE_TYPE = "int8" if DEVICE == "cpu" else "float16"


def _get_model():
    global _model
    if _model is None:
        from faster_whisper import WhisperModel

        print(f"[whisper] Loading model '{MODEL_SIZE}' on {DEVICE} ({COMPUTE_TYPE})…")
        _model = WhisperModel(MODEL_SIZE, device=DEVICE, compute_type=COMPUTE_TYPE)
        print("[whisper] Model loaded.")
    return _model


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------
@app.get("/", tags=["health"])
async def root():
    return {"service": "whisper", "status": "ok", "model": MODEL_SIZE, "device": DEVICE}


@app.get("/health", tags=["health"])
async def health():
    return {"status": "healthy", "model_loaded": _model is not None}


@app.post("/transcribe", tags=["transcription"])
async def transcribe(file: UploadFile = File(...)):
    """
    Transcribe an uploaded audio file (WAV, MP3, M4A, WEBM, etc.)
    and return the full text plus timestamped segments.
    """
    if not file.filename:
        raise HTTPException(status_code=400, detail="No filename provided")

    content = await file.read()
    if len(content) == 0:
        raise HTTPException(status_code=400, detail="Empty file")

    # Write to a temp file because faster-whisper reads from disk
    suffix = Path(file.filename).suffix or ".wav"
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        tmp.write(content)
        tmp_path = tmp.name

    try:
        model = _get_model()
        start = time.time()

        # First try with VAD filter for better results on speech audio
        try:
            segments_iter, info = model.transcribe(
                tmp_path,
                beam_size=5,
                language=None,  # auto-detect
                vad_filter=True,  # skip silence
            )

            segments = []
            full_text_parts = []
            for seg in segments_iter:
                segments.append(
                    {
                        "start": round(seg.start, 2),
                        "end": round(seg.end, 2),
                        "text": seg.text.strip(),
                    }
                )
                full_text_parts.append(seg.text.strip())
        except Exception:
            # VAD filter can fail on certain audio (e.g. pure tones);
            # retry without it
            segments_iter, info = model.transcribe(
                tmp_path,
                beam_size=5,
                language=None,
                vad_filter=False,
            )

            segments = []
            full_text_parts = []
            for seg in segments_iter:
                segments.append(
                    {
                        "start": round(seg.start, 2),
                        "end": round(seg.end, 2),
                        "text": seg.text.strip(),
                    }
                )
                full_text_parts.append(seg.text.strip())

        elapsed = round(time.time() - start, 2)

        return JSONResponse(
            {
                "text": " ".join(full_text_parts),
                "segments": segments,
                "language": info.language,
                "language_probability": round(info.language_probability, 3),
                "duration": round(info.duration, 2),
                "processing_time": elapsed,
            }
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Transcription failed: {exc}")
    finally:
        os.unlink(tmp_path)
