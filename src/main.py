import os
import base64
from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel
from src.agent import handle_query
from src.vector_store import VectorStore
from src.llm import transcribe_audio

app = FastAPI()
store = VectorStore()

# Ensure dist exists so FastAPI doesn't crash on startup if not built yet
os.makedirs("frontend/dist", exist_ok=True)

class ChatRequest(BaseModel):
    message: str

@app.get("/api/health")
def health_endpoint():
    return {"status": "ok", "app": "mutual-fund-assistant"}

@app.post("/api/chat")
def chat_endpoint(request: ChatRequest):
    response_text = handle_query(request.message, store)
    return {"reply": response_text}

@app.post("/api/transcribe")
async def transcribe_endpoint(request: Request):
    content_type = request.headers.get("content-type", "")
    try:
        if "application/json" in content_type:
            data = await request.json()
            audio_b64 = data.get("audio", "")
            mime_type = data.get("mime_type", "audio/webm")
            if not audio_b64:
                return {"transcript": ""}
            audio_bytes = base64.b64decode(audio_b64)
        else:
            audio_bytes = await request.body()
            mime_type = content_type or "audio/webm"

        if not audio_bytes or len(audio_bytes) < 100:
            return {"transcript": ""}

        transcript = transcribe_audio(audio_bytes, mime_type)
        return {"transcript": transcript}
    except Exception as e:
        print(f"Transcription error in endpoint: {e}")
        return JSONResponse(status_code=500, content={"error": str(e), "transcript": ""})

app.mount("/", StaticFiles(directory="frontend/dist", html=True), name="static")