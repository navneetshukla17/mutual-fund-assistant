import logging
from src.guardrails import detect_pii, route_query, verify_response
from src.vector_store import VectorStore
from src.llm import generate_response

SYSTEM_PROMPT = """You are a strictly factual Groww Mutual Fund Assistant, helping users with Axis Mutual Fund schemes. 
Answer ONLY from the provided context. Assume the context applies to the Axis scheme asked about.
If the answer is not in the context, reply exactly: "I couldn't find this in the official sources I have."
Your answer MUST be concise, maximum 3 sentences.
Never give investment advice. Never calculate returns.
Do not include any source URLs in your text.
"""

CONVERSATIONAL_PROMPT = """You are a friendly, helpful Groww Mutual Fund Assistant. 
The user is just chatting with you (e.g., saying hello, asking how you are, or asking what you can do).
Respond warmly and naturally in 1-2 sentences. Let them know you specialize in answering factual questions about Axis Mutual Fund schemes based on official documents. Do not provide financial advice."""

def extract_scheme(query: str) -> str:
    q = query.lower()
    if 'large cap' in q or 'bluechip' in q: return "Large Cap"
    if 'flexi cap' in q or 'flexicap' in q: return "Flexi Cap"
    if 'small cap' in q: return "Small Cap"
    if 'elss' in q or 'tax saver' in q: return "ELSS"
    if 'liquid' in q: return "Liquid"
    return None

def handle_query(query: str, vector_store: VectorStore) -> str:
    if detect_pii(query):
        return "Please do not share personal information like PAN or Aadhaar. I have not stored your message."
        
    route = route_query(query)
    if route == "ADVICE":
        return "I cannot provide investment advice. For educational material, visit: <a href='https://www.mutualfundssahihai.com/' target='_blank'>Mutual Funds Sahi Hai</a>"
    if route == "PERFORMANCE":
        return "I cannot forecast returns or discuss performance. Please refer to official scheme factsheets for historical data."
        
    try:
        if route == "CONVERSATIONAL":
            return generate_response(query, system_instruction=CONVERSATIONAL_PROMPT)
            
        scheme_filter = extract_scheme(query)
        
        results = vector_store.search(query, top_k=4, scheme_filter=scheme_filter)
        if not results or results[0]['distance'] > 1.2:
            return "I couldn't find this in the official sources I have."
            
        best_source = results[0]
        context_text = best_source['text']
        source_url = best_source['metadata'].get('url', '#')
        doc_date = best_source['metadata'].get('doc_date', 'Unknown')
        
        prompt = f"Context (official info):\n{context_text}\n\nQuestion: {query}"
        
        response = generate_response(prompt, system_instruction=SYSTEM_PROMPT)
        
        if "I couldn't find this" in response:
            return response
    
        if not verify_response(response):
            response = generate_response(prompt + "\n\nCRITICAL: Ensure max 3 sentences.", system_instruction=SYSTEM_PROMPT)
            if not verify_response(response) and "I couldn't find this" not in response:
                return "I couldn't find this in the official sources I have."
                
        if "I couldn't find this" in response:
            return response
            
        # Programmatically append clean citation
        citation = f"\n\n*Source: <a href='{source_url}' target='_blank'>Official Document</a> (Updated: {doc_date})*"
        return response + citation
        
    except Exception as e:
        logging.error(f"Error handling query: {e}")
        return "I'm currently experiencing technical difficulties. Please try again later."
