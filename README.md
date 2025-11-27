# MIRExplorer

Currently a barebones Flask app using Flask, Bootstrap (v5.3.0) and jQuery (v3.6.3).

Make sure you have Python and poetry installed.

```sh
git clone https://github.com/musicinformationretrieval/mirexplorer.git
cd mirexplorer
poetry install
cd mirexplorer/frontend
npm install
cd ../..
poetry run python mirexplorer/app.py
```

Your app should now be running on [localhost:5000](http://localhost:5000/).
