import os

from dotenv import load_dotenv, find_dotenv

from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

load_dotenv(find_dotenv())
limiter = Limiter(
	key_func=get_remote_address,
	default_limits=["30 per hour"],
	storage_uri=os.environ["REDIS_URI"]
)
