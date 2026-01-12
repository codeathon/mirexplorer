.PHONY: build install run

install:
	@echo "Installing dependencies..."
	poetry lock
	poetry install --no-interaction
	poetry run flask vite install

dev: install
	@echo "Starting frontend + backend..."
	@trap "kill 0" EXIT; \
		poetry run flask vite start & \
		poetry run python app.py