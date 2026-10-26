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
from src.agent import handle_query
from src.main import store

# Inference function decorated with @spaces.GPU for Hugging Face ZeroGPU
@spaces.GPU
def chat_fn(message, history):
    return handle_query(message, store)

# Built-in Gradio ChatInterface
demo = gr.ChatInterface(
    fn=chat_fn,
    title="Axis Mutual Fund Assistant",
    description="Factual RAG assistant for Axis Mutual Fund schemes (Large Cap, Flexi Cap, Small Cap, ELSS, Liquid).",
    examples=[
        "What is the exit load for Axis Bluechip Fund?",
        "What is the lock-in period for Axis ELSS Tax Saver Fund?",
        "What is the minimum SIP investment for Axis Small Cap Fund?"
    ]
)

if __name__ == "__main__":
    demo.launch()
