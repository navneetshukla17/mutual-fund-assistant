from google import genai
from google.genai import types
from src.config import config

def get_client():
    return genai.Client(api_key=config.GEMINI_API_KEY)

def generate_response(prompt: str, system_instruction: str = "") -> str:
    client = get_client()
    response = client.models.generate_content(
        model=config.LLM_MODEL,
        contents=prompt,
        config=types.GenerateContentConfig(
            temperature=0.0,
            system_instruction=system_instruction,
        ),
    )
    return response.text

def get_embedding(text: str) -> list[float]:
    client = get_client()
    result = client.models.embed_content(
        model=config.EMBEDDING_MODEL,
        contents=text,
    )
    return result.embeddings[0].values

def get_embeddings(texts: list[str]) -> list[list[float]]:
    # Naive loop since batching seems to combine contents
    return [get_embedding(t) for t in texts]

def transcribe_audio(audio_bytes: bytes, mime_type: str = "audio/webm") -> str:
    """
    Transcribes audio dynamically into English, Hindi, or mixed Hinglish using Gemini.
    Hindi is formatted in natural Devanagari script and English in English alphabet.
    """
    client = get_client()
    clean_mime = mime_type.split(";")[0].strip() if mime_type else "audio/webm"
    if not clean_mime:
        clean_mime = "audio/webm"

    prompt = (
        "You are an accurate, real-time speech-to-text transcriber for a mutual fund assistant. "
        "Transcribe the spoken audio verbatim. "
        "The speaker may speak in English, Hindi, or a natural mix of both (Hinglish). "
        "Dynamically detect and transcribe the spoken words in their spoken language without requiring a preset language switch. "
        "Format Hindi words in natural Devanagari script (e.g. म्यूचुअल फंड, एसआईपी, रिटर्न) and English words in Latin alphabet (e.g. Mutual Fund, SIP, NAV). "
        "Ensure financial terms are accurately transcribed. "
        "If the audio contains only ambient silence or unintelligible noise with no spoken words, respond with empty text. "
        "Output ONLY the verbatim transcription without any introductory text, labels, quotes, brackets, or explanations."
    )

    try:
        response = client.models.generate_content(
            model=config.LLM_MODEL,
            contents=[
                types.Part.from_bytes(
                    data=audio_bytes,
                    mime_type=clean_mime,
                ),
                prompt,
            ],
            config=types.GenerateContentConfig(
                temperature=0.0,
            ),
        )
        transcript = (response.text or "").strip()
        # Clean enclosing quotation marks if model returned them
        if len(transcript) >= 2 and ((transcript.startswith('"') and transcript.endswith('"')) or (transcript.startswith("'") and transcript.endswith("'"))):
            transcript = transcript[1:-1].strip()
        return transcript
    except Exception as e:
        print(f"Error in transcribe_audio: {e}")
        raise e

