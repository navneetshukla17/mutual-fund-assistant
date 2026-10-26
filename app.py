import os
import gradio as gr
from src.main import app, store
from src.agent import handle_query

def gradio_chat(message, history):
    return handle_query(message, store)

# Gradio Interface (accessible at /gradio)
demo = gr.ChatInterface(
    fn=gradio_chat,
    title="Axis Mutual Fund Assistant",
    description="Factual RAG assistant for Axis Mutual Fund schemes based on official documents."
)

# Mount Gradio onto the existing FastAPI app
# Root / serves your custom Material Web UI (with voice transcription)
# /gradio serves the Gradio ChatInterface
# /api/chat, /api/transcribe, /api/health are served directly by FastAPI
app = gr.mount_gradio_app(app, demo, path="/gradio")

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 7860))
    uvicorn.run("app:app", host="0.0.0.0", port=port, reload=False)
