import os

from mirexplorer_chat.app import create_chat_app

if __name__ == "__main__":
	port = int(os.environ.get("CHAT_SERVICE_PORT", "8003"))
	create_chat_app().run(host="0.0.0.0", port=port, debug=os.environ.get("DEVELOPMENT_ENV") == "true")
