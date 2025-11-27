.PHONY: build install run

install:
	sudo apt update
	poetry lock
	poetry install --no-interaction
	cd frontend && npm install

build: install
	cd frontend && npx webpack

run: build
	cd mirexplorer && poetry run python app.py