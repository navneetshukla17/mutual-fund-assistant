import base64
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient
from src.main import app
from src.llm import transcribe_audio

client = TestClient(app)

def test_transcribe_endpoint_empty():
    response = client.post("/api/transcribe", json={"audio": "", "mime_type": "audio/webm"})
    assert response.status_code == 200
    assert response.json() == {"transcript": ""}

def test_transcribe_endpoint_short_bytes():
    # Audio with negligible length (< 100 bytes)
    short_data = base64.b64encode(b"too_short").decode("utf-8")
    response = client.post("/api/transcribe", json={"audio": short_data, "mime_type": "audio/webm"})
    assert response.status_code == 200
    assert response.json() == {"transcript": ""}

@patch("src.main.transcribe_audio")
def test_transcribe_endpoint_success(mock_transcribe):
    mock_transcribe.return_value = "म्यूचुअल फंड में एसआईपी क्या है?"
    dummy_audio = base64.b64encode(b"a" * 200).decode("utf-8")
    response = client.post("/api/transcribe", json={"audio": dummy_audio, "mime_type": "audio/webm"})
    assert response.status_code == 200
    assert response.json() == {"transcript": "म्यूचुअल फंड में एसआईपी क्या है?"}
    mock_transcribe.assert_called_once()

@patch("src.llm.get_client")
def test_transcribe_audio_quotes_strip(mock_get_client):
    mock_model_response = MagicMock()
    mock_model_response.text = '"Axis Small Cap Fund returns"'
    
    mock_genai_client = MagicMock()
    mock_genai_client.models.generate_content.return_value = mock_model_response
    mock_get_client.return_value = mock_genai_client

    result = transcribe_audio(b"dummy_bytes", "audio/webm")
    assert result == "Axis Small Cap Fund returns"
