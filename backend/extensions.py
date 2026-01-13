from flask_caching import Cache
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from flask_vite import Vite

cache = Cache()
vite = Vite()
limiter = Limiter(
    key_func=get_remote_address,
    default_limits=["15 per hour"]
)
