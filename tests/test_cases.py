from src.guardrails import detect_pii, route_query, verify_response

def test_pii_detection():
    assert detect_pii("My PAN is ABCDE1234F") == True
    assert detect_pii("Aadhaar 1234 5678 9012 here") == True
    assert detect_pii("What is the exit load?") == False

def test_query_routing():
    assert route_query("Should I buy this fund?") == "ADVICE"
    assert route_query("What returns will Axis ELSS give?") == "PERFORMANCE"
    assert route_query("What is the lock-in for ELSS?") == "FACTUAL"

def test_verify_response_valid():
    ans = "The lock in is 3 years. This is a fact. We are doing good."
    assert verify_response(ans) == True

def test_verify_response_with_decimals():
    ans = "The fund returned 15.5% last year. Rs. 50.00 is the minimum. This is a third sentence."
    assert verify_response(ans) == True

def test_verify_response_too_long():
    ans = "One. Two. Three. Four. Five."
    assert verify_response(ans) == False
