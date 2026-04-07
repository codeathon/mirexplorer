.PHONY: dev install build start

# Install dependencies
install:
	@echo "Installing dependencies..."
	poetry lock
	poetry install --no-interaction
	cd frontend && npm install

# Development (local only): starts audio, analysis, chat, Vite, then the Flask gateway (BFF).
dev: build
	@echo "Starting microservices + frontend + gateway..."
	@echo "Ensure .env sets INTERNAL_SERVICE_TOKEN and AUDIO_/ANALYSIS_/CHAT_SERVICE_URL."
	@trap "kill 0" EXIT; \
	   poetry run python -m mirexplorer_audio & \
	   poetry run python -m mirexplorer_analysis & \
	   poetry run python -m mirexplorer_chat & \
	   sleep 2; \
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
	poetry run gunicorn app:app --bind 0.0.0.0:$(PORT) --timeout 240
