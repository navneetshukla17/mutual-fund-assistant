import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
    LLM_MODEL = os.getenv("LLM_MODEL", "gemini-2.5-flash")
    EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "text-embedding-004")
    CHROMA_PERSIST_DIR = os.getenv("CHROMA_PERSIST_DIR", "data/chroma_db")
    RAW_DATA_DIR = os.getenv("RAW_DATA_DIR", "data/raw")

config = Config()
