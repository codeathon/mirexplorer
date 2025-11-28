.PHONY: build install run

install:
	@echo "Installing dependencies..."
	poetry lock
	poetry install --no-interaction
	flask vite install

dev: install
	@echo "Starting frontend + backend..."
	@trap "kill 0" EXIT; \
		flask vite start & \
		flask run --debug