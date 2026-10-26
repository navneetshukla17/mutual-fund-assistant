import re
from src.llm import generate_response

def detect_pii(text: str) -> bool:
    pan_pattern = r'[A-Z]{5}[0-9]{4}[A-Z]{1}'
    aadhaar_pattern = r'\b\d{4}\s?\d{4}\s?\d{4}\b'
    phone_pattern = r'\b[6-9]\d{9}\b'
    email_pattern = r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}'
    
    patterns = [pan_pattern, aadhaar_pattern, phone_pattern, email_pattern]
    return any(re.search(p, text) for p in patterns)

def route_query(query: str) -> str:
    prompt = f"""Classify the user's query into exactly one of these four categories:
1. CONVERSATIONAL: Greetings, small talk, asking what you can do, general pleasantries (e.g., 'hi', 'how are you', 'who are you').
2. ADVICE: Asking for investment advice, what to buy/sell, portfolio reviews, or recommendations.
3. PERFORMANCE: Asking for future return predictions, forecasting, or historical performance metrics.
4. FACTUAL: Asking specific factual questions about mutual funds, lock-in periods, exit loads, taxation, or how to use the platform.

Query: "{query}"

Output ONLY the category name (CONVERSATIONAL, ADVICE, PERFORMANCE, or FACTUAL)."""
    
    try:
        route = generate_response(prompt).strip().upper()
        if route in ["CONVERSATIONAL", "ADVICE", "PERFORMANCE", "FACTUAL"]:
            return route
        return "FACTUAL" # Default fallback
    except Exception:
        return "FACTUAL" # Fallback on error

def verify_response(response: str) -> bool:
    # Just check sentence length to keep it concise
    sentences = [s for s in re.split(r'(?<=[.!?])\s+', response.strip()) if s.strip()]
    if len(sentences) > 4: # Allowing max 3 + 1 buffer
        return False
    return True
