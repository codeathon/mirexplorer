import os

from mirexplorer_analysis.app import create_analysis_app

if __name__ == "__main__":
	port = int(os.environ.get("ANALYSIS_SERVICE_PORT", "8002"))
	create_analysis_app().run(host="0.0.0.0", port=port, debug=os.environ.get("DEVELOPMENT_ENV") == "true")
