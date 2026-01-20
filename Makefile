.PHONY: dev install

install:
	@echo "Installing dependencies..."
	poetry lock
	poetry install --no-interaction
	cd frontend && npm install

dev: install
	@echo "Starting frontend + backend..."
	@trap "kill 0" EXIT; \
	   cd frontend && npm run dev & \
	   poetry run python app.py