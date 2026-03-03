import requests
from typing import Dict, Any, Optional
from src import config

from src.utils.logger import setup_logger
from src.security import load_api_key

logger = setup_logger(__name__)

class ApiClient:
    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        })
        self.computer_id: Optional[int] = None
        self.api_key: Optional[str] = None
        self.base_url: str = config.API_BASE_URL
        self._load_token()

    def _load_token(self):
        api_key, computer_id = load_api_key()
        if api_key and computer_id:
            self.api_key = api_key
            self.computer_id = computer_id
            self.session.headers.update({'Authorization': f"Bearer {api_key}"})

    def request(self, method: str, endpoint: str, **kwargs) -> requests.Response:
        url = f"{config.API_BASE_URL}{endpoint}"
        try:
            response = self.session.request(method, url, timeout=config.REQUEST_TIMEOUT, **kwargs)
            return response
        except requests.exceptions.RequestException as e:
            logger.error(f"API Request failed to {url}: {e}")
            raise

    def post(self, endpoint: str, **kwargs) -> requests.Response:
        return self.request('POST', endpoint, **kwargs)

    def get(self, endpoint: str, **kwargs) -> requests.Response:
        return self.request('GET', endpoint, **kwargs)

    def put(self, endpoint: str, **kwargs) -> requests.Response:
        return self.request('PUT', endpoint, **kwargs)

    def patch(self, endpoint: str, **kwargs) -> requests.Response:
        return self.request('PATCH', endpoint, **kwargs)

    def delete(self, endpoint: str, **kwargs) -> requests.Response:
        return self.request('DELETE', endpoint, **kwargs)
