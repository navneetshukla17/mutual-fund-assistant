try:
    import spaces
except ImportError:
    class spaces:
        @staticmethod
        def GPU(func=None, **kwargs):
            if func is None:
                return lambda f: f
            return func

import os
import gradio as gr
from src.main import app, store
from src.agent import handle_query

# 1. ZeroGPU Probe function required for ZeroGPU startup check
@spaces.GPU
def _zero_gpu_probe():
    return True

# 2. Main inference function decorated with @spaces.GPU
@spaces.GPU
def gradio_chat(message, history):
    return handle_query(message, store)

# 3. Gradio Blocks with explicit event binding so ZeroGPU event scanner registers it
with gr.Blocks(title="Axis Mutual Fund Assistant") as demo:
    gr.Markdown("### Axis Mutual Fund Assistant\nFactual RAG assistant for Axis Mutual Fund schemes.")
    chatbot = gr.ChatInterface(fn=gradio_chat)
    dummy_btn = gr.Button("Probe", visible=False)
    dummy_btn.click(fn=_zero_gpu_probe, outputs=[])

# Mount Gradio onto the existing FastAPI app
# Root / continues to serve your custom Material Web UI (with voice transcription)
# /gradio serves the Gradio ChatInterface
# /api/chat, /api/transcribe, /api/health are served directly by FastAPI
app = gr.mount_gradio_app(app, demo, path="/gradio")

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 7860))
    uvicorn.run(app, host="0.0.0.0", port=port, reload=False)
