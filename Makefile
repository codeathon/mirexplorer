.PHONY: dev install build start

# Install dependencies
install:
	@echo "Installing dependencies..."
	poetry lock
	poetry install --no-interaction
	cd frontend && npm install

# Development (local only)
dev: install
	@echo "Starting frontend + backend for development..."
	@trap "kill 0" EXIT; \
	   cd frontend && npm run dev & \
	   poetry run python app.py

# Build frontend for production
build: install
	@echo "Building frontend for production..."
	cd frontend && npm run build

# Start backend for production (after build)
prod:
	@echo "Starting Flask backend (production)..."
	# Render provides $PORT
	poetry run gunicorn app:app --bind 0.0.0.0:$(PORT)
