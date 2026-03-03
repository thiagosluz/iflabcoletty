import pytest
from datetime import datetime, timezone, timedelta
from src.commands.parser import is_command_expired

def test_command_expiration_calculation():
    """Verify that commands older than max_age are correctly marked as expired."""
    # Arrange 1: A fresh command sent 10 seconds ago
    now = datetime.now(timezone.utc)
    fresh_time = now - timedelta(seconds=10)
    fresh_cmd = {
        'id': 1,
        'command': 'shutdown',
        'created_at': fresh_time.isoformat()
    }
    
    # Arrange 2: An old command sent 1 hour ago
    old_time = now - timedelta(hours=1)
    old_cmd = {
        'id': 2,
        'command': 'restart',
        'created_at': old_time.isoformat()
    }
    
    # Arrange 3: Malformed payload missing created_at
    bad_cmd = {'id': 3, 'command': 'malformed'}
    
    # Act & Assert
    assert is_command_expired(fresh_cmd, max_age_seconds=300) is False
    assert is_command_expired(old_cmd, max_age_seconds=300) is True
    assert is_command_expired(bad_cmd) is False  # Fails open if no time is provided
