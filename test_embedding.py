from google import genai
import os
from dotenv import load_dotenv

load_dotenv()

client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

try:
    result = client.models.embed_content(
        model="text-embedding-004",
        contents="Mutual funds are subject to market risks."
    )
    print("Success text-embedding-004!")
except Exception as e:
    print("Failed text-embedding-004:", e)

try:
    result = client.models.embed_content(
        model="models/embedding-001",
        contents="Mutual funds are subject to market risks."
    )
    print("Success models/embedding-001!")
except Exception as e:
    print("Failed models/embedding-001:", e)
