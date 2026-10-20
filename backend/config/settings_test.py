"""Settings for pytest. Selects the test environment before the main settings load."""
import os

os.environ['DJANGO_ENV'] = 'test'

from .settings import *  # noqa: E402,F401,F403
