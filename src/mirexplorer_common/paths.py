from pathlib import Path


def repo_root() -> Path:
	"""Repository root (parent of ``src/``)."""
	return Path(__file__).resolve().parents[2]
