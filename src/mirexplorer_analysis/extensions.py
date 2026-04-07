import os

from dotenv import load_dotenv, find_dotenv

from flask_caching import Cache

load_dotenv(find_dotenv())
cache = Cache()
