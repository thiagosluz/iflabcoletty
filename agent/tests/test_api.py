import pytest
import responses
import socket
from src.api_client import ApiClient
from src.config import API_BASE_URL

@responses.activate
def test_api_client_json_headers():
    """Verify that ApiClient sets JSON headers and the base URL correctly."""
    api = ApiClient()
    
    # Mocking endpoint
    url = f"{API_BASE_URL}/test_endpoint"
    responses.add(responses.GET, url, json={"status": "ok"}, status=200)
    
    response = api.get("/test_endpoint")
    
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
    assert api.session.headers['Accept'] == 'application/json'

@responses.activate
def test_agent_registration_payload(mocker):
    """Test the registration flow inside the AgentOrchestrator."""
    from main import AgentOrchestrator
    
    # Mock the api token loader to simulate an unregistered agent
    mocker.patch('src.api_client.ApiClient._load_token')
    
    # Mock INSTALLATION_TOKEN properly mapped in main
    mocker.patch('main.config.INSTALLATION_TOKEN', 'test_token_123')
    
    agent = AgentOrchestrator()
    agent.machine_id = "mock_machine_id"
    
    # Mock the decorators/functions
    mocker.patch('main.get_hardware_info', return_value={'cpu': 'mocked', 'network': []})
    mocker.patch('main.get_software_list', return_value=[])
    mocker.patch('socket.gethostname', return_value='MockComputer')
    
    # We expect a POST to /agents/register with specific JSON
    url = f"{API_BASE_URL}/agents/register"
    responses.add(
        responses.POST, 
        url, 
        json={"api_key": "new_fake_api_key", "computer_id": 999}, 
        status=201
    )
    
    # We must also mock the save_api_key so we don't write to disk during tests
    mocker.patch('src.security.save_api_key', return_value=True)

    result = agent.login()
    
    assert result is True
    assert len(responses.calls) == 1
    
    req_body = responses.calls[0].request.body.decode()
    assert 'test_token_123' in req_body
    assert 'mock_machine_id' in req_body
    assert 'MockComputer' in req_body
